import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type { AgencyBillingStatusSummary, AgencyCommercialPlanCode, AgencySubscriptionStatus } from "@/types"
import { AGENCY_PLAN_DEFINITIONS, normalizeAgencyCommercialPlanCode } from "@/lib/billing/agency-plans"

type SupabaseDbClient = SupabaseClient<Database>
type AgencySubscriptionRow = Database["public"]["Tables"]["agency_subscriptions"]["Row"]

function buildAgencyBillingStatus(
  agencyId: string | null,
  planCode: AgencyCommercialPlanCode,
  status: AgencySubscriptionStatus,
  startedAt: string | null,
  expiresAt: string | null,
): AgencyBillingStatusSummary {
  const definition = AGENCY_PLAN_DEFINITIONS[planCode]

  return {
    agencyId,
    planCode,
    status,
    startedAt,
    expiresAt,
    maxUsers: definition.maxUsers,
    maxActiveTrips: definition.maxActiveTrips,
    monthlyCredits: definition.monthlyCredits,
    features: definition.features,
  }
}

export function getDefaultAgencyBillingStatus(agencyId: string | null): AgencyBillingStatusSummary {
  return buildAgencyBillingStatus(agencyId, "start", "active", null, null)
}

export function mapAgencySubscriptionRowToBillingStatus(row: AgencySubscriptionRow | null | undefined): AgencyBillingStatusSummary {
  if (!row) {
    return getDefaultAgencyBillingStatus(null)
  }

  return buildAgencyBillingStatus(
    row.agency_id,
    normalizeAgencyCommercialPlanCode(row.plan_code),
    row.status,
    row.started_at,
    row.expires_at,
  )
}

export async function getAgencyBillingStatusForClient(client: SupabaseDbClient, agencyId: string) {
  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle()

  if (error) {
    return { data: null as AgencyBillingStatusSummary | null, error: error.message }
  }

  return {
    data: data ? mapAgencySubscriptionRowToBillingStatus(data as AgencySubscriptionRow) : getDefaultAgencyBillingStatus(agencyId),
    error: null,
  }
}

export async function upsertAgencySubscriptionForClient(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    planCode: AgencyCommercialPlanCode
    status?: AgencySubscriptionStatus
    startedAt?: string | null
    expiresAt?: string | null
  },
) {
  const nowIso = new Date().toISOString()
  const payload = {
    agency_id: params.agencyId,
    plan_code: params.planCode,
    status: params.status ?? "active",
    started_at: params.startedAt ?? nowIso,
    expires_at: params.expiresAt ?? null,
    updated_at: nowIso,
  }

  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .upsert(payload, { onConflict: "agency_id" })
    .select("*")
    .single()

  if (error) {
    return { data: null as AgencyBillingStatusSummary | null, error: error.message }
  }

  return {
    data: mapAgencySubscriptionRowToBillingStatus(data as AgencySubscriptionRow),
    error: null,
  }
}

export async function countActiveAgencyTripsForClient(client: SupabaseDbClient, agencyId: string) {
  const { count, error } = await client
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", "agency")
    .eq("agency_id", agencyId)
    .in("status", ["draft", "upcoming", "ongoing"])

  return { count: count ?? 0, error: error?.message ?? null }
}

export async function countActiveAgencyMembersForClient(client: SupabaseDbClient, agencyId: string) {
  const { count, error } = await client
    .from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("status", ["active", "pending"])

  return { count: count ?? 0, error: error?.message ?? null }
}
