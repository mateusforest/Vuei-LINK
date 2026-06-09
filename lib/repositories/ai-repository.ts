import type { AiConversation, AiMessage, AiModule, AiPrompt, AiUsageLog, AiUsageStatus } from "@/types"
import {
  createSupabaseBrowserClient,
  createSupabaseBrowserClientPlaceholder,
} from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

const AI_STORAGE_KEY = "vuei_ai_repository"
const AI_SCHEMA_VERSION = 2

type PromptModule = Extract<AiModule, "concierge" | "itinerary" | "documents" | "ticket_reader" | "accommodation_reader" | "flight_reader" | "support_assistant">
type ConversationChannel = Extract<AiModule, "concierge" | "itinerary" | "documents" | "ticket_reader">

type ConversationRowCompat = Database["public"]["Tables"]["ai_conversations"]["Row"] & {
  user_id?: string | null
  channel?: string | null
}

type UsageLogRowCompat = Database["public"]["Tables"]["ai_usage_logs"]["Row"] & {
  owner_user_id?: string | null
  conversation_id?: string | null
  message_id?: string | null
  feature?: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction" | null
  model?: string | null
  input_tokens?: number | null
  output_tokens?: number | null
  total_tokens?: number | null
  credit_amount?: number | null
  status?: AiUsageStatus | null
}

type PromptRowCompat = Database["public"]["Tables"]["ai_prompts"]["Row"] & {
  module: PromptModule
}

interface AiRepositoryState {
  schemaVersion: number
  conversations: AiConversation[]
  messages: AiMessage[]
  usageLogs: AiUsageLog[]
  prompts: AiPrompt[]
}

interface CreateConversationPayload {
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  channel: ConversationChannel
  title?: string | null
  metadata?: Record<string, unknown> | null
}

interface ListConversationsParams {
  tripId?: string
  userId?: string
  agencyId?: string
  clientId?: string
  channel?: ConversationChannel
  status?: AiConversation["status"]
}

interface AddMessagePayload {
  conversationId: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  role: AiMessage["role"]
  content: string
  creditsUsed?: number
  metadata?: Record<string, unknown> | null
}

interface LogAiUsagePayload {
  ownerUserId?: string | null
  tripId: string | null
  agencyId: string | null
  conversationId?: string | null
  messageId?: string | null
  feature: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"
  model?: string | null
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  creditAmount?: number
  status?: AiUsageStatus
  metadata?: Record<string, unknown> | null
}

interface ListAiUsageLogsParams {
  ownerUserId?: string
  agencyId?: string
  tripId?: string
  feature?: "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"
  status?: AiUsageStatus
  limit?: number
}

interface ListPromptsParams {
  module?: PromptModule
  includeInactive?: boolean
}

