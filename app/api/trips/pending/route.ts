import { NextResponse } from "next/server"
import { mapStoredTripToTrip, slugifyTripBase, buildUniqueTripSlug } from "@/lib/mappers/trip-mappers"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { ensureTripTravelersPersistedWithClient } from "@/lib/repositories/trip-travelers-repository"
import { buildAdminTripUrl, buildPublicTripUrl, generateSecureToken } from "@/lib/security/link-tokens"
import { buildPendingTripClaimExpiresAt, generatePendingTripClaimToken, hashPendingTripClaimToken } from "@/lib/server/pending-trip-claim"
import { buildTripInsertPayload } from "@/lib/trips/trip-record"
import { CREATE_TRIP_ERROR_MESSAGE } from "@/lib/trips/trip-policies"
import { isTripSlugConflict, listExistingTripSlugs } from "@/lib/trips/trip-slug"
import { checkRateLimit, getRequestIp } from "@/lib/server/request-rate-limit"

const MAX_TRIP_SLUG_ATTEMPTS = 5
const ANONYMOUS_CREATE_LIMIT = 5
const ANONYMOUS_CREATE_WINDOW_MS = 15 * 60 * 1000

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin indisponivel para criar a viagem." }, { status: 503 })
  }

  let body: {
    title?: string
    destination?: string
    startDate?: string | null
    endDate?: string | null
    style?: string | null
    travelersCount?: number
  }

  try {
    body = await request.json()
  } catch {
    return badRequest("Payload invalido.")
  }

  const destination = body.destination?.trim()
  if (!destination) {
    return badRequest("Destino obrigatorio.")
  }

  const ip = getRequestIp(request)
  const rateLimit = checkRateLimit(`pending-trip:${ip}`, {
    limit: ANONYMOUS_CREATE_LIMIT,
    windowMs: ANONYMOUS_CREATE_WINDOW_MS,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Muitas tentativas. Aguarde alguns minutos antes de criar outra viagem.",
        code: "rate_limit_exceeded",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1)),
        },
      },
    )
  }

  try {
    const supabase = createSupabaseAdminClient()
    const baseSlug = slugifyTripBase(body.title, destination)
    const knownSlugs = new Set(await listExistingTripSlugs(supabase, baseSlug))

    for (let attempt = 0; attempt < MAX_TRIP_SLUG_ATTEMPTS; attempt += 1) {
      const slug = buildUniqueTripSlug(baseSlug, [...knownSlugs])
      knownSlugs.add(slug)

      const claimToken = generatePendingTripClaimToken()
      const claimTokenHash = hashPendingTripClaimToken(claimToken)
      const claimTokenExpiresAt = buildPendingTripClaimExpiresAt()
      const adminToken = generateSecureToken()
      const publicToken = generateSecureToken()
      const adminLink = buildAdminTripUrl(slug, adminToken)
      const publicLink = buildPublicTripUrl(slug)

      const trip = mapStoredTripToTrip({
        id: `pending-${Date.now()}`,
        slug,
        title: body.title?.trim() || destination,
        destination,
        startDate: body.startDate ?? undefined,
        endDate: body.endDate ?? undefined,
        style: body.style ?? undefined,
        ownerType: "traveler",
        ownerUserId: null,
        adminToken,
        publicToken,
        adminLink,
        publicLink,
        visibility: "public",
        travelersCount: typeof body.travelersCount === "number" && body.travelersCount > 0 ? body.travelersCount : 1,
        status: "draft",
      })

      const insertPayload = buildTripInsertPayload(
        trip,
        {
          adminToken,
          publicToken,
          adminLink,
          publicLink,
        },
        {
          source: "pending_claim",
          claimTokenHash,
          claimTokenExpiresAt,
        },
      )

      const { data, error } = await supabase.from("trips").insert(insertPayload).select("*").single()

      if (!error && data) {
        const travelersResult = await ensureTripTravelersPersistedWithClient(supabase, {
          tripId: data.id,
          travelersCount: trip.travelersCount,
        })

        if (travelersResult.error) {
          console.error("[TRIP] pending travelers placeholder error", travelersResult.error)
        }

        return NextResponse.json({
          trip: {
            id: data.id,
            slug: data.slug,
            title: data.title,
            destination: data.destination,
            publicLink: buildPublicTripUrl(data.slug),
          },
          claimToken,
        })
      }

      if (isTripSlugConflict(error) && attempt < MAX_TRIP_SLUG_ATTEMPTS - 1) {
        for (const existingSlug of await listExistingTripSlugs(supabase, baseSlug)) {
          knownSlugs.add(existingSlug)
        }
        continue
      }

      console.error("[TRIP] pending insert error", error)
      return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
    }

    return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "Supabase admin indisponivel para criar a viagem." }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : CREATE_TRIP_ERROR_MESSAGE
    console.error("[TRIP] pending route error", message)
    return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
  }
}
