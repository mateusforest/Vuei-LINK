export type AgencyPlan = "starter" | "pro" | "enterprise"
export type AgencyPlanCode = AgencyPlan
export type AgencyCommercialPlanCode = "free" | "start" | "pro" | "business"
export type AgencySubscriptionStatus =
  | "active"
  | "inactive"
  | "cancelled"
  | "incomplete"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"

export type AgencyStatus = "pending" | "active" | "suspended" | "archived"

export interface AgencyNotificationSettings {
  concierge: boolean
  trips: boolean
  credits: boolean
  newClients: boolean
}

export interface AgencySettings {
  email: string | null
  phone: string | null
  cnpj: string | null
  address: string | null
  notifications: AgencyNotificationSettings
  twoFactorEnabled: boolean
}

export interface AgencyBranding {
  logoUrl: string | null
  linkLogoUrl?: string | null
}

export interface Agency {
  id: string
  name: string
  slug: string
  logo: string | null
  ownerUserId: string | null
  plan: AgencyPlan
  status: AgencyStatus
  creditsBalance: number
  settings: AgencySettings | null
  branding: AgencyBranding | null
  createdAt: string
  updatedAt: string
}

export interface AgencyPlanDefinition {
  code: AgencyCommercialPlanCode
  name: string
  priceLabel: string
  monthlyCredits: number
  maxUsers: number
  maxClients: number | null
  maxActiveTrips: number
  badge?: string
  features: string[]
}

export interface AgencyBillingStatusSummary {
  agencyId: string | null
  planCode: AgencyCommercialPlanCode
  status: AgencySubscriptionStatus
  startedAt: string | null
  expiresAt: string | null
  maxUsers: number
  maxClients: number | null
  maxActiveTrips: number
  monthlyCredits: number
  features: string[]
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}

export interface AgencyPlanSnapshot {
  code: AgencyCommercialPlanCode
  definition: AgencyPlanDefinition
  status: AgencySubscriptionStatus
  startedAt: string | null
  expiresAt: string | null
}

export interface AgencyCreditBalanceSummary {
  planCreditsAvailable: number
  purchasedCreditsAvailable: number
  totalAvailable: number
  currentPlan: AgencyCommercialPlanCode
  currentPeriodEnd: string | null
  usedCredits: number
}

export interface AgencyBillingApiStatus extends AgencyCreditBalanceSummary {
  agencyId: string | null
  planCode: AgencyCommercialPlanCode
  status: AgencySubscriptionStatus
  maxUsers: number
  maxClients: number | null
  maxActiveTrips: number
  monthlyCredits: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  cancelAtPeriodEnd: boolean
  canManageBilling: boolean
}

export interface AgencyLimitDialogState {
  kind: "trip_limit" | "team_limit" | "client_limit"
  title: string
  description: string
  actionLabel: string
  actionHref?: string | null
}
