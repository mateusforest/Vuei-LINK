import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { shouldUseSupabase } from "@/lib/data-source"
import type { AiPrompt } from "@/types"
import type { Database } from "@/lib/supabase/types"

const OPENAI_MODEL = process.env.OPENAI_CONCIERGE_MODEL ?? "gpt-4.1-mini"
const MIN_CREDITS_PER_CALL = 1

type JsonObject = Record<string, unknown>

interface ConciergeRequestBody {
  tripId?: string
  conversationId?: string | null
  message?: string
  origin?: string
}

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type PromptRow = Database["public"]["Tables"]["ai_prompts"]["Row"]

function buildFallbackPrompt(code: string): AiPrompt {
  if (code === "concierge_agency") {
    return {
      id: "prompt-concierge-agency-default",
      code,
      name: "Concierge Agency",
      module: "concierge",
      systemPrompt:
        "Voce e o Concierge Vuei em contexto de agencia. Responda com base apenas no contexto real da viagem e deixe claro quando algum dado ainda nao estiver disponivel.",
      userPromptTemplate: "{message}",
      isActive: true,
      version: 1,
      metadata: { fallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return {
    id: "prompt-concierge-traveler-default",
    code: "concierge_traveler",
    name: "Concierge Traveler",
    module: "concierge",
    systemPrompt:
      "Voce e o Concierge Vuei para viajantes. Responda usando somente o contexto real disponivel da viagem, sem inventar documentos, roteiros, reservas ou informacoes ausentes.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

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

function estimateCostUsd(inputTokens: number, outputTokens: number) {
  const inputRate = Number(process.env.OPENAI_PRICE_INPUT_PER_1M_USD ?? "")
  const outputRate = Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M_USD ?? "")

  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate < 0 || outputRate < 0) {
    return null
  }

  return Number((((inputTokens / 1_000_000) * inputRate) + ((outputTokens / 1_000_000) * outputRate)).toFixed(6))
}

function buildContextSummary(trip: TripRow, hotels: HotelRow[], documents: DocumentRow[], audience: "traveler" | "agency") {
  const travelWindow = [trip.start_date, trip.end_date].filter(Boolean).join(" ate ")
  const hotelsSummary = hotels.length
    ? hotels
        .map((hotel) => {
          const hotelName = hotel.name ?? hotel.hotel_name ?? "Hospedagem sem nome"
          return `${hotelName} (${hotel.check_in ?? "check-in nao informado"} -> ${hotel.check_out ?? "check-out nao informado"})`
        })
        .join("; ")
    : "Nenhuma hospedagem real adicionada."

  const documentsSummary = documents.length
    ? documents
        .map((document) => `${document.name} [${document.type}]${document.is_private ? " (privado)" : ""}`)
        .join("; ")
    : "Nenhum documento real anexado."

  return [
    `Viagem: ${trip.title}`,
    `Destino: ${trip.destination}${trip.city ? `, ${trip.city}` : ""}${trip.country ? `, ${trip.country}` : ""}`,
    `Periodo: ${travelWindow || "Nao informado"}`,
    `Status: ${trip.status}`,
    `Estilo: ${trip.style || "Nao informado"}`,
    `Viajantes: ${trip.travelers_count}`,
    `Hospedagens: ${hotelsSummary}`,
    `Documentos visiveis para este contexto (${audience}): ${documentsSummary}`,
  ].join("\n")
}

function buildUserPrompt(template: string | null, message: string, contextSummary: string) {
  const baseTemplate = template?.trim() || "{message}\n\nContexto real:\n{context}"
  return baseTemplate
    .replaceAll("{message}", message)
    .replaceAll("{context}", contextSummary)
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
  if (exact.error) return { prompt: buildFallbackPrompt(code), error: exact.error.message }

  const fallback = await client
    .from("ai_prompts")
    .select("*")
    .eq("module", "concierge")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallback.data) return { prompt: mapPromptRow(fallback.data), error: null }
  return { prompt: buildFallbackPrompt(code), error: fallback.error?.message ?? null }
}

async function createOrReuseConversation(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  trip: TripRow,
  ownerUserId: string | null,
  agencyId: string | null,
  clientId: string | null,
  origin: string,
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
      metadata: { origin },
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

async function requestOpenAIReply(systemPrompt: string, history: Array<{ role: string; content: string }>, userPrompt: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false as const,
      error: "A IA operacional ainda nao esta configurada no servidor. Defina OPENAI_API_KEY para habilitar respostas reais.",
    }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...history.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        { role: "user", content: userPrompt },
      ],
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false as const,
      error:
        data?.error?.message ||
        "A chamada real de IA falhou no servidor.",
    }
  }

  const content = data?.choices?.[0]?.message?.content?.trim?.()
  if (!content) {
    return {
      ok: false as const,
      error: "A IA nao retornou uma resposta valida para esta pergunta.",
    }
  }

  return {
    ok: true as const,
    content,
    usage: {
      inputTokens: data?.usage?.prompt_tokens ?? 0,
      outputTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    },
  }
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json(
      { error: "A IA operacional real so fica disponivel quando o Supabase estiver ativo." },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => null)) as ConciergeRequestBody | null
  const tripId = body?.tripId?.trim?.()
  const message = body?.message?.trim?.()
  const origin = body?.origin?.trim?.() || "unknown"

  if (!tripId || !message) {
    return NextResponse.json({ error: "Trip e mensagem sao obrigatorios para o concierge." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json(
      { error: "Entre para usar o concierge real e salvar o historico desta viagem." },
      { status: 401 }
    )
  }

  const profileResult = await getProfile(supabase, user.id)
  if (!profileResult.data) {
    return NextResponse.json({ error: profileResult.error ?? "Perfil do usuario nao encontrado." }, { status: 403 })
  }

  const accessResult = await getAccessibleTrip(supabase, user.id, tripId, profileResult.data)
  if (!accessResult.trip) {
    return NextResponse.json({ error: accessResult.error ?? "Viagem nao encontrada." }, { status: 403 })
  }

  const ownerType = accessResult.membership ? "agency" : "traveler"
  const ownerId = accessResult.membership ? accessResult.trip.agency_id : user.id

  if (!ownerId) {
    return NextResponse.json({ error: "Nao foi possivel identificar o saldo responsavel por esta chamada de IA." }, { status: 400 })
  }

  const balanceResult = await getCreditsBalance(supabase, ownerType, ownerId)
  if (balanceResult.error) {
    return NextResponse.json({ error: balanceResult.error }, { status: 500 })
  }

  if ((balanceResult.balance ?? 0) < MIN_CREDITS_PER_CALL) {
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
  const documentsResult = await supabase
    .from("documents")
    .select("*")
    .eq("trip_id", accessResult.trip.id)
    .order("created_at", { ascending: true })

  const conversationResult = await createOrReuseConversation(
    supabase,
    accessResult.trip,
    ownerType === "traveler" ? user.id : null,
    ownerType === "agency" ? accessResult.trip.agency_id : null,
    accessResult.trip.client_id,
    origin,
    body?.conversationId ?? null,
  )

  if (!conversationResult.conversationId) {
    return NextResponse.json(
      { error: conversationResult.error ?? "Nao foi possivel iniciar a conversa real do concierge." },
      { status: 500 }
    )
  }

  const history = await fetchConversationHistory(supabase, conversationResult.conversationId)
  const contextSummary = buildContextSummary(
    accessResult.trip,
    (hotelsResult.data ?? []) as HotelRow[],
    (documentsResult.data ?? []) as DocumentRow[],
    ownerType,
  )

  const userPrompt = buildUserPrompt(promptResult.prompt.userPromptTemplate, message, contextSummary)
  const aiResult = await requestOpenAIReply(promptResult.prompt.systemPrompt, history, userPrompt)

  if (!aiResult.ok) {
    return NextResponse.json({ error: aiResult.error }, { status: 503 })
  }

  const assistantMessage = aiResult.content
  const estimatedCost = estimateCostUsd(aiResult.usage.inputTokens, aiResult.usage.outputTokens)
  const creditsToCharge = MIN_CREDITS_PER_CALL

  const userInsert = await supabase.from("ai_messages").insert({
    conversation_id: conversationResult.conversationId,
    role: "user",
    content: message,
    metadata: { origin, promptCode: promptResult.prompt.code, promptSourceError: promptResult.error },
  })

  const assistantInsert = await supabase.from("ai_messages").insert({
    conversation_id: conversationResult.conversationId,
    role: "assistant",
    content: assistantMessage,
    metadata: {
      origin,
      model: OPENAI_MODEL,
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

  const usageInsert = await supabase.from("ai_usage_logs").insert({
    owner_type: ownerType,
    owner_user_id: ownerType === "traveler" ? user.id : null,
    trip_id: accessResult.trip.id,
    user_id: user.id,
    agency_id: accessResult.trip.agency_id,
    client_id: accessResult.trip.client_id,
    module: "concierge",
    action: "chat_completion",
    model: OPENAI_MODEL,
    input_tokens: aiResult.usage.inputTokens,
    output_tokens: aiResult.usage.outputTokens,
    total_tokens: aiResult.usage.totalTokens,
    estimated_cost: estimatedCost,
    credits_charged: creditsToCharge,
    credits_used: creditsToCharge,
    status: "success",
    metadata: {
      origin,
      promptCode: promptResult.prompt.code,
      promptFallback: promptResult.error ? true : false,
    },
  })

  let warning: string | null = null

  if (usageInsert.error) {
    console.error("[AI] usage log error", usageInsert.error.message)
    warning = "A resposta foi gerada, mas o log operacional da IA ainda nao foi salvo. Revise o schema de ai_usage_logs."
  } else {
    const creditsInsert = await supabase.from("credit_transactions").insert({
      owner_type: ownerType,
      owner_user_id: ownerType === "traveler" ? user.id : null,
      agency_id: ownerType === "agency" ? accessResult.trip.agency_id : null,
      type: "consume",
      amount: -creditsToCharge,
      reason: `Consumo do concierge IA para ${accessResult.trip.title}`,
      source: "ai_concierge",
      metadata: {
        module: "concierge",
        trip_id: accessResult.trip.id,
        conversation_id: conversationResult.conversationId,
      },
      created_by: user.id,
    })

    if (creditsInsert.error) {
      console.error("[AI] credits consume error", creditsInsert.error.message)
      warning = "A resposta foi gerada, mas o consumo de creditos ainda nao foi registrado. Revise o ledger de creditos."
    }
  }

  return NextResponse.json({
    conversationId: conversationResult.conversationId,
    assistantMessage,
    model: OPENAI_MODEL,
    creditsCharged: warning ? 0 : creditsToCharge,
    warning,
  })
}
