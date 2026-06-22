import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { shouldUseSupabase } from "@/lib/data-source"
import type { AiPrompt } from "@/types"
import type { Database } from "@/lib/supabase/types"
import { requestConciergeReply } from "@/lib/ai/concierge-engine"
import { getConciergeCreditCost, estimateCostUsd } from "@/lib/ai/credit-consumption"
import { buildFallbackConciergePrompt, buildPromptInput } from "@/lib/ai/prompts"
import { buildTripContextSummary } from "@/lib/ai/trip-context"
import { createAiUsageLog } from "@/lib/ai/usage-logs"
import { consumeTravelerCredits, getTravelerCreditBalance } from "@/lib/billing/traveler-billing"
import { consumeAgencyCredits, getAgencyCreditBalance } from "@/lib/billing/agency-billing"
import { hasAgencyMutationAccess, resolveTripLinkAccess } from "@/lib/security/trip-link-access"

type JsonObject = Record<string, unknown>

interface ConciergeRequestBody {
  tripId?: string
  conversationId?: string | null
  message?: string
  origin?: string
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode?: "admin" | "public" | "authenticated"
}

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type TripItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]
type PromptRow = Database["public"]["Tables"]["ai_prompts"]["Row"]
type ClientRow = Database["public"]["Tables"]["clients"]["Row"]
type RouteSupabaseClient = ReturnType<typeof createSupabaseAdminClient>

function mapPromptRow(row: PromptRow): AiPrompt {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    isActive: row.is_active,
    version: row.version,
    metadata: (row.metadata ?? {}) as JsonObject,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function getProfile(client: RouteSupabaseClient, userId: string) {
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
  client: RouteSupabaseClient,
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para usar o concierge desta viagem." }
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para usar o concierge desta viagem." }
  }

  if (!hasAgencyMutationAccess(membershipResult.data.role)) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voc? n?o tem permiss?o para usar o concierge desta viagem." }
  }

  return { trip, membership: membershipResult.data as AgencyMemberRow, error: null }
}

async function getTripByLinkAccess(payload: {
  tripId: string
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: "admin" | "public"
}) {
  const adminClient = createSupabaseAdminClient()
  const accessResult = await resolveTripLinkAccess(adminClient, {
    tripId: payload.tripId,
    tripSlug: payload.tripSlug,
    adminToken: payload.adminToken,
    publicToken: payload.publicToken,
    accessMode: payload.accessMode,
  })

  return {
    trip: accessResult.trip,
    membership: null as AgencyMemberRow | null,
    error: accessResult.error ?? (accessResult.trip ? null : "Voc? n?o tem permiss?o para usar o concierge desta viagem."),
  }
}

async function getCreditsBalance(
  client: RouteSupabaseClient,
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

async function resolvePrompt(
  client: RouteSupabaseClient,
  code: "concierge_traveler" | "concierge_agency",
) {
  const exact = await client
    .from("ai_prompts")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle()

  if (exact.data) return { prompt: mapPromptRow(exact.data), error: null }
  if (exact.error) return { prompt: buildFallbackConciergePrompt(code), error: exact.error.message }

  const fallback = await client
    .from("ai_prompts")
    .select("*")
    .eq("module", "concierge")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallback.data) return { prompt: mapPromptRow(fallback.data), error: null }
  return { prompt: buildFallbackConciergePrompt(code), error: fallback.error?.message ?? null }
}

