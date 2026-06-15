import type { Client, Trip } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { readLegacyAgencyData } from "@/lib/local-storage-migration"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"
import { mapLegacyClientToClient, type LegacyAgencyClient, type LegacyAgencyTrip } from "@/lib/mappers/agency-mappers"
import { mapAgencyTripToTrip } from "@/lib/mappers/trip-mappers"
import { listTripsByAgency } from "@/lib/repositories/trips-repository"

const ACTIVE_CLIENT_TRIP_STATUSES = ["draft", "upcoming", "ongoing"] as const

function isClientActiveStatus(status: Client["status"] | Database["public"]["Tables"]["clients"]["Row"]["status"] | null | undefined) {
  return status == null || status === "active"
}

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
  return (readClientsState().clients ?? [])
    .map((client) => mapLegacyClientToClient(client, agencyId))
    .filter((client) => isClientActiveStatus(client.status))
}

function mapClientRowToClient(row: Database["public"]["Tables"]["clients"]["Row"]): Client {
  return {
    id: row.id,
    agencyId: row.agency_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    document: row.document,
    notes: row.notes,
    status: row.status,
    creditsBalance: row.credits_balance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listClients(agencyId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("clients")
        .select("*")
        .eq("agency_id", agencyId)
        .or("status.is.null,status.eq.active")
        .order("created_at", { ascending: false })
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: [] as Client[],
          error: error.message,
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: (data ?? []).map(mapClientRowToClient),
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Client[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return { source: "local" as const, data: getClients(agencyId), error: null }
}

export async function listAllClients() {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("clients")
        .select("*")
        .or("status.is.null,status.eq.active")
        .order("created_at", { ascending: false })
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: [] as Client[],
          error: error.message,
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: (data ?? []).map(mapClientRowToClient),
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Client[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return { source: "local" as const, data: getClients(null), error: null }
}

export async function getClientById(id: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("clients").select("*").eq("id", id).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null as Client | null, error: error.message }
      }

      return { source: "supabase" as const, data: data ? mapClientRowToClient(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Client | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readClientsState()
  const localClient = (state.clients ?? []).find((item) => item.id === id) ?? null
  return {
    source: "local" as const,
    data: localClient ? mapLegacyClientToClient(localClient, "agency-frontend") : null,
    error: null,
  }
}

export async function createClient(payload: Omit<Client, "id" | "createdAt" | "updatedAt"> & { agencyId: string | null }) {
  if (shouldUseSupabase()) {
    if (!payload.agencyId) {
      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: null as Client | null,
        error: "agency_id obrigatorio para criar cliente da agencia.",
      }
    }

    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["clients"]["Insert"] = {
        agency_id: payload.agencyId,
        name: payload.name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        document: payload.document ?? null,
        notes: payload.notes ?? null,
        status: payload.status,
      }

      const { data, error } = await client.from("clients").insert(insertPayload).select("*").single()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: null as Client | null,
          error: error.message,
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: mapClientRowToClient(data),
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Client | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const createdAt = new Date().toISOString()
  const createdClient: Client = {
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

  const state = readClientsState()
  writeClientsState({
    ...state,
    clients: [
      {
        id: createdClient.id,
        name: createdClient.name,
        email: createdClient.email ?? undefined,
        phone: createdClient.phone ?? undefined,
        document: createdClient.document ?? undefined,
        notes: createdClient.notes ?? undefined,
        status: createdClient.status === "archived" || createdClient.status === "lead" ? "active" : createdClient.status,
        createdAt: createdClient.createdAt,
        updatedAt: createdClient.updatedAt,
      },
      ...(state.clients ?? []),
    ],
  })

  return { source: "local" as const, data: createdClient, error: null }
}

export async function updateClient(id: string, payload: Partial<Client>) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const updatePayload: Database["public"]["Tables"]["clients"]["Update"] = {
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        document: payload.document,
        notes: payload.notes,
        status: payload.status,
      }

      const { data, error } = await client.from("clients").update(updatePayload).eq("id", id).select("*").maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: null as Client | null,
          error: error.message,
        }
      }

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: data ? mapClientRowToClient(data) : null,
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Client | null,
      error: "Supabase browser client indisponivel.",
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
  return { source: "local" as const, data: updatedClient, error: null }
}

export async function deleteClient(id: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data: activeLinkedTrips, error: activeLinkedTripsError } = await client
        .from("trips")
        .select("id, title, status")
        .eq("client_id", id)
        .in("status", [...ACTIVE_CLIENT_TRIP_STATUSES])
        .limit(5)

      if (activeLinkedTripsError) {
        console.error("[AUTH ERROR]", activeLinkedTripsError.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          success: false,
          error: activeLinkedTripsError.message,
        }
      }

      if ((activeLinkedTrips ?? []).length > 0) {
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          success: false,
          error: "Este cliente possui viagens vinculadas e nao pode ser excluido agora.",
        }
      }

      const { data: historicalTrip, error: historicalTripError } = await client
        .from("trips")
        .select("id")
        .eq("client_id", id)
        .limit(1)
        .maybeSingle()

      if (historicalTripError) {
        console.error("[AUTH ERROR]", historicalTripError.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          success: false,
          error: historicalTripError.message,
        }
      }

      if (historicalTrip?.id) {
        const { error: archiveError } = await client
          .from("clients")
          .update({
            status: "archived",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)

        if (archiveError) {
          console.error("[AUTH ERROR]", archiveError.message)
          return {
            source: "supabase" as const,
            config: createSupabaseBrowserClientPlaceholder(),
            success: false,
            error: archiveError.message,
          }
        }

        return { source: "supabase" as const, config: createSupabaseBrowserClientPlaceholder(), success: true, error: null }
      }

      const { error } = await client.from("clients").delete().eq("id", id)
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          success: false,
          error: error.message,
        }
      }

      return { source: "supabase" as const, config: createSupabaseBrowserClientPlaceholder(), success: true, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: false,
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readClientsState()
  writeClientsState({
    ...state,
    clients: (state.clients ?? []).filter((client) => client.id !== id),
  })
  return { source: "local" as const, success: true, error: null }
}

