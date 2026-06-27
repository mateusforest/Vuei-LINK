import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import { countUsefulFlightFields, requestFlightExtraction } from "@/lib/ai/flight-extraction"
import { estimateCostUsd, getTicketExtractionCreditCost } from "@/lib/ai/credit-consumption"
import { createAiUsageLog } from "@/lib/ai/usage-logs"
import { consumeTravelerCredits, getTravelerCreditBalance } from "@/lib/billing/traveler-billing"
import { consumeAgencyCredits, getAgencyCreditBalance } from "@/lib/billing/agency-billing"
import { hasAgencyMutationAccess, resolveTripLinkAccess } from "@/lib/security/trip-link-access"

interface FlightExtractionRequestBody {
  tripId?: string
  documentId?: string
  flightId?: string
  tripSlug?: string
  adminToken?: string
}

type JsonObject = Record<string, unknown>
type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type TripFlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]

async function getTripByAdminAccess(
  client: ReturnType<typeof createSupabaseAdminClient>,
  payload: { tripId: string; tripSlug?: string | null; adminToken?: string | null },
) {
  const accessResult = await resolveTripLinkAccess(client, {
    tripId: payload.tripId,
    tripSlug: payload.tripSlug,
    adminToken: payload.adminToken,
    accessMode: "admin",
  })

  return {
    trip: accessResult.trip,
    membership: null as AgencyMemberRow | null,
    error: accessResult.error ?? (accessResult.trip ? null : "Voc? n?o tem permiss?o para processar esta passagem."),
  }
}

async function getProfile(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, agency_id, email, name")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { data: null as ProfileRow | null, error: error.message }
  }

  return { data: data as ProfileRow | null, error: null }
}

async function getAccessibleTrip(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  tripId: string,
  profile: ProfileRow | null,
) {
  const tripResult = await client
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle()

  if (tripResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: tripResult.error.message }
  }

  const trip = tripResult.data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem n?o ?ncontrada." }
  }

  if (profile?.role === "master") {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (trip.owner_user_id === userId) {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (!trip.agency_id) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para processar esta passagem." }
  }

  const membershipResult = await client
    .from("agency_members")
    .select("*")
    .eq("agency_id", trip.agency_id)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (membershipResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: membershipResult.error.message }
  }

  if (!membershipResult.data) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para processar esta passagem." }
  }

  if (!hasAgencyMutationAccess(membershipResult.data.role)) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para processar esta passagem." }
  }

  return { trip, membership: membershipResult.data as AgencyMemberRow, error: null }
}

async function getCreditsBalance(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  ownerType: "traveler" | "agency",
  ownerId: string,
) {
  if (ownerType === "traveler") {
    const adminClient = createSupabaseAdminClient()
    const result = await getTravelerCreditBalance(adminClient, ownerId)
    return { balance: result.data?.totalAvailable ?? 0, error: result.error }
  }

  if (ownerType === "agency") {
    const adminClient = createSupabaseAdminClient()
    const result = await getAgencyCreditBalance(adminClient, ownerId)
    return { balance: result.data?.totalAvailable ?? 0, error: result.error }
  }

  const { data, error } = await client.from("profiles").select("credits_balance").eq("id", ownerId).maybeSingle()
  return { balance: data?.credits_balance ?? 0, error: error?.message ?? null }
}

async function getFlightAndDocument(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  tripId: string,
  flightId: string,
  documentId: string,
) {
  const flightResult = await client
    .from("trip_flights")
    .select("*")
    .eq("id", flightId)
    .eq("trip_id", tripId)
    .maybeSingle()

  if (flightResult.error) {
    return {
      flight: null as TripFlightRow | null,
      document: null as DocumentRow | null,
      error: flightResult.error.message,
    }
  }

  if (!flightResult.data) {
    return {
      flight: null as TripFlightRow | null,
      document: null as DocumentRow | null,
      error: "Registro da passagem n?o ?ncontrado.",
    }
  }

  const documentResult = await client
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("trip_id", tripId)
    .maybeSingle()

  if (documentResult.error) {
    return {
      flight: null as TripFlightRow | null,
      document: null as DocumentRow | null,
      error: documentResult.error.message,
    }
  }

  if (!documentResult.data) {
    return {
      flight: null as TripFlightRow | null,
      document: null as DocumentRow | null,
      error: "Documento da passagem n?o ?ncontrado.",
    }
  }

  return {
    flight: flightResult.data as TripFlightRow,
    document: documentResult.data as DocumentRow,
    error: null,
  }
}

