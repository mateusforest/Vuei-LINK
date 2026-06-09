import type { SupabaseServerClient } from "@/lib/supabase/server"
import type { AiUsageFeature, AiUsageStatus } from "@/types"

interface CreateAiUsageLogPayload {
  ownerUserId?: string | null
  agencyId?: string | null
  tripId?: string | null
  conversationId?: string | null
  messageId?: string | null
  feature: AiUsageFeature
  model?: string | null
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  creditAmount?: number
  status?: AiUsageStatus
  metadata?: Record<string, unknown> | null
}

export async function createAiUsageLog(
  client: SupabaseServerClient,
  payload: CreateAiUsageLogPayload,
) {
  const { data, error } = await client
    .from("ai_usage_logs")
    .insert({
      owner_user_id: payload.ownerUserId ?? null,
      agency_id: payload.agencyId ?? null,
      trip_id: payload.tripId ?? null,
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
    })
    .select("*")
    .single()

  return {
    data,
    error: error?.message ?? null,
  }
}
