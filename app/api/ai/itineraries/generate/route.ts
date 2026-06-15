import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import type { Database } from "@/lib/supabase/types"
import { requestItineraryGeneration } from "@/lib/ai/itinerary-generation"
import { buildTripItineraryPdf } from "@/lib/ai/itinerary-pdf"
import { getCompleteItineraryCreditCost, getSimpleItineraryCreditCost, estimateCostUsd } from "@/lib/ai/credit-consumption"
import { createAiUsageLog } from "@/lib/ai/usage-logs"
import { getDestinationCoverImage, getDestinationMetadata } from "@/lib/trip-destination"
import type { Document } from "@/types/document"
import type { TripItineraryRecord, TripItineraryContent } from "@/types/itinerary"
import { consumeTravelerCredits, getTravelerCreditBalance } from "@/lib/billing/traveler-billing"
import { getAgencyBillingStatusForClient, resolveAgencyAvailableCredits } from "@/lib/billing/agency-billing"

export const runtime = "nodejs"
export const maxDuration = 60

type JsonObject = Record<string, unknown>
type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type ClientRow = Database["public"]["Tables"]["clients"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type TripItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]

function logItineraryDev(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  console.log("[AI][ITINERARY]", stage, details ?? {})
}

function calculateTripDays(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return null

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null

  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function mapDocumentRowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    tripId: row.trip_id,
    clientId: row.client_id,
    agencyId: row.agency_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    fileUrl: row.file_url,
    filePath: row.file_path,
    mimeType: row.mime_type,
    size: row.size_bytes,
    isPrivate: row.is_private,
    visibility: row.visibility,
    aiExtractedData: (row.ai_extracted_data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapItineraryRowToRecord(row: TripItineraryRow): TripItineraryRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    content: (row.content ?? null) as TripItineraryContent | null,
    pdfUrl: row.pdf_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

interface GenerateItineraryRequestBody {
  tripId?: string
  mode?: "simple" | "complete_pdf"
  tripSlug?: string
  adminToken?: string
}

const PREMIUM_REQUIRED_ERROR = "Assine o Premium para gerar roteiros inteligentes, criar viagens ilimitadas e receber créditos mensais inclusos."

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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para gerar roteiros desta viagem." }
  }

  return { trip, membership: null as AgencyMemberRow | null, error: null }
}

async function getProfile(client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, agency_id, email, name")
    .eq("id", userId)
    .maybeSingle()

  return { data: (data as ProfileRow | null) ?? null, error: error?.message ?? null }
}

async function getAccessibleTrip(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  userId: string,
  tripId: string,
  profile: ProfileRow | null,
) {
  const tripResult = await client.from("trips").select("*").eq("id", tripId).maybeSingle()
  if (tripResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: tripResult.error.message }
  }

  const trip = tripResult.data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem nao encontrada." }
  }

  if (profile?.role === "master" || trip.owner_user_id === userId) {
    return { trip, membership: null as AgencyMemberRow | null, error: null }
  }

  if (!trip.agency_id) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para gerar roteiros desta viagem." }
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

  if (!membershipResult.data || !["owner", "admin", "member"].includes(membershipResult.data.role)) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para gerar roteiros desta viagem." }
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
    return {
      balance: result.data?.totalAvailable ?? 0,
      error: result.error,
      currentPlan: result.data?.currentPlan ?? "free",
    }
  }

  if (ownerType === "agency") {
    const [billingStatusResult, balanceResult, transactionsResult] = await Promise.all([
      getAgencyBillingStatusForClient(client, ownerId),
      client.from("agencies").select("credits_balance").eq("id", ownerId).maybeSingle(),
      (client.from("credit_transactions" as any) as any)
        .select("amount")
        .eq("owner_type", "agency")
        .eq("agency_id", ownerId),
    ])

    const firstError = billingStatusResult.error || balanceResult.error?.message || transactionsResult.error?.message || null
    if (firstError) {
      return { balance: 0, error: firstError, currentPlan: "free" as const }
    }

    const agencyBalanceRow = balanceResult.data as { credits_balance?: number | null } | null

    return {
      balance: resolveAgencyAvailableCredits({
        persistedBalance: agencyBalanceRow?.credits_balance ?? 0,
        planMonthlyCredits: billingStatusResult.data?.monthlyCredits ?? 0,
        transactions: transactionsResult.data ?? [],
      }),
      error: null,
      currentPlan: billingStatusResult.data?.planCode ?? "free",
    }
  }

  const { data, error } = await client.from("profiles").select("credits_balance").eq("id", ownerId).maybeSingle()
  const profileBalanceRow = data as { credits_balance?: number | null } | null
  return { balance: profileBalanceRow?.credits_balance ?? 0, error: error?.message ?? null, currentPlan: "free" as const }
}

