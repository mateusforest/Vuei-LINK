import type { Trip, TripOwnerType } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { normalizeLegacyAgencyTrips, normalizeLegacyTrips } from "@/lib/local-storage-migration"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { extractAgencyStorageState } from "@/lib/mappers/agency-mappers"
import { buildUniqueTripSlug, extractTripsStoragePayload, mapStoredTripToTrip, slugifyTripBase, type LegacyStoredTrip } from "@/lib/mappers/trip-mappers"
import { buildAdminTripUrl, buildPublicTripUrl, generateSecureToken } from "@/lib/security/link-tokens"
import type { Database } from "@/lib/supabase/types"
import { getDestinationCoverImage } from "@/lib/trip-destination"

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

interface RepositoryTripResult {
  source: "local" | "supabase" | "supabase-placeholder"
  data: Trip | null
  error?: string | null
  config?: ReturnType<typeof createSupabaseBrowserClientPlaceholder>
}

const CREATE_TRIP_ERROR_MESSAGE = "Nao foi possivel criar a viagem. Tente novamente."
const MAX_TRIP_SLUG_ATTEMPTS = 5

function isDeletedTripStatus(status?: string | null) {
  return status === "cancelled" || status === "deleted" || status === "archived"
}

function readStoredTrips() {
  return [...normalizeLegacyTrips(), ...normalizeLegacyAgencyTrips()]
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isMatchingTripSlug(slug: string, baseSlug: string) {
  const matcher = new RegExp(`^${escapeRegExp(baseSlug)}(?:-\\d+)?$`)
  return matcher.test(slug)
}

function isTripSlugConflict(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined) {
  if (!error) return false

  const diagnostic = [error.code, error.message, error.details].filter(Boolean).join(" ")
  return error.code === "23505" && /trips_slug_key/i.test(diagnostic)
}

async function listExistingTripSlugs(
  supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
  baseSlug: string
) {
  const { data, error } = await supabase.from("trips").select("slug").like("slug", `${baseSlug}%`)

  if (error) {
    console.error("[TRIP] slug lookup error", error)
    return []
  }

  return (data ?? [])
    .map((row) => row.slug)
    .filter((slug): slug is string => typeof slug === "string" && isMatchingTripSlug(slug, baseSlug))
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
    adminLink: buildAdminTripUrl(row.slug),
    publicLink: buildPublicTripUrl(row.slug),
    coverImage: row.cover_image || getDestinationCoverImage(row.destination, row.city, row.country),
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
      visibility: trip.visibility,
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

function removeTripFromLegacyCaches(id: string) {
  if (typeof window === "undefined") return

  const travelerPayload = {
    schemaVersion: 2,
    trips: extractTripsStoragePayload(window.localStorage.getItem("vuei_trips")).trips.filter((trip) => trip.id !== id),
  }
  window.localStorage.setItem("vuei_trips", JSON.stringify(travelerPayload))

  const agencyState = extractAgencyStorageState(window.localStorage.getItem("vuei_agency"))
  window.localStorage.setItem(
    "vuei_agency",
    JSON.stringify({
      ...agencyState,
      trips: (agencyState.trips ?? []).filter((trip: any) => trip?.id !== id),
    }),
  )
}

function filterTrips(trips: Trip[], params?: ListTripsParams) {
  const visibleTrips = trips.filter((trip) => !isDeletedTripStatus(trip.status))
  if (!params) return visibleTrips

  return visibleTrips.filter((trip) => {
    if (params.ownerType && trip.ownerType !== params.ownerType) return false
    if (params.ownerUserId && trip.ownerUserId !== params.ownerUserId) return false
    if (params.agencyId && trip.agencyId !== params.agencyId) return false
    if (params.clientId && trip.clientId !== params.clientId) return false
    if (params.status && trip.status !== params.status) return false
    return true
  })
}

function parseDestinationParts(destination?: string | null) {
  const value = (destination ?? "").trim()
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean)

  return {
    city: parts[0] || value || null,
    country: parts.length > 1 ? parts[parts.length - 1] : null,
  }
}

function buildTrip(payload: CreateTripPayload, existingTrips: Trip[], slugOverride?: string): Trip {
  const now = new Date().toISOString()
  const baseSlug = slugifyTripBase(payload.title, payload.destination)
  const slug = slugOverride ?? buildUniqueTripSlug(baseSlug, existingTrips.map((trip) => trip.slug))
  const destinationParts = parseDestinationParts(payload.destination)

  return mapStoredTripToTrip({
    id: `trip-${Date.now()}`,
    title: payload.title || payload.destination || "Minha Viagem",
    destination: payload.destination || payload.title || "Minha Viagem",
    country: payload.country ?? destinationParts.country ?? undefined,
    city: payload.city ?? destinationParts.city ?? undefined,
    startDate: payload.startDate ?? undefined,
    endDate: payload.endDate ?? undefined,
    style: payload.style ?? undefined,
    ownerType: payload.ownerType ?? "traveler",
    ownerUserId: payload.ownerUserId ?? null,
    agencyId: payload.agencyId ?? null,
    clientId: payload.clientId ?? null,
    slug,
    status: payload.status ?? "draft",
    coverImage: payload.coverImage ?? undefined,
    adminToken: payload.adminToken ?? null,
    publicToken: payload.publicToken ?? null,
    visibility: payload.visibility ?? "public",
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
      if (!params?.status) query = query.neq("status", "cancelled")

      const { data, error } = await query

      if (!error && data) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: data.map(mapTripRowToTrip).filter((trip) => !isDeletedTripStatus(trip.status)),
        }
      }
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: [],
          error: error.message,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao listar viagens."
      console.error("[AUTH ERROR]", message)
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: [],
        error: message,
      }
    }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Trip[],
      error: "Supabase browser client indisponivel.",
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
        const mappedTrip = mapTripRowToTrip(data)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: isDeletedTripStatus(mappedTrip.status) ? null : mappedTrip,
        }
      }
      if (error) {
        console.error("[TRIP] erro ao carregar link", error.message)
      }
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: error?.message ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar viagem."
      console.error("[TRIP] erro ao carregar link", message)
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: message,
      }
    }
  }

  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.slug === slug) ?? null }
}

