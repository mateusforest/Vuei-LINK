import "server-only"

import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

type SupabaseDbClient = SupabaseClient<Database>

interface AgencyBillingActor {
  user: User
  agencyId: string
  agencyName: string
  stripeCustomerId: string | null
  planCode: "free" | "start" | "pro" | "business"
  canManageBilling: boolean
}

export async function resolveAgencyBillingActor(
  serverClient: SupabaseDbClient,
  adminClient: SupabaseDbClient,
): Promise<{ data: AgencyBillingActor | null; error: string | null; status?: number }> {
  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser()

  if (authError) {
    return { data: null, error: authError.message, status: 401 }
  }

  if (!user) {
    return { data: null, error: "Entre para gerenciar o billing da agência.", status: 401 }
  }

  const profileResult = await adminClient
    .from("profiles")
    .select("agency_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileResult.error) {
    return { data: null, error: profileResult.error.message, status: 500 }
  }

  const profile = profileResult.data as { agency_id?: string | null; role?: string | null } | null

  let agencyId = profile?.agency_id ?? null
  if (!agencyId) {
    const ownerAgencyResult = await adminClient
      .from("agencies")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle()

    if (ownerAgencyResult.error) {
      return { data: null, error: ownerAgencyResult.error.message, status: 500 }
    }

    agencyId = (ownerAgencyResult.data as { id?: string | null } | null)?.id ?? null
  }

  if (!agencyId) {
    return { data: null, error: "Nenhuma agência vinculada foi encontrada para este usuário.", status: 404 }
  }

  const [agencyResult, subscriptionResult, membershipResult] = await Promise.all([
    adminClient
      .from("agencies")
      .select("id, name, owner_user_id")
      .eq("id", agencyId)
      .maybeSingle(),
    (adminClient.from("agency_subscriptions" as any) as any)
      .select("plan_code, stripe_customer_id")
      .eq("agency_id", agencyId)
      .maybeSingle(),
    adminClient
      .from("agency_members")
      .select("role, status")
      .eq("agency_id", agencyId)
      .eq("profile_id", user.id)
      .maybeSingle(),
  ])

  if (agencyResult.error) {
    return { data: null, error: agencyResult.error.message, status: 500 }
  }

  if (subscriptionResult.error) {
    return { data: null, error: subscriptionResult.error.message, status: 500 }
  }

  if (membershipResult.error && membershipResult.error.code !== "PGRST116") {
    return { data: null, error: membershipResult.error.message, status: 500 }
  }

  const agency = agencyResult.data as { id: string; name: string; owner_user_id: string | null } | null
  if (!agency) {
    return { data: null, error: "Agência não encontrada.", status: 404 }
  }

  const membership = membershipResult.data as { role?: string | null; status?: string | null } | null
  const isMaster = profile?.role === "master"
  const isOwner = agency.owner_user_id === user.id
  const isAdminMember = membership?.status === "active" && (membership.role === "owner" || membership.role === "admin")

  return {
    data: {
      user,
      agencyId: agency.id,
      agencyName: agency.name,
      stripeCustomerId: ((subscriptionResult.data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id) ?? null,
      planCode: ((((subscriptionResult.data as { plan_code?: string | null } | null)?.plan_code) ?? "free") as "free" | "start" | "pro" | "business"),
      canManageBilling: Boolean(isMaster || isOwner || isAdminMember),
    },
    error: null,
  }
}
