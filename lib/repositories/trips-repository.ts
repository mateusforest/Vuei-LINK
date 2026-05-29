import type { Trip, TripOwnerType } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { normalizeLegacyAgencyTrips, normalizeLegacyTrips } from "@/lib/local-storage-migration"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { buildUniqueTripSlug, mapStoredTripToTrip, slugifyTripBase, type LegacyStoredTrip } from "@/lib/mappers/trip-mappers"
import { generateAdminLink, generatePublicLink, generateSecureToken } from "@/lib/security/link-tokens"
import type { Database } from "@/lib/supabase/types"

export interface ListTripsParams {
  ownerType?: TripOwnerType
  ownerUserId?: string
  agencyId?: string
  clientId?: string
  status?: Trip["status"]
}

export interface CreateTripPayload extends Partial<Omit<Trip, "id" | "slug" | "createdAt" | "updatedAt">> {
  title?: string
  destination?: string
}

function readStoredTrips() {
  return [...normalizeLegacyTrips(), ...normalizeLegacyAgencyTrips()]
}

function mapTripRowToTrip(row: Database["public"]["Tables"]["trips"]["Row"]): Trip {
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
    adminLink: row.admin_link || `vuei.app${generateAdminLink(row.slug, row.admin_token || "")}`,
    publicLink: row.public_link || `vuei.app${generatePublicLink(row.slug, row.public_token || "")}`,
    coverImage: row.cover_image,
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

function writeLocalTrips(nextTrips: Trip[]) {
  if (typeof window === "undefined") return

  const travelerTrips = nextTrips.filter((trip) => trip.ownerType !== "agency")
  const agencyTrips = nextTrips.filter((trip) => trip.ownerType === "agency")

  const travelerPayload = {
    schemaVersion: 2,
    trips: travelerTrips.map<LegacyStoredTrip>((trip) => ({
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      destination: trip.destination,
      country: trip.country ?? undefined,
      city: trip.city ?? undefined,
      startDate: trip.startDate ?? undefined,
      endDate: trip.endDate ?? undefined,
      style: trip.style ?? undefined,
      travelersCount: trip.travelersCount,
      status: trip.status,
      coverImage: trip.coverImage ?? undefined,
      adminLink: trip.adminLink,
      publicLink: trip.publicLink,
      ownerType: trip.ownerType,
      ownerUserId: trip.ownerUserId,
      adminToken: trip.adminToken,
      publicToken: trip.publicToken,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
    })),
  }

  window.localStorage.setItem("vuei_trips", JSON.stringify(travelerPayload))

  try {
    const rawAgency = window.localStorage.getItem("vuei_agency")
    const parsedAgency = rawAgency ? JSON.parse(rawAgency) : {}
    window.localStorage.setItem(
      "vuei_agency",
      JSON.stringify({
        schemaVersion: typeof parsedAgency?.schemaVersion === "number" ? parsedAgency.schemaVersion : 2,
        clients: Array.isArray(parsedAgency?.clients) ? parsedAgency.clients : [],
        trips: agencyTrips.map((trip) => ({
          id: trip.id,
          slug: trip.slug,
          clientId: trip.clientId ?? "",
          clientName: "",
          name: trip.title,
          destination: trip.destination,
          country: trip.country ?? "",
          city: trip.city ?? trip.destination,
          startDate: trip.startDate ?? "",
          endDate: trip.endDate ?? "",
          style: trip.style ?? "",
          passengersCount: trip.travelersCount,
          status: trip.status === "draft" || trip.status === "cancelled" ? "upcoming" : trip.status,
          coverImage: trip.coverImage ?? "",
          adminLink: trip.adminLink,
          shareLink: trip.publicLink,
          createdAt: trip.createdAt,
        })),
        documents: Array.isArray(parsedAgency?.documents) ? parsedAgency.documents : [],
        conciergeRequests: Array.isArray(parsedAgency?.conciergeRequests) ? parsedAgency.conciergeRequests : [],
        teamMembers: Array.isArray(parsedAgency?.teamMembers) ? parsedAgency.teamMembers : [],
        activities: Array.isArray(parsedAgency?.activities) ? parsedAgency.activities : [],
        credits: parsedAgency?.credits ?? null,
      })
    )
  } catch {
    // Mantem fallback silencioso para nao quebrar o app atual.
  }
}

function filterTrips(trips: Trip[], params?: ListTripsParams) {
  if (!params) return trips

  return trips.filter((trip) => {
    if (params.ownerType && trip.ownerType !== params.ownerType) return false
    if (params.ownerUserId && trip.ownerUserId !== params.ownerUserId) return false
    if (params.agencyId && trip.agencyId !== params.agencyId) return false
    if (params.clientId && trip.clientId !== params.clientId) return false
    if (params.status && trip.status !== params.status) return false
    return true
  })
}

function buildTrip(payload: CreateTripPayload, existingTrips: Trip[]): Trip {
  const now = new Date().toISOString()
  const baseSlug = slugifyTripBase(payload.title, payload.destination)
  const slug = buildUniqueTripSlug(baseSlug, existingTrips.map((trip) => trip.slug))

  return mapStoredTripToTrip({
    id: `trip-${Date.now()}`,
    title: payload.title || payload.destination || "Minha Viagem",
    destination: payload.destination || payload.title || "Minha Viagem",
    country: payload.country ?? undefined,
    city: payload.city ?? undefined,
    startDate: payload.startDate ?? undefined,
    endDate: payload.endDate ?? undefined,
    style: payload.style ?? undefined,
    ownerType: payload.ownerType ?? "traveler",
    ownerUserId: payload.ownerUserId ?? null,
    agencyId: payload.agencyId ?? null,
    clientId: payload.clientId ?? null,
    slug,
    status: payload.status ?? "upcoming",
    coverImage: payload.coverImage ?? undefined,
    adminToken: payload.adminToken ?? null,
    publicToken: payload.publicToken ?? null,
    adminLink: payload.adminLink,
    publicLink: payload.publicLink,
    createdAt: now,
    updatedAt: now,
  })
}

export async function listTrips(params?: ListTripsParams) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      let query = supabase.from("trips").select("*").order("created_at", { ascending: false })

      if (params?.ownerType) query = query.eq("owner_type", params.ownerType)
      if (params?.ownerUserId) query = query.eq("owner_user_id", params.ownerUserId)
      if (params?.agencyId) query = query.eq("agency_id", params.agencyId)
      if (params?.clientId) query = query.eq("client_id", params.clientId)
      if (params?.status) query = query.eq("status", params.status)

      const { data, error } = await query

      if (!error && data) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: data.map(mapTripRowToTrip),
        }
      }
    } catch {
      // fallback local silencioso
    }
  }

  return {
    source: "local" as const,
    data: filterTrips(readStoredTrips(), params),
  }
}

