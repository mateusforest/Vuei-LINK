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
type PromptRow = Database["public"]["Tables"]["ai_prompts"]["Row"]

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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para usar o concierge desta viagem." }
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
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para usar o concierge desta viagem." }
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
  const tripResult = await adminClient.from("trips").select("*").eq("id", payload.tripId).maybeSingle()

  if (tripResult.error) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: tripResult.error.message }
  }

  const trip = tripResult.data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Viagem nao encontrada." }
  }

  if (payload.accessMode === "admin") {
    const tokenMatches = Boolean(payload.adminToken && trip.admin_token === payload.adminToken)
    const slugMatches = Boolean(payload.tripSlug && trip.slug === payload.tripSlug)

    if (!tokenMatches && !slugMatches) {
      return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para usar o concierge desta viagem." }
    }
  } else {
    const tokenMatches = Boolean(payload.publicToken && trip.public_token === payload.publicToken)
    const slugMatches = Boolean(payload.tripSlug && trip.slug === payload.tripSlug && trip.visibility === "public")

    if (trip.visibility !== "public" || (!tokenMatches && !slugMatches)) {
      return { trip: null as TripRow | null, membership: null as AgencyMemberRow | null, error: "Voce nao tem permissao para usar o concierge desta viagem." }
    }
  }

  return { trip, membership: null as AgencyMemberRow | null, error: null }
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

async function resolvePrompt(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
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
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
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
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
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

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json(
      { error: "A IA operacional real so fica disponivel quando o Supabase estiver ativo." },
      { status: 503 }
    )
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do billing traveler nao esta disponivel." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as ConciergeRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const message = body?.message?.trim?.()
  const origin = body?.origin?.trim?.() || "unknown"
  const tripSlug = body?.tripSlug?.trim?.() ?? null
  const adminToken = body?.adminToken?.trim?.() ?? null
  const publicToken = body?.publicToken?.trim?.() ?? null
  const accessMode = body?.accessMode === "admin" || body?.accessMode === "public" ? body.accessMode : "authenticated"

  if (!tripId || !message) {
    return NextResponse.json({ error: "Trip e mensagem sao obrigatorios para o concierge." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
  }

  const authResult = await supabase.auth.getUser()
  const user = authResult.data.user
  const authError = authResult.error

  let actingUserId: string | null = null
  let accessResult:
    | Awaited<ReturnType<typeof getAccessibleTrip>>
    | Awaited<ReturnType<typeof getTripByLinkAccess>>

  if (user) {
    const profileResult = await getProfile(supabase, user.id)
    if (!profileResult.data) {
      return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario nao encontrado." }, { status: 403 })
    }

    accessResult = await getAccessibleTrip(supabase, user.id, tripId, profileResult.data)
    actingUserId = user.id
  } else {
    if (authError && accessMode === "authenticated") {
      return NextResponse.json({ error: "Faça login novamente para continuar." }, { status: 401 })
    }

    accessResult = await getTripByLinkAccess({
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode: accessMode === "admin" ? "admin" : "public",
    })
    actingUserId = accessResult.trip?.owner_user_id ?? null
  }
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem nao encontrada." }, { status: 403 })
  }

  const ownerType = accessResult.trip.agency_id ? "agency" : "traveler"
  const ownerId = ownerType === "agency" ? accessResult.trip.agency_id : actingUserId

  if (!ownerId) {
    return NextResponse.json({ error: "Nao foi possivel identificar o saldo responsavel por esta chamada de IA." }, { status: 400 })
  }

  const balanceResult = await getCreditsBalance(supabase, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }

  const creditsPerCall = getConciergeCreditCost()

  if ((balanceResult.balance ?? 0) < creditsPerCall) {
    return NextResponse.json(
      { error: "Saldo insuficiente. Adicione creditos antes de usar o concierge real." },
      { status: 402 }
    )
  }

  const promptResult = await resolvePrompt(supabase, ownerType === "agency" ? "concierge_agency" : "concierge_traveler")
  const hotelsResult = await supabase
    .from("trip_hotels")
    .select("*")
    .eq("trip_id", accessResult.trip.id)
    .order("created_at", { ascending: true })
  const flightsResult = await supabase
    .from("trip_flights")
    .select("*")
    .eq("trip_id", accessResult.trip.id)
    .order("departure_at", { ascending: true, nullsFirst: false })
  const documentsResult = await supabase
    .from("documents")
    .select("*")
    .eq("trip_id", accessResult.trip.id)
    .order("created_at", { ascending: true })

  const conversationResult = await createOrReuseConversation(
    supabase,
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
      { error: conversationResult.error ?? "Nao foi possivel iniciar a conversa real do concierge." },
      { status: 500 }
    )
  }

  const history = await fetchConversationHistory(supabase, conversationResult.conversationId)
  const contextSummary = buildTripContextSummary({
    trip: accessResult.trip,
    hotels: (hotelsResult.data ?? []) as HotelRow[],
    flights: (flightsResult.data ?? []) as FlightRow[],
    documents: (documentsResult.data ?? []) as DocumentRow[],
    audience: ownerType,
    recentMessages: history,
  })

  const userPrompt = buildPromptInput(promptResult.prompt.userPromptTemplate, message, contextSummary)
  const aiResult = await requestConciergeReply(promptResult.prompt.systemPrompt, history, userPrompt)

  if (!aiResult.ok) {
    if (aiResult.calledModel) {
      const usageResult = await createAiUsageLog(supabase, {
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

  const userInsert = await supabase.from("ai_messages").insert({
    conversation_id: conversationResult.conversationId,
    role: "user",
    content: message,
    metadata: { origin, accessMode, promptCode: promptResult.prompt.code, promptSourceError: promptResult.error },
  })

  const assistantInsert = await supabase.from("ai_messages").insert({
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

  const conversationUpdate = await supabase
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
          "Nao foi possivel persistir o historico real do concierge.",
      },
      { status: 500 }
    )
  }

  const usageInsert = await createAiUsageLog(supabase, {
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
    },
  })

  let warning: string | null = null

  if (usageInsert.error) {
    console.error("[AI] usage log error", usageInsert.error)
    warning = "A resposta foi gerada, mas o log operacional da IA ainda nao foi salvo. Revise o schema de ai_usage_logs."
  }

  if (ownerType === "traveler" && actingUserId) {
    const adminClient = createSupabaseAdminClient()
    const consumeResult = await consumeTravelerCredits(adminClient, {
      userId: actingUserId,
      amount: creditsToCharge,
      reason: `Consumo do concierge IA para ${accessResult.trip.title}`,
      source: "ai_concierge",
      metadata: {
        module: "concierge",
        trip_id: accessResult.trip.id,
        conversation_id: conversationResult.conversationId,
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
    const adminClient = createSupabaseAdminClient()
    const consumeResult = await consumeAgencyCredits(adminClient, {
      agencyId: accessResult.trip.agency_id ?? "",
      amount: creditsToCharge,
      reason: `Consumo do concierge IA para ${accessResult.trip.title}`,
      source: "ai_concierge",
      metadata: {
        module: "concierge",
        trip_id: accessResult.trip.id,
        conversation_id: conversationResult.conversationId,
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
