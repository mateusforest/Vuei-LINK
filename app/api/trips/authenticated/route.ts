import { NextResponse } from "next/server"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { ensureTripTravelersPersistedWithClient } from "@/lib/repositories/trip-travelers-repository"
import { buildAdminTripUrl, buildPublicTripUrl, generateSecureToken } from "@/lib/security/link-tokens"
import { buildUniqueTripSlug, slugifyTripBase } from "@/lib/mappers/trip-mappers"
import { mapTripRowToTrip, parseDestinationParts } from "@/lib/trips/trip-record"
import { CREATE_TRIP_ERROR_MESSAGE } from "@/lib/trips/trip-policies"
import { listExistingTripSlugs } from "@/lib/trips/trip-slug"
import { createWalletService } from "@/lib/wallet"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_TRIP_SLUG_ATTEMPTS = 5

type AuthenticatedTripPayload = {
  title?: string
  destination?: string
  country?: string | null
  city?: string | null
  startDate?: string | null
  endDate?: string | null
  style?: string | null
  status?: "draft" | "upcoming" | "ongoing" | "completed" | "cancelled"
  visibility?: "private" | "public"
  travelersCount?: number
  permissions?: Record<string, unknown>
  creditsSummary?: Record<string, unknown>
  offlineEnabled?: boolean
  idempotencyKey?: string | null
}

function unauthorized(error: string) {
  return NextResponse.json({ error }, { status: 401 })
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function isTripSlugConflictMessage(message: string) {
  return message.includes("duplicate key value") && message.includes("slug")
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin indisponivel para criar a viagem." }, { status: 503 })
  }

  const serverClient = await createSupabaseServerClient()
  if (!serverClient) {
    return unauthorized("Sessao indisponivel.")
  }

  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser()

  if (authError || !user) {
    return unauthorized("Login obrigatorio para criar a viagem.")
  }

  let body: AuthenticatedTripPayload

  try {
    body = await request.json()
  } catch {
    return badRequest("Payload invalido.")
  }

  const destination = body.destination?.trim()
  if (!destination) {
    return badRequest("Destino obrigatorio.")
  }

  const title = body.title?.trim() || destination
  const travelersCount =
    typeof body.travelersCount === "number" && Number.isFinite(body.travelersCount) && body.travelersCount >= 1
      ? body.travelersCount
      : 1

  try {
    const profile = await ensureProfile(user, serverClient)
    if (!profile || profile.role !== "traveler") {
      return NextResponse.json(
        { error: "Esta rota esta disponivel apenas para viajantes." },
        { status: 403 },
      )
    }

    const supabase = createSupabaseAdminClient()
    const walletService = createWalletService(supabase)
    const baseSlug = slugifyTripBase(title, destination)
    const knownSlugs = new Set(await listExistingTripSlugs(supabase, baseSlug))
    const destinationParts = parseDestinationParts(destination)

    for (let attempt = 0; attempt < MAX_TRIP_SLUG_ATTEMPTS; attempt += 1) {
      const slug = buildUniqueTripSlug(baseSlug, [...knownSlugs])
      knownSlugs.add(slug)

      const adminToken = generateSecureToken()
      const publicToken = generateSecureToken()
      const adminLink = buildAdminTripUrl(slug, adminToken)
      const publicLink = buildPublicTripUrl(slug)

      try {
        const createdRow = await walletService.createAuthenticatedTravelerTripWithWallet({
          ownerUserId: user.id,
          title,
          slug,
          destination,
          country: body.country ?? destinationParts.country,
          city: body.city ?? destinationParts.city,
          startDate: body.startDate ?? null,
          endDate: body.endDate ?? null,
          status: "draft",
          style: body.style ?? null,
          adminToken,
          publicToken,
          adminLink,
          publicLink,
          coverImage: null,
          visibility: "private",
          travelersCount,
          permissions: body.permissions ?? {},
          creditsSummary: body.creditsSummary ?? {},
          offlineEnabled: body.offlineEnabled ?? false,
          source: "manual",
          idempotencyKey: body.idempotencyKey ?? null,
        })

        const travelersResult = await ensureTripTravelersPersistedWithClient(supabase, {
          tripId: createdRow.id,
          travelersCount,
        })

        if (travelersResult.error) {
          console.error("[TRIP] authenticated travelers placeholder error", travelersResult.error)
        }

        return NextResponse.json({
          trip: createdRow,
          mappedTrip: mapTripRowToTrip(createdRow),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : CREATE_TRIP_ERROR_MESSAGE
        if (isTripSlugConflictMessage(message) && attempt < MAX_TRIP_SLUG_ATTEMPTS - 1) {
          for (const existingSlug of await listExistingTripSlugs(supabase, baseSlug)) {
            knownSlugs.add(existingSlug)
          }
          continue
        }
        throw error
      }
    }

    return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "Supabase admin indisponivel para criar a viagem." }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : CREATE_TRIP_ERROR_MESSAGE
    console.error("[TRIP] authenticated route error", message)
    return NextResponse.json({ error: CREATE_TRIP_ERROR_MESSAGE }, { status: 500 })
  }
}
