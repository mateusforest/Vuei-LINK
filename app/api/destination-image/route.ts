import { NextRequest, NextResponse } from "next/server"
import { resolveDestinationImage } from "@/lib/destination-image-resolver"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { normalizeImageUrl } from "@/lib/trip-destination"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type AccessMode = "admin" | "public"

async function resolveTripByLinkAccess(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
}) {
  const supabase = createSupabaseAdminClient()

  let query = supabase.from("trips").select("*")
  if (params.tripId) {
    query = query.eq("id", params.tripId)
  } else if (params.tripSlug) {
    query = query.eq("slug", params.tripSlug)
  } else if (params.accessMode === "admin" && params.adminToken) {
    query = query.eq("admin_token", params.adminToken)
  } else if (params.accessMode === "public" && params.publicToken) {
    query = query.eq("public_token", params.publicToken)
  } else {
    return { trip: null as TripRow | null, error: "Link da viagem invalido." }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { trip: null as TripRow | null, error: error.message }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, error: "Viagem nao encontrada." }
  }

  if (params.accessMode === "admin") {
    const tokenMatches = Boolean(params.adminToken && trip.admin_token === params.adminToken)
    if (!tokenMatches) {
      return { trip: null as TripRow | null, error: "Acesso administrativo invalido para este link." }
    }
  } else {
    const tokenMatches = Boolean(params.publicToken && trip.public_token === params.publicToken)
    const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug && trip.visibility === "public")

    if (trip.visibility !== "public") {
      return { trip: null as TripRow | null, error: "Esta viagem nao esta disponivel publicamente." }
    }

    if (!tokenMatches && !slugMatches) {
      return { trip: null as TripRow | null, error: "Acesso publico invalido para este link." }
    }
  }

  return { trip, error: null as string | null }
}

async function persistTripCoverImage(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
  imageUrl: string
}) {
  if (!hasSupabaseAdminEnv()) return false

  const accessResult = await resolveTripByLinkAccess({
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    adminToken: params.adminToken,
    publicToken: params.publicToken,
    accessMode: params.accessMode,
  })

  if (!accessResult.trip || normalizeImageUrl(accessResult.trip.cover_image)) {
    return false
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("trips")
    .update({
      cover_image: params.imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accessResult.trip.id)
    .is("cover_image", null)

  if (error) {
    console.error("[DESTINATION IMAGE] failed to persist trip cover image", {
      tripId: accessResult.trip.id,
      strategy: params.accessMode,
      error: error.message,
    })
    return false
  }

  return true
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const destination = url.searchParams.get("destination")
    const city = url.searchParams.get("city")
    const country = url.searchParams.get("country")
    const persist = url.searchParams.get("persist") === "1"
    const tripId = url.searchParams.get("tripId")
    const tripSlug = url.searchParams.get("tripSlug")
    const adminToken = url.searchParams.get("adminToken")
    const publicToken = url.searchParams.get("publicToken") || url.searchParams.get("token")
    const accessMode = (url.searchParams.get("accessMode") === "admin" ? "admin" : "public") as AccessMode

    const result = await resolveDestinationImage({
      destination,
      city,
      country,
    })

    let persisted = false
    if (persist && result.source !== "fallback" && normalizeImageUrl(result.imageUrl)) {
      try {
        persisted = await persistTripCoverImage({
          tripId,
          tripSlug,
          adminToken,
          publicToken,
          accessMode,
          imageUrl: result.imageUrl!,
        })
      } catch (error) {
        console.error("[DESTINATION IMAGE] failed to persist resolved image", {
          tripId,
          tripSlug,
          accessMode,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.info("[DESTINATION IMAGE] resolved", {
      destination,
      country,
      strategy: result.strategy,
      source: result.source,
      persisted,
    })

    return NextResponse.json(
      {
        ...result,
        persisted,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    )
  } catch (error) {
    console.error("[DESTINATION IMAGE] failed to resolve image", error)

    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json(
        { error: "A configuracao administrativa do servidor nao esta disponivel no momento." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel resolver a imagem do destino." },
      { status: 500 },
    )
  }
}
