import type { Client, Trip } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { readLegacyAgencyData } from "@/lib/local-storage-migration"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { mapLegacyClientToClient, type LegacyAgencyClient } from "@/lib/mappers/agency-mappers"
import { mapAgencyTripToTrip, type LegacyAgencyTrip } from "@/lib/mappers/trip-mappers"

export interface ClientWithTrips extends Client {
  trips: Trip[]
}

type AgencyLocalState = {
  schemaVersion?: number
  clients?: LegacyAgencyClient[]
  trips?: LegacyAgencyTrip[]
  documents?: unknown[]
  conciergeRequests?: unknown[]
  teamMembers?: unknown[]
  activities?: unknown[]
  credits?: unknown
}

function readClientsState() {
  return readLegacyAgencyData<LegacyAgencyTrip>()
}

function writeClientsState(state: AgencyLocalState) {
  if (typeof window === "undefined") return
  window.localStorage.setItem("vuei_agency", JSON.stringify(state))
}

function getClients(agencyId: string | null) {
  return (readClientsState().clients ?? []).map((client) => mapLegacyClientToClient(client, agencyId))
}

export async function listClients(agencyId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Client[],
    }
  }

  return { source: "local" as const, data: getClients(agencyId) }
}

export async function getClientById(id: string) {
  const state = readClientsState()
  const client = (state.clients ?? []).find((item) => item.id === id) ?? null
  return {
    source: "local" as const,
    data: client ? mapLegacyClientToClient(client, "agency-frontend") : null,
  }
}

export async function createClient(payload: Omit<Client, "id" | "createdAt" | "updatedAt"> & { agencyId: string | null }) {
  const createdAt = new Date().toISOString()
  const client: Client = {
    id: `client-${Date.now()}`,
    agencyId: payload.agencyId,
    name: payload.name,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    document: payload.document ?? null,
    notes: payload.notes ?? null,
    status: payload.status,
    createdAt,
    updatedAt: createdAt,
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: client,
    }
  }

  const state = readClientsState()
  writeClientsState({
    ...state,
    clients: [
      {
        id: client.id,
        name: client.name,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        document: client.document ?? undefined,
        notes: client.notes ?? undefined,
        status: client.status === "archived" || client.status === "lead" ? "active" : client.status,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
      ...(state.clients ?? []),
    ],
  })

  return { source: "local" as const, data: client }
}

export async function updateClient(id: string, payload: Partial<Client>) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Client | null,
    }
  }

  const state = readClientsState()
  let updatedClient: Client | null = null
  const clients = (state.clients ?? []).map((client) => {
    if (client.id !== id) return client
    const nextClient = {
      ...client,
      ...payload,
      updatedAt: new Date().toISOString(),
    }
    updatedClient = mapLegacyClientToClient(nextClient, payload.agencyId ?? "agency-frontend")
    return nextClient
  })

  writeClientsState({ ...state, clients })
  return { source: "local" as const, data: updatedClient }
}

export async function deleteClient(id: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: true,
    }
  }

  const state = readClientsState()
  writeClientsState({
    ...state,
    clients: (state.clients ?? []).filter((client) => client.id !== id),
  })
  return { source: "local" as const, success: true }
}

export async function listClientsWithTrips(agencyId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as ClientWithTrips[],
    }
  }

  const state = readClientsState()
  const trips = (state.trips ?? []).map((trip) => mapAgencyTripToTrip(trip))
  const clients = getClients(agencyId).map((client) => ({
    ...client,
    trips: trips.filter((trip) => trip.clientId === client.id),
  }))

  return { source: "local" as const, data: clients }
}
