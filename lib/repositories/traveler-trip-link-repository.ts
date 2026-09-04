import type { TravelerTripLinkProductCode } from "@/lib/billing/traveler-trip-link-catalog"
import type { TravelerTripLinkProductsSummary, TravelerTripLinkStoreSummary } from "@/types"

export const TRAVELER_TRIP_LINK_BALANCE_CHANGED_EVENT = "vuei:traveler-trip-link-balance-changed"

export function notifyTravelerTripLinkBalanceChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TRAVELER_TRIP_LINK_BALANCE_CHANGED_EVENT))
  }
}

export async function getTravelerTripLinkStoreSummary() {
  try {
    const response = await fetch("/api/billing/traveler/trip-links", {
      method: "GET",
      cache: "no-store",
    })
    const body = await response.json().catch(() => null) as TravelerTripLinkStoreSummary | { error?: string } | null

    if (!response.ok) {
      return {
        data: null as TravelerTripLinkStoreSummary | null,
        error: body && "error" in body && typeof body.error === "string"
          ? body.error
          : "Nao foi possivel consultar as viagens disponiveis.",
      }
    }

    return {
      data: body as TravelerTripLinkStoreSummary,
      error: null as string | null,
    }
  } catch (error) {
    return {
      data: null as TravelerTripLinkStoreSummary | null,
      error: error instanceof Error ? error.message : "Nao foi possivel consultar as viagens disponiveis.",
    }
  }
}

export async function getPublicTravelerTripLinkProducts() {
  try {
    const response = await fetch("/api/billing/traveler/trip-links/products", {
      method: "GET",
      cache: "no-store",
    })
    const body = await response.json().catch(() => null) as TravelerTripLinkProductsSummary | { error?: string } | null

    if (!response.ok || !body || !("products" in body)) {
      return {
        data: null as TravelerTripLinkProductsSummary | null,
        error: body && "error" in body && typeof body.error === "string"
          ? body.error
          : "Não foi possível carregar as opções de viagem.",
      }
    }

    return {
      data: body as TravelerTripLinkProductsSummary,
      error: null as string | null,
    }
  } catch (error) {
    return {
      data: null as TravelerTripLinkProductsSummary | null,
      error: error instanceof Error ? error.message : "Não foi possível carregar as opções de viagem.",
    }
  }
}

export async function createTravelerTripLinkCheckout(
  packageCode: TravelerTripLinkProductCode,
  tripId?: string | null,
) {
  try {
    const response = await fetch("/api/billing/traveler/trip-links/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageCode, tripId: tripId ?? undefined }),
    })
    const body = await response.json().catch(() => null) as { url?: string; error?: string } | null

    if (!response.ok || !body?.url) {
      return {
        data: null as { url: string } | null,
        error: body?.error ?? "Nao foi possivel iniciar a compra de viagens.",
      }
    }

    return {
      data: { url: body.url },
      error: null as string | null,
    }
  } catch (error) {
    return {
      data: null as { url: string } | null,
      error: error instanceof Error ? error.message : "Nao foi possivel iniciar a compra de viagens.",
    }
  }
}