async function createOrReuseConversation(
  client: RouteSupabaseClient,
  trip: TripRow,
  ownerUserId: string | null,
  agencyId: string | null,
  clientId: string | null,
  origin: string,
  accessMode: "admin" | "public" | "authenticated",
  conversationId?: string | null,
) {
  if (conversationId) {
    const existing = await client
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .eq("trip_id", trip.id)
      .maybeSingle()

    if (existing.data) {
      return { conversationId: existing.data.id, error: null }
    }
  }

  let query = client
    .from("ai_conversations")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("source", "concierge")
    .order("updated_at", { ascending: false })
    .limit(1)

  if (agencyId) {
    query = query.eq("agency_id", agencyId)
  } else if (ownerUserId) {
    query = query.eq("owner_user_id", ownerUserId)
  }

  const existing = await query.maybeSingle()
  if (existing.data) {
    return { conversationId: existing.data.id, error: null }
  }

  const created = await client
    .from("ai_conversations")
    .insert({
      trip_id: trip.id,
      owner_user_id: ownerUserId,
      agency_id: agencyId,
      client_id: clientId,
      source: "concierge",
      title: trip.title,
      metadata: { origin, accessMode },
    })
    .select("id")
    .single()

  return { conversationId: created.data?.id ?? null, error: created.error?.message ?? null }
}

async function fetchConversationHistory(
  client: RouteSupabaseClient,
  conversationId: string,
) {
  const { data } = await client
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(8)

  return (data ?? []).map((message) => ({
    role: message.role === "agent" ? "assistant" : message.role,
    content: message.content,
  }))
}

function normalizeTripPermissions(trip: TripRow) {
  const permissions = (trip.permissions ?? {}) as Record<string, unknown>

  return {
    publicCanViewItinerary: typeof permissions.publicCanViewItinerary === "boolean" ? permissions.publicCanViewItinerary : true,
    publicCanViewAccommodation: typeof permissions.publicCanViewAccommodation === "boolean" ? permissions.publicCanViewAccommodation : true,
    publicCanViewFlights: typeof permissions.publicCanViewFlights === "boolean" ? permissions.publicCanViewFlights : false,
    publicCanViewPublicDocuments: typeof permissions.publicCanViewPublicDocuments === "boolean" ? permissions.publicCanViewPublicDocuments : true,
  }
}

function filterContextDocuments(
  trip: TripRow,
  documents: DocumentRow[],
  accessMode: "admin" | "public" | "authenticated",
) {
  if (accessMode !== "public") return documents

  const permissions = normalizeTripPermissions(trip)
  if (!permissions.publicCanViewPublicDocuments) return []

  return documents.filter((document) =>
    document.visibility === "public_trip"
    && document.is_private !== true
  )
}

function filterContextHotels(
  trip: TripRow,
  hotels: HotelRow[],
  accessMode: "admin" | "public" | "authenticated",
) {
  if (accessMode !== "public") return hotels
  return normalizeTripPermissions(trip).publicCanViewAccommodation ? hotels : []
}

function filterContextFlights(
  trip: TripRow,
  flights: FlightRow[],
  accessMode: "admin" | "public" | "authenticated",
) {
  if (accessMode !== "public") return flights
  return normalizeTripPermissions(trip).publicCanViewFlights ? flights : []
}

function filterContextItineraries(
  trip: TripRow,
  itineraries: TripItineraryRow[],
  accessMode: "admin" | "public" | "authenticated",
) {
  if (accessMode !== "public") return itineraries
  return normalizeTripPermissions(trip).publicCanViewItinerary ? itineraries : []
}

