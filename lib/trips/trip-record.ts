import type { Trip } from "@/types"
import type { Database } from "@/lib/supabase/types"
import { buildAdminTripUrl, buildPublicTripUrl } from "@/lib/security/link-tokens"
import { resolveTripHeroImage } from "@/lib/trip-destination"

function parseTripPinSettings(value: unknown) {
  if (!value || typeof value !== "object") return null
  const settings = value as Record<string, unknown>
  return {
    enabled: settings.enabled === true,
    pinHash: typeof settings.pinHash === "string" ? settings.pinHash : null,
    pinSalt: typeof settings.pinSalt === "string" ? settings.pinSalt : null,
    pinIterations: typeof settings.pinIterations === "number" ? settings.pinIterations : null,
  }
}

export function parseDestinationParts(destination?: string | null) {
  const value = (destination ?? "").trim()
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean)

  return {
    city: parts[0] || value || null,
    country: parts.length > 1 ? parts[parts.length - 1] : null,
  }
}

export function mapTripRowToTrip(row: Database["public"]["Tables"]["trips"]["Row"]): Trip {
  const permissions = (row.permissions as Record<string, unknown>) ?? {}
  const creditsSummary = (row.credits_summary as Record<string, unknown>) ?? {}

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    destination: row.destination,
    country: row.country,
    city: row.city,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    style: row.style,
    ownerType: row.owner_type,
    ownerUserId: row.owner_user_id,
    agencyId: row.agency_id,
    clientId: row.client_id,
    adminToken: row.admin_token,
    publicToken: row.public_token,
    adminLink: buildAdminTripUrl(row.slug, row.admin_token),
    publicLink: buildPublicTripUrl(row.slug),
    coverImage: resolveTripHeroImage({
      coverImage: row.cover_image,
      destination: row.destination,
      city: row.city,
      country: row.country,
    }),
    visibility: row.visibility,
    travelersCount: row.travelers_count,
    travelers: [],
    flights: [],
    accommodations: [],
    itinerary: [],
    documents: [],
    permissions: {
      publicCanViewItinerary: typeof permissions.publicCanViewItinerary === "boolean" ? permissions.publicCanViewItinerary : true,
      publicCanViewAccommodation: typeof permissions.publicCanViewAccommodation === "boolean" ? permissions.publicCanViewAccommodation : true,
      publicCanViewFlights: typeof permissions.publicCanViewFlights === "boolean" ? permissions.publicCanViewFlights : false,
      publicCanViewPublicDocuments: typeof permissions.publicCanViewPublicDocuments === "boolean" ? permissions.publicCanViewPublicDocuments : true,
      publicCanUseConcierge: typeof permissions.publicCanUseConcierge === "boolean" ? permissions.publicCanUseConcierge : false,
      tripPin: parseTripPinSettings(permissions.tripPin),
    },
    creditsSummary: {
      balance: typeof creditsSummary.balance === "number" ? creditsSummary.balance : null,
      used: typeof creditsSummary.used === "number" ? creditsSummary.used : null,
      total: typeof creditsSummary.total === "number" ? creditsSummary.total : null,
    },
    offlineEnabled: row.offline_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function buildTripInsertPayload(
  trip: Pick<
    Trip,
    | "title"
    | "slug"
    | "destination"
    | "country"
    | "city"
    | "startDate"
    | "endDate"
    | "status"
    | "style"
    | "ownerType"
    | "ownerUserId"
    | "agencyId"
    | "clientId"
    | "coverImage"
    | "visibility"
    | "travelersCount"
    | "permissions"
    | "creditsSummary"
    | "offlineEnabled"
  >,
  tokens: {
    adminToken: string | null
    publicToken: string | null
    adminLink: string
    publicLink: string
  },
  options?: {
    source?: string
    claimTokenHash?: string | null
    claimTokenExpiresAt?: string | null
    claimTokenClaimedAt?: string | null
  },
): Database["public"]["Tables"]["trips"]["Insert"] {
  const parsedDestination = parseDestinationParts(trip.destination)

  return {
    title: trip.title,
    slug: trip.slug,
    destination: trip.destination,
    country: trip.country ?? parsedDestination.country,
    city: trip.city ?? parsedDestination.city,
    start_date: trip.startDate,
    end_date: trip.endDate,
    status: trip.status ?? "draft",
    style: trip.style,
    owner_type: trip.ownerType,
    owner_user_id: trip.ownerUserId,
    agency_id: trip.agencyId,
    client_id: trip.clientId,
    admin_token: tokens.adminToken,
    public_token: tokens.publicToken,
    admin_link: tokens.adminLink,
    public_link: tokens.publicLink,
    cover_image: trip.coverImage ?? null,
    visibility: trip.visibility ?? "public",
    travelers_count: trip.travelersCount || 1,
    permissions: trip.permissions ?? {},
    credits_summary: trip.creditsSummary ?? {},
    offline_enabled: trip.offlineEnabled,
    source: options?.source ?? "manual",
    claim_token_hash: options?.claimTokenHash ?? null,
    claim_token_expires_at: options?.claimTokenExpiresAt ?? null,
    claim_token_claimed_at: options?.claimTokenClaimedAt ?? null,
  }
}
