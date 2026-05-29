import type { AiConversation, AiMessage, AiModule, AiUsageLog } from "@/types"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"

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
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: [] as AiConversation[] }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.conversations.filter((conversation) => conversation.tripId === tripId) }
}

export async function getConversation(conversationId: string) {
  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: null as AiConversation | null }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.conversations.find((conversation) => conversation.id === conversationId) || null }
}

export async function createConversation(payload: CreateConversationPayload) {
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

  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: conversation }
  }

  const state = readAiState()
  writeAiState({ ...state, conversations: [conversation, ...state.conversations] })
  return { source: "local" as const, data: conversation }
}

export async function listMessages(conversationId: string) {
  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: [] as AiMessage[] }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.messages.filter((message) => message.conversationId === conversationId) }
}

export async function addMessage(payload: AddMessagePayload) {
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

  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: message }
  }

  const state = readAiState()
  writeAiState({ ...state, messages: [...state.messages, message] })
  return { source: "local" as const, data: message }
}

export async function logAiUsage(payload: LogAiUsagePayload) {
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

  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: usageLog }
  }

  const state = readAiState()
  writeAiState({ ...state, usageLogs: [usageLog, ...state.usageLogs] })
  return { source: "local" as const, data: usageLog }
}

export async function listActivePrompts(module: AiModule) {
  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: [] as StoredPrompt[] }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.prompts.filter((prompt) => prompt.module === module && prompt.isActive) }
}

export async function getPromptByCode(code: string) {
  if (shouldUseSupabase()) {
    return { source: "supabase-placeholder" as const, config: createSupabaseBrowserClientPlaceholder(), data: null as StoredPrompt | null }
  }

  const state = readAiState()
  return { source: "local" as const, data: state.prompts.find((prompt) => prompt.code === code) || null }
}
