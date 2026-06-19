"use client"

export const CREDIT_BALANCE_CHANGED_EVENT = "vuei:credits-updated"

export type CreditBalanceChangedDetail = {
  ownerType?: "traveler" | "agency" | null
  amount?: number | null
  feature?: "concierge" | "itinerary_generation" | "flight_extraction" | null
}

export function dispatchCreditBalanceChanged(detail: CreditBalanceChangedDetail = {}) {
  if (typeof window === "undefined") return

  window.dispatchEvent(
    new CustomEvent<CreditBalanceChangedDetail>(CREDIT_BALANCE_CHANGED_EVENT, {
      detail,
    }),
  )
}