function buildTravelerName(params: { trip: TripRow; ownerProfile: ProfileRow | null; client: ClientRow | null }) {
  return params.client?.name ?? params.ownerProfile?.name ?? (params.trip.travelers_count > 1 ? `${params.trip.travelers_count} viajantes` : "Viajante")
}

function buildTripContext(params: {
  trip: TripRow
  documents: DocumentRow[]
  hotels: HotelRow[]
  flights: FlightRow[]
}) {
  const { trip, documents, hotels, flights } = params
  const hotelsSummary = hotels.length
    ? hotels.map((hotel) => `${hotel.name ?? hotel.hotel_name ?? "Hospedagem"} (${hotel.check_in ?? "check-in nao informado"} -> ${hotel.check_out ?? "check-out nao informado"})`).join("; ")
    : "Nenhuma hospedagem adicionada."
  const flightsSummary = flights.length
    ? flights.map((flight) => `${flight.airline ?? "Companhia nao informada"} ${flight.flight_number ?? ""} ${flight.origin_airport ?? ""} -> ${flight.destination_airport ?? ""}`.trim()).join("; ")
    : "Nenhuma passagem adicionada."
  const documentsSummary = documents.length
    ? documents.map((document) => `${document.name} [${document.type}]${document.is_private ? " (privado)" : ""}`).join("; ")
    : "Nenhum documento adicional."

  return [
    `Viagem: ${trip.title}`,
    `Destino: ${trip.destination}${trip.city ? `, ${trip.city}` : ""}${trip.country ? `, ${trip.country}` : ""}`,
    `Periodo: ${trip.start_date ?? "nao informado"} ate ${trip.end_date ?? "nao informado"}`,
    `Status: ${trip.status}`,
    `Estilo: ${trip.style ?? "nao informado"}`,
    `Quantidade de viajantes: ${trip.travelers_count}`,
    `Hospedagens: ${hotelsSummary}`,
    `Passagens: ${flightsSummary}`,
    `Documentos: ${documentsSummary}`,
    "Quando faltar informacao critica, mantenha null ou trate como sugestao geral.",
  ].join("\n")
}

async function insertGeneratingItinerary(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  tripId: string,
  title: string,
  mode: "simple" | "complete_pdf",
  createdBy: string,
) {
  const { data, error } = await client
    .from("trip_itineraries")
    .insert({
      trip_id: tripId,
      title,
      mode,
      status: "generating",
      content: { days: [] },
      created_by: createdBy,
    })
    .select("*")
    .single()

  return { data: (data as TripItineraryRow | null) ?? null, error: error?.message ?? null }
}

async function updateItinerary(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  itineraryId: string,
  payload: Database["public"]["Tables"]["trip_itineraries"]["Update"],
) {
  const { data, error } = await client
    .from("trip_itineraries")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itineraryId)
    .select("*")
    .single()

  return { data: (data as TripItineraryRow | null) ?? null, error: error?.message ?? null }
}

