export type CreditOwnerType = "profile" | "agency" | "client"

export type CreditTransactionType =
  | "grant"
  | "purchase"
  | "consume"
  | "usage_ai"
  | "usage_concierge"
  | "usage_document"
  | "usage_itinerary"
  | "refund"
  | "adjustment"
  | "plan_included"

export interface CreditBalance {
  ownerType: CreditOwnerType
  ownerId: string
  balance: number
  updatedAt: string
}

export interface CreditTransaction {
  id: string
  ownerType: CreditOwnerType
  ownerId: string
  amount: number
  type: CreditTransactionType
  reason: string
  relatedTripId: string | null
  relatedDocumentId: string | null
  source: string | null
  createdAt: string
  balanceAfter?: number | null
  metadata?: Record<string, unknown>
  createdBy?: string | null
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  code: string
  name: string
  ownerType: CreditOwnerType
  monthlyCredits: number
  price: number
  isActive: boolean
  limits: Record<string, number | boolean>
  createdAt: string
  updatedAt: string
}

export type TravelerPlanCode = "free" | "premium"
export type TravelerSubscriptionStatus = "free" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid"
export type VueiPlusSubscriptionStatus = "none" | Exclude<TravelerSubscriptionStatus, "free">
export type TravelerMembershipState = "NONE" | "VUEI_PLUS_ACTIVE" | "PREMIUM_LEGACY"

export interface TravelerMembershipCapabilities {
  hasVueiPlus: boolean
  isPremiumLegacy: boolean
  canAccessArchivedTrips: boolean
  canAccessArchivedDocuments: boolean
}

export interface TravelerMembershipStatusSummary extends TravelerMembershipCapabilities {
  state: TravelerMembershipState
  vueiPlusStatus: VueiPlusSubscriptionStatus
  vueiPlusCurrentPeriodEnd: string | null
  vueiPlusCancelAtPeriodEnd: boolean
  vueiPlusStripeSubscriptionId: string | null
  stripeCustomerId: string | null
  legacyPlanCode: TravelerPlanCode
  legacySubscriptionStatus: TravelerSubscriptionStatus
}

export interface TravelerCreditBalanceSummary {
  planCreditsAvailable: number
  purchasedCreditsAvailable: number
  totalAvailable: number
  currentPlan: TravelerPlanCode
  currentPeriodEnd: string | null
}

export interface TravelerBillingStatusSummary extends TravelerCreditBalanceSummary {
  subscriptionStatus: TravelerSubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
  maxActiveTrips: number | null
}
