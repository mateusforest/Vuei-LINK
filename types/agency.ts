export type AgencyPlan = "starter" | "pro" | "enterprise"
export type AgencyPlanCode = AgencyPlan

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