async function registerItineraryCreditConsumption(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  payload: {
    ownerType: "traveler" | "agency"
    ownerUserId: string | null
    agencyId: string | null
    amount: number
    tripId: string
    itineraryId: string
    mode: "simple" | "complete_pdf"
    createdBy: string
    failed?: boolean
  },
) {
  return client.from("credit_transactions").insert({
    owner_type: payload.ownerType,
    owner_user_id: payload.ownerType === "traveler" ? payload.ownerUserId : null,
    agency_id: payload.ownerType === "agency" ? payload.agencyId : null,
    type: "consume",
    amount: -payload.amount,
    reason: `Geracao de roteiro ${payload.mode === "simple" ? "simples" : "completo"} para a viagem`,
    source: payload.failed ? "ai_itinerary_generation_failed" : "ai_itinerary_generation",
    metadata: {
      module: "itinerary",
      trip_id: payload.tripId,
      itinerary_id: payload.itineraryId,
      mode: payload.mode,
      failed: payload.failed ?? false,
    },
    created_by: payload.createdBy,
  })
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "A geracao operacional real de roteiros so fica disponivel quando o Supabase estiver ativo." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as GenerateItineraryRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const mode = body?.mode
  const tripSlug = body?.tripSlug?.trim?.() ?? null
  const adminToken = body?.adminToken?.trim?.() ?? null

  if (!tripId || (mode !== "simple" && mode !== "complete_pdf")) {
    return NextResponse.json({ error: "Trip e modo valido sao obrigatorios para gerar o roteiro." }, { status: 400 })
  }

  const adminAccessRequested = Boolean(adminToken || tripSlug)
  if (adminAccessRequested && !hasSupabaseAdminEnv()) {
    console.error("[AI][ITINERARY] missing admin env", {
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
      { error: "A configuracao administrativa do servidor nao esta disponivel no momento." },
      { status: 503 },
    )
  }

  const supabase = adminAccessRequested ? createSupabaseAdminClient() : await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
  }

  let actingUserId: string | null = null
  let actingProfile: ProfileRow | null = null
  let accessResult: Awaited<ReturnType<typeof getAccessibleTrip>> | Awaited<ReturnType<typeof getTripByAdminAccess>>

  if (adminAccessRequested) {
    accessResult = await getTripByAdminAccess(supabase, { tripId, tripSlug, adminToken })
    actingUserId = accessResult.trip?.owner_user_id ?? null
  } else {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 })
    }
    if (!authData.user) {
      return NextResponse.json({ error: "Entre para gerar roteiros reais desta viagem." }, { status: 401 })
    }

    const profileResult = await getProfile(supabase, authData.user.id)
    if (!profileResult.data) {
      return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario nao encontrado." }, { status: 403 })
    }

    actingProfile = profileResult.data
    accessResult = await getAccessibleTrip(supabase, authData.user.id, tripId, profileResult.data)
    actingUserId = authData.user.id
  }
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem nao encontrada." }, { status: 403 })
  }

  const ownerType = accessResult.membership ? "agency" : "traveler"
  const ownerId = ownerType === "agency" ? accessResult.trip.agency_id : actingUserId
  const actingOwnerUserId = actingUserId ?? accessResult.trip.owner_user_id ?? null
  const fileOwnerKey = accessResult.trip.owner_user_id ?? accessResult.trip.agency_id ?? accessResult.trip.id
  if (!ownerId) {
    return NextResponse.json({ error: "Nao foi possivel identificar o responsavel pelos creditos desta geracao." }, { status: 400 })
  }

  const creditCost = mode === "simple" ? getSimpleItineraryCreditCost() : getCompleteItineraryCreditCost()
  const balanceResult = await getCreditsBalance(supabase, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }

  if (ownerType === "traveler" && balanceResult.currentPlan !== "premium") {
    return NextResponse.json({ error: PREMIUM_REQUIRED_ERROR, code: "premium_required" }, { status: 403 })
  }

  if ((balanceResult.balance ?? 0) < creditCost) {
    return NextResponse.json({ error: "Saldo insuficiente para gerar este roteiro com IA." }, { status: 402 })
  }

  const generatingRecord = await insertGeneratingItinerary(
    supabase,
    accessResult.trip.id,
    mode === "simple" ? `Roteiro simples • ${accessResult.trip.title}` : `Roteiro completo • ${accessResult.trip.title}`,
    mode,
    actingUserId ?? accessResult.trip.owner_user_id ?? accessResult.trip.agency_id ?? accessResult.trip.id,
  )

  if (!generatingRecord.data) {
    return NextResponse.json({ error: generatingRecord.error ?? "Nao foi possivel iniciar a geracao do roteiro." }, { status: 500 })
  }

  logItineraryDev("generation_started", {
    tripId: accessResult.trip.id,
    mode,
    itineraryId: generatingRecord.data.id,
    ownerType,
  })

  const [documentsResult, hotelsResult, flightsResult, agencyResult, clientResult, ownerProfileResult] = await Promise.all([
    supabase.from("documents").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: false }),
    supabase.from("trip_hotels").select("*").eq("trip_id", accessResult.trip.id).order("created_at", { ascending: true }),
    supabase.from("trip_flights").select("*").eq("trip_id", accessResult.trip.id).order("departure_at", { ascending: true, nullsFirst: false }),
    accessResult.trip.agency_id ? supabase.from("agencies").select("id, name, branding, logo_url, settings").eq("id", accessResult.trip.agency_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    accessResult.trip.client_id ? supabase.from("clients").select("id, name, email, phone").eq("id", accessResult.trip.client_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    accessResult.trip.owner_user_id ? supabase.from("profiles").select("id, role, name, email, phone").eq("id", accessResult.trip.owner_user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])

  const context = buildTripContext({
    trip: accessResult.trip,
    documents: (documentsResult.data ?? []) as DocumentRow[],
    hotels: (hotelsResult.data ?? []) as HotelRow[],
    flights: (flightsResult.data ?? []) as FlightRow[],
  })
  const expectedDays = calculateTripDays(accessResult.trip.start_date, accessResult.trip.end_date)

  const aiResult = await requestItineraryGeneration({
    mode,
    tripTitle: accessResult.trip.title,
    destination: accessResult.trip.destination,
    startDate: accessResult.trip.start_date,
    endDate: accessResult.trip.end_date,
    expectedDays,
    travelContext: context,
  })

  logItineraryDev("ai_finished", {
    ok: aiResult.ok,
    calledModel: aiResult.calledModel,
    model: aiResult.model,
    hasData: Boolean(aiResult.data),
    error: aiResult.error ?? null,
  })

  if (!aiResult.calledModel) {
    await updateItinerary(supabase, generatingRecord.data.id, {
      status: "failed",
      content: {
        days: [],
        error: aiResult.error,
      },
    })

    return NextResponse.json({ error: aiResult.error ?? "A IA nao foi chamada para gerar o roteiro." }, { status: 503 })
  }

  const usageMetadata: JsonObject = {
    source: "itinerary_generation",
    mode,
    raw_response: aiResult.rawText,
    structured_result: aiResult.data,
    travel_context: context,
    estimatedCostUsd: estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens),
    processed_at: new Date().toISOString(),
  }

  if (!aiResult.ok || !aiResult.data) {
    await updateItinerary(supabase, generatingRecord.data.id, {
      status: "failed",
      content: {
        days: [],
        error: aiResult.error,
      },
    })

    await createAiUsageLog(supabase, {
      ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
      agencyId: accessResult.trip.agency_id,
      tripId: accessResult.trip.id,
      feature: "itinerary_generation",
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      totalTokens: aiResult.usage.totalTokens,
      creditAmount: creditCost,
      status: "failed",
      metadata: usageMetadata,
    })

    return NextResponse.json({ error: aiResult.error ?? "Nao foi possivel gerar o roteiro." }, { status: 422 })
  }

  let document: DocumentRow | null = null
  let pdfPath: string | null = null

  if (mode === "complete_pdf") {
    try {
    const branding = (agencyResult.data?.branding ?? {}) as Record<string, unknown>
    const agencySettings = (agencyResult.data?.settings ?? {}) as Record<string, unknown>
    const destinationMetadata = getDestinationMetadata(accessResult.trip.destination, accessResult.trip.country, accessResult.trip.city)
    const heroImage = accessResult.trip.cover_image || getDestinationCoverImage(accessResult.trip.destination, accessResult.trip.city, accessResult.trip.country)
    const usefulInfo = [
      accessResult.trip.country ? `Pais: ${accessResult.trip.country}` : null,
      accessResult.trip.city ? `Cidade base: ${accessResult.trip.city}` : null,
      hotelsResult.data?.[0]?.name ? `Hospedagem principal: ${hotelsResult.data[0].name}` : null,
      flightsResult.data?.[0]?.booking_reference ? `Localizador principal: ${flightsResult.data[0].booking_reference}` : null,
    ].filter((entry): entry is string => Boolean(entry))

    logItineraryDev("pdf_payload_ready", {
      tripId: accessResult.trip.id,
      itineraryId: generatingRecord.data.id,
      hasHeroImage: Boolean(heroImage),
      hasAgencyLogo: Boolean((typeof branding.linkLogoUrl === "string" && branding.linkLogoUrl) || agencyResult.data?.logo_url),
      hotels: (hotelsResult.data ?? []).length,
      flights: (flightsResult.data ?? []).length,
      documents: (documentsResult.data ?? []).length,
    })

    const pdfBytes = await buildTripItineraryPdf({
      title: aiResult.data.title,
      destination: accessResult.trip.destination,
      country: accessResult.trip.country,
      startDate: accessResult.trip.start_date,
      endDate: accessResult.trip.end_date,
      travelersCount: accessResult.trip.travelers_count,
      travelersLabel: `${accessResult.trip.travelers_count} pessoa(s)`,
      travelerName: buildTravelerName({
        trip: accessResult.trip,
        ownerProfile: (actingProfile?.id === accessResult.trip.owner_user_id ? actingProfile : ownerProfileResult.data) as ProfileRow | null,
        client: (clientResult.data as ClientRow | null) ?? null,
      }),
      tripSummary: aiResult.data.summary,
      heroImage,
      usefulInfo,
      contacts: [
        typeof agencySettings.phone === "string" && agencySettings.phone ? { label: "Telefone", value: agencySettings.phone } : null,
        typeof agencySettings.email === "string" && agencySettings.email ? { label: "E-mail", value: agencySettings.email } : null,
      ].filter((entry): entry is { label: string; value: string } => Boolean(entry)),
      branding: {
        agencyName: agencyResult.data?.name ?? null,
        agencyLogoUrl:
          (typeof branding.linkLogoUrl === "string" && branding.linkLogoUrl) ||
          agencyResult.data?.logo_url ||
          null,
        consultantName:
          actingProfile?.role === "agency_owner" || actingProfile?.role === "agency_member"
            ? actingProfile?.name ?? null
            : ownerProfileResult.data?.role === "agency_owner" || ownerProfileResult.data?.role === "agency_member"
              ? ownerProfileResult.data?.name ?? null
              : null,
        contactEmail: typeof agencySettings.email === "string" ? agencySettings.email : null,
        contactPhone: typeof agencySettings.phone === "string" ? agencySettings.phone : null,
        website: typeof agencySettings.website === "string" ? agencySettings.website : null,
        isAgency: Boolean(accessResult.trip.agency_id),
      },
      hotels: ((hotelsResult.data ?? []) as HotelRow[]).map((hotel) => ({
        name: hotel.name ?? hotel.hotel_name ?? null,
        address: hotel.address,
        checkIn: hotel.check_in,
        checkOut: hotel.check_out,
        confirmationCode: hotel.confirmation_code ?? hotel.confirmation_number ?? null,
        notes: hotel.notes,
      })),
      flights: ((flightsResult.data ?? []) as FlightRow[]).map((flight) => ({
        airline: flight.airline,
        flightNumber: flight.flight_number,
        bookingReference: flight.booking_reference,
        originAirport: flight.origin_airport,
        destinationAirport: flight.destination_airport,
        departureAt: flight.departure_at,
        arrivalAt: flight.arrival_at,
        passengerName: flight.passenger_name,
        terminal: flight.terminal,
        gate: flight.gate,
        seat: flight.seat,
        baggageInfo: flight.baggage_info,
      })),
      documents: ((documentsResult.data ?? []) as DocumentRow[]).map((documentRow) => ({
        name: documentRow.name,
        type: documentRow.type,
      })),
      quickInfo: {
        currency: destinationMetadata.currency?.name ?? null,
        language: destinationMetadata.language,
        timezone: destinationMetadata.timezone,
        weather: null,
        emergency: destinationMetadata.emergency,
        baggage: ((flightsResult.data ?? []) as FlightRow[]).map((flight) => flight.baggage_info).find((value) => typeof value === "string" && value.trim().length > 0) ?? null,
        documents: (documentsResult.data ?? []).map((documentRow) => documentRow.name),
      },
      content: aiResult.data,
    })

    logItineraryDev("pdf_created", {
      bytes: pdfBytes.byteLength,
    })

    pdfPath = `${fileOwnerKey}/${accessResult.trip.id}/itineraries/${Date.now()}-roteiro-completo.pdf`
    const upload = await supabase.storage.from("vuei-documents").upload(pdfPath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    })

    logItineraryDev("storage_upload_finished", {
      path: pdfPath,
      ok: !upload.error,
      error: upload.error?.message ?? null,
    })

    if (upload.error) {
      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: upload.error.message,
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          upload_error: upload.error.message,
        },
      })

      return NextResponse.json({ error: upload.error.message }, { status: 500 })
    }

    const signedPdfResult = await supabase.storage.from("vuei-documents").createSignedUrl(pdfPath, 60 * 10)
    logItineraryDev("storage_validation_finished", {
      path: pdfPath,
      ok: !signedPdfResult.error && Boolean(signedPdfResult.data?.signedUrl),
      error: signedPdfResult.error?.message ?? null,
    })
    if (signedPdfResult.error || !signedPdfResult.data?.signedUrl) {
      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: signedPdfResult.error?.message || "Nao foi possivel validar o PDF salvo no Storage.",
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          signed_url_error: signedPdfResult.error?.message || "Nao foi possivel validar o PDF salvo no Storage.",
        },
      })

      return NextResponse.json({ error: signedPdfResult.error?.message || "Nao foi possivel validar o PDF salvo no Storage." }, { status: 500 })
    }

    const documentInsert = await supabase
      .from("documents")
      .insert({
        trip_id: accessResult.trip.id,
        agency_id: accessResult.trip.agency_id,
        owner_user_id: accessResult.trip.owner_user_id,
        name: `Roteiro completo • ${accessResult.trip.title}`,
        type: "itinerary",
        file_path: upload.data.path,
        mime_type: "application/pdf",
        size_bytes: pdfBytes.byteLength,
        is_private: false,
        visibility: "public_trip",
        ai_extracted_data: {
          source: "itinerary_generation",
          mode,
          generated: true,
        },
      })
      .select("*")
      .single()

    logItineraryDev("document_insert_finished", {
      ok: !documentInsert.error && Boolean(documentInsert.data),
      error: documentInsert.error?.message ?? null,
    })

    if (documentInsert.error || !documentInsert.data) {
      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro.",
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          document_error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro.",
        },
      })

      return NextResponse.json({ error: documentInsert.error?.message || "Nao foi possivel registrar o PDF do roteiro." }, { status: 500 })
    }

    document = documentInsert.data as DocumentRow
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida ao gerar o PDF do roteiro."
      console.error("[AI][ITINERARY] complete pdf runtime error", error)
      logItineraryDev("pdf_generation_failed", {
        itineraryId: generatingRecord.data.id,
        message,
      })

      await updateItinerary(supabase, generatingRecord.data.id, {
        status: "failed",
        content: {
          ...aiResult.data,
          error: message,
        },
      })

      await createAiUsageLog(supabase, {
        ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        feature: "itinerary_generation",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditCost,
        status: "failed",
        metadata: {
          ...usageMetadata,
          pdf_runtime_error: message,
        },
      })

      return NextResponse.json({ error: `Falha na geracao do PDF do roteiro: ${message}` }, { status: 500 })
    }
  }

  const itineraryUpdate = await updateItinerary(supabase, generatingRecord.data.id, {
    document_id: document?.id ?? null,
    title: aiResult.data.title,
    status: "completed",
    content: aiResult.data,
    pdf_url: pdfPath,
  })

  if (!itineraryUpdate.data) {
    await createAiUsageLog(supabase, {
      ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
      agencyId: accessResult.trip.agency_id,
      tripId: accessResult.trip.id,
      feature: "itinerary_generation",
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      totalTokens: aiResult.usage.totalTokens,
      creditAmount: creditCost,
      status: "failed",
      metadata: {
        ...usageMetadata,
        finalize_error: itineraryUpdate.error ?? "Nao foi possivel finalizar o roteiro gerado.",
      },
    })

    return NextResponse.json({ error: itineraryUpdate.error ?? "Nao foi possivel finalizar o roteiro gerado." }, { status: 500 })
  }

  logItineraryDev("itinerary_updated", {
    itineraryId: itineraryUpdate.data.id,
    status: itineraryUpdate.data.status,
    documentId: itineraryUpdate.data.document_id,
    pdfUrl: itineraryUpdate.data.pdf_url,
  })

  const usageInsert = await createAiUsageLog(supabase, {
    ownerUserId: ownerType === "traveler" ? actingOwnerUserId : null,
    agencyId: accessResult.trip.agency_id,
    tripId: accessResult.trip.id,
    feature: "itinerary_generation",
    model: aiResult.model,
    inputTokens: aiResult.usage.inputTokens,
    outputTokens: aiResult.usage.outputTokens,
    totalTokens: aiResult.usage.totalTokens,
    creditAmount: creditCost,
    status: "completed",
    metadata: usageMetadata,
  })

  if (usageInsert.error) {
    console.error("[AI][ITINERARY] usage log error", usageInsert.error)
  }

  if (ownerType === "traveler" && actingOwnerUserId) {
    const adminClient = createSupabaseAdminClient()
    const consumeResult = await consumeTravelerCredits(adminClient, {
      userId: actingOwnerUserId,
      amount: creditCost,
      reason: `Geracao de roteiro ${mode === "simple" ? "simples" : "completo"} para a viagem`,
      source: "ai_itinerary_generation",
      metadata: {
        module: "itinerary",
        trip_id: accessResult.trip.id,
        itinerary_id: itineraryUpdate.data.id,
        mode,
        failed: false,
      },
      createdBy: actingOwnerUserId,
    })

    if (!consumeResult.success) {
      console.error("[AI][ITINERARY] traveler credit transaction error", consumeResult.error)
    }
  } else {
    const creditInsert = await registerItineraryCreditConsumption(supabase, {
      ownerType,
      ownerUserId: actingOwnerUserId,
      agencyId: accessResult.trip.agency_id,
      amount: creditCost,
      tripId: accessResult.trip.id,
      itineraryId: itineraryUpdate.data.id,
      mode,
      createdBy: actingOwnerUserId,
    })

    if (creditInsert.error) {
      console.error("[AI][ITINERARY] credit transaction error", creditInsert.error.message)
    }
  }

  logItineraryDev("response_ready", {
    itineraryId: itineraryUpdate.data.id,
    hasDocument: Boolean(document),
  })

  return NextResponse.json({
    itinerary: mapItineraryRowToRecord(itineraryUpdate.data),
    document: document ? mapDocumentRowToDocument(document) : null,
  })
}
