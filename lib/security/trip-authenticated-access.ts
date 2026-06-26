import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { hasAgencyMutationAccess } from "@/lib/security/trip-link-access"

type ServerClient = SupabaseClient<Database>
type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type AgencyMemberRow = Database["public"]["Tables"]["agency_members"]["Row"]

async function getProfile(client: ServerClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, agency_id")
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { data: null as ProfileRow | null, error: error.message }
  }

  return { data: (data as ProfileRow | null) ?? null, error: null }
}

export async function resolveAuthenticatedTripAccess(
  client: ServerClient,
  userId: string,
  params: {
    tripId?: string | null
    tripSlug?: string | null
    requireMutationRole?: boolean
  },
) {
  const profileResult = await getProfile(client, userId)
  if (!profileResult.data) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: null as ProfileRow | null,
      error: profileResult.error ?? "Perfil do usuario nao encontrado.",
    }
  }

  let tripQuery = client.from("trips").select("*")
  if (params.tripId) {
    tripQuery = tripQuery.eq("id", params.tripId)
  } else if (params.tripSlug) {
    tripQuery = tripQuery.eq("slug", params.tripSlug)
  } else {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: "Viagem nao encontrada.",
    }
  }

  const tripResult = await tripQuery.maybeSingle()
  if (tripResult.error) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: tripResult.error.message,
    }
  }

  const trip = tripResult.data as TripRow | null
  if (!trip) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: "Viagem nao encontrada.",
    }
  }

  if (profileResult.data.role === "master" || trip.owner_user_id === userId) {
    return {
      trip,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: null as string | null,
    }
  }

  if (!trip.agency_id) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: "Voce nao tem permissao para acessar esta viagem.",
    }
  }

  const membershipResult = await client
    .from("agency_members")
    .select("*")
    .eq("agency_id", trip.agency_id)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (membershipResult.error) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: membershipResult.error.message,
    }
  }

  if (!membershipResult.data) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: "Voce nao tem permissao para acessar esta viagem.",
    }
  }

  if (params.requireMutationRole && !hasAgencyMutationAccess(membershipResult.data.role)) {
    return {
      trip: null as TripRow | null,
      membership: null as AgencyMemberRow | null,
      profile: profileResult.data,
      error: "Voce nao tem permissao para editar esta viagem.",
    }
  }

  return {
    trip,
    membership: membershipResult.data as AgencyMemberRow,
    profile: profileResult.data,
    error: null as string | null,
  }
}
