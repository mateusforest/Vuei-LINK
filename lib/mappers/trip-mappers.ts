import type {
  Trip,
  TripAdminView,
  TripCardData,
  TripLinkPageData,
  TripOwnerType,
  TripPermissionSettings,
  TripPublicView,
  TripStatus,
  TripVisibility,
} from "@/types"
import { buildAdminTripUrl, buildPublicTripUrl, generateSecureToken } from "@/lib/security/link-tokens"
import { mapTripToAdminView, mapTripToPublicView } from "@/lib/mappers/trip-view-mappers"

export interface LegacyStoredTrip {
  id: string
  slug?: string
  name?: string
  title?: string
  destination?: string
  country?: string
  city?: string
  startDate?: string
  endDate?: string
  style?: string
  companions?: string
  passengersCount?: number
  travelersCount?: number
  status?: string
  coverImage?: string
  adminLink?: string
  shareLink?: string
  publicLink?: string
  createdAt?: string
  updatedAt?: string
  ownerType?: TripOwnerType
  ownerUserId?: string | null
  agencyId?: string | null
  clientId?: string | null
  adminToken?: string | null
  publicToken?: string | null
  visibility?: TripVisibility
}

export interface LegacyAgencyTrip extends LegacyStoredTrip {
  clientName?: string
}

export interface LegacyMasterTrip {
  id: string
  slug?: string
  name: string
  destination: string
  cover?: string
  coverImage?: string
  startDate?: string
  endDate?: string
  status?: string
  origin?: "user" | "agency"
  userId?: string
  agencyId?: string
  adminLink?: string
  shareLink?: string
  publicLink?: string
}

export interface TripStoragePayload {
  schemaVersion: number
  trips: LegacyStoredTrip[]
}

export const TRIP_STORAGE_SCHEMA_VERSION = 2

const defaultPermissions: TripPermissionSettings = {
  publicCanViewItinerary: true,
  publicCanViewAccommodation: true,
  publicCanViewFlights: false,
  publicCanViewPublicDocuments: true,
  publicCanUseConcierge: false,
}

export function slugifyTripBase(title?: string, destination?: string): string {
  const baseValue = title?.trim() || destination?.trim() || "minha viagem"
  const normalized = baseValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")

  return normalized || "minha-viagem"
}

export function buildUniqueTripSlug(baseSlug: string, existingSlugs: string[]): string {
  if (!existingSlugs.includes(baseSlug)) return baseSlug

  let counter = 2
  while (existingSlugs.includes(`${baseSlug}-${counter}`)) {
    counter += 1
  }

  return `${baseSlug}-${counter}`
}

export function normalizeTripStatus(status?: string): TripStatus {
  if (status === "ongoing" || status === "completed" || status === "cancelled" || status === "draft") {
    return status
  }

  return "upcoming"
}

export function parseTripDestination(destination?: string): { city: string | null; country: string | null } {
  const parts = (destination ?? "").split(",").map((part) => part.trim()).filter(Boolean)

  return {
    city: parts[0] || destination || null,
    country: parts.length > 1 ? parts[parts.length - 1] : null,
  }
}

function normalizeVisibility(trip?: LegacyStoredTrip): TripVisibility {
  return trip?.visibility === "public" ? "public" : "private"
}

function normalizeLinks(slug: string, trip?: LegacyStoredTrip) {
  const adminToken = trip?.adminToken || generateSecureToken()
  const publicToken = trip?.publicToken || generateSecureToken()

  return {
    adminToken,
    publicToken,
    adminLink: buildAdminTripUrl(slug),
    publicLink: buildPublicTripUrl(slug),
  }
}

function resolveTravelersCount(trip?: LegacyStoredTrip) {
  if (typeof trip?.travelersCount === "number") return trip.travelersCount
  if (typeof trip?.passengersCount === "number") return trip.passengersCount
  return 1
}

