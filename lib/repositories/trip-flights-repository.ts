import type { TripFlightRecord, TripFlightUpsertPayload } from "@/types/flight"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

const STORAGE_KEY = "vuei_trip_flights_repository"

interface PersistedTripFlightsPayload {
  flights: TripFlightRecord[]
}

type TripFlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type TripFlightInsert = Database["public"]["Tables"]["trip_flights"]["Insert"]
type TripFlightUpdate = Database["public"]["Tables"]["trip_flights"]["Update"]

function readLocalFlights() {
  if (typeof window === "undefined") return [] as TripFlightRecord[]

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as PersistedTripFlightsPayload | TripFlightRecord[]) : []
    return Array.isArray(parsed) ? parsed : parsed.flights ?? []
  } catch {
    return []
  }
}

function writeLocalFlights(flights: TripFlightRecord[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ flights }))
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

function mapRow(row: TripFlightRow): TripFlightRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    airline: row.airline,
    flightNumber: row.flight_number,
    bookingReference: row.booking_reference,
    originAirport: row.origin_airport,
    destinationAirport: row.destination_airport,
    departureAt: row.departure_at,
    arrivalAt: row.arrival_at,
    passengerName: row.passenger_name,
    qrCodePayload: row.qr_code_payload,
    baggageInfo: row.baggage_info,
    terminal: row.terminal,
    gate: row.gate,
    seat: row.seat,
    extractedData: (row.extracted_data ?? {}) as Record<string, unknown>,
    extractionStatus: row.extraction_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildInsertPayload(payload: TripFlightUpsertPayload): TripFlightInsert {
  return {
    trip_id: payload.tripId,
    document_id: payload.documentId ?? null,
    airline: payload.airline ?? null,
    flight_number: payload.flightNumber ?? null,
    booking_reference: payload.bookingReference ?? null,
    origin_airport: payload.originAirport ?? null,
    destination_airport: payload.destinationAirport ?? null,
    departure_at: payload.departureAt ?? null,
    arrival_at: payload.arrivalAt ?? null,
    passenger_name: payload.passengerName ?? null,
    qr_code_payload: payload.qrCodePayload ?? null,
    baggage_info: payload.baggageInfo ?? null,
    terminal: payload.terminal ?? null,
    gate: payload.gate ?? null,
    seat: payload.seat ?? null,
    extracted_data: payload.extractedData ?? {},
    extraction_status: payload.extractionStatus ?? "pending",
  }
}

function buildUpdatePayload(payload: TripFlightUpsertPayload): TripFlightUpdate {
  return {
    document_id: payload.documentId ?? null,
    airline: payload.airline ?? null,
    flight_number: payload.flightNumber ?? null,
    booking_reference: payload.bookingReference ?? null,
    origin_airport: payload.originAirport ?? null,
    destination_airport: payload.destinationAirport ?? null,
    departure_at: payload.departureAt ?? null,
    arrival_at: payload.arrivalAt ?? null,
    passenger_name: payload.passengerName ?? null,
    qr_code_payload: payload.qrCodePayload ?? null,
    baggage_info: payload.baggageInfo ?? null,
    terminal: payload.terminal ?? null,
    gate: payload.gate ?? null,
    seat: payload.seat ?? null,
    extracted_data: payload.extractedData ?? {},
    extraction_status: payload.extractionStatus ?? "pending",
    updated_at: new Date().toISOString(),
  }
}

export async function listTripFlights(tripId: string) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return {
      source: shouldUseSupabase() ? ("supabase-placeholder" as const) : ("local" as const),
      config: shouldUseSupabase() ? createSupabaseBrowserClientPlaceholder() : undefined,
      data: shouldUseSupabase() ? ([] as TripFlightRecord[]) : readLocalFlights().filter((flight) => flight.tripId === tripId),
      error: shouldUseSupabase() ? clientError : null,
    }
  }

  const { data, error } = await client
    .from("trip_flights")
    .select("*")
    .eq("trip_id", tripId)
    .order("departure_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  if (error) {
    return { source: "supabase" as const, data: [] as TripFlightRecord[], error: error.message }
  }

  return { source: "supabase" as const, data: (data ?? []).map(mapRow), error: null }
}

