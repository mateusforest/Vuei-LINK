import type { AgencyBillingStatusSummary, AgencyCommercialPlanCode } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { getDefaultAgencyBillingStatus, getAgencyBillingStatusForClient, upsertAgencySubscriptionForClient } from "@/lib/billing/agency-billing"

const AGENCY_BILLING_STORAGE_KEY = "vuei_agency_billing"

interface PersistedAgencyBillingState {
  subscriptions: Record<
    string,
    {
      agencyId: string
      planCode: AgencyCommercialPlanCode
      status: "active" | "inactive" | "cancelled"
      startedAt: string | null
      expiresAt: string | null
    }
  >
}

function readLocalBillingState(): PersistedAgencyBillingState {
  if (typeof window === "undefined") {
    return { subscriptions: {} }
  }

  try {
    const raw = window.localStorage.getItem(AGENCY_BILLING_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === "object" && parsed.subscriptions ? parsed : { subscriptions: {} }
  } catch {
    return { subscriptions: {} }
  }
}

function writeLocalBillingState(state: PersistedAgencyBillingState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(AGENCY_BILLING_STORAGE_KEY, JSON.stringify(state))
}

function getLocalAgencyBillingStatus(agencyId: string): AgencyBillingStatusSummary {
  const state = readLocalBillingState()
  const saved = state.subscriptions[agencyId]

  if (!saved) {
    return getDefaultAgencyBillingStatus(agencyId)
  }

  const fallback = getDefaultAgencyBillingStatus(agencyId)
  return {
    ...fallback,
    agencyId: saved.agencyId,
    planCode: saved.planCode,
    status: saved.status,
    startedAt: saved.startedAt,
    expiresAt: saved.expiresAt,
  }
}

export async function getAgencyBillingStatus(agencyId: string) {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: getLocalAgencyBillingStatus(agencyId), error: null }
  }

  const client = createSupabaseBrowserClient()
  if (!client) {
    return { source: "supabase-placeholder" as const, data: null as AgencyBillingStatusSummary | null, error: "Supabase browser client indisponivel." }
  }

  const result = await getAgencyBillingStatusForClient(client, agencyId)
  return {
    source: "supabase" as const,
    data: result.data,
    error: result.error,
  }
}

export async function setAgencyPlanSelection(agencyId: string, planCode: AgencyCommercialPlanCode) {
  if (!shouldUseSupabase()) {
    const current = readLocalBillingState()
    current.subscriptions[agencyId] = {
      agencyId,
      planCode,
      status: "active",
      startedAt: current.subscriptions[agencyId]?.startedAt ?? new Date().toISOString(),
      expiresAt: null,
    }
    writeLocalBillingState(current)
    return { source: "local" as const, data: getLocalAgencyBillingStatus(agencyId), error: null }
  }

  const client = createSupabaseBrowserClient()
  if (!client) {
    return { source: "supabase-placeholder" as const, data: null as AgencyBillingStatusSummary | null, error: "Supabase browser client indisponivel." }
  }

  const result = await upsertAgencySubscriptionForClient(client, {
    agencyId,
    planCode,
    status: "active",
  })

  return {
    source: "supabase" as const,
    data: result.data,
    error: result.error,
  }
}
