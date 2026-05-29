import type { Agency, Profile, Trip } from "@/types"
import { mapMasterTripToTrip, type LegacyMasterTrip } from "@/lib/mappers/trip-mappers"

export interface LegacyMasterAgency {
  id: string
  name: string
  logo?: string
  plan: "starter" | "pro" | "enterprise"
  status: "active" | "suspended" | "pending"
  owner: string
  email: string
  phone: string
  createdAt: string
  creditsBalance: number
}

export interface LegacyMasterUser {
  id: string
  name: string
  email: string
  avatar?: string
  type: "traveler" | "agency" | "admin"
  status: "active" | "suspended" | "pending"
  agencyId?: string
  creditsBalance: number
  createdAt: string
  lastActive: string
}

export function mapMasterAgencyToAgency(agency: LegacyMasterAgency): Agency {
  return {
    id: agency.id,
    name: agency.name,
    slug: agency.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || agency.id,
    logo: agency.logo || null,
    ownerUserId: null,
    plan: agency.plan,
    status: agency.status === "pending" ? "pending" : agency.status === "suspended" ? "suspended" : "active",
    creditsBalance: agency.creditsBalance,
    settings: {
      email: agency.email,
      phone: agency.phone,
      cnpj: null,
      address: null,
      notifications: {
        concierge: true,
        trips: true,
        credits: true,
        newClients: true,
      },
      twoFactorEnabled: false,
    },
    branding: {
      logoUrl: agency.logo || null,
    },
    createdAt: agency.createdAt,
    updatedAt: agency.createdAt,
  }
}

export function mapMasterUserToProfile(user: LegacyMasterUser): Profile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: null,
    avatarUrl: user.avatar || null,
    role: user.type === "admin" ? "master" : user.type === "agency" ? "agency_owner" : "traveler",
    agencyId: user.agencyId || null,
    creditsBalance: user.creditsBalance,
    settings: null,
    createdAt: user.createdAt,
    updatedAt: user.lastActive || user.createdAt,
  }
}

export function mapMasterTripRecordToTrip(trip: LegacyMasterTrip): Trip {
  return mapMasterTripToTrip(trip)
}
