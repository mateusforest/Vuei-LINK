import type { AiConversation, AiMessage, AiModule, AiUsageLog } from "@/types"
import {
  createSupabaseBrowserClient,
  createSupabaseBrowserClientPlaceholder,
} from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

const AI_STORAGE_KEY = "vuei_ai_repository"
const AI_SCHEMA_VERSION = 1

interface StoredPrompt {
  id: string
  code: string
  name: string
  module: AiModule
  systemPrompt: string
  userPromptTemplate: string | null
  isActive: boolean
  version: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface AiRepositoryState {
  schemaVersion: number
  conversations: AiConversation[]
  messages: AiMessage[]
  usageLogs: AiUsageLog[]
  prompts: StoredPrompt[]
}

interface CreateConversationPayload {
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  channel: Extract<AiModule, "concierge" | "itinerary" | "documents" | "ticket_reader">
  metadata?: Record<string, unknown> | null
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
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  module: AiModule
  action: string
  creditsUsed?: number
  metadata?: Record<string, unknown> | null
}

const DEFAULT_PROMPTS: StoredPrompt[] = [
  {
    id: "prompt-concierge-default",
    code: "concierge-default",
    name: "Concierge Default",
    module: "concierge",
    systemPrompt: "Voce e o concierge do Vuei. Responda com clareza e foco na viagem.",
    userPromptTemplate: "{message}",
    isActive: true,
    version: 1,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function mapConversationRow(row: Database["public"]["Tables"]["ai_conversations"]["Row"]): AiConversation {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    agencyId: row.agency_id,
    clientId: row.client_id,
    channel: row.channel,
    status: row.status,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageRow(row: Database["public"]["Tables"]["ai_messages"]["Row"]): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tripId: row.trip_id,
    userId: row.user_id,
    agencyId: row.agency_id,
    clientId: row.client_id,
    role: row.role,
    content: row.content,
    creditsUsed: row.credits_used,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

function mapUsageLogRow(row: Database["public"]["Tables"]["ai_usage_logs"]["Row"]): AiUsageLog {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    agencyId: row.agency_id,
    clientId: row.client_id,
    module: row.module,
    action: row.action,
    creditsUsed: row.credits_used,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }
}

function mapPromptRow(row: Database["public"]["Tables"]["ai_prompts"]["Row"]): StoredPrompt {
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

export async function listConversationsByTrip(tripId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("ai_conversations")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })

      if (error) {
        return { source: "supabase" as const, data: [] as AiConversation[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapConversationRow), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AiConversation[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.conversations.filter((conversation) => conversation.tripId === tripId), error: null }
}

export async function getConversation(conversationId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("ai_conversations").select("*").eq("id", conversationId).maybeSingle()
      if (error) {
        return { source: "supabase" as const, data: null as AiConversation | null, error: error.message }
      }

      return { source: "supabase" as const, data: data ? mapConversationRow(data) : null, error: null }
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
        user_id: payload.userId,
        agency_id: payload.agencyId,
        client_id: payload.clientId,
        channel: payload.channel,
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_conversations").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiConversation | null, error: error.message }
      }

      return { source: "supabase" as const, data: mapConversationRow(data), error: null }
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
        return { source: "supabase" as const, data: [] as AiMessage[], error: error.message }
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

export async function addMessage(payload: AddMessagePayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["ai_messages"]["Insert"] = {
        conversation_id: payload.conversationId,
        trip_id: payload.tripId,
        user_id: payload.userId,
        agency_id: payload.agencyId,
        client_id: payload.clientId,
        role: payload.role,
        content: payload.content,
        credits_used: payload.creditsUsed ?? 0,
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_messages").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiMessage | null, error: error.message }
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

export async function logAiUsage(payload: LogAiUsagePayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["ai_usage_logs"]["Insert"] = {
        trip_id: payload.tripId,
        user_id: payload.userId,
        agency_id: payload.agencyId,
        client_id: payload.clientId,
        module: payload.module,
        action: payload.action,
        credits_used: payload.creditsUsed ?? 0,
        metadata: payload.metadata ?? {},
      }

      const { data, error } = await client.from("ai_usage_logs").insert(insertPayload).select("*").single()
      if (error) {
        return { source: "supabase" as const, data: null as AiUsageLog | null, error: error.message }
      }

      return { source: "supabase" as const, data: mapUsageLogRow(data), error: null }
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
    tripId: payload.tripId,
    userId: payload.userId,
    agencyId: payload.agencyId,
    clientId: payload.clientId,
    module: payload.module,
    action: payload.action,
    creditsUsed: payload.creditsUsed ?? 0,
    metadata: payload.metadata ?? {},
    createdAt: new Date().toISOString(),
  }

  const state = readAiState()
  writeAiState({ ...state, usageLogs: [usageLog, ...state.usageLogs] })
  return { source: "local" as const, data: usageLog, error: null }
}

export async function listActivePrompts(module: AiModule) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("ai_prompts")
        .select("*")
        .eq("module", module)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })

      if (error) {
        return { source: "supabase" as const, data: [] as StoredPrompt[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapPromptRow), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as StoredPrompt[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.prompts.filter((prompt) => prompt.module === module && prompt.isActive), error: null }
}

export async function getPromptByCode(code: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("ai_prompts").select("*").eq("code", code).maybeSingle()
      if (error) {
        return { source: "supabase" as const, data: null as StoredPrompt | null, error: error.message }
      }

      return { source: "supabase" as const, data: data ? mapPromptRow(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as StoredPrompt | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.prompts.find((prompt) => prompt.code === code) || null, error: null }
}
