import type { SupabaseClient } from "@supabase/supabase-js"
import type { TripTraveler } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

type TripTravelerRow = Database["public"]["Tables"]["trip_travelers"]["Row"]
type TripTravelerInsert = Database["public"]["Tables"]["trip_travelers"]["Insert"]
type TripTravelersClient = Pick<SupabaseClient<Database>, "from">

export interface TripTravelerPayload {
  name: string
  role?: "primary" | "companion"
  isPrimary?: boolean
  avatarUrl?: string | null
}

export interface TripTravelersResult {
  source: "supabase" | "supabase-placeholder"
  data: TripTraveler[]
  error: string | null
  config?: ReturnType<typeof createSupabaseBrowserClientPlaceholder>
}

function mapTripTravelerRow(row: TripTravelerRow): TripTraveler {
  const isPrimary = row.is_primary === true || row.role === "primary"
  return {
    id: row.id,
    name: row.name,
    role: isPrimary ? "primary" : "companion",
    email: null,
    phone: null,
    avatarUrl: row.avatar_url,
    isPrimary,
  }
}

function buildTripTravelerInsertPayload(tripId: string, payload: TripTravelerPayload): TripTravelerInsert {
  const role = payload.isPrimary || payload.role === "primary" ? "primary" : "companion"
  return {
    trip_id: tripId,
    name: payload.name,
    role,
    is_primary: role === "primary",
    avatar_url: payload.avatarUrl ?? null,
  }
}

function buildTravelerPlaceholder(index: number): TripTravelerInsert {
  return {
    name: index === 0 ? "Viajante Principal" : `Acompanhante ${index}`,
    role: index === 0 ? "primary" : "companion",
    is_primary: index === 0,
    avatar_url: null,
  }
}

function sanitizeTravelerId(travelerId: string) {
  return typeof travelerId === "string" ? travelerId.trim() : ""
}

export async function listTripTravelersByTripWithClient(client: TripTravelersClient, tripId: string) {
  const { data, error } = await client
    .from("trip_travelers")
    .select("*")
    .eq("trip_id", tripId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [] as TripTraveler[], error: error.message }
  }

  return { data: (data ?? []).map(mapTripTravelerRow), error: null as string | null }
}

export async function ensureTripTravelersPersistedWithClient(
  client: TripTravelersClient,
  params: { tripId: string; travelersCount?: number | null },
) {
  const current = await listTripTravelersByTripWithClient(client, params.tripId)
  if (current.error || current.data.length > 0) {
    return current
  }

  const total = typeof params.travelersCount === "number" ? Math.max(params.travelersCount, 0) : 0
  if (total === 0) {
    return { data: [] as TripTraveler[], error: null as string | null }
  }

  const placeholders = Array.from({ length: total }, (_, index) => ({
    ...buildTravelerPlaceholder(index),
    trip_id: params.tripId,
  }))

  const { data, error } = await client
    .from("trip_travelers")
    .insert(placeholders)
    .select("*")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) {
    return { data: [] as TripTraveler[], error: error.message }
  }

  return { data: (data ?? []).map(mapTripTravelerRow), error: null as string | null }
}

export async function createTripTravelerWithClient(
  client: TripTravelersClient,
  tripId: string,
  payload: TripTravelerPayload,
) {
  const nextPayload = buildTripTravelerInsertPayload(tripId, payload)
  if (nextPayload.is_primary) {
    const resetPrimaryResult = await client
      .from("trip_travelers")
      .update({ is_primary: false, role: "companion" })
      .eq("trip_id", tripId)

    if (resetPrimaryResult.error) {
      return { data: null as TripTraveler | null, error: resetPrimaryResult.error.message }
    }
  }

  const { data, error } = await client
    .from("trip_travelers")
    .insert(nextPayload)
    .select("*")
    .single()

  if (error) {
    return { data: null as TripTraveler | null, error: error.message }
  }

  return { data: mapTripTravelerRow(data as TripTravelerRow), error: null as string | null }
}

