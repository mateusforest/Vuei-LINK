import type { AgencyBillingApiStatus, AgencyBillingStatusSummary, AgencyCommercialPlanCode } from "@/types"
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

interface BillingRedirectResponse {
  url?: string | null
  error?: string | null
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
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

export async function getAgencyBillingStatusFromApi() {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: null as AgencyBillingApiStatus | null, error: null }
  }

  const response = await fetch("/api/billing/agency/status", {
    method: "GET",
    cache: "no-store",
  })

  const data = await parseJson<AgencyBillingApiStatus & { error?: string }>(response)

  return {
    source: "api" as const,
    data: response.ok && data ? data : null,
    error: response.ok ? null : data?.error ?? "Nao foi possivel carregar o billing da agencia.",
  }
}

export async function createAgencyPlanCheckout(planCode: "start" | "pro" | "business") {
  const response = await fetch("/api/billing/agency/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planCode }),
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel iniciar o checkout da agencia.",
  }
}

export async function createAgencyCreditsCheckout(packageCode: "starter" | "popular" | "pro") {
  const response = await fetch("/api/billing/agency/credits/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ packageCode }),
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel iniciar o checkout de creditos da agencia.",
  }
}

export async function createAgencyCustomerPortal() {
  const response = await fetch("/api/billing/agency/portal", {
    method: "POST",
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel abrir o portal de assinatura da agencia.",
  }
}