export async function getTripById(id: string) {
  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.id === id) ?? null }
}

export async function getTripBySlug(slug: string) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const { data, error } = await supabase.from("trips").select("*").eq("slug", slug).maybeSingle()
      if (!error && data) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: mapTripRowToTrip(data),
        }
      }
    } catch {
      // fallback abaixo
    }
  }

  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.slug === slug) ?? null }
}

export async function getTripByAdminToken(token: string) {
  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.adminToken === token) ?? null }
}

export async function getTripByPublicToken(token: string) {
  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.publicToken === token) ?? null }
}

export async function createTrip(payload: CreateTripPayload) {
  const currentTrips = readStoredTrips()
  const trip = buildTrip(payload, currentTrips)
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const adminToken = trip.adminToken || generateSecureToken()
      const publicToken = trip.publicToken || generateSecureToken()
      const adminLink = `vuei.app${generateAdminLink(trip.slug, adminToken)}`
      const publicLink = `vuei.app${generatePublicLink(trip.slug, publicToken)}`

      const insertPayload: Database["public"]["Tables"]["trips"]["Insert"] = {
        title: trip.title,
        slug: trip.slug,
        destination: trip.destination,
        country: trip.country,
        city: trip.city,
        start_date: trip.startDate,
        end_date: trip.endDate,
        status: trip.status,
        style: trip.style,
        owner_type: trip.ownerType,
        owner_user_id: trip.ownerUserId,
        agency_id: trip.agencyId,
        client_id: trip.clientId,
        admin_token: adminToken,
        public_token: publicToken,
        admin_link: adminLink,
        public_link: publicLink,
        cover_image: trip.coverImage,
        visibility: trip.visibility,
        travelers_count: trip.travelersCount,
        permissions: trip.permissions,
        credits_summary: trip.creditsSummary ?? {},
        offline_enabled: trip.offlineEnabled,
        source: "manual",
      }

      const { data, error } = await supabase.from("trips").insert(insertPayload).select("*").single()

      if (!error && data) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: mapTripRowToTrip(data),
        }
      }
    } catch {
      // fallback local abaixo
    }
  }

  writeLocalTrips([trip, ...currentTrips])
  return { source: "local" as const, data: trip }
}

export async function updateTrip(id: string, payload: Partial<Trip>) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const updatePayload: Database["public"]["Tables"]["trips"]["Update"] = {
        title: payload.title,
        slug: payload.slug,
        destination: payload.destination,
        country: payload.country,
        city: payload.city,
        start_date: payload.startDate,
        end_date: payload.endDate,
        status: payload.status,
        style: payload.style,
        owner_type: payload.ownerType,
        owner_user_id: payload.ownerUserId,
        agency_id: payload.agencyId,
        client_id: payload.clientId,
        admin_token: payload.adminToken,
        public_token: payload.publicToken,
        admin_link: payload.adminLink,
        public_link: payload.publicLink,
        cover_image: payload.coverImage,
        visibility: payload.visibility,
        travelers_count: payload.travelersCount,
        permissions: payload.permissions,
        credits_summary: payload.creditsSummary ?? undefined,
        offline_enabled: payload.offlineEnabled,
      }

      const { data, error } = await supabase.from("trips").update(updatePayload).eq("id", id).select("*").maybeSingle()

      if (!error && data) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: mapTripRowToTrip(data),
        }
      }
    } catch {
      // fallback local abaixo
    }
  }

  const currentTrips = readStoredTrips()
  let updatedTrip: Trip | null = null
  const nextTrips = currentTrips.map((trip) => {
    if (trip.id !== id) return trip
    updatedTrip = {
      ...trip,
      ...payload,
      updatedAt: new Date().toISOString(),
    }
    return updatedTrip
  })
  writeLocalTrips(nextTrips)
  return { source: "local" as const, data: updatedTrip }
}

export async function deleteTrip(id: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: true,
    }
  }

  writeLocalTrips(readStoredTrips().filter((trip) => trip.id !== id))
  return { source: "local" as const, success: true }
}

export async function listTripsByUser(userId: string) {
  return listTrips({ ownerUserId: userId, ownerType: "traveler" })
}

export async function listTripsByAgency(agencyId: string) {
  return listTrips({ agencyId, ownerType: "agency" })
}

export async function listTripsByClient(clientId: string) {
  return listTrips({ clientId })
}
