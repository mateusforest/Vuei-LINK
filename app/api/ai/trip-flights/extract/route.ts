import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import { countUsefulFlightFields, requestFlightExtraction } from "@/lib/ai/flight-extraction"
import { estimateCostUsd, getTicketExtractionCreditCost } from "@/lib/ai/credit-consumption"
import { createAiUsageLog } from "@/lib/ai/usage-logs"

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
  const { data, error } = await client.from("trips").select("*").eq("id", payload.tripId).maybeSingle()
  if (error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: error.message }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem nao encontrada." }
  }

  const tokenMatches = Boolean(payload.adminToken && trip.admin_token === payload.adminToken)
  const slugMatches = Boolean(payload.tripSlug && trip.slug === payload.tripSlug)

  if (!tokenMatches && !slugMatches) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para processar esta passagem." }
  }

  return { trip, membership: null as AgencyMemberRow | null, error: null }
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem nao encontrada." }
  }

  if (profile?.role === "master") {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (trip.owner_user_id === userId) {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (!trip.agency_id) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para processar esta passagem." }
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para processar esta passagem." }
  }

  return { trip, membership: membershipResult.data as AgencyMemberRow, error: null }
}

async function getCreditsBalance(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  ownerType: "traveler" | "agency",
  ownerId: string,
) {
  if (ownerType === "agency") {
    const { data, error } = await client.from("agencies").select("credits_balance").eq("id", ownerId).maybeSingle()
    return { balance: data?.credits_balance ?? 0, error: error?.message ?? null }
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
      error: "Registro da passagem nao encontrado.",
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
      error: "Documento da passagem nao encontrado.",
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
      { error: "A extracao operacional real de passagens so fica disponivel quando o Supabase estiver ativo." },
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
  const supabase = adminAccessRequested ? createSupabaseAdminClient() : await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
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
      return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario nao encontrado." }, { status: 403 })
    }

    accessResult = await getAccessibleTrip(supabase, user.id, tripId, profileResult.data)
    actingUserId = user.id
  }
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem nao encontrada." }, { status: 403 })
  }

  const entityResult = await getFlightAndDocument(supabase, tripId, flightId, documentId)
  if (!entityResult.flight || !entityResult.document) {
    return NextResponse.json({ error: entityResult.error ?? "Passagem nao encontrada." }, { status: 404 })
  }

  if (entityResult.document.type !== "ticket") {
    const failed = await markFlightFailed(
      supabase,
      entityResult.flight.id,
      entityResult.document.id,
      "O documento anexado nao esta classificado como passagem aerea.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
        document_type: entityResult.document.type,
      },
    )

    return NextResponse.json(
      {
        error: "O documento informado nao e uma passagem.",
        flight: failed.flight,
        document: failed.document,
      },
      { status: 400 }
    )
  }

  const ownerType = accessResult.membership ? "agency" : "traveler"
  const ownerId = accessResult.membership ? accessResult.trip.agency_id : actingUserId

  if (!ownerId) {
    return NextResponse.json({ error: "Nao foi possivel identificar o saldo responsavel por esta extracao." }, { status: 400 })
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
      "Saldo insuficiente para iniciar a extracao desta passagem.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
        reason_code: "insufficient_credits",
      },
    )

    return NextResponse.json(
      {
        error: "Saldo insuficiente. Adicione creditos antes de processar passagens reais.",
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
      "A passagem anexada nao possui file_path para leitura operacional.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
      },
    )

    return NextResponse.json(
      {
        error: "A passagem anexada nao possui um arquivo valido para leitura.",
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
      signedUrlResult.error?.message || "Nao foi possivel gerar a URL temporaria para leitura da passagem.",
      {
        source: "flight_extraction",
        skipped_before_ai: true,
      },
    )

    return NextResponse.json(
      {
        error: signedUrlResult.error?.message || "Nao foi possivel acessar o arquivo da passagem.",
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
  const usefulFieldCount = countUsefulFlightFields(extractionPayload)
  const completed = Boolean(extractionPayload?.is_ticket && usefulFieldCount > 0)
  const failureReason =
    aiResult.error ||
    extractionPayload?.failure_reason ||
    (!extractionPayload?.is_ticket ? "O arquivo analisado nao parece ser uma passagem aerea." : null) ||
    (usefulFieldCount === 0 ? "Nao foi possivel identificar dados uteis nesta passagem." : null)

  const metadata: JsonObject = {
    source: "flight_extraction",
    model: aiResult.model,
    raw_response: aiResult.rawText,
    structured_result: extractionPayload,
    useful_field_count: usefulFieldCount,
    confidence: extractionPayload?.confidence ?? null,
    notes: extractionPayload?.notes ?? [],
    failure_reason: failureReason,
    processed_at: new Date().toISOString(),
    mime_type: entityResult.document.mime_type,
    estimatedCostUsd: estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens),
  }

  const flightUpdate = await updateFlightRecord(supabase, entityResult.flight.id, {
    airline: completed ? extractionPayload?.airline ?? null : null,
    flight_number: completed ? extractionPayload?.flight_number ?? null : null,
    booking_reference: completed ? extractionPayload?.booking_reference ?? null : null,
    origin_airport: completed ? extractionPayload?.origin_airport ?? null : null,
    destination_airport: completed ? extractionPayload?.destination_airport ?? null : null,
    departure_at: completed ? extractionPayload?.departure_at ?? null : null,
    arrival_at: completed ? extractionPayload?.arrival_at ?? null : null,
    passenger_name: completed ? extractionPayload?.passenger_name ?? null : null,
    terminal: completed ? extractionPayload?.terminal ?? null : null,
    gate: completed ? extractionPayload?.gate ?? null : null,
    seat: completed ? extractionPayload?.seat ?? null : null,
    baggage_info: completed ? extractionPayload?.baggage_info ?? null : null,
    qr_code_payload: completed ? extractionPayload?.qr_code_payload ?? null : null,
    extracted_data: metadata,
    extraction_status: completed ? "completed" : "failed",
  })

  const documentUpdate = await updateDocumentExtractionData(supabase, entityResult.document.id, metadata)

  if (flightUpdate.error || !flightUpdate.data) {
    return NextResponse.json({ error: flightUpdate.error ?? "Nao foi possivel atualizar a passagem processada." }, { status: 500 })
  }

  if (documentUpdate.error) {
    console.error("[AI][FLIGHT_EXTRACTION] document metadata update error", documentUpdate.error)
  }

  if (shouldChargeCredits) {
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
      status: completed ? "completed" : "failed",
      metadata,
    })

    if (usageInsert.error) {
      console.error("[AI][FLIGHT_EXTRACTION] usage log error", usageInsert.error)
    }

    const creditsInsert = await supabase.from("credit_transactions").insert({
      owner_type: ownerType,
      owner_user_id: ownerType === "traveler" ? actingUserId : null,
      agency_id: ownerType === "agency" ? accessResult.trip.agency_id : null,
      type: "consume",
      amount: -creditsPerCall,
      reason: `Consumo da leitura de passagem para ${accessResult.trip.title}`,
      source: "ai_flight_extraction",
      metadata: {
        module: "flight_reader",
        trip_id: accessResult.trip.id,
        document_id: entityResult.document.id,
        flight_id: entityResult.flight.id,
      },
      created_by: actingUserId,
    })

    if (creditsInsert.error) {
      console.error("[AI][FLIGHT_EXTRACTION] credit transaction error", creditsInsert.error.message)
    }
  }

  if (!completed) {
    return NextResponse.json(
      {
        error: failureReason || "Nao foi possivel identificar esta passagem.",
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
