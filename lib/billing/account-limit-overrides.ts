import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

type SupabaseDbClient = SupabaseClient<Database>
type LimitOverrideRow = Database["public"]["Tables"]["account_limit_overrides"]["Row"]

export type AccountLimitOwnerType = "agency" | "traveler"
export type AccountLimitType = "clients" | "active_trips"

function isOptionalOverridesSourceError(message?: string | null) {
  const normalized = (message ?? "").toLowerCase()
  return (
    normalized.includes("account_limit_overrides") ||
    normalized.includes("permission denied") ||
    normalized.includes("forbidden")
  )
}

function mapOverrideRow(row: LimitOverrideRow) {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    limitType: row.limit_type,
    quantity: row.quantity,
    reason: row.reason,
    ticketId: row.ticket_id,
    grantedBy: row.granted_by,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export async function getAccountLimitOverrideQuantity(
  client: SupabaseDbClient,
  params: {
    ownerType: AccountLimitOwnerType
    ownerId: string
    limitType: AccountLimitType
    atIso?: string
  },
) {
  const referenceIso = params.atIso ?? new Date().toISOString()

  const { data, error } = await (client.from("account_limit_overrides") as any)
    .select("*")
    .eq("owner_type", params.ownerType)
    .eq("owner_id", params.ownerId)
    .eq("limit_type", params.limitType)

  if (error) {
    if (isOptionalOverridesSourceError(error.message)) {
      return { data: 0, error: null }
    }
    return { data: 0, error: error.message }
  }

  const activeRows = ((data as LimitOverrideRow[] | null) ?? []).filter((row) => {
    return !row.expires_at || row.expires_at > referenceIso
  })

  return {
    data: activeRows.reduce((sum, row) => sum + Math.max(row.quantity ?? 0, 0), 0),
    error: null,
  }
}

export async function createAccountLimitOverride(
  client: SupabaseDbClient,
  params: {
    ownerType: AccountLimitOwnerType
    ownerId: string
    limitType: AccountLimitType
    quantity: number
    reason: string
    ticketId?: string | null
    grantedBy?: string | null
    expiresAt?: string | null
  },
) {
  const normalizedQuantity = Math.max(Math.trunc(params.quantity), 0)
  if (normalizedQuantity <= 0) {
    return { data: null, error: "Informe uma quantidade positiva para a bonificacao." }
  }

  const { data, error } = await (client.from("account_limit_overrides") as any)
    .insert({
      owner_type: params.ownerType,
      owner_id: params.ownerId,
      limit_type: params.limitType,
      quantity: normalizedQuantity,
      reason: params.reason,
      ticket_id: params.ticketId ?? null,
      granted_by: params.grantedBy ?? null,
      expires_at: params.expiresAt ?? null,
    } as any)
    .select("*")
    .single()

  if (error || !data) {
    return { data: null, error: error?.message ?? "Nao foi possivel registrar a bonificacao de limite." }
  }

  return { data: mapOverrideRow(data as LimitOverrideRow), error: null }
}