export async function listPublicTripFlights(tripId: string) {
  const { client, error: clientError } = getClient()
  if (!client) {
    return {
      source: shouldUseSupabase() ? ("supabase-placeholder" as const) : ("local" as const),
      config: shouldUseSupabase() ? createSupabaseBrowserClientPlaceholder() : undefined,
      data: shouldUseSupabase() ? ([] as TripFlightRecord[]) : readLocalFlights().filter((flight) => flight.tripId === tripId),
      error: shouldUseSupabase() ? clientError : null,
    }
  }

  const { data, error } = await client
    .from("trip_flights")
    .select("*")
    .eq("trip_id", tripId)
    .in("extraction_status", ["pending", "processing", "completed", "failed", "manual"])
    .order("departure_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })

  if (error) {
    return { source: "supabase" as const, data: [] as TripFlightRecord[], error: error.message }
  }

  return { source: "supabase" as const, data: (data ?? []).map(mapRow), error: null }
}

export async function upsertTripFlight(payload: TripFlightUpsertPayload) {
  const { client, error: clientError } = getClient()
  if (!client) {
    if (shouldUseSupabase()) {
      return {
        source: "supabase-placeholder" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null as TripFlightRecord | null,
        error: clientError,
      }
    }

    const now = new Date().toISOString()
    const flights = readLocalFlights()
    const nextFlight: TripFlightRecord = {
      id: payload.id ?? `flight-${Date.now()}`,
      tripId: payload.tripId,
      documentId: payload.documentId ?? null,
      airline: payload.airline ?? null,
      flightNumber: payload.flightNumber ?? null,
      bookingReference: payload.bookingReference ?? null,
      originAirport: payload.originAirport ?? null,
      destinationAirport: payload.destinationAirport ?? null,
      departureAt: payload.departureAt ?? null,
      arrivalAt: payload.arrivalAt ?? null,
      passengerName: payload.passengerName ?? null,
      qrCodePayload: payload.qrCodePayload ?? null,
      baggageInfo: payload.baggageInfo ?? null,
      terminal: payload.terminal ?? null,
      gate: payload.gate ?? null,
      seat: payload.seat ?? null,
      extractedData: payload.extractedData ?? {},
      extractionStatus: payload.extractionStatus ?? "pending",
      createdAt: payload.id ? flights.find((item) => item.id === payload.id)?.createdAt ?? now : now,
      updatedAt: now,
    }
    const nextFlights = [nextFlight, ...flights.filter((item) => item.id !== nextFlight.id)]
    writeLocalFlights(nextFlights)

    return { source: "local" as const, data: nextFlight, error: null }
  }

  if (payload.id) {
    const { data, error } = await client
      .from("trip_flights")
      .update(buildUpdatePayload(payload))
      .eq("id", payload.id)
      .select("*")
      .single()

    if (error) {
      return { source: "supabase" as const, data: null as TripFlightRecord | null, error: error.message }
    }

    return { source: "supabase" as const, data: mapRow(data), error: null }
  }

  const { data, error } = await client
    .from("trip_flights")
    .insert(buildInsertPayload(payload))
    .select("*")
    .single()

  if (error) {
    return { source: "supabase" as const, data: null as TripFlightRecord | null, error: error.message }
  }

  return { source: "supabase" as const, data: mapRow(data), error: null }
}

export async function deleteTripFlight(id: string) {
  const { client, error: clientError } = getClient()
  if (!client) {
    if (shouldUseSupabase()) {
      return {
        source: "supabase-placeholder" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        success: false,
        error: clientError,
      }
    }

    writeLocalFlights(readLocalFlights().filter((flight) => flight.id !== id))
    return { source: "local" as const, success: true, error: null }
  }

  const { error } = await client.from("trip_flights").delete().eq("id", id)
  if (error) {
    return { source: "supabase" as const, success: false, error: error.message }
  }

  return { source: "supabase" as const, success: true, error: null }
}

export async function requestTripFlightExtraction(payload: { tripId: string; documentId: string; flightId: string }) {
  if (!shouldUseSupabase()) {
    return {
      source: "local" as const,
      data: null,
      error: "A extracao operacional de passagens so fica disponivel com Supabase ativo.",
    }
  }

  const response = await fetch("/api/ai/trip-flights/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  return {
    source: "api" as const,
    data,
    error: response.ok ? null : data?.error || "Nao foi possivel processar a passagem anexada.",
  }
}
