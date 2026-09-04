import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { resolveTripLinkLifecycle, type TripLinkLifecycleStatus } from "@/lib/security/trip-link-lifecycle"

export type TripLinkAccessMode = "admin" | "public"
export type TripRow = Database["public"]["Tables"]["trips"]["Row"]

type SupabaseDbClient = SupabaseClient<Database>

interface ResolveTripLinkAccessParams {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripLinkAccessMode
}

export type TripLinkAccessErrorCode =
  | "trip_link_invalid"
  | "trip_not_found"
  | "trip_link_not_public"
  | "trip_link_ended"
  | "trip_link_access_invalid"

export interface TripLinkAccessResult {
  trip: TripRow | null
  error: string | null
  code: TripLinkAccessErrorCode | null
  lifecycle: TripLinkLifecycleStatus | null
}

export async function resolveTripLinkAccess(
  client: SupabaseDbClient,
  params: ResolveTripLinkAccessParams,
): Promise<TripLinkAccessResult> {
  let query = client.from("trips").select("*")

  if (params.tripId) {
    query = query.eq("id", params.tripId)
  } else if (params.tripSlug) {
    query = query.eq("slug", params.tripSlug)
  } else if (params.accessMode === "admin" && params.adminToken) {
    query = query.eq("admin_token", params.adminToken)
  } else if (params.accessMode === "public" && params.publicToken) {
    query = query.eq("public_token", params.publicToken)
  } else {
    return { trip: null, error: "Link da viagem inválido.", code: "trip_link_invalid", lifecycle: null }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { trip: null, error: error.message, code: "trip_link_access_invalid", lifecycle: null }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { trip: null, error: "Viagem não encontrada.", code: "trip_not_found", lifecycle: null }
  }

  const lifecycle = resolveTripLinkLifecycle({
    ownerType: trip.owner_type,
    visibility: trip.visibility,
    status: trip.status,
    endDate: trip.end_date,
    linkActivatedAt: trip.link_activated_at,
    linkAccessUntil: trip.link_access_until,
  })

  if (params.accessMode === "admin") {
    if (!params.adminToken) {
      return { trip: null, error: "Admin token obrigatório para acesso administrativo.", code: "trip_link_access_invalid", lifecycle }
    }

    if (trip.admin_token !== params.adminToken) {
      return { trip: null, error: "Acesso administrativo inválido para esta viagem.", code: "trip_link_access_invalid", lifecycle }
    }

    if (trip.owner_type === "traveler" && lifecycle === "ended") {
      return { trip: null, error: "Esta viagem foi encerrada.", code: "trip_link_ended", lifecycle }
    }

    return { trip, error: null, code: null, lifecycle }
  }

  const tokenMatches = Boolean(params.publicToken && trip.public_token === params.publicToken)
  const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug && trip.visibility === "public")

  if (!tokenMatches && !slugMatches) {
    return { trip: null, error: "Acesso público inválido para esta viagem.", code: "trip_link_access_invalid", lifecycle }
  }

  if (lifecycle === "ended") {
    return { trip: null, error: "Esta viagem foi encerrada.", code: "trip_link_ended", lifecycle }
  }

  if (trip.visibility !== "public" || (lifecycle !== "active" && lifecycle !== "post_trip")) {
    return { trip: null, error: "Esta viagem não está disponível publicamente.", code: "trip_link_not_public", lifecycle }
  }

  return { trip, error: null, code: null, lifecycle }
}

export function hasAgencyMutationAccess(role?: string | null) {
  return role === "owner" || role === "admin" || role === "member"
}