async function updateFlightRecord(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  flightId: string,
  payload: Database["public"]["Tables"]["trip_flights"]["Update"],
) {
  const { data, error } = await client
    .from("trip_flights")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", flightId)
    .select("*")
    .single()

  return { data: data as TripFlightRow | null, error: error?.message ?? null }
}

async function updateDocumentExtractionData(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  documentId: string,
  metadata: JsonObject,
) {
  const { data, error } = await client
    .from("documents")
    .update({
      ai_extracted_data: metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select("*")
    .single()

  return { data: data as DocumentRow | null, error: error?.message ?? null }
}

function isPartialFlightExtraction(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return false

  const requiredFields = [
    payload.airline,
    payload.flight_number,
    payload.origin_airport,
    payload.destination_airport,
    payload.departure_at,
  ]

  const filledRequiredFields = requiredFields.filter((value) => typeof value === "string" && value.trim().length > 0).length
  return filledRequiredFields > 0 && filledRequiredFields < requiredFields.length
}

function sanitizeFlightText(value: unknown) {
  if (typeof value !== "string") return null

  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeQrCodePayload(value: unknown) {
  if (typeof value !== "string") return null

  const normalized = value.replace(/\s+/g, "").trim()
  return normalized || null
}

function normalizeExtractedDateTime(value: unknown, rawText: unknown) {
  const normalizedValue = sanitizeFlightText(value)
  const candidates = [normalizedValue, sanitizeFlightText(rawText)].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    if (/^\d{1,2}:\d{2}$/.test(candidate)) {
      return candidate.padStart(5, "0")
    }

    const isoDateOnlyMatch = candidate.match(/^(\d{4}-\d{2}-\d{2})$/)
    if (isoDateOnlyMatch) {
      return isoDateOnlyMatch[1]
    }

    const isoDateTimeMatch = candidate.match(/^(\d{4}-\d{2}-\d{2})[tT ](\d{1,2}):(\d{2})(?::(\d{2}))?([zZ]|[+-]\d{2}:\d{2})?$/)
    if (isoDateTimeMatch) {
      const [, datePart, hourPart, minutePart, secondPart, timezonePart] = isoDateTimeMatch
      const normalizedHour = hourPart.padStart(2, "0")
      const normalizedSecond = secondPart ?? "00"
      return `${datePart}T${normalizedHour}:${minutePart}:${normalizedSecond}${timezonePart ?? ""}`
    }

    const localizedDateTimeMatch = candidate.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?:\s+|[tT-])(\d{1,2}):(\d{2})$/)
    if (localizedDateTimeMatch) {
      const [, dayPart, monthPart, yearPart, hourPart, minutePart] = localizedDateTimeMatch
      if (yearPart) {
        const normalizedYear = yearPart.length === 2 ? `20${yearPart}` : yearPart
        const normalizedMonth = monthPart.padStart(2, "0")
        const normalizedDay = dayPart.padStart(2, "0")
        const normalizedHour = hourPart.padStart(2, "0")
        return `${normalizedYear}-${normalizedMonth}-${normalizedDay}T${normalizedHour}:${minutePart}:00`
      }

      return `${hourPart.padStart(2, "0")}:${minutePart}`
    }

    const embeddedTimeMatch = candidate.match(/\b(\d{1,2}):(\d{2})\b/)
    if (embeddedTimeMatch) {
      return `${embeddedTimeMatch[1].padStart(2, "0")}:${embeddedTimeMatch[2]}`
    }
  }

  return null
}

function hasStoredUsefulFlightData(flight: TripFlightRow | null) {
  if (!flight) return false

  const extractedData =
    flight.extracted_data && typeof flight.extracted_data === "object"
      ? (flight.extracted_data as JsonObject)
      : null
  const structuredResult =
    extractedData?.structured_result && typeof extractedData.structured_result === "object"
      ? (extractedData.structured_result as JsonObject)
      : extractedData

  return Boolean(
    sanitizeFlightText(flight.airline) ||
      sanitizeFlightText(flight.flight_number) ||
      sanitizeFlightText(flight.origin_airport) ||
      sanitizeFlightText(flight.destination_airport) ||
      sanitizeFlightText(flight.departure_at) ||
      sanitizeFlightText(flight.arrival_at) ||
      sanitizeFlightText(flight.booking_reference) ||
      sanitizeFlightText(flight.passenger_name) ||
      sanitizeFlightText(structuredResult?.airline) ||
      sanitizeFlightText(structuredResult?.flight_number) ||
      sanitizeFlightText(structuredResult?.origin_airport) ||
      sanitizeFlightText(structuredResult?.destination_airport) ||
      sanitizeFlightText(structuredResult?.departure_at) ||
      sanitizeFlightText(structuredResult?.arrival_at) ||
      sanitizeFlightText(structuredResult?.booking_reference) ||
      sanitizeFlightText(structuredResult?.passenger_name)
  )
}

