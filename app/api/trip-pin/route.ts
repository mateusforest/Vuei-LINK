import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { verifyStoredQuickAccessPin } from "@/lib/auth/quick-access"
import { resolveAuthenticatedTripAccess } from "@/lib/security/trip-authenticated-access"
import { resolveTripLinkAccess, type TripLinkAccessErrorCode } from "@/lib/security/trip-link-access"
import type { Database } from "@/lib/supabase/types"
import type { ProfileQuickAccessSettings } from "@/types"

export const runtime = "nodejs"
export const maxDuration = 60

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

type TripPinScope = "traveler_portal" | "agency_trip" | null
type TripPinResolution = {
  pinConfigured: boolean
  pinScope: TripPinScope
  ownerType: "traveler" | "agency" | null
  settings: ProfileQuickAccessSettings | null
}

type TripLinkSnapshot = {
  id: string
  slug: string
  title: string
  destination: string
  country: string | null
  city: string | null
  startDate: string | null
  endDate: string | null
  status: TripRow["status"]
  ownerType: TripRow["owner_type"]
  ownerUserId: string | null
  agencyId: string | null
  clientId: string | null
  visibility: TripRow["visibility"]
  linkActivatedAt: string | null
  linkAccessUntil: string | null
  travelersCount: number
  coverImage: string | null
  adminLink: string | null
  publicLink: string | null
}

function getMissingAdminConfigResponse() {
  return NextResponse.json(
    { error: "A configuracao administrativa do servidor nao esta disponivel no momento." },
    { status: 503 },
  )
}

function parseQuickAccessSettings(value: unknown): ProfileQuickAccessSettings | null {
  if (!value || typeof value !== "object") return null

  const settings = value as Record<string, unknown>
  if (settings.enabled !== true) {
    return null
  }

  return {
    enabled: true,
    pinHash: typeof settings.pinHash === "string" ? settings.pinHash : null,
    pinSalt: typeof settings.pinSalt === "string" ? settings.pinSalt : null,
    pinIterations: typeof settings.pinIterations === "number" ? settings.pinIterations : null,
  }
}

function mapTripSnapshot(trip: TripRow): TripLinkSnapshot {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    destination: trip.destination,
    country: trip.country,
    city: trip.city,
    startDate: trip.start_date,
    endDate: trip.end_date,
    status: trip.status,
    ownerType: trip.owner_type,
    ownerUserId: trip.owner_user_id,
    agencyId: trip.agency_id,
    clientId: trip.client_id,
    visibility: trip.visibility,
    linkActivatedAt: trip.link_activated_at,
    linkAccessUntil: trip.link_access_until,
    travelersCount: trip.travelers_count,
    coverImage: trip.cover_image,
    adminLink: trip.admin_link,
    publicLink: trip.public_link,
  }
}

async function resolveTripFromRequest(request: NextRequest, payload?: Record<string, unknown> | null) {
  const supabase = createSupabaseAdminClient()
  const url = new URL(request.url)
  const tripId = typeof payload?.tripId === "string" ? payload.tripId : url.searchParams.get("tripId")
  const tripSlug = typeof payload?.tripSlug === "string" ? payload.tripSlug : url.searchParams.get("tripSlug")
  const adminToken = typeof payload?.adminToken === "string" ? payload.adminToken : url.searchParams.get("adminToken")
  const publicToken =
    typeof payload?.publicToken === "string"
      ? payload.publicToken
      : url.searchParams.get("publicToken") ?? url.searchParams.get("token")
  const accessMode =
    payload?.accessMode === "admin" || url.searchParams.get("accessMode") === "admin"
      ? "admin"
      : "public"

  let accessResult: {
    trip: TripRow | null
    error: string | null
    code: TripLinkAccessErrorCode | null
  }

  if (accessMode === "admin" && !adminToken && Boolean(tripId || tripSlug)) {
    const serverClient = await createSupabaseServerClient()
    const authResult = serverClient ? await serverClient.auth.getUser() : null
    const sessionUser = authResult?.data.user ?? null

    if (!serverClient || !sessionUser) {
      accessResult = {
        trip: null,
        error: "Acesso administrativo invalido para esta viagem.",
        code: "trip_link_access_invalid",
      }
    } else {
      const authenticatedAccessResult = await resolveAuthenticatedTripAccess(serverClient, sessionUser.id, {
        tripId,
        tripSlug,
        requireMutationRole: true,
      })

      accessResult = {
        trip: authenticatedAccessResult.trip,
        error: authenticatedAccessResult.error,
        code: authenticatedAccessResult.trip ? null : "trip_link_access_invalid",
      }
    }
  } else {
    const linkAccessResult = await resolveTripLinkAccess(supabase, {
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode,
    })
    accessResult = linkAccessResult
  }

  return {
    supabase,
    trip: accessResult.trip,
    error: accessResult.error,
    code: accessResult.code,
  }
}