export async function updateTripTravelerWithClient(
  client: TripTravelersClient,
  travelerId: string,
  tripId: string | null,
  payload: TripTravelerPayload,
) {
  const safeTravelerId = sanitizeTravelerId(travelerId)
  if (!safeTravelerId) {
    return { data: null as TripTraveler | null, error: "Identificador do viajante invalido." }
  }

  const nextRole = payload.isPrimary || payload.role === "primary" ? "primary" : "companion"
  if (nextRole === "primary" && tripId) {
    const resetPrimaryResult = await client
      .from("trip_travelers")
      .update({ is_primary: false, role: "companion" })
      .eq("trip_id", tripId)
      .neq("id", safeTravelerId)

    if (resetPrimaryResult.error) {
      return { data: null as TripTraveler | null, error: resetPrimaryResult.error.message }
    }
  }

  let query = client
    .from("trip_travelers")
    .update({
      name: payload.name,
      role: nextRole,
      is_primary: nextRole === "primary",
      avatar_url: payload.avatarUrl ?? null,
    })
    .eq("id", safeTravelerId)

  if (tripId) {
    query = query.eq("trip_id", tripId)
  }

  const { data, error } = await query.select("*").single()

  if (error) {
    return { data: null as TripTraveler | null, error: error.message }
  }

  return { data: mapTripTravelerRow(data as TripTravelerRow), error: null as string | null }
}

export async function deleteTripTravelerWithClient(client: TripTravelersClient, travelerId: string, tripId?: string | null) {
  const safeTravelerId = sanitizeTravelerId(travelerId)
  if (!safeTravelerId) {
    return { error: "Identificador do viajante invalido." }
  }

  let query = client.from("trip_travelers").delete().eq("id", safeTravelerId)
  if (tripId) {
    query = query.eq("trip_id", tripId)
  }
  const { error } = await query
  return { error: error?.message ?? null }
}

export async function setPrimaryTripTravelerWithClient(
  client: TripTravelersClient,
  travelerId: string,
  tripId?: string | null,
) {
  const safeTravelerId = sanitizeTravelerId(travelerId)
  if (!safeTravelerId) {
    return { data: null as TripTraveler | null, error: "Identificador do viajante invalido." }
  }

  if (tripId) {
    const resetPrimaryResult = await client
      .from("trip_travelers")
      .update({
        is_primary: false,
        role: "companion",
      })
      .eq("trip_id", tripId)
      .neq("id", safeTravelerId)

    if (resetPrimaryResult.error) {
      return { data: null as TripTraveler | null, error: resetPrimaryResult.error.message }
    }
  }

  let query = client
    .from("trip_travelers")
    .update({
      is_primary: true,
      role: "primary",
    })
    .eq("id", safeTravelerId)

  if (tripId) {
    query = query.eq("trip_id", tripId)
  }

  const { data, error } = await query.select("*").single()

  if (error) {
    return { data: null as TripTraveler | null, error: error.message }
  }

  return { data: mapTripTravelerRow(data as TripTravelerRow), error: null as string | null }
}

export async function listTripTravelersByTrip(tripId: string): Promise<TripTravelersResult> {
  if (!shouldUseSupabase()) {
    return {
      source: "supabase-placeholder",
      config: createSupabaseBrowserClientPlaceholder(),
      data: [],
      error: "Persistencia real de viajantes requer Supabase ativo.",
    }
  }

  const client = createSupabaseBrowserClient()
  if (!client) {
    return {
      source: "supabase-placeholder",
      config: createSupabaseBrowserClientPlaceholder(),
      data: [],
      error: "Supabase browser client indisponivel.",
    }
  }

  const result = await listTripTravelersByTripWithClient(client, tripId)
  return {
    source: "supabase",
    data: result.data,
    error: result.error,
  }
}