function logConciergeContextDebug(details: Record<string, unknown>) {
  console.info("[AI][CONCIERGE][CONTEXT]", details)
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json(
      { error: "A IA operacional real so fica dispon?vel quando o Supabase estiver ativo." },
      { status: 503 }
    )
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configura??o administrativa do billing traveler n?o ?sta dispon?vel." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as ConciergeRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const message = body?.message?.trim?.()
  const origin = body?.origin?.trim?.() || "unknown"
  const referer = request.headers.get("referer")
  const tripSlug = body?.tripSlug?.trim?.() ?? null
  const adminToken = body?.adminToken?.trim?.() ?? null
  const publicToken = body?.publicToken?.trim?.() ?? null
  const refererPathname = (() => {
    if (!referer) return null
    try {
      return new URL(referer).pathname
    } catch {
      return null
    }
  })()
  const refererAccessMode =
    refererPathname?.endsWith("/admin")
      ? "admin"
      : refererPathname?.startsWith("/v/") || refererPathname?.startsWith("/viagem/")
        ? "public"
        : null
  const explicitAccessMode = body?.accessMode === "admin" || body?.accessMode === "public" ? body.accessMode : null
  const inferredLinkAccessMode =
    explicitAccessMode
    ?? (adminToken ? "admin" : null)
    ?? refererAccessMode
    ?? (publicToken || tripSlug || origin === "trip-public-link" || origin === "trip-admin-link" ? "public" : null)
  const accessMode = inferredLinkAccessMode ?? "authenticated"

  if (!tripId || !message) {
    return NextResponse.json({ error: "Trip e mensagem sao obrigatorios para o concierge." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indispon?vel." }, { status: 503 })
  }

  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error
  const adminClient = createSupabaseAdminClient()
  const isDirectTripLinkRequest =
    origin === "trip-public-link"
    || origin === "trip-admin-link"
    || Boolean(adminToken)
    || Boolean(publicToken)
    || Boolean(tripSlug)
    || Boolean(refererAccessMode)
  const dataClient = !user && isDirectTripLinkRequest ? adminClient : supabase

  let actingUserId: string | null = null
  let accessResult:
    | Awaited<ReturnType<typeof getAccessibleTrip>>
    | Awaited<ReturnType<typeof getTripByLinkAccess>>

  if (user) {
    const profileResult = await getProfile(supabase, user.id)
    if (!profileResult.data) {
      return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario n?o ?ncontrado." }, { status: 403 })
    }

    accessResult = await getAccessibleTrip(supabase, user.id, tripId, profileResult.data)
    actingUserId = user.id
  } else {
    if (authError && accessMode === "authenticated" && !isDirectTripLinkRequest) {
      return NextResponse.json({ error: "Faça login novamente para continuar." }, { status: 401 })
    }

    accessResult = await getTripByLinkAccess({
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode: accessMode === "admin" || origin === "trip-admin-link" ? "admin" : "public",
    })
    actingUserId = accessResult.trip?.owner_user_id ?? null
  }
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem n?o ?ncontrada." }, { status: 403 })
  }

  const ownerType = accessResult.trip.agency_id ? "agency" : "traveler"
  const ownerId = ownerType === "agency" ? accessResult.trip.agency_id : actingUserId

  if (!ownerId) {
    return NextResponse.json({ error: "N?o foi poss?vel identificar o saldo responsavel por esta chamada de IA." }, { status: 400 })
  }

  const balanceResult = await getCreditsBalance(dataClient, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }

  const creditsPerCall = getConciergeCreditCost()

  if ((balanceResult.balance ?? 0) < creditsPerCall) {
    return NextResponse.json(
      { error: "Saldo insuficiente. Adicione cr?ditos antes de usar o concierge real." },
      { status: 402 }
    )
  }

  const promptResult = await resolvePrompt(dataClient, ownerType === "agency" ? "concierge_agency" : "concierge_traveler")
  const [hotelsResult, flightsResult, documentsResult, itinerariesResult, clientResult, ownerProfileResult] = await Promise.all([
    dataClient
      .from("trip_hotels")
      .select("*")
      .eq("trip_id", accessResult.trip.id)
      .order("created_at", { ascending: true }),
    dataClient
      .from("trip_flights")
      .select("*")
      .eq("trip_id", accessResult.trip.id)
      .order("departure_at", { ascending: true, nullsFirst: false }),
    dataClient
      .from("documents")
      .select("*")
      .eq("trip_id", accessResult.trip.id)
      .order("created_at", { ascending: true }),
    dataClient
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", accessResult.trip.id)
      .order("created_at", { ascending: false }),
    accessResult.trip.client_id
      ? dataClient.from("clients").select("id, name").eq("id", accessResult.trip.client_id).maybeSingle()
      : Promise.resolve({ data: null as ClientRow | null, error: null }),
    accessResult.trip.owner_user_id
      ? dataClient.from("profiles").select("id, name").eq("id", accessResult.trip.owner_user_id).maybeSingle()
      : Promise.resolve({ data: null as Pick<ProfileRow, "id" | "name"> | null, error: null }),
  ])

  const conversationResult = await createOrReuseConversation(
    dataClient,
    accessResult.trip,
    ownerType === "traveler" ? actingUserId : null,
    ownerType === "agency" ? accessResult.trip.agency_id : null,
    accessResult.trip.client_id,
    origin,
    accessMode,
    body?.conversationId ?? null,
  )

  if (!conversationResult.conversationId) {
    return NextResponse.json(
      { error: conversationResult.error ?? "N?o foi poss?vel iniciar a conversa real do concierge." },
      { status: 500 }
    )
  }

  const history = await fetchConversationHistory(dataClient, conversationResult.conversationId)
  const visibleHotels = filterContextHotels(accessResult.trip, (hotelsResult.data ?? []) as HotelRow[], accessMode)
  const visibleFlights = filterContextFlights(accessResult.trip, (flightsResult.data ?? []) as FlightRow[], accessMode)
  const visibleDocuments = filterContextDocuments(accessResult.trip, (documentsResult.data ?? []) as DocumentRow[], accessMode)
  const visibleItineraries = filterContextItineraries(accessResult.trip, (itinerariesResult.data ?? []) as TripItineraryRow[], accessMode)
  const contextResult = buildTripContextSummary({
    trip: accessResult.trip,
    hotels: visibleHotels,
    flights: visibleFlights,
    itineraries: visibleItineraries,
    documents: visibleDocuments,
    audience: ownerType,
    accessMode,
    clientName: clientResult.data?.name ?? null,
    travelerName: ownerProfileResult.data?.name ?? null,
    recentMessages: history,
  })
  const contextSummary = contextResult.summary

  logConciergeContextDebug({
    tripId: accessResult.trip.id,
    tripSlug: accessResult.trip.slug,
    accessMode,
    ownerType,
    promptCode: promptResult.prompt.code,
    ...contextResult.debug,
  })

  const userPrompt = buildPromptInput(promptResult.prompt.userPromptTemplate, message, contextSummary)
  const aiResult = await requestConciergeReply(promptResult.prompt.systemPrompt, history, userPrompt)

  if (!aiResult.ok) {
    if (aiResult.calledModel) {
      const usageResult = await createAiUsageLog(dataClient, {
        ownerUserId: ownerType === "traveler" ? actingUserId : null,
        agencyId: accessResult.trip.agency_id,
        tripId: accessResult.trip.id,
        conversationId: conversationResult.conversationId,
        feature: "concierge",
        model: aiResult.model,
        inputTokens: aiResult.usage.inputTokens,
        outputTokens: aiResult.usage.outputTokens,
        totalTokens: aiResult.usage.totalTokens,
        creditAmount: creditsPerCall,
        status: "failed",
        metadata: {
          origin,
          accessMode,
          promptCode: promptResult.prompt.code,
          promptFallback: promptResult.error ? true : false,
          error: aiResult.error,
          tripTitle: accessResult.trip.title,
          tripSlug: accessResult.trip.slug,
          clientId: accessResult.trip.client_id,
          clientName: clientResult.data?.name ?? null,
        },
      })

      if (usageResult.error) {
        console.error("[AI] usage log error", usageResult.error)
      }
    }

    return NextResponse.json({ error: aiResult.error }, { status: 503 })
  }

  const assistantMessage = aiResult.content
  const creditsToCharge = creditsPerCall

  const userInsert = await dataClient.from("ai_messages").insert({
    conversation_id: conversationResult.conversationId,
    role: "user",
    content: message,
    metadata: { origin, accessMode, promptCode: promptResult.prompt.code, promptSourceError: promptResult.error },
  })

  const assistantInsert = await dataClient.from("ai_messages").insert({
    conversation_id: conversationResult.conversationId,
    role: "assistant",
    content: assistantMessage,
    metadata: {
      origin,
      accessMode,
      model: aiResult.model,
      promptCode: promptResult.prompt.code,
    },
  })

  const conversationUpdate = await dataClient
    .from("ai_conversations")
    .update({
      last_message: assistantMessage,
      last_message_at: new Date().toISOString(),
      title: accessResult.trip.title,
    })
    .eq("id", conversationResult.conversationId)

  if (userInsert.error || assistantInsert.error || conversationUpdate.error) {
    return NextResponse.json(
      {
        error:
          userInsert.error?.message ||
          assistantInsert.error?.message ||
          conversationUpdate.error?.message ||
          "N?o foi poss?vel persistir o historico real do concierge.",
      },
      { status: 500 }
    )
  }

  const usageInsert = await createAiUsageLog(dataClient, {
    ownerUserId: ownerType === "traveler" ? actingUserId : null,
    agencyId: accessResult.trip.agency_id,
    tripId: accessResult.trip.id,
    conversationId: conversationResult.conversationId,
    feature: "concierge",
    model: aiResult.model,
    inputTokens: aiResult.usage.inputTokens,
    outputTokens: aiResult.usage.outputTokens,
    totalTokens: aiResult.usage.totalTokens,
    creditAmount: creditsToCharge,
    status: "completed",
    metadata: {
      origin,
      accessMode,
      promptCode: promptResult.prompt.code,
      promptFallback: promptResult.error ? true : false,
      estimatedCostUsd: estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens),
      tripTitle: accessResult.trip.title,
      tripSlug: accessResult.trip.slug,
      clientId: accessResult.trip.client_id,
      clientName: clientResult.data?.name ?? null,
    },
  })

  let warning: string | null = null

  if (usageInsert.error) {
    console.error("[AI] usage log error", usageInsert.error)
    warning = "A resposta foi gerada, mas o log operacional da IA ainda n?o foi salvo. Revise o schema de ai_usage_logs."
  }

  if (ownerType === "traveler" && actingUserId) {
    const consumeResult = await consumeTravelerCredits(adminClient, {
      userId: actingUserId,
      amount: creditsToCharge,
      reason: `Consumo do concierge IA para ${accessResult.trip.title}`,
      source: "ai_concierge",
      metadata: {
        module: "concierge",
        trip_id: accessResult.trip.id,
        trip_slug: accessResult.trip.slug,
        trip_title: accessResult.trip.title,
        client_id: accessResult.trip.client_id,
        client_name: clientResult.data?.name ?? null,
        conversation_id: conversationResult.conversationId,
        feature: "concierge",
        source_context: isDirectTripLinkRequest ? (accessMode === "admin" ? "link_admin" : "link_public") : "portal_traveler",
      },
      createdBy: actingUserId,
    })

    if (!consumeResult.success) {
      console.error("[AI] traveler credits consume error", consumeResult.error)
      return NextResponse.json(
        { error: consumeResult.error ?? "A resposta foi gerada, mas o débito dos créditos falhou." },
        { status: 500 },
      )
    }
  } else {
    const consumeResult = await consumeAgencyCredits(adminClient, {
      agencyId: accessResult.trip.agency_id ?? "",
      amount: creditsToCharge,
      reason: `Consumo do concierge IA para ${accessResult.trip.title}`,
      source: "ai_concierge",
      metadata: {
        module: "concierge",
        trip_id: accessResult.trip.id,
        trip_slug: accessResult.trip.slug,
        trip_title: accessResult.trip.title,
        client_id: accessResult.trip.client_id,
        client_name: clientResult.data?.name ?? null,
        conversation_id: conversationResult.conversationId,
        feature: "concierge",
        source_context: isDirectTripLinkRequest ? (accessMode === "admin" ? "link_admin" : "link_public") : "portal_agency",
      },
      createdBy: actingUserId,
    })

    if (!consumeResult.success) {
      console.error("[AI] agency credits consume error", consumeResult.error)
      return NextResponse.json(
        { error: consumeResult.error ?? "A resposta foi gerada, mas o débito dos créditos falhou." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    conversationId: conversationResult.conversationId,
    assistantMessage,
    model: aiResult.model,
    creditsCharged: warning ? 0 : creditsToCharge,
    warning,
  })
}