async function resolveTripPinSettings(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  trip: TripRow,
): Promise<TripPinResolution> {
  if (trip.owner_type === "traveler" && trip.owner_user_id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", trip.owner_user_id)
      .maybeSingle()

    if (error) {
      throw new Error(error.message)
    }

    const settings = data?.settings && typeof data.settings === "object"
      ? ((data.settings as Record<string, unknown>).quickAccess)
      : null
    const quickAccess = parseQuickAccessSettings(settings)

    return {
      pinConfigured: Boolean(quickAccess?.pinHash && quickAccess.pinSalt),
      pinScope: quickAccess ? "traveler_portal" : null,
      ownerType: "traveler",
      settings: quickAccess,
    }
  }

  const permissions = (trip.permissions ?? {}) as Record<string, unknown>
  const tripPin = parseQuickAccessSettings(permissions.tripPin)

  return {
    pinConfigured: Boolean(tripPin?.pinHash && tripPin.pinSalt),
    pinScope: tripPin ? "agency_trip" : null,
    ownerType: trip.owner_type === "agency" ? "agency" : null,
    settings: tripPin,
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return getMissingAdminConfigResponse()
    }

    const { supabase, trip, error, code } = await resolveTripFromRequest(request)
    if (error || !trip) {
      return NextResponse.json({ error: error ?? "Acesso ao PIN da viagem invalido.", code }, { status: 403 })
    }

    const pinResolution = await resolveTripPinSettings(supabase, trip)

    return NextResponse.json({
      pinConfigured: pinResolution.pinConfigured,
      pinScope: pinResolution.pinScope,
      ownerType: pinResolution.ownerType,
      trip: mapTripSnapshot(trip),
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return getMissingAdminConfigResponse()
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel verificar o PIN da viagem."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return getMissingAdminConfigResponse()
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const pin = typeof body?.pin === "string" ? body.pin.trim() : ""

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json({ error: "Informe um PIN de 4 digitos." }, { status: 400 })
    }

    const { supabase, trip, error, code } = await resolveTripFromRequest(request, body)
    if (error || !trip) {
      return NextResponse.json({ error: error ?? "Acesso ao PIN da viagem invalido.", code }, { status: 403 })
    }

    const pinResolution = await resolveTripPinSettings(supabase, trip)
    if (!pinResolution.settings) {
      return NextResponse.json({
        verified: false,
        pinConfigured: false,
        pinScope: pinResolution.pinScope,
        ownerType: pinResolution.ownerType,
        trip: mapTripSnapshot(trip),
      })
    }

    const verified = await verifyStoredQuickAccessPin(pinResolution.settings, pin)

    return NextResponse.json({
      verified,
      pinConfigured: true,
      pinScope: pinResolution.pinScope,
      ownerType: pinResolution.ownerType,
      trip: mapTripSnapshot(trip),
      adminToken: verified ? trip.admin_token : null,
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return getMissingAdminConfigResponse()
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel validar o PIN da viagem."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