const DEFAULT_PROMPTS: AiPrompt[] = [
  {
    id: "prompt-concierge-traveler-default",
    code: "concierge_traveler",
    name: "Concierge Traveler",
    module: "concierge",
    systemPrompt:
      "Voce e o Concierge Vuei para viajantes. Use apenas o contexto real disponivel da viagem, seja claro, cordial e nao invente dados que nao existirem.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { audience: "traveler", fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prompt-concierge-agency-default",
    code: "concierge_agency",
    name: "Concierge Agency",
    module: "concierge",
    systemPrompt:
      "Voce e o Concierge Vuei em contexto de agencia. Responda usando somente o contexto real da viagem e destaque quando algum dado ainda nao existir.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { audience: "agency", fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prompt-itinerary-generator-default",
    code: "itinerary_generator",
    name: "Itinerary Generator",
    module: "itinerary",
    systemPrompt: "Gere roteiros apenas quando houver contexto real suficiente e deixe lacunas explicitas quando faltarem dados.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prompt-document-reader-default",
    code: "document_reader",
    name: "Document Reader",
    module: "documents",
    systemPrompt: "Extraia informacoes apenas do conteudo real fornecido, sem completar campos ausentes por inferencia.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "prompt-support-assistant-default",
    code: "support_assistant",
    name: "Support Assistant",
    module: "support_assistant",
    systemPrompt: "Voce e o assistente interno do Vuei. Ajude com base no contexto operacional real e sinalize claramente qualquer limite do sistema.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: { fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function mapConversationRow(row: ConversationRowCompat): AiConversation {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.owner_user_id ?? row.user_id ?? null,
    agencyId: row.agency_id,
    clientId: row.client_id,
    channel: (row.source ?? row.channel ?? "concierge") as ConversationChannel,
    status: row.status,
    title: row.title ?? null,
    lastMessage: row.last_message ?? null,
    lastMessageAt: row.last_message_at ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageRow(row: Database["public"]["Tables"]["ai_messages"]["Row"]): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tripId: null,
    userId: null,
    agencyId: null,
    clientId: null,
    role: row.role,
    content: row.content,
    creditsUsed: 0,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

function mapUsageLogRow(row: UsageLogRowCompat): AiUsageLog {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? null,
    tripId: row.trip_id,
    agencyId: row.agency_id,
    conversationId: row.conversation_id ?? null,
    messageId: row.message_id ?? null,
    feature: row.feature ?? "document_extraction",
    model: row.model ?? null,
    inputTokens: row.input_tokens ?? 0,
    outputTokens: row.output_tokens ?? 0,
    totalTokens: row.total_tokens ?? 0,
    creditAmount: row.credit_amount ?? 0,
    status: row.status ?? "completed",
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

function mapPromptRow(row: PromptRowCompat): AiPrompt {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    module: row.module,
    systemPrompt: row.system_prompt,
    userPromptTemplate: row.user_prompt_template,
    isActive: row.is_active,
    version: row.version,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function readAiState(): AiRepositoryState {
  const fallback: AiRepositoryState = {
    schemaVersion: AI_SCHEMA_VERSION,
    conversations: [],
    messages: [],
    usageLogs: [],
    prompts: DEFAULT_PROMPTS,
  }

  if (typeof window === "undefined") return fallback

  try {
    const raw = window.localStorage.getItem(AI_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<AiRepositoryState>

    return {
      schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : AI_SCHEMA_VERSION,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      usageLogs: Array.isArray(parsed.usageLogs) ? parsed.usageLogs : [],
      prompts: Array.isArray(parsed.prompts) && parsed.prompts.length > 0 ? parsed.prompts : DEFAULT_PROMPTS,
    }
  } catch {
    return fallback
  }
}

function writeAiState(state: AiRepositoryState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(state))
}

function mapAiSchemaError(error?: string | null) {
  const normalized = (error ?? "").toLowerCase()

  if (normalized.includes("ai_conversations") || normalized.includes("ai_messages")) {
    return "As tabelas do Concierge ainda nao existem no Supabase. Rode o arquivo supabase/ai_conversations_setup.sql antes de testar este modulo."
  }

  if (normalized.includes("ai_usage_logs")) {
    return "A estrutura operacional de IA ainda nao esta completa no Supabase. Rode o arquivo supabase/ai_operational_fix.sql antes de testar logs e consumo real."
  }

  if (normalized.includes("ai_prompts")) {
    return "A tabela de prompts de IA ainda nao esta disponivel no Supabase. Rode o schema consolidado da IA antes de usar este modulo."
  }

  if (normalized.includes("relation") && normalized.includes("does not exist")) {
    return "O schema operacional de IA ainda nao esta completo no Supabase. Rode os SQLs recomendados antes de usar este modulo."
  }

  return error ?? null
}

export async function listConversations(params?: ListConversationsParams) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      let query = client.from("ai_conversations").select("*").order("updated_at", { ascending: false })

      if (params?.tripId) query = query.eq("trip_id", params.tripId)
      if (params?.userId) query = query.eq("owner_user_id", params.userId)
      if (params?.agencyId) query = query.eq("agency_id", params.agencyId)
      if (params?.clientId) query = query.eq("client_id", params.clientId)
      if (params?.channel) query = query.eq("source", params.channel)
      if (params?.status) query = query.eq("status", params.status)

      const { data, error } = await query

      if (error) {
        return { source: "supabase" as const, data: [] as AiConversation[], error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: (data ?? []).map((row) => mapConversationRow(row as ConversationRowCompat)), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiConversation[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  const filtered = state.conversations.filter((conversation) => {
    if (params?.tripId && conversation.tripId !== params.tripId) return false
    if (params?.userId && conversation.userId !== params.userId) return false
    if (params?.agencyId && conversation.agencyId !== params.agencyId) return false
    if (params?.clientId && conversation.clientId !== params.clientId) return false
    if (params?.channel && conversation.channel !== params.channel) return false
    if (params?.status && conversation.status !== params.status) return false
    return true
  })

  return { source: "local" as const, data: filtered, error: null }
}

export async function listConversationsByTrip(tripId: string) {
  return listConversations({ tripId })
}

export async function getConversation(conversationId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("ai_conversations").select("*").eq("id", conversationId).maybeSingle()
      if (error) {
        return { source: "supabase" as const, data: null as AiConversation | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: data ? mapConversationRow(data as ConversationRowCompat) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiConversation | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.conversations.find((conversation) => conversation.id === conversationId) || null, error: null }
}

export async function createConversation(payload: CreateConversationPayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["ai_conversations"]["Insert"] = {
        trip_id: payload.tripId,
        owner_user_id: payload.userId,
        agency_id: payload.agencyId,
        client_id: payload.clientId,
        source: payload.channel,
        title: payload.title ?? "Concierge",
        last_message: null,
        last_message_at: null,
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_conversations").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiConversation | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: mapConversationRow(data as ConversationRowCompat), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiConversation | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const conversation: AiConversation = {
    id: `ai-conv-${Date.now()}`,
    tripId: payload.tripId,
    userId: payload.userId,
    agencyId: payload.agencyId,
    clientId: payload.clientId,
    channel: payload.channel,
    status: "open",
    title: payload.title ?? "Concierge",
    lastMessage: null,
    lastMessageAt: null,
    metadata: payload.metadata ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const state = readAiState()
  writeAiState({ ...state, conversations: [conversation, ...state.conversations] })
  return { source: "local" as const, data: conversation, error: null }
}

export async function listMessages(conversationId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })

      if (error) {
        return { source: "supabase" as const, data: [] as AiMessage[], error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapMessageRow), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiMessage[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.messages.filter((message) => message.conversationId === conversationId), error: null }
}

export async function listMessagesByConversationIds(conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return { source: shouldUseSupabase() ? ("supabase" as const) : ("local" as const), data: [] as AiMessage[], error: null }
  }

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("ai_messages")
        .select("*")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true })

      if (error) {
        return { source: "supabase" as const, data: [] as AiMessage[], error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapMessageRow), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiMessage[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return {
    source: "local" as const,
    data: state.messages.filter((message) => conversationIds.includes(message.conversationId)),
    error: null,
  }
}

export async function addMessage(payload: AddMessagePayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["ai_messages"]["Insert"] = {
        conversation_id: payload.conversationId,
        role: payload.role,
        content: payload.content,
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_messages").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiMessage | null, error: mapAiSchemaError(error.message) }
      }

      const { error: conversationError } = await client
        .from("ai_conversations")
        .update({
          last_message: payload.content,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", payload.conversationId)

      if (conversationError) {
        console.error("[CONCIERGE] conversation last message update error", mapAiSchemaError(conversationError.message))
      }

      return { source: "supabase" as const, data: mapMessageRow(data), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiMessage | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const message: AiMessage = {
    id: `ai-msg-${Date.now()}`,
    conversationId: payload.conversationId,
    tripId: payload.tripId,
    userId: payload.userId,
    agencyId: payload.agencyId,
    clientId: payload.clientId,
    role: payload.role,
    content: payload.content,
    creditsUsed: payload.creditsUsed ?? 0,
    metadata: payload.metadata ?? {},
    createdAt: new Date().toISOString(),
  }

  const state = readAiState()
  writeAiState({ ...state, messages: [...state.messages, message] })
  return { source: "local" as const, data: message, error: null }
}

export async function updateConversationStatus(conversationId: string, status: AiConversation["status"]) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("ai_conversations")
        .update({ status })
        .eq("id", conversationId)
        .select("*")
        .maybeSingle()

      if (error) {
        return { source: "supabase" as const, data: null as AiConversation | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: data ? mapConversationRow(data as ConversationRowCompat) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiConversation | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  let updatedConversation: AiConversation | null = null

  const conversations = state.conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation

    updatedConversation = {
      ...conversation,
      status,
      updatedAt: new Date().toISOString(),
    }

    return updatedConversation
  })

  writeAiState({ ...state, conversations })
  return { source: "local" as const, data: updatedConversation, error: null }
}

export async function logAiUsage(payload: LogAiUsagePayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["ai_usage_logs"]["Insert"] = {
        owner_user_id: payload.ownerUserId ?? null,
        trip_id: payload.tripId,
        agency_id: payload.agencyId,
        conversation_id: payload.conversationId ?? null,
        message_id: payload.messageId ?? null,
        feature: payload.feature,
        model: payload.model ?? null,
        input_tokens: payload.inputTokens ?? 0,
        output_tokens: payload.outputTokens ?? 0,
        total_tokens: payload.totalTokens ?? 0,
        credit_amount: payload.creditAmount ?? 0,
        status: payload.status ?? "completed",
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_usage_logs").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiUsageLog | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: mapUsageLogRow(data as UsageLogRowCompat), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiUsageLog | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const usageLog: AiUsageLog = {
    id: `ai-usage-${Date.now()}`,
    ownerUserId: payload.ownerUserId ?? null,
    tripId: payload.tripId,
    agencyId: payload.agencyId,
    conversationId: payload.conversationId ?? null,
    messageId: payload.messageId ?? null,
    feature: payload.feature,
    model: payload.model ?? null,
    inputTokens: payload.inputTokens ?? 0,
    outputTokens: payload.outputTokens ?? 0,
    totalTokens: payload.totalTokens ?? 0,
    creditAmount: payload.creditAmount ?? 0,
    status: payload.status ?? "completed",
    metadata: payload.metadata ?? {},
    createdAt: new Date().toISOString(),
  }

  const state = readAiState()
  writeAiState({ ...state, usageLogs: [usageLog, ...state.usageLogs] })
  return { source: "local" as const, data: usageLog, error: null }
}

export async function listAiUsageLogs(params?: ListAiUsageLogsParams) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      let query = client.from("ai_usage_logs").select("*").order("created_at", { ascending: false })

      if (params?.ownerUserId) query = query.eq("owner_user_id", params.ownerUserId)
      if (params?.agencyId) query = query.eq("agency_id", params.agencyId)
      if (params?.tripId) query = query.eq("trip_id", params.tripId)
      if (params?.feature) query = query.eq("feature", params.feature)
      if (params?.status) query = query.eq("status", params.status)
      if (params?.limit) query = query.limit(params.limit)

      const { data, error } = await query
      if (error) {
        return { source: "supabase" as const, data: [] as AiUsageLog[], error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: (data ?? []).map((row) => mapUsageLogRow(row as UsageLogRowCompat)), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiUsageLog[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  let data = [...state.usageLogs]
  if (params?.ownerUserId) data = data.filter((log) => log.ownerUserId === params.ownerUserId)
  if (params?.agencyId) data = data.filter((log) => log.agencyId === params.agencyId)
  if (params?.tripId) data = data.filter((log) => log.tripId === params.tripId)
  if (params?.feature) data = data.filter((log) => log.feature === params.feature)
  if (params?.status) data = data.filter((log) => log.status === params.status)
  if (params?.limit) data = data.slice(0, params.limit)
  return { source: "local" as const, data, error: null }
}

export async function listPrompts(params?: ListPromptsParams) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      let query = client.from("ai_prompts").select("*").order("updated_at", { ascending: false })
      if (params?.module) query = query.eq("module", params.module)
      if (!params?.includeInactive) query = query.eq("is_active", true)

      const { data, error } = await query
      if (error) {
        return { source: "supabase" as const, data: [] as AiPrompt[], error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: (data ?? []).map((row) => mapPromptRow(row as PromptRowCompat)), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiPrompt[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  const prompts = state.prompts.filter((prompt) => {
    if (params?.module && prompt.module !== params.module) return false
    if (!params?.includeInactive && !prompt.isActive) return false
    return true
  })
  return { source: "local" as const, data: prompts, error: null }
}

export async function listActivePrompts(module: AiModule) {
  return listPrompts({ module: module as PromptModule, includeInactive: false })
}

export async function getPromptByCode(code: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("ai_prompts").select("*").eq("code", code).maybeSingle()
      if (error) {
        return { source: "supabase" as const, data: null as AiPrompt | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: data ? mapPromptRow(data as PromptRowCompat) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiPrompt | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.prompts.find((prompt) => prompt.code === code) || null, error: null }
}

export async function updatePrompt(
  promptId: string,
  payload: Partial<Pick<AiPrompt, "name" | "module" | "systemPrompt" | "userPromptTemplate" | "isActive" | "version" | "metadata">>
) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const updatePayload: Database["public"]["Tables"]["ai_prompts"]["Update"] = {
        name: payload.name,
        module: payload.module as Database["public"]["Tables"]["ai_prompts"]["Update"]["module"],
        system_prompt: payload.systemPrompt,
        user_prompt_template: payload.userPromptTemplate,
        is_active: payload.isActive,
        version: payload.version,
        metadata: payload.metadata as Database["public"]["Tables"]["ai_prompts"]["Update"]["metadata"],
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await client
        .from("ai_prompts")
        .update(updatePayload)
        .eq("id", promptId)
        .select("*")
        .maybeSingle()

      if (error) {
        return { source: "supabase" as const, data: null as AiPrompt | null, error: mapAiSchemaError(error.message) }
      }

      return { source: "supabase" as const, data: data ? mapPromptRow(data as PromptRowCompat) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AiPrompt | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  let updatedPrompt: AiPrompt | null = null
  const prompts = state.prompts.map((prompt) => {
    if (prompt.id !== promptId) return prompt

    updatedPrompt = {
      ...prompt,
      name: payload.name ?? prompt.name,
      module: payload.module ?? prompt.module,
      systemPrompt: payload.systemPrompt ?? prompt.systemPrompt,
      userPromptTemplate: payload.userPromptTemplate ?? prompt.userPromptTemplate,
      isActive: payload.isActive ?? prompt.isActive,
      version: payload.version ?? prompt.version,
      metadata: payload.metadata ?? prompt.metadata,
      updatedAt: new Date().toISOString(),
    }
    return updatedPrompt
  })

  writeAiState({ ...state, prompts })
  return { source: "local" as const, data: updatedPrompt, error: null }
}
