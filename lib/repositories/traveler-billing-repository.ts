import type { TravelerBillingStatusSummary, TravelerMembershipStatusSummary } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"

interface BillingRedirectResponse {
  url?: string | null
  error?: string | null
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

export async function getTravelerBillingStatus() {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: null as TravelerBillingStatusSummary | null, error: null }
  }

  const response = await fetch("/api/billing/traveler/status", {
    method: "GET",
    cache: "no-store",
  })

  const data = await parseJson<TravelerBillingStatusSummary & { error?: string }>(response)

  return {
    source: "api" as const,
    data: response.ok && data ? data : null,
    error: response.ok ? null : data?.error ?? "Nao foi possivel carregar o billing traveler.",
  }
}

export async function createTravelerPremiumCheckout() {
  const response = await fetch("/api/billing/traveler/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planCode: "premium" }),
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel iniciar o checkout Premium.",
  }
}

export async function getTravelerVueiPlusStatus() {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: null as TravelerMembershipStatusSummary | null, error: null }
  }

  const response = await fetch("/api/billing/traveler/vuei-plus/status", {
    method: "GET",
    cache: "no-store",
  })
  const data = await parseJson<TravelerMembershipStatusSummary & { error?: string }>(response)

  return {
    source: "api" as const,
    data: response.ok && data ? data : null,
    error: response.ok ? null : data?.error ?? "Nao foi possivel carregar o Vuei+.",
  }
}

export async function createTravelerVueiPlusCheckout() {
  const response = await fetch("/api/billing/traveler/vuei-plus/checkout", { method: "POST" })
  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel iniciar o checkout Vuei+.",
  }
}

export async function createTravelerCreditsCheckout(packageCode: "starter" | "popular" | "pro") {
  const response = await fetch("/api/billing/traveler/credits/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ packageCode }),
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel iniciar o checkout de creditos.",
  }
}

export async function createTravelerCustomerPortal() {
  const response = await fetch("/api/billing/traveler/portal", {
    method: "POST",
  })

  const data = await parseJson<BillingRedirectResponse>(response)

  return {
    data,
    error: response.ok ? null : data?.error ?? "Nao foi possivel abrir o portal de assinatura.",
  }
}