export function mapStoredTripToTrip(trip: LegacyStoredTrip): Trip {
  const title = trip.title || trip.name || "Minha Viagem"
  const destination = trip.destination || title
  const slug = trip.slug || slugifyTripBase(title, destination)
  const parsedDestination = parseTripDestination(destination)
  const links = normalizeLinks(slug, trip)
  const createdAt = trip.createdAt || new Date().toISOString()
  const updatedAt = trip.updatedAt || createdAt

  return {
    id: trip.id,
    title,
    slug,
    destination,
    country: trip.country || parsedDestination.country,
    city: trip.city || parsedDestination.city,
    startDate: trip.startDate || null,
    endDate: trip.endDate || null,
    status: normalizeTripStatus(trip.status),
    style: trip.style || null,
    ownerType: trip.ownerType || "traveler",
    ownerUserId: trip.ownerUserId ?? null,
    agencyId: trip.agencyId ?? null,
    clientId: trip.clientId ?? null,
    adminToken: links.adminToken,
    publicToken: links.publicToken,
    adminLink: links.adminLink,
    publicLink: links.publicLink,
    coverImage: trip.coverImage || null,
    visibility: normalizeVisibility(trip),
    travelersCount: resolveTravelersCount(trip),
    travelers: [],
    flights: [],
    accommodations: [],
    itinerary: [],
    documents: [],
    permissions: defaultPermissions,
    creditsSummary: null,
    offlineEnabled: false,
    createdAt,
    updatedAt,
  }
}

export function mapAgencyTripToTrip(trip: LegacyAgencyTrip): Trip {
  return {
    ...mapStoredTripToTrip({
      ...trip,
      ownerType: "agency",
    }),
    agencyId: trip.agencyId ?? null,
    clientId: trip.clientId ?? null,
  }
}

export function mapMasterTripToTrip(trip: LegacyMasterTrip): Trip {
  return mapStoredTripToTrip({
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    ownerType: trip.origin === "agency" ? "agency" : "traveler",
    ownerUserId: trip.userId ?? null,
    agencyId: trip.agencyId ?? null,
    adminLink: trip.adminLink,
    shareLink: trip.publicLink || trip.shareLink,
    publicLink: trip.publicLink || trip.shareLink,
    coverImage: trip.coverImage || trip.cover,
  })
}

export function mapTripToTripCard(trip: Trip): TripCardData {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    destination: trip.destination,
    status: trip.status,
    coverImage: trip.coverImage,
    adminLink: trip.adminLink,
    publicLink: trip.publicLink,
    startDate: trip.startDate,
    endDate: trip.endDate,
  }
}

export function mapTripToLinkPageData(trip: Trip): TripLinkPageData {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    destination: trip.destination,
    city: trip.city,
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    coverImage: trip.coverImage,
    travelersCount: trip.travelersCount,
    adminLink: trip.adminLink,
    publicLink: trip.publicLink,
  }
}

export function mapTripToPublicTripView(trip: Trip): TripPublicView {
  return mapTripToPublicView(trip)
}

export function mapTripToAdminTripView(trip: Trip): TripAdminView {
  return mapTripToAdminView(trip)
}

export function extractTripsStoragePayload(rawValue: string | null): TripStoragePayload {
  if (!rawValue) {
    return { schemaVersion: TRIP_STORAGE_SCHEMA_VERSION, trips: [] }
  }

  try {
    const parsed = JSON.parse(rawValue) as TripStoragePayload | LegacyStoredTrip[]

    if (Array.isArray(parsed)) {
      return { schemaVersion: 1, trips: parsed }
    }

    if (parsed && Array.isArray(parsed.trips)) {
      return {
        schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : TRIP_STORAGE_SCHEMA_VERSION,
        trips: parsed.trips,
      }
    }
  } catch {
    // fallback silencioso
  }

  return { schemaVersion: TRIP_STORAGE_SCHEMA_VERSION, trips: [] }
}
