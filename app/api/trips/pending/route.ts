import { NextResponse } from "next/server"
import { mapStoredTripToTrip, slugifyTripBase, buildUniqueTripSlug } from "@/lib/mappers/trip-mappers"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { ensureTripTravelersPersistedWithClient } from "@/lib/repositories/trip-travelers-repository"
import { buildAdminTripUrl, buildPublicTripUrl, generateSecureToken } from "@/lib/security/link-tokens"
import {
  buildPendingTripClaimExpiresAt,
  generatePendingTripClaimToken,
  hashPendingTripClaimToken,
  isPendingTripClaimExpired,
} from "@/lib/server/pending-trip-claim"
import { buildTripInsertPayload } from "@/lib/trips/trip-record"
import { CREATE_TRIP_ERROR_MESSAGE } from "@/lib/trips/trip-policies"
import { isTripSlugConflict, listExistingTripSlugs } from "@/lib/trips/trip-slug"
import { checkRateLimit, getRequestIp } from "@/lib/server/request-rate-limit"
import type { Database } from "@/lib/supabase/types"

const MAX_TRIP_SLUG_ATTEMPTS = 5
const ANONYMOUS_CREATE_LIMIT = 5
const ANONYMOUS_CREATE_WINDOW_MS = 15 * 60 * 1000
const ANONYMOUS_RETRY_LIMIT = 12
const PENDING_REQUEST_TOKEN_PATTERN = /^[a-f0-9]{64}$/

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function pendingTripResponse(trip: TripRow, claimToken: string) {
  return NextResponse.json({
    trip: {
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelersCount: trip.travelers_count,
      status: "draft" as const,
      visibility: "private" as const,
      publicLink: buildPublicTripUrl(trip.slug),
    },
    claimToken,
    claimExpiresAt: trip.claim_token_expires_at,
  })
}

function pendingRequestConflict(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 409 })
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
    requestToken?: string
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

  const requestToken = body.requestToken?.trim().toLowerCase() || null
  if (requestToken && !PENDING_REQUEST_TOKEN_PATTERN.test(requestToken)) {
    return badRequest("Chave de criacao invalida.")
  }

  const ip = getRequestIp(request)
  const retryRateLimit = checkRateLimit(`pending-trip-request:${ip}`, {
    limit: ANONYMOUS_RETRY_LIMIT,
    windowMs: ANONYMOUS_CREATE_WINDOW_MS,
  })

  if (!retryRateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Muitas tentativas. Aguarde alguns minutos antes de criar outra viagem.",
        code: "rate_limit_exceeded",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(Math.ceil((retryRateLimit.resetAt - Date.now()) / 1000), 1)),
        },
      },
    )
  }

  try {
    const supabase = createSupabaseAdminClient()
    const claimToken = requestToken ?? generatePendingTripClaimToken()
    const claimTokenHash = hashPendingTripClaimToken(claimToken)

    if (requestToken) {
      const { data: existingTrip, error: existingTripError } = await supabase
        .from("trips")
        .select("*")
        .eq("claim_token_hash", claimTokenHash)
        .eq("owner_type", "traveler")
        .maybeSingle()

      if (existingTripError) {
        console.error("[TRIP] pending idempotency lookup error", existingTripError)
        return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
      }

      const existingTripRow = existingTrip as TripRow | null
      if (existingTripRow) {
        if (existingTripRow.owner_user_id || existingTripRow.claim_token_claimed_at) {
          return pendingRequestConflict("Este rascunho ja foi vinculado a uma conta.", "pending_request_claimed")
        }
        if (isPendingTripClaimExpired(existingTripRow.claim_token_expires_at)) {
          return pendingRequestConflict("A tentativa anterior expirou. Inicie uma nova viagem.", "pending_request_expired")
        }
        return pendingTripResponse(existingTripRow, claimToken)
      }
    }

    const createRateLimit = checkRateLimit(`pending-trip:${ip}`, {
      limit: ANONYMOUS_CREATE_LIMIT,
      windowMs: ANONYMOUS_CREATE_WINDOW_MS,
    })

    if (!createRateLimit.allowed) {
      return NextResponse.json(
        {
          error: "Muitas tentativas. Aguarde alguns minutos antes de criar outra viagem.",
          code: "rate_limit_exceeded",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(Math.ceil((createRateLimit.resetAt - Date.now()) / 1000), 1)),
          },
        },
      )
    }

    const baseSlug = slugifyTripBase(body.title, destination)
    const knownSlugs = new Set(await listExistingTripSlugs(supabase, baseSlug))

    for (let attempt = 0; attempt < MAX_TRIP_SLUG_ATTEMPTS; attempt += 1) {
      const slug = buildUniqueTripSlug(baseSlug, [...knownSlugs])
      knownSlugs.add(slug)

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
        visibility: "private",
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

      const { data, error } = await supabase.from("trips").insert(insertPayload as never).select("*").single()
      const insertedTrip = data as TripRow | null

      if (!error && insertedTrip) {
        const travelersResult = await ensureTripTravelersPersistedWithClient(supabase, {
          tripId: insertedTrip.id,
          travelersCount: trip.travelersCount,
        })

        if (travelersResult.error) {
          console.error("[TRIP] pending travelers placeholder error", travelersResult.error)
        }

        return pendingTripResponse(insertedTrip, claimToken)
      }

      if (requestToken) {
        const { data: retryTrip } = await supabase
          .from("trips")
          .select("*")
          .eq("claim_token_hash", claimTokenHash)
          .eq("owner_type", "traveler")
          .is("owner_user_id", null)
          .is("claim_token_claimed_at", null)
          .maybeSingle()

        const retryTripRow = retryTrip as TripRow | null
        if (retryTripRow && !isPendingTripClaimExpired(retryTripRow.claim_token_expires_at)) {
          return pendingTripResponse(retryTripRow, claimToken)
        }
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
