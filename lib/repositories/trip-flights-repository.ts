import type { TripFlightRecord } from "@/types/flight"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"

const STORAGE_KEY = "vuei_trip_flights_repository"

interface PersistedTripFlightsPayload {
  flights: TripFlightRecord[]
}

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

export async function listTripFlights(tripId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as TripFlightRecord[],
      error: "A tabela operacional de passagens ainda precisa ser provisionada no Supabase para leitura real.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalFlights().filter((flight) => flight.tripId === tripId),
    error: null,
  }
}

export async function upsertTripFlight(payload: Omit<TripFlightRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    return {
      source: client ? ("supabase-placeholder" as const) : ("supabase-placeholder" as const),
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as TripFlightRecord | null,
      error: "A tabela operacional de passagens ainda precisa ser provisionada no Supabase para escrita real.",
    }
  }

  const now = new Date().toISOString()
  const flights = readLocalFlights()
  const nextFlight: TripFlightRecord = {
    ...payload,
    id: payload.id ?? `flight-${Date.now()}`,
    createdAt: payload.id ? flights.find((item) => item.id === payload.id)?.createdAt ?? now : now,
    updatedAt: now,
  }
  const nextFlights = [nextFlight, ...flights.filter((item) => item.id !== nextFlight.id)]
  writeLocalFlights(nextFlights)

  return {
    source: "local" as const,
    data: nextFlight,
    error: null,
  }
}
