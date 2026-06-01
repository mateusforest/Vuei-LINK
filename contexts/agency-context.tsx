"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import type { Client as CanonicalClient, CreditBalance, CreditTransaction, Trip as CanonicalTrip, TripStatus } from "@/types"
import {
  AGENCY_STORAGE_SCHEMA_VERSION,
  extractAgencyStorageState,
  mapLegacyClientToClient,
  type AgencyStorageState,
} from "@/lib/mappers/agency-mappers"
import {
  buildUniqueTripSlug,
  mapAgencyTripToTrip,
  slugifyTripBase,
  type LegacyAgencyTrip,
} from "@/lib/mappers/trip-mappers"
import { mapCreditHistoryToTransactions, mapLegacyCreditsToCreditBalance } from "@/lib/mappers/credit-mappers"
import { buildAdminTripUrl, buildPublicTripUrl } from "@/lib/security/link-tokens"

export interface Client extends Pick<CanonicalClient, "id" | "name"> {
  id: string
  name: string
  email: string
  phone: string
  document?: string
  notes?: string
  status: "active" | "inactive"
  createdAt: string
  updatedAt?: string
}

export interface AgencyTrip extends Pick<CanonicalTrip, "id" | "slug" | "destination" | "country" | "city" | "startDate" | "endDate" | "coverImage" | "createdAt"> {
  id: string
  slug: string
  clientId: string
  clientName: string
  name: string
  destination: string
  country: string
  city: string
  startDate: string
  endDate: string
  style: string
  passengersCount: number
  status: Extract<TripStatus, "upcoming" | "ongoing" | "completed">
  coverImage: string
  adminLink: string
  shareLink: string
  createdAt: string
  itinerary?: ItineraryItem[]
  documents?: AgencyDocument[]
}

export interface AgencyDocument {
  id: string
  tripId?: string
  clientId?: string
  name: string
  type: "voucher" | "ticket" | "passport" | "visa" | "insurance" | "itinerary" | "other"
  isPrivate: boolean
  fileUrl?: string
  createdAt: string
}

export interface ItineraryItem {
  id: string
  day: number
  title: string
  time: string
  type: "attraction" | "food" | "transport" | "hotel" | "experience" | "flight"
  highlight?: boolean
}

export interface ConciergeRequest {
  id: string
  tripId: string
  clientId: string
  clientName: string
  destination: string
  question: string
  response?: string
  status: "pending" | "answered" | "resolved"
  createdAt: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: "admin" | "agent" | "viewer"
  status: "active" | "pending" | "inactive"
  avatar?: string
  createdAt: string
}

export interface Activity {
  id: string
  action: string
  description: string
  type: "trip" | "client" | "document" | "itinerary" | "concierge" | "credits" | "team"
  timestamp: string
}

interface AgencyCredits {
  balance: number
  plan: "starter" | "professional" | "enterprise"
  history: { action: string; amount: number; date: string; source: string }[]
  canonicalBalance?: CreditBalance
  canonicalTransactions?: CreditTransaction[]
}

interface AgencyContextType {
  clients: Client[]
  addClient: (data: Omit<Client, "id" | "createdAt">) => Client
  updateClient: (id: string, data: Partial<Client>) => void
  deleteClient: (id: string) => void
  getClientById: (id: string) => Client | undefined
  trips: AgencyTrip[]
  addTrip: (data: Omit<AgencyTrip, "id" | "slug" | "adminLink" | "shareLink" | "createdAt" | "coverImage">) => AgencyTrip
  updateTrip: (id: string, data: Partial<AgencyTrip>) => void
  deleteTrip: (id: string) => void
  getTripById: (id: string) => AgencyTrip | undefined
  getTripsByClient: (clientId: string) => AgencyTrip[]
  documents: AgencyDocument[]
  addDocument: (data: Omit<AgencyDocument, "id" | "createdAt">) => AgencyDocument
  deleteDocument: (id: string) => void
  getDocumentsByTrip: (tripId: string) => AgencyDocument[]
  getDocumentsByClient: (clientId: string) => AgencyDocument[]
  conciergeRequests: ConciergeRequest[]
  addConciergeRequest: (data: Omit<ConciergeRequest, "id" | "createdAt">) => void
  respondToRequest: (id: string, response: string) => void
  resolveRequest: (id: string) => void
  teamMembers: TeamMember[]
  addTeamMember: (data: Omit<TeamMember, "id" | "createdAt">) => void
  updateTeamMember: (id: string, data: Partial<TeamMember>) => void
  removeTeamMember: (id: string) => void
  credits: AgencyCredits
  useCredits: (amount: number, source: string, action: string) => boolean
  addCredits: (amount: number) => void
  activities: Activity[]
  addActivity: (action: string, description: string, type: Activity["type"]) => void
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined)

