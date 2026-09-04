import type {
  TravelerMembershipCapabilities,
  TravelerMembershipState,
  TravelerMembershipStatusSummary,
  TravelerPlanCode,
  TravelerSubscriptionStatus,
  VueiPlusSubscriptionStatus,
} from "@/types"

export const TRAVELER_VUEI_PLUS_BILLING_SCOPE = "traveler_vuei_plus"
export const TRAVELER_VUEI_PLUS_OFFER = {
  unitAmount: 1490,
  currency: "brl",
  priceLabel: "R$ 14,90/mês",
} as const

export interface TravelerMembershipSnapshot {
  planCode: TravelerPlanCode
  legacyStatus: TravelerSubscriptionStatus
  legacyCurrentPeriodEnd: string | null
  vueiPlusStatus: VueiPlusSubscriptionStatus
  vueiPlusCurrentPeriodEnd: string | null
  vueiPlusCancelAtPeriodEnd: boolean
  vueiPlusStripeSubscriptionId: string | null
  stripeCustomerId: string | null
}

function isWithinPaidPeriod(periodEnd: string | null, at: Date) {
  if (!periodEnd) return true
  const parsed = new Date(periodEnd)
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= at.getTime()
}

export function isTravelerSubscriptionAccessActive(
  status: TravelerSubscriptionStatus | VueiPlusSubscriptionStatus,
  currentPeriodEnd: string | null,
  at = new Date(),
) {
  if (status === "active" || status === "trialing") {
    return isWithinPaidPeriod(currentPeriodEnd, at)
  }

  // Stripe normally keeps cancel_at_period_end subscriptions active. This
  // fallback protects the already-paid window if a canceled event arrives first.
  return status === "canceled" && Boolean(currentPeriodEnd) && isWithinPaidPeriod(currentPeriodEnd, at)
}

export function getTravelerMembershipCapabilities(params: {
  hasVueiPlus: boolean
  isPremiumLegacy: boolean
}): TravelerMembershipCapabilities {
  const canAccessArchive = params.hasVueiPlus || params.isPremiumLegacy

  return {
    hasVueiPlus: params.hasVueiPlus,
    isPremiumLegacy: params.isPremiumLegacy,
    canAccessArchivedTrips: canAccessArchive,
    canAccessArchivedDocuments: canAccessArchive,
  }
}

export function resolveTravelerMembership(
  snapshot: TravelerMembershipSnapshot,
  at = new Date(),
): TravelerMembershipStatusSummary {
  const isPremiumLegacy =
    snapshot.planCode === "premium" &&
    isTravelerSubscriptionAccessActive(snapshot.legacyStatus, snapshot.legacyCurrentPeriodEnd, at)
  const hasVueiPlus = isTravelerSubscriptionAccessActive(
    snapshot.vueiPlusStatus,
    snapshot.vueiPlusCurrentPeriodEnd,
    at,
  )
  const state: TravelerMembershipState = isPremiumLegacy
    ? "PREMIUM_LEGACY"
    : hasVueiPlus
      ? "VUEI_PLUS_ACTIVE"
      : "NONE"
  const capabilities = getTravelerMembershipCapabilities({ hasVueiPlus, isPremiumLegacy })

  return {
    state,
    ...capabilities,
    vueiPlusStatus: snapshot.vueiPlusStatus,
    vueiPlusCurrentPeriodEnd: snapshot.vueiPlusCurrentPeriodEnd,
    vueiPlusCancelAtPeriodEnd: snapshot.vueiPlusCancelAtPeriodEnd,
    vueiPlusStripeSubscriptionId: snapshot.vueiPlusStripeSubscriptionId,
    stripeCustomerId: snapshot.stripeCustomerId,
    legacyPlanCode: snapshot.planCode,
    legacySubscriptionStatus: snapshot.legacyStatus,
  }
}