export async function getTripByAdminToken(token: string) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const { data, error } = await supabase.from("trips").select("*").eq("admin_token", token).maybeSingle()
      if (!error && data) {
        const mappedTrip = mapTripRowToTrip(data)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: isDeletedTripStatus(mappedTrip.status) ? null : mappedTrip,
        }
      }
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: error?.message ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar viagem admin."
      console.error("[TRIP] erro ao carregar link", message)
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: message,
      }
    }
  }

  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.adminToken === token) ?? null }
}

export async function getTripByPublicToken(token: string) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const { data, error } = await supabase.from("trips").select("*").eq("public_token", token).maybeSingle()
      if (!error && data) {
        const mappedTrip = mapTripRowToTrip(data)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: isDeletedTripStatus(mappedTrip.status) ? null : mappedTrip,
        }
      }
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: error?.message ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar viagem publica."
      console.error("[TRIP] erro ao carregar link", message)
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: message,
      }
    }
  }

  const result = await listTrips()
  return { ...result, data: result.data.find((trip) => trip.publicToken === token) ?? null }
}

export async function createTrip(payload: CreateTripPayload) {
  const currentTrips = readStoredTrips()
  const supabase = createSupabaseBrowserClient()

  console.log("[TRIP] create started")

  if (shouldUseSupabase() && supabase) {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser && payload.ownerType !== "agency") {
        await ensureProfile(authUser, supabase)
      }

      if (payload.ownerType === "agency" && !payload.agencyId) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: null,
          error: "agency_id obrigatorio para criar viagem da agencia.",
        }
      }

      const baseSlug = slugifyTripBase(payload.title, payload.destination)
      const knownSlugs = new Set(currentTrips.map((storedTrip) => storedTrip.slug).filter(Boolean))

      for (const slug of await listExistingTripSlugs(supabase, baseSlug)) {
        knownSlugs.add(slug)
      }

      for (let attempt = 0; attempt < MAX_TRIP_SLUG_ATTEMPTS; attempt += 1) {
        const candidateSlug = buildUniqueTripSlug(baseSlug, [...knownSlugs])
        knownSlugs.add(candidateSlug)

        const trip = buildTrip(payload, currentTrips, candidateSlug)
        const adminToken = trip.adminToken || generateSecureToken()
        const publicToken = trip.publicToken || generateSecureToken()
        const adminLink = buildAdminTripUrl(trip.slug)
        const publicLink = buildPublicTripUrl(trip.slug)
        const parsedDestination = parseDestinationParts(trip.destination)
        const resolvedCoverImage =
          trip.coverImage || getDestinationCoverImage(trip.destination, trip.city ?? parsedDestination.city, trip.country ?? parsedDestination.country)

        const insertPayload: Database["public"]["Tables"]["trips"]["Insert"] = {
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
          admin_token: adminToken,
          public_token: publicToken,
          admin_link: adminLink,
          public_link: publicLink,
          cover_image: resolvedCoverImage,
          visibility: trip.visibility ?? "public",
          travelers_count: trip.travelersCount || 1,
          permissions: trip.permissions ?? {},
          credits_summary: {},
          offline_enabled: trip.offlineEnabled,
          source: "manual",
        }
        console.log("[TRIP] payload", insertPayload)

        const { data, error } = await supabase.from("trips").insert(insertPayload).select("*").single()

        if (!error && data) {
          console.log("[TRIP] insert data", data)
          console.log("[TRIP] viagem criada", data.id)
          return {
            source: "supabase" as const,
            config: createSupabaseBrowserClientPlaceholder(),
            data: mapTripRowToTrip(data),
            error: null,
          }
        }

        if (error) {
          console.error("[TRIP] insert error", error)

          if (isTripSlugConflict(error) && attempt < MAX_TRIP_SLUG_ATTEMPTS - 1) {
            for (const slug of await listExistingTripSlugs(supabase, baseSlug)) {
              knownSlugs.add(slug)
            }
            continue
          }

          return {
            source: "supabase" as const,
            config: createSupabaseBrowserClientPlaceholder(),
            data: null,
            error: CREATE_TRIP_ERROR_MESSAGE,
          }
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: CREATE_TRIP_ERROR_MESSAGE,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar viagem."
      console.error("[TRIP] insert error", message)
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null,
        error: CREATE_TRIP_ERROR_MESSAGE,
      }
    }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
      error: CREATE_TRIP_ERROR_MESSAGE,
    }
  }

  const trip = buildTrip(payload, currentTrips)
  writeLocalTrips([trip, ...currentTrips])
  console.log("[TRIP] viagem criada", trip.id)
  return { source: "local" as const, data: trip, error: null }
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
          error: null,
        }
      }
      if (error) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: null,
          error: error.message,
        }
      }
    } catch {
      // retorno controlado abaixo
    }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
      error: "Supabase browser client indisponivel.",
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

export async function ensureTripIsPublic(id: string) {
  return updateTrip(id, { visibility: "public" })
}

export async function deleteTrip(id: string) {
  const supabase = createSupabaseBrowserClient()

  if (shouldUseSupabase() && supabase) {
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "cancelled",
          visibility: "private",
          public_token: null,
          admin_token: null,
          public_link: null,
          admin_link: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)

      if (!error) {
        removeTripFromLegacyCaches(id)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          success: true,
          error: null,
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        success: false,
        error: error?.message || "Nao foi possivel excluir a viagem no Supabase.",
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao remover viagem."
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        success: false,
        error: message,
      }
    }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: false,
      error: "Supabase browser client indisponivel.",
    }
  }

  writeLocalTrips(readStoredTrips().filter((trip) => trip.id !== id))
  removeTripFromLegacyCaches(id)
  return { source: "local" as const, success: true, error: null }
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