const destinationImages: Record<string, string> = {
  paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  france: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  franca: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
  lisboa: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  lisbon: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  portugal: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=80",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  japan: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  japao: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
  "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  "nova york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=80",
  london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  londres: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80",
  rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  roma: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  italy: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  italia: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=80",
  barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  spain: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  espanha: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&q=80",
  dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "rio de janeiro": "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  rio: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  brasil: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=800&q=80",
  amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&q=80",
  berlin: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  berlim: "https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80",
  miami: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=800&q=80",
  cancun: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800&q=80",
  maldives: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
  maldivas: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80",
}

function getImageForDestination(destination: string): string {
  const searchTerm = destination.toLowerCase()
  for (const [key, url] of Object.entries(destinationImages)) {
    if (searchTerm.includes(key)) {
      return url
    }
  }
  return destinationImages.default
}

function normalizeTripLinks(trips: AgencyTrip[]): AgencyTrip[] {
  const usedSlugs: string[] = []

  return trips.map((trip) => {
    const baseSlug = slugifyTripBase(trip.name, trip.destination)
    const slug = buildUniqueTripSlug(baseSlug, usedSlugs)
    usedSlugs.push(slug)

    return {
      ...trip,
      slug,
      adminLink: buildAdminTripUrl(slug),
      shareLink: buildPublicTripUrl(slug),
    }
  })
}

function parseDestination(destination: string): { city: string; country: string } {
  const parts = destination.split(",").map((part) => part.trim())
  if (parts.length >= 2) {
    return { city: parts[0], country: parts[parts.length - 1] }
  }
  return { city: destination, country: "" }
}

function mapCanonicalTripToAgencyTrip(trip: CanonicalTrip, clientName = ""): AgencyTrip {
  return {
    id: trip.id,
    slug: trip.slug,
    clientId: trip.clientId || "",
    clientName,
    name: trip.title,
    destination: trip.destination,
    country: trip.country || "",
    city: trip.city || trip.destination,
    startDate: trip.startDate || "",
    endDate: trip.endDate || "",
    style: trip.style || "",
    passengersCount: trip.travelersCount,
    status: trip.status === "ongoing" || trip.status === "completed" ? trip.status : "upcoming",
    coverImage: trip.coverImage || getImageForDestination(trip.destination),
    adminLink: trip.adminLink,
    shareLink: trip.publicLink,
    createdAt: trip.createdAt,
    itinerary: [],
    documents: [],
  }
}

function buildCanonicalCredits(balance: number, history: AgencyCredits["history"]) {
  return {
    canonicalBalance: mapLegacyCreditsToCreditBalance({ balance, history }, "agency", "local-agency"),
    canonicalTransactions: mapCreditHistoryToTransactions(history, "agency", "local-agency"),
  }
}

const AGENCY_STORAGE_KEY = "vuei_agency"
type PersistedAgencyState = AgencyStorageState<AgencyTrip, AgencyDocument, ConciergeRequest, TeamMember, Activity, AgencyCredits>