export async function listClientsWithTrips(agencyId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const [{ data: clientsData, error: clientsError }, agencyTripsResult] = await Promise.all([
        client
          .from("clients")
          .select("*")
          .eq("agency_id", agencyId)
          .or("status.is.null,status.eq.active")
          .order("created_at", { ascending: false }),
        listTripsByAgency(agencyId),
      ])

      if (clientsError || agencyTripsResult.error) {
        const errorMessage = clientsError?.message || agencyTripsResult.error || "Falha ao listar clientes da agencia."
        console.error("[AUTH ERROR]", errorMessage)
        return {
          source: "supabase" as const,
          config: createSupabaseBrowserClientPlaceholder(),
          data: [] as ClientWithTrips[],
          error: errorMessage,
        }
      }

      const trips = agencyTripsResult.data ?? []
      const clients = (clientsData ?? []).map((clientRow) => {
        const normalizedClient = mapClientRowToClient(clientRow)
        return {
          ...normalizedClient,
          trips: trips.filter((trip) => trip.clientId === normalizedClient.id),
        }
      })

      return {
        source: "supabase" as const,
        config: createSupabaseBrowserClientPlaceholder(),
        data: clients,
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as ClientWithTrips[],
      error: "Supabase browser client indisponivel.",
    }
  }

  const state = readClientsState()
  const trips = (state.trips ?? []).map((trip) => mapAgencyTripToTrip(trip))
  const clients = getClients(agencyId).map((client) => ({
    ...client,
    trips: trips.filter((trip) => trip.clientId === client.id),
  }))

  return { source: "local" as const, data: clients, error: null }
}