async function markFlightFailed(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  flightId: string,
  documentId: string,
  reason: string,
  metadata: JsonObject,
) {
  const extractionData = {
    ...metadata,
    failure_reason: reason,
    processed_at: new Date().toISOString(),
  }

  const flightUpdate = await updateFlightRecord(client, flightId, {
    extraction_status: "failed",
    airline: null,
    flight_number: null,
    booking_reference: null,
    origin_airport: null,
    destination_airport: null,
    departure_at: null,
    arrival_at: null,
    passenger_name: null,
    qr_code_payload: null,
    baggage_info: null,
    terminal: null,
    gate: null,
    seat: null,
    extracted_data: extractionData,
  })

  const documentUpdate = await updateDocumentExtractionData(client, documentId, extractionData)

  return {
    flight: flightUpdate.data,
    document: documentUpdate.data,
    error: flightUpdate.error || documentUpdate.error,
  }
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json(
      { error: "A extra??o operacional real de passagens so fica dispon?vel quando o Supabase estiver ativo." },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => null)) as FlightExtractionRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const documentId = body?.documentId?.trim?.()
  const flightId = body?.flightId?.trim?.()
  const tripSlug = body?.tripSlug?.trim?.() ?? null
  const adminToken = body?.adminToken?.trim?.() ?? null

  if (!tripId || !documentId || !flightId) {
    return NextResponse.json({ error: "Trip, document e flight sao obrigatorios para processar a passagem." }, { status: 400 })
  }

  const adminAccessRequested = Boolean(adminToken || tripSlug)
  if (adminAccessRequested && !hasSupabaseAdminEnv()) {
    console.error("[AI][FLIGHT_EXTRACTION] missing admin env", {
      tripId,
      tripSlug,
      hasAdminToken: Boolean(adminToken),
      hasPublicSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      hasServiceRoleKey: Boolean(
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SECRET_KEY,
      ),
    })

    return NextResponse.json(
      { error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." },
      { status: 503 },
    )
  }

  const supabase = adminAccessRequested ? createSupabaseAdminClient() : await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indispon?vel." }, { status: 503 })
  }

  let actingUserId: string | null = null
  let accessResult: Awaited<ReturnType<typeof getAccessibleTrip>> | Awaited<ReturnType<typeof getTripByAdminAccess>>

  if (adminAccessRequested) {
    accessResult = await getTripByAdminAccess(supabase, { tripId, tripSlug, adminToken })
    actingUserId = accessResult.trip?.owner_user_id ?? null
  } else {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: "Entre para processar passagens reais desta viagem." }, { status: 401 })
    }

    const profileResult = await getProfile(supabase, user.id)
    if (!profileResult.data) {
      return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario n?o ?ncontrado." }, { status: 403 })
    }

    accessResult = await getAccessibleTrip(supabase, user.id, tripId, profileResult.data)
    actingUserId = user.id
  }
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem n?o ?ncontrada." }, { status: 403 })
  }

  const entityResult = await getFlightAndDocument(supabase, tripId, flightId, documentId)
  if (!entityResult.flight || !entityResult.document) {
    return NextResponse.json({ error: entityResult.error ?? "Passagem n?o ?ncontrada." }, { status: 404 })
  }

  const alreadyExtractedSuccessfully =
    (entityResult.flight.extraction_status === "completed" || entityResult.flight.extraction_status === "manual") &&
    hasStoredUsefulFlightData(entityResult.flight)

  if (alreadyExtractedSuccessfully) {
    console.info("[AI][FLIGHT_EXTRACTION] reusing existing extraction", {
      tripId,
      documentId,
      flightId,
      strategy: "existing_flight_data",
      status: entityResult.flight.extraction_status,
    })

    return NextResponse.json({
      flight: entityResult.flight,
      document: entityResult.document,
    })
  }

  if (entityResult.document.type !== "ticket") {
    const failed = await markFlightFailed(
      supabase,
      entityResult.flight.id,
      entityResult.document.id,
      "O documento anexado n?o ?sta classificado como passagem aerea.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
        document_type: entityResult.document.type,
      },
    )

    return NextResponse.json(
      {
        error: "O documento informado n?o ? uma passagem.",
        flight: failed.flight,
        document: failed.document,
      },
      { status: 400 }
    )
  }

  const ownerType = accessResult.trip.agency_id ? "agency" : "traveler"
  const ownerId = ownerType === "agency" ? accessResult.trip.agency_id : actingUserId

  if (!ownerId) {
    return NextResponse.json({ error: "N?o foi poss?vel identificar o saldo responsavel por esta extra??o." }, { status: 400 })
  }

  const balanceResult = await getCreditsBalance(supabase, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }

  const creditsPerCall = getTicketExtractionCreditCost()
  if ((balanceResult.balance ?? 0) < creditsPerCall) {
    const failed = await markFlightFailed(
      supabase,
      entityResult.flight.id,
      entityResult.document.id,
      "Saldo insuficiente para iniciar a extra??o desta passagem.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
        reason_code: "insufficient_credits",
      },
    )

    return NextResponse.json(
      {
        error: "Saldo insuficiente. Adicione cr?ditos antes de processar passagens reais.",
        flight: failed.flight,
        document: failed.document,
      },
      { status: 402 }
    )
  }

  const processingUpdate = await updateFlightRecord(supabase, entityResult.flight.id, {
    extraction_status: "processing",
    extracted_data: {
      ...(((entityResult.flight.extracted_data as JsonObject | null) ?? {})),
      source: "flight_extraction",
      processing_started_at: new Date().toISOString(),
    },
  })

  if (processingUpdate.error) {
    return NextResponse.json({ error: processingUpdate.error }, { status: 500 })
  }

  if (!entityResult.document.file_path) {
    const failed = await markFlightFailed(
      supabase,
      entityResult.flight.id,
      entityResult.document.id,
      "A passagem anexada n?o possui file_path para leitura operacional.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
      },
    )

    return NextResponse.json(
      {
        error: "A passagem anexada n?o possui um arquivo valido para leitura.",
        flight: failed.flight,
        document: failed.document,
      },
      { status: 400 }
    )
  }

  const signedUrlResult = await supabase.storage.from("vuei-documents").createSignedUrl(entityResult.document.file_path, 60 * 10)
  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    const failed = await markFlightFailed(
      supabase,
      entityResult.flight.id,
      entityResult.document.id,
      signedUrlResult.error?.message || "N?o foi poss?vel gerar a URL tempor?ria para leitura da passagem.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
      },
    )

    return NextResponse.json(
      {
        error: signedUrlResult.error?.message || "N?o foi poss?vel acessar o arquivo da passagem.",
        flight: failed.flight,
        document: failed.document,
      },
      { status: 400 }
    )
  }

  const aiResult = await requestFlightExtraction({
    documentName: entityResult.document.name,
    mimeType: entityResult.document.mime_type,
    signedUrl: signedUrlResult.data.signedUrl,
  })

  const shouldChargeCredits = aiResult.calledModel
  const extractionPayload = aiResult.data
  const normalizedExtractionPayload = extractionPayload
    ? {
        ...extractionPayload,
        departure_at: normalizeExtractedDateTime(extractionPayload.departure_at, extractionPayload.raw_departure_text),
        arrival_at: normalizeExtractedDateTime(extractionPayload.arrival_at, extractionPayload.raw_arrival_text),
        qr_code_payload: normalizeQrCodePayload(extractionPayload.qr_code_payload),
      }
    : null
  const usefulFieldCount = countUsefulFlightFields(normalizedExtractionPayload)
  const partial = Boolean(normalizedExtractionPayload?.is_ticket && isPartialFlightExtraction(normalizedExtractionPayload))
  const completed = Boolean(normalizedExtractionPayload?.is_ticket && usefulFieldCount > 0)
  const failureReason =
    aiResult.error ||
    normalizedExtractionPayload?.failure_reason ||
    (!normalizedExtractionPayload?.is_ticket ? "O arquivo analisado n?o parece ser uma passagem aerea." : null) ||
    (usefulFieldCount === 0 ? "N?o foi poss?vel identificar dados ?teis nesta passagem." : null)

  const metadata: JsonObject = {
    source: "flight_extraction",
    model: aiResult.model,
    raw_response: aiResult.rawText,
    structured_result: normalizedExtractionPayload,
    useful_field_count: usefulFieldCount,
    partial,
    confidence: normalizedExtractionPayload?.confidence ?? null,
    notes: normalizedExtractionPayload?.notes ?? [],
    failure_reason: failureReason,
    processed_at: new Date().toISOString(),
    mime_type: entityResult.document.mime_type,
    estimatedCostUsd: estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens),
  }

  console.info("[AI][FLIGHT_EXTRACTION] processed", {
    tripId,
    documentId,
    flightId,
    strategy: completed ? "ai_ticket_completed" : partial ? "ai_ticket_partial_failed" : "ai_ticket_failed",
    usefulFieldCount,
    isTicket: Boolean(normalizedExtractionPayload?.is_ticket),
    shouldChargeCredits: Boolean(shouldChargeCredits && completed),
  })

  const flightUpdate = await updateFlightRecord(supabase, entityResult.flight.id, {
    airline: completed ? normalizedExtractionPayload?.airline ?? null : null,
    flight_number: completed ? normalizedExtractionPayload?.flight_number ?? null : null,
    booking_reference: completed ? normalizedExtractionPayload?.booking_reference ?? null : null,
    origin_airport: completed ? normalizedExtractionPayload?.origin_airport ?? null : null,
    destination_airport: completed ? normalizedExtractionPayload?.destination_airport ?? null : null,
    departure_at: completed ? normalizedExtractionPayload?.departure_at ?? null : null,
    arrival_at: completed ? normalizedExtractionPayload?.arrival_at ?? null : null,
    passenger_name: completed ? normalizedExtractionPayload?.passenger_name ?? null : null,
    terminal: completed ? normalizedExtractionPayload?.terminal ?? null : null,
    gate: completed ? normalizedExtractionPayload?.gate ?? null : null,
    seat: completed ? normalizedExtractionPayload?.seat ?? null : null,
    baggage_info: completed ? normalizedExtractionPayload?.baggage_info ?? null : null,
    qr_code_payload: completed ? normalizedExtractionPayload?.qr_code_payload ?? null : null,
    extracted_data: metadata,
    extraction_status: completed ? "completed" : "failed",
  })

  const documentUpdate = await updateDocumentExtractionData(supabase, entityResult.document.id, metadata)

  if (flightUpdate.error || !flightUpdate.data) {
    return NextResponse.json({ error: flightUpdate.error ?? "N?o foi poss?vel atualizar a passagem processada." }, { status: 500 })
  }

  if (documentUpdate.error) {
    console.error("[AI][FLIGHT_EXTRACTION] document metadata update error", documentUpdate.error)
  }

  if (shouldChargeCredits && completed) {
    const usageInsert = await createAiUsageLog(supabase, {
      ownerUserId: ownerType === "traveler" ? actingUserId : null,
      agencyId: accessResult.trip.agency_id,
      tripId: accessResult.trip.id,
      feature: "flight_extraction",
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      totalTokens: aiResult.usage.totalTokens,
      creditAmount: creditsPerCall,
      status: "completed",
      metadata,
    })

    if (usageInsert.error) {
      console.error("[AI][FLIGHT_EXTRACTION] usage log error", usageInsert.error)
    }

    if (ownerType === "traveler" && actingUserId) {
      const adminClient = createSupabaseAdminClient()
      const consumeResult = await consumeTravelerCredits(adminClient, {
        userId: actingUserId,
        amount: creditsPerCall,
        reason: `Consumo da leitura de passagem para ${accessResult.trip.title}`,
        source: "ai_flight_extraction",
        metadata: {
          module: "flight_reader",
          trip_id: accessResult.trip.id,
          document_id: entityResult.document.id,
          flight_id: entityResult.flight.id,
        },
        createdBy: actingUserId,
      })

      if (!consumeResult.success) {
        console.error("[AI][FLIGHT_EXTRACTION] traveler credit transaction error", consumeResult.error)
        return NextResponse.json(
          { error: consumeResult.error ?? "A passagem foi extraída, mas o débito dos créditos falhou." },
          { status: 500 },
        )
      }
    } else {
      const adminClient = createSupabaseAdminClient()
      const consumeResult = await consumeAgencyCredits(adminClient, {
        agencyId: accessResult.trip.agency_id ?? "",
        amount: creditsPerCall,
        reason: `Consumo da leitura de passagem para ${accessResult.trip.title}`,
        source: "ai_flight_extraction",
        metadata: {
          module: "flight_reader",
          trip_id: accessResult.trip.id,
          document_id: entityResult.document.id,
          flight_id: entityResult.flight.id,
        },
        createdBy: actingUserId,
      })

      if (!consumeResult.success) {
        console.error("[AI][FLIGHT_EXTRACTION] agency credit transaction error", consumeResult.error)
        return NextResponse.json(
          { error: consumeResult.error ?? "A passagem foi extraída, mas o débito dos créditos falhou." },
          { status: 500 },
        )
      }
    }
  }

  if (!completed) {
    return NextResponse.json(
      {
        error:
          failureReason ||
          "Não conseguimos ler esta passagem automaticamente. Você ainda pode abrir o documento original.",
        flight: flightUpdate.data,
        document: documentUpdate.data,
      },
      { status: 422 }
    )
  }

  return NextResponse.json({
    flight: flightUpdate.data,
    document: documentUpdate.data,
  })
}
