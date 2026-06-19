import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

export interface TripHotelPayload {
  tripId: string
  name: string
  address?: string | null
  checkIn?: string | null
  checkOut?: string | null
  confirmationCode?: string | null
  notes?: string | null
  documentId?: string | null
}

export interface TripHotelUpdatePayload {
  name?: string
  address?: string | null
  checkIn?: string | null
  checkOut?: string | null
  confirmationCode?: string | null
  notes?: string | null
  documentId?: string | null
}

export interface TripHotelRecord {
  id: string
  tripId: string
  name: string
  address: string | null
  checkIn: string | null
  checkOut: string | null
  confirmationCode: string | null
  notes: string | null
  documentId: string | null
  createdAt: string
  updatedAt: string
}

type TripHotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type TripHotelInsert = Database["public"]["Tables"]["trip_hotels"]["Insert"]
type TripHotelUpdate = Database["public"]["Tables"]["trip_hotels"]["Update"]

function mapRow(row: TripHotelRow): TripHotelRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name ?? row.hotel_name ?? "",
    address: row.address ?? null,
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    confirmationCode: row.confirmation_code ?? row.confirmation_number ?? null,
    notes: row.notes ?? null,
    documentId: row.document_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function getClient() {
  if (!shouldUseSupabase()) {
    return { client: null, error: "Supabase nao esta ativo neste ambiente." }
  }

  const client = createSupabaseBrowserClient() as any
  if (!client) {
    return { client: null, error: "Cliente Supabase indisponivel." }
  }

  return { client, error: null }
}

export async function listTripHotels(tripId: string) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return { source: "local" as const, data: [] as TripHotelRecord[], error: clientError }
  }

  const { data, error } = await client
    .from("trip_hotels")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })

  if (error) {
    return { source: "supabase" as const, data: [] as TripHotelRecord[], error: error.message }
  }

  return { source: "supabase" as const, data: (data ?? []).map(mapRow), error: null }
}

export async function createTripHotel(payload: TripHotelPayload) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return { source: "local" as const, data: null, error: clientError }
  }

  const { data, error } = await client
    .from("trip_hotels")
    .insert({
      trip_id: payload.tripId,
      name: payload.name,
      address: payload.address ?? null,
      check_in: payload.checkIn ?? null,
      check_out: payload.checkOut ?? null,
      confirmation_code: payload.confirmationCode ?? null,
      notes: payload.notes ?? null,
      document_id: payload.documentId ?? null,
    } satisfies TripHotelInsert)
    .select("*")
    .single()

  if (error) {
    return { source: "supabase" as const, data: null, error: error.message }
  }

  return { source: "supabase" as const, data: mapRow(data), error: null }
}

export async function updateTripHotel(id: string, payload: TripHotelUpdatePayload) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return { source: "local" as const, data: null, error: clientError }
  }

  const { data, error } = await client
    .from("trip_hotels")
    .update({
      name: payload.name,
      address: payload.address ?? null,
      check_in: payload.checkIn ?? null,
      check_out: payload.checkOut ?? null,
      confirmation_code: payload.confirmationCode ?? null,
      notes: payload.notes ?? null,
      document_id: payload.documentId ?? undefined,
    } satisfies TripHotelUpdate)
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    return { source: "supabase" as const, data: null, error: error.message }
  }

  return { source: "supabase" as const, data: mapRow(data), error: null }
}

export async function deleteTripHotel(id: string) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return { source: "local" as const, success: false, error: clientError }
  }

  const { error } = await client.from("trip_hotels").delete().eq("id", id)

  if (error) {
    return { source: "supabase" as const, success: false, error: error.message }
  }

  return { source: "supabase" as const, success: true, error: null }
}
