import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"

export interface TripHotelPayload {
  tripId: string
  name: string
  address?: string | null
  checkIn?: string | null
  checkOut?: string | null
  confirmationCode?: string | null
  notes?: string | null
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
  createdAt: string
  updatedAt: string
}

function mapRow(row: any): TripHotelRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    address: row.address ?? null,
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    confirmationCode: row.confirmation_code ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getTripHotel(tripId: string) {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: null, error: null }
  }

  const client = createSupabaseBrowserClient() as any
  if (!client) {
    return { source: "supabase" as const, data: null, error: "Cliente Supabase indisponivel." }
  }

  const { data, error } = await client.from("trip_hotels").select("*").eq("trip_id", tripId).maybeSingle()
  if (error) {
    return { source: "supabase" as const, data: null, error: error.message }
  }

  return { source: "supabase" as const, data: data ? mapRow(data) : null, error: null }
}

export async function upsertTripHotel(payload: TripHotelPayload) {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: null, error: "Supabase nao esta ativo neste ambiente." }
  }

  const client = createSupabaseBrowserClient() as any
  if (!client) {
    return { source: "supabase" as const, data: null, error: "Cliente Supabase indisponivel." }
  }

  const { data, error } = await client
    .from("trip_hotels")
    .upsert(
      {
        trip_id: payload.tripId,
        name: payload.name,
        address: payload.address ?? null,
        check_in: payload.checkIn ?? null,
        check_out: payload.checkOut ?? null,
        confirmation_code: payload.confirmationCode ?? null,
        notes: payload.notes ?? null,
      },
      { onConflict: "trip_id" }
    )
    .select("*")
    .single()

  if (error) {
    return { source: "supabase" as const, data: null, error: error.message }
  }

  return { source: "supabase" as const, data: mapRow(data), error: null }
}
