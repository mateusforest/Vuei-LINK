import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

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

export async function resolveTripLinkAccess(
  client: SupabaseDbClient,
  params: ResolveTripLinkAccessParams,
) {
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
    return { trip: null as TripRow | null, error: "Link da viagem inválido." }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { trip: null as TripRow | null, error: error.message }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, error: "Viagem não encontrada." }
  }

  if (params.accessMode === "admin") {
    if (!params.adminToken) {
      return { trip: null as TripRow | null, error: "Admin token obrigatório para acesso administrativo." }
    }

    if (trip.admin_token !== params.adminToken) {
      return { trip: null as TripRow | null, error: "Acesso administrativo inválido para esta viagem." }
    }

    return { trip, error: null as string | null }
  }

  const tokenMatches = Boolean(params.publicToken && trip.public_token === params.publicToken)
  const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug && trip.visibility === "public")

  if (trip.visibility !== "public") {
    return { trip: null as TripRow | null, error: "Esta viagem não está disponível publicamente." }
  }

  if (!tokenMatches && !slugMatches) {
    return { trip: null as TripRow | null, error: "Acesso público inválido para esta viagem." }
  }

  return { trip, error: null as string | null }
}

export function hasAgencyMutationAccess(role?: string | null) {
  return role === "owner" || role === "admin" || role === "member"
}