const initialClients: Client[] = [
  { id: "client-1", name: "Maria Silva", email: "maria@email.com", phone: "(11) 99999-1234", status: "active", createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "client-2", name: "Joao Santos", email: "joao@email.com", phone: "(21) 98888-5678", status: "active", createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "client-3", name: "Ana Costa", email: "ana@email.com", phone: "(31) 97777-9012", status: "active", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
]

const initialTrips: AgencyTrip[] = [
  {
    id: "agency-trip-1",
    slug: "lua-de-mel-em-paris",
    clientId: "client-1",
    clientName: "Maria Silva",
    name: "Lua de Mel em Paris",
    destination: "Paris, Franca",
    country: "Franca",
    city: "Paris",
    startDate: "2024-07-15",
    endDate: "2024-07-25",
    style: "lua-de-mel",
    passengersCount: 2,
    status: "upcoming",
    coverImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
    adminLink: buildAdminTripUrl("lua-de-mel-em-paris"),
    shareLink: buildPublicTripUrl("lua-de-mel-em-paris"),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "agency-trip-2",
    slug: "ferias-em-tokyo",
    clientId: "client-2",
    clientName: "Joao Santos",
    name: "Ferias em Tokyo",
    destination: "Tokyo, Japao",
    country: "Japao",
    city: "Tokyo",
    startDate: "2024-08-10",
    endDate: "2024-08-20",
    style: "familia",
    passengersCount: 4,
    status: "upcoming",
    coverImage: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
    adminLink: buildAdminTripUrl("ferias-em-tokyo"),
    shareLink: buildPublicTripUrl("ferias-em-tokyo"),
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

const initialConciergeRequests: ConciergeRequest[] = [
  {
    id: "req-1",
    tripId: "agency-trip-1",
    clientId: "client-1",
    clientName: "Maria Silva",
    destination: "Paris, Franca",
    question: "Qual o melhor restaurante romantico perto da Torre Eiffel?",
    status: "pending",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "req-2",
    tripId: "agency-trip-2",
    clientId: "client-2",
    clientName: "Joao Santos",
    destination: "Tokyo, Japao",
    question: "Preciso de recomendacao de passeio para criancas em Shibuya",
    response: "Recomendo o Shibuya Sky para uma vista incrivel da cidade! As criancas vao adorar o mirante interativo.",
    status: "answered",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
]

const initialTeamMembers: TeamMember[] = [
  { id: "team-1", name: "Admin Principal", email: "admin@agencia.com", role: "admin", status: "active", createdAt: new Date().toISOString() },
  { id: "team-2", name: "Agente 1", email: "agente1@agencia.com", role: "agent", status: "active", createdAt: new Date().toISOString() },
]

const initialActivities: Activity[] = [
  { id: "act-1", action: "Viagem criada", description: "Lua de Mel em Paris para Maria Silva", type: "trip", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "act-2", action: "Viagem criada", description: "Ferias em Tokyo para Joao Santos", type: "trip", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "act-3", action: "Solicitacao recebida", description: "Maria Silva perguntou sobre restaurantes", type: "concierge", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
]

export function AgencyProvider({ children }: { children: ReactNode }) {
  // O contexto segue como fonte local principal nesta etapa.
  // Repositories canônicos foram adicionados para a migracao futura sem quebrar as telas atuais.
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [trips, setTrips] = useState<AgencyTrip[]>(initialTrips)
  const [documents, setDocuments] = useState<AgencyDocument[]>([])
  const [conciergeRequests, setConciergeRequests] = useState<ConciergeRequest[]>(initialConciergeRequests)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers)
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [credits, setCredits] = useState<AgencyCredits>(() => {
    const history = [{ action: "Plano Professional", amount: 500, date: new Date().toISOString(), source: "Sistema" }]
    return {
      balance: 500,
      plan: "professional",
      history,
      ...buildCanonicalCredits(500, history),
    }
  })
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const stored = extractAgencyStorageState<AgencyTrip, AgencyDocument, ConciergeRequest, TeamMember, Activity, AgencyCredits>(
      window.localStorage.getItem(AGENCY_STORAGE_KEY)
    )

    if (stored.clients.length > 0) {
      setClients(stored.clients.map((client) => {
        const mapped = mapLegacyClientToClient(client)
        return {
          id: mapped.id,
          name: mapped.name,
          email: mapped.email || "",
          phone: mapped.phone || "",
          document: mapped.document || undefined,
          notes: mapped.notes || undefined,
          status: mapped.status === "inactive" ? "inactive" : "active",
          createdAt: mapped.createdAt,
          updatedAt: mapped.updatedAt,
        }
      }))
    }

    if (stored.trips.length > 0) {
      setTrips(normalizeTripLinks(stored.trips.map((trip) => {
        const canonicalTrip = mapAgencyTripToTrip(trip as LegacyAgencyTrip)
        return mapCanonicalTripToAgencyTrip(canonicalTrip, (trip as AgencyTrip).clientName || "")
      })))
    }

    if (stored.documents.length > 0) setDocuments(stored.documents)
    if (stored.conciergeRequests.length > 0) setConciergeRequests(stored.conciergeRequests)
    if (stored.teamMembers.length > 0) setTeamMembers(stored.teamMembers)
    if (stored.activities.length > 0) setActivities(stored.activities)

    if (stored.credits) {
      setCredits({
        ...stored.credits,
        ...buildCanonicalCredits(stored.credits.balance, stored.credits.history),
      })
    }

    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return

    const payload: PersistedAgencyState = {
      schemaVersion: AGENCY_STORAGE_SCHEMA_VERSION,
      clients,
      trips,
      documents,
      conciergeRequests,
      teamMembers,
      activities,
      credits,
    }
    window.localStorage.setItem(AGENCY_STORAGE_KEY, JSON.stringify(payload))
  }, [clients, trips, documents, conciergeRequests, teamMembers, activities, credits, isLoaded])

  const addActivity = useCallback((action: string, description: string, type: Activity["type"]) => {
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      action,
      description,
      type,
      timestamp: new Date().toISOString(),
    }
    setActivities((prev) => [newActivity, ...prev.slice(0, 49)])
  }, [])

  const addClient = useCallback((data: Omit<Client, "id" | "createdAt">) => {
    const newClient: Client = {
      ...data,
      id: `client-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setClients((prev) => [newClient, ...prev])
    addActivity("Cliente cadastrado", newClient.name, "client")
    return newClient
  }, [addActivity])

  const updateClient = useCallback((id: string, data: Partial<Client>) => {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, ...data } : client)))
  }, [])

  const deleteClient = useCallback((id: string) => {
    const client = clients.find((item) => item.id === id)
    setClients((prev) => prev.filter((item) => item.id !== id))
    if (client) addActivity("Cliente removido", client.name, "client")
  }, [clients, addActivity])

  const getClientById = useCallback((id: string) => clients.find((client) => client.id === id), [clients])

  const addTrip = useCallback((data: Omit<AgencyTrip, "id" | "slug" | "adminLink" | "shareLink" | "createdAt" | "coverImage">) => {
    const { city, country } = parseDestination(data.destination)
    const baseSlug = slugifyTripBase(data.name, data.destination)
    const slug = buildUniqueTripSlug(baseSlug, trips.map((trip) => trip.slug))
    const id = `agency-trip-${Date.now()}`

    const newTrip: AgencyTrip = {
      ...data,
      id,
      slug,
      city,
      country,
      coverImage: getImageForDestination(data.destination),
      adminLink: buildAdminTripUrl(slug),
      shareLink: buildPublicTripUrl(slug),
      createdAt: new Date().toISOString(),
    }

    setTrips((prev) => [newTrip, ...prev])
    addActivity("Viagem criada", `${data.name} para ${data.clientName}`, "trip")
    return newTrip
  }, [addActivity, trips])

  const updateTrip = useCallback((id: string, data: Partial<AgencyTrip>) => {
    setTrips((prev) => prev.map((trip) => (trip.id === id ? { ...trip, ...data } : trip)))
  }, [])

  const deleteTrip = useCallback((id: string) => {
    const trip = trips.find((item) => item.id === id)
    setTrips((prev) => prev.filter((item) => item.id !== id))
    if (trip) addActivity("Viagem removida", trip.name, "trip")
  }, [trips, addActivity])

  const getTripById = useCallback((id: string) => trips.find((trip) => trip.id === id), [trips])

  const getTripsByClient = useCallback((clientId: string) => trips.filter((trip) => trip.clientId === clientId), [trips])

  const addDocument = useCallback((data: Omit<AgencyDocument, "id" | "createdAt">) => {
    const newDocument: AgencyDocument = {
      ...data,
      id: `doc-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setDocuments((prev) => [newDocument, ...prev])
    addActivity("Documento enviado", data.name, "document")
    return newDocument
  }, [addActivity])

  const deleteDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((document) => document.id !== id))
  }, [])

  const getDocumentsByTrip = useCallback((tripId: string) => documents.filter((document) => document.tripId === tripId), [documents])

  const getDocumentsByClient = useCallback((clientId: string) => documents.filter((document) => document.clientId === clientId), [documents])

  const addConciergeRequest = useCallback((data: Omit<ConciergeRequest, "id" | "createdAt">) => {
    const newRequest: ConciergeRequest = {
      ...data,
      id: `req-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setConciergeRequests((prev) => [newRequest, ...prev])
    addActivity("Solicitacao recebida", `${data.clientName}: ${data.question.slice(0, 50)}...`, "concierge")
  }, [addActivity])

  const respondToRequest = useCallback((id: string, response: string) => {
    setConciergeRequests((prev) =>
      prev.map((request) => (request.id === id ? { ...request, response, status: "answered" as const } : request))
    )
    addActivity("Solicitacao respondida", `${response.slice(0, 50)}...`, "concierge")
  }, [addActivity])

  const resolveRequest = useCallback((id: string) => {
    setConciergeRequests((prev) =>
      prev.map((request) => (request.id === id ? { ...request, status: "resolved" as const } : request))
    )
  }, [])

  const addTeamMember = useCallback((data: Omit<TeamMember, "id" | "createdAt">) => {
    const newMember: TeamMember = {
      ...data,
      id: `team-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setTeamMembers((prev) => [...prev, newMember])
    addActivity("Membro convidado", data.name, "team")
  }, [addActivity])

  const updateTeamMember = useCallback((id: string, data: Partial<TeamMember>) => {
    setTeamMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...data } : member)))
  }, [])

  const removeTeamMember = useCallback((id: string) => {
    const member = teamMembers.find((item) => item.id === id)
    setTeamMembers((prev) => prev.filter((item) => item.id !== id))
    if (member) addActivity("Membro removido", member.name, "team")
  }, [teamMembers, addActivity])

  const useCredits = useCallback((amount: number, source: string, action: string) => {
    if (credits.balance < amount) return false

    setCredits((prev) => {
      const history = [{ action, amount: -amount, date: new Date().toISOString(), source }, ...prev.history]
      const balance = prev.balance - amount

      return {
        ...prev,
        balance,
        history,
        ...buildCanonicalCredits(balance, history),
      }
    })
    addActivity("Creditos utilizados", `${amount} creditos - ${action}`, "credits")
    return true
  }, [credits.balance, addActivity])

  const addCredits = useCallback((amount: number) => {
    setCredits((prev) => {
      const history = [{ action: "Compra de creditos", amount, date: new Date().toISOString(), source: "Compra" }, ...prev.history]
      const balance = prev.balance + amount

      return {
        ...prev,
        balance,
        history,
        ...buildCanonicalCredits(balance, history),
      }
    })
    addActivity("Creditos adquiridos", `${amount} creditos`, "credits")
  }, [addActivity])

  return (
    <AgencyContext.Provider
      value={{
        clients,
        addClient,
        updateClient,
        deleteClient,
        getClientById,
        trips,
        addTrip,
        updateTrip,
        deleteTrip,
        getTripById,
        getTripsByClient,
        documents,
        addDocument,
        deleteDocument,
        getDocumentsByTrip,
        getDocumentsByClient,
        conciergeRequests,
        addConciergeRequest,
        respondToRequest,
        resolveRequest,
        teamMembers,
        addTeamMember,
        updateTeamMember,
        removeTeamMember,
        credits,
        useCredits,
        addCredits,
        activities,
        addActivity,
      }}
    >
      {children}
    </AgencyContext.Provider>
  )
}

export function useAgency() {
  const context = useContext(AgencyContext)
  if (context === undefined) {
    throw new Error("useAgency must be used within an AgencyProvider")
  }
  return context
}
