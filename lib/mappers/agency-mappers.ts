import type { Agency, Client } from "@/types"

export interface LegacyAgencyClient {
  id: string
  name: string
  email?: string
  phone?: string
  document?: string
  notes?: string
  status?: "active" | "inactive"
  createdAt?: string
  updatedAt?: string
}

export interface LegacyAgencySettings {
  name?: string
  email?: string
  phone?: string
  cnpj?: string
  address?: string
  logo?: string
  plan?: string
  status?: "pending" | "active" | "suspended" | "archived"
}

export interface LegacyAgencyNotifications {
  concierge?: boolean
  trips?: boolean
  credits?: boolean
  newClients?: boolean
}

export interface AgencyStorageState<TTrip = unknown, TDocument = unknown, TConcierge = unknown, TTeam = unknown, TActivity = unknown, TCredits = unknown> {
  schemaVersion: number
  clients: LegacyAgencyClient[]
  trips: TTrip[]
  documents: TDocument[]
  conciergeRequests: TConcierge[]
  teamMembers: TTeam[]
  activities: TActivity[]
  credits: TCredits | null
}

export const AGENCY_STORAGE_SCHEMA_VERSION = 2

export function mapLegacyClientToClient(client: LegacyAgencyClient, agencyId: string | null = null): Client {
  const createdAt = client.createdAt || new Date().toISOString()

  return {
    id: client.id,
    agencyId,
    name: client.name,
    email: client.email || null,
    phone: client.phone || null,
    document: client.document || null,
    notes: client.notes || null,
    status: client.status === "inactive" ? "inactive" : "active",
    createdAt,
    updatedAt: client.updatedAt || createdAt,
  }
}

export function mapAgencySettingsToAgency(
  agencyData: LegacyAgencySettings,
  notifications: LegacyAgencyNotifications,
  creditsBalance: number,
  brandingLinkLogo: string | null = null,
): Agency {
  const now = new Date().toISOString()
  const name = agencyData.name || "Agencia Vuei"
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-") || "agencia-vuei"

  return {
    id: "agency-frontend",
    name,
    slug,
    logo: agencyData.logo || null,
    ownerUserId: null,
    plan: agencyData.plan?.toLowerCase() === "enterprise" ? "enterprise" : agencyData.plan?.toLowerCase() === "starter" ? "starter" : "pro",
    status: agencyData.status === "pending" || agencyData.status === "suspended" || agencyData.status === "archived" ? agencyData.status : "active",
    creditsBalance,
    settings: {
      email: agencyData.email || null,
      phone: agencyData.phone || null,
      cnpj: agencyData.cnpj || null,
      address: agencyData.address || null,
      notifications: {
        concierge: notifications.concierge ?? true,
        trips: notifications.trips ?? true,
        credits: notifications.credits ?? true,
        newClients: notifications.newClients ?? false,
      },
      twoFactorEnabled: false,
    },
    branding: {
      logoUrl: null,
      linkLogoUrl: brandingLinkLogo,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export function extractAgencyStorageState<TTrip = unknown, TDocument = unknown, TConcierge = unknown, TTeam = unknown, TActivity = unknown, TCredits = unknown>(
  rawValue: string | null
): AgencyStorageState<TTrip, TDocument, TConcierge, TTeam, TActivity, TCredits> {
  const fallback: AgencyStorageState<TTrip, TDocument, TConcierge, TTeam, TActivity, TCredits> = {
    schemaVersion: AGENCY_STORAGE_SCHEMA_VERSION,
    clients: [],
    trips: [],
    documents: [],
    conciergeRequests: [],
    teamMembers: [],
    activities: [],
    credits: null,
  }

  if (!rawValue) return fallback

  try {
    const parsed = JSON.parse(rawValue) as Partial<AgencyStorageState<TTrip, TDocument, TConcierge, TTeam, TActivity, TCredits>>

    return {
      schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : 1,
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      conciergeRequests: Array.isArray(parsed.conciergeRequests) ? parsed.conciergeRequests : [],
      teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : [],
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      credits: parsed.credits ?? null,
    }
  } catch {
    return fallback
  }
}
