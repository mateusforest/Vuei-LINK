import type { Document } from "@/types"
import type { TripFlightRecord, TripFlightUpsertPayload } from "@/types/flight"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"
import { dispatchCreditBalanceChanged } from "@/lib/credits/credit-events"

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
  const extractedData = (row.extracted_data ?? {}) as Record<string, unknown>
  const structuredResult =
    extractedData.structured_result && typeof extractedData.structured_result === "object"
      ? (extractedData.structured_result as Record<string, unknown>)
      : extractedData

  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    airline: row.airline ?? (typeof structuredResult.airline === "string" ? structuredResult.airline : null),
    flightNumber: row.flight_number ?? (typeof structuredResult.flight_number === "string" ? structuredResult.flight_number : null),
    bookingReference: row.booking_reference ?? (typeof structuredResult.booking_reference === "string" ? structuredResult.booking_reference : null),
    originAirport: row.origin_airport ?? (typeof structuredResult.origin_airport === "string" ? structuredResult.origin_airport : null),
    destinationAirport: row.destination_airport ?? (typeof structuredResult.destination_airport === "string" ? structuredResult.destination_airport : null),
    departureAt: row.departure_at ?? (typeof structuredResult.departure_at === "string" ? structuredResult.departure_at : null),
    arrivalAt: row.arrival_at ?? (typeof structuredResult.arrival_at === "string" ? structuredResult.arrival_at : null),
    passengerName: row.passenger_name ?? (typeof structuredResult.passenger_name === "string" ? structuredResult.passenger_name : null),
    qrCodePayload: row.qr_code_payload ?? (typeof structuredResult.qr_code_payload === "string" ? structuredResult.qr_code_payload : null),
    baggageInfo: row.baggage_info ?? (typeof structuredResult.baggage_info === "string" ? structuredResult.baggage_info : null),
    terminal: row.terminal ?? (typeof structuredResult.terminal === "string" ? structuredResult.terminal : null),
    gate: row.gate ?? (typeof structuredResult.gate === "string" ? structuredResult.gate : null),
    seat: row.seat ?? (typeof structuredResult.seat === "string" ? structuredResult.seat : null),
    extractedData,
    extractionStatus: row.extraction_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDocumentRow(row: Database["public"]["Tables"]["documents"]["Row"]): Document {
  return {
    id: row.id,
    tripId: row.trip_id,
    clientId: row.client_id,
    agencyId: row.agency_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    fileUrl: row.file_url,
    filePath: row.file_path,
    mimeType: row.mime_type,
    size: row.size_bytes,
    isPrivate: row.is_private,
    visibility: row.visibility,
    aiExtractedData: (row.ai_extracted_data ?? {}) as Record<string, unknown>,
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

export async function requestTripFlightExtraction(payload: { tripId: string; documentId: string; flightId: string; tripSlug?: string | null; adminToken?: string | null }) {
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
  const normalizedData = data && typeof data === "object"
    ? {
        ...data,
        flight: data?.flight && typeof data.flight === "object" && "flight_number" in data.flight
          ? mapRow(data.flight as TripFlightRow)
          : data?.flight ?? null,
        document: data?.document && typeof data.document === "object" && "file_path" in data.document
          ? mapDocumentRow(data.document as Database["public"]["Tables"]["documents"]["Row"])
          : data?.document ?? null,
      }
    : data

  if (response.ok && normalizedData?.flight) {
    dispatchCreditBalanceChanged({ feature: "flight_extraction" })
  }

  return {
    source: "api" as const,
    data: normalizedData,
    error: response.ok ? null : normalizedData?.error || "Nao foi possivel processar a passagem anexada.",
  }
}
