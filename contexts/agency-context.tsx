"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
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
import { useAuth } from "@/contexts/auth-context"
import { shouldUseSupabase } from "@/lib/data-source"
import { createClient as createClientRecord, deleteClient as deleteClientRecord, listClients, updateClient as updateClientRecord } from "@/lib/repositories/clients-repository"
import { addAgencyMember as addAgencyMemberRecord, getAgencyById, getAgencyByOwner, listAgencyMembers, updateAgencyMember as updateAgencyMemberRecord } from "@/lib/repositories/agencies-repository"
import {
  createDocumentMetadata,
  deleteDocument as deleteDocumentRecord,
  listDocuments,
  uploadDocumentFile,
} from "@/lib/repositories/documents-repository"
import { createTrip as createTripRecord, deleteTrip as deleteTripRecord, listTripsByAgency, updateTrip as updateTripRecord } from "@/lib/repositories/trips-repository"
import { getProfileByEmail } from "@/lib/repositories/profiles-repository"
import { updateProfile as updateProfileRecord } from "@/lib/repositories/profiles-repository"
import {
  addMessage as addAiMessage,
  listConversations,
  listMessagesByConversationIds,
  updateConversationStatus,
} from "@/lib/repositories/ai-repository"
import type { Agency } from "@/types"

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
  agencyId?: string
  ownerUserId?: string
  name: string
  type: "voucher" | "ticket" | "passport" | "visa" | "insurance" | "itinerary" | "other"
  isPrivate: boolean
  fileUrl?: string
  filePath?: string
  mimeType?: string
  size?: number | null
  visibility?: "private" | "public_trip" | "agency_only"
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
  conversationId?: string
  tripId: string
  clientId: string
  clientName: string
  tripName?: string
  destination: string
  question: string
  response?: string
  status: "pending" | "answered" | "resolved"
  createdAt: string
  lastInteractionAt?: string
  messages?: Array<{
    id: string
    role: "user" | "assistant" | "agent" | "system"
    content: string
    createdAt: string
  }>
}

export interface TeamMember {
  id: string
  profileId?: string
  name: string
  email: string
  role: "owner" | "admin" | "agent" | "viewer"
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
  addClient: (data: Omit<Client, "id" | "createdAt">) => Promise<Client | null>
  updateClient: (id: string, data: Partial<Client>) => Promise<Client | null>
  deleteClient: (id: string) => Promise<boolean>
  getClientById: (id: string) => Client | undefined
  trips: AgencyTrip[]
  addTrip: (data: Omit<AgencyTrip, "id" | "slug" | "adminLink" | "shareLink" | "createdAt" | "coverImage">) => Promise<AgencyTrip | null>
  updateTrip: (id: string, data: Partial<AgencyTrip>) => Promise<AgencyTrip | null>
  deleteTrip: (id: string) => Promise<boolean>
  getTripById: (id: string) => AgencyTrip | undefined
  getTripsByClient: (clientId: string) => AgencyTrip[]
  documents: AgencyDocument[]
  addDocument: (data: Omit<AgencyDocument, "id" | "createdAt"> & { file?: File | null }) => Promise<AgencyDocument | null>
  deleteDocument: (id: string) => Promise<boolean>
  getDocumentsByTrip: (tripId: string) => AgencyDocument[]
  getDocumentsByClient: (clientId: string) => AgencyDocument[]
  conciergeRequests: ConciergeRequest[]
  addConciergeRequest: (data: Omit<ConciergeRequest, "id" | "createdAt">) => void
  respondToRequest: (id: string, response: string) => Promise<boolean>
  resolveRequest: (id: string) => Promise<boolean>
  teamMembers: TeamMember[]
  addTeamMember: (data: Omit<TeamMember, "id" | "createdAt">) => Promise<{ success: boolean; error: string | null }>
  updateTeamMember: (id: string, data: Partial<TeamMember>) => Promise<{ success: boolean; error: string | null }>
  removeTeamMember: (id: string) => Promise<{ success: boolean; error: string | null }>
  credits: AgencyCredits
  useCredits: (amount: number, source: string, action: string) => boolean
  addCredits: (amount: number) => void
  activities: Activity[]
  addActivity: (action: string, description: string, type: Activity["type"]) => void
  agencyId: string | null
  agency: Agency | null
  isUsingRealData: boolean
  setupIncomplete: boolean
  workspaceError: string | null
  refreshAgencyWorkspace: () => Promise<void>
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

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

function mapDocumentRecordToAgencyDocument(document: {
  id: string
  tripId: string | null
  clientId: string | null
  agencyId: string | null
  ownerUserId: string | null
  name: string
  type: string
  isPrivate: boolean
  fileUrl: string | null
  filePath: string | null
  mimeType: string | null
  size: number | null
  visibility: "private" | "public_trip" | "agency_only"
  createdAt: string
}): AgencyDocument {
  return {
    id: document.id,
    tripId: document.tripId ?? undefined,
    clientId: document.clientId ?? undefined,
    agencyId: document.agencyId ?? undefined,
    ownerUserId: document.ownerUserId ?? undefined,
    name: document.name,
    type:
      document.type === "voucher" ||
      document.type === "ticket" ||
      document.type === "passport" ||
      document.type === "visa" ||
      document.type === "insurance" ||
      document.type === "itinerary"
        ? document.type
        : "other",
    isPrivate: document.isPrivate,
    fileUrl: document.fileUrl ?? undefined,
    filePath: document.filePath ?? undefined,
    mimeType: document.mimeType ?? undefined,
    size: document.size ?? null,
    visibility: document.visibility,
    createdAt: document.createdAt,
  }
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
  { id: "team-1", name: "Admin Principal", email: "admin@agencia.com", role: "owner", status: "active", createdAt: new Date().toISOString() },
  { id: "team-2", name: "Agente 1", email: "agente1@agencia.com", role: "agent", status: "active", createdAt: new Date().toISOString() },
]

const initialActivities: Activity[] = [
  { id: "act-1", action: "Viagem criada", description: "Lua de Mel em Paris para Maria Silva", type: "trip", timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "act-2", action: "Viagem criada", description: "Ferias em Tokyo para Joao Santos", type: "trip", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { id: "act-3", action: "Solicitacao recebida", description: "Maria Silva perguntou sobre restaurantes", type: "concierge", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
]

export function AgencyProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const isUsingRealData = shouldUseSupabase()
  const [agency, setAgency] = useState<Agency | null>(null)
  const [agencyId, setAgencyId] = useState<string | null>(null)
  const [setupIncomplete, setSetupIncomplete] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>(isUsingRealData ? [] : initialClients)
  const [trips, setTrips] = useState<AgencyTrip[]>(isUsingRealData ? [] : initialTrips)
  const [documents, setDocuments] = useState<AgencyDocument[]>([])
  const [conciergeRequests, setConciergeRequests] = useState<ConciergeRequest[]>(isUsingRealData ? [] : initialConciergeRequests)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(isUsingRealData ? [] : initialTeamMembers)
  const [activities, setActivities] = useState<Activity[]>(isUsingRealData ? [] : initialActivities)
  const [credits, setCredits] = useState<AgencyCredits>(() => {
    if (isUsingRealData) {
      return {
        balance: 0,
        plan: "starter",
        history: [],
        ...buildCanonicalCredits(0, []),
      }
    }
    const history = [{ action: "Plano Professional", amount: 500, date: new Date().toISOString(), source: "Sistema" }]
    return {
      balance: 500,
      plan: "professional",
      history,
      ...buildCanonicalCredits(500, history),
    }
  })
  const [isLoaded, setIsLoaded] = useState(false)
  const clientNameById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isUsingRealData) {
      setIsLoaded(true)
      return
    }

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
  }, [isUsingRealData])

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined" || isUsingRealData) return

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
  }, [clients, trips, documents, conciergeRequests, teamMembers, activities, credits, isLoaded, isUsingRealData])

  const refreshAgencyWorkspace = useCallback(async () => {
    if (!isUsingRealData) return
    if (!user?.id) {
      setAgency(null)
      setAgencyId(null)
      setSetupIncomplete(false)
      setWorkspaceError(null)
      setClients([])
      setTrips([])
      setDocuments([])
      setConciergeRequests([])
      setTeamMembers([])
      setActivities([])
      setCredits({
        balance: 0,
        plan: "starter",
        history: [],
        ...buildCanonicalCredits(0, []),
      })
      setIsLoaded(true)
      return
    }

    const agencyResult = profile?.agencyId ? await getAgencyById(profile.agencyId) : await getAgencyByOwner(user.id)
    const resolvedAgency = agencyResult.data

    if (!resolvedAgency) {
      setAgency(null)
      setAgencyId(null)
      setSetupIncomplete(profile?.role === "agency_owner")
      setWorkspaceError(
        profile?.role === "agency_owner"
          ? "Sua conta de agencia foi criada, mas a agencia ainda nao foi persistida corretamente no Supabase."
          : agencyResult.error ?? null
      )
      setClients([])
      setTrips([])
      setDocuments([])
      setConciergeRequests([])
      setTeamMembers([])
      setActivities([])
      setCredits({
        balance: 0,
        plan: "starter",
        history: [],
        ...buildCanonicalCredits(0, []),
      })
      setIsLoaded(true)
      return
    }

    if (profile?.agencyId !== resolvedAgency.id && profile?.id) {
      const profileUpdate = await updateProfileRecord(profile.id, {
        agencyId: resolvedAgency.id,
        role: profile.role === "agency_member" ? "agency_member" : "agency_owner",
      })

      if (!profileUpdate.data && profileUpdate.error) {
        console.error("[AUTH ERROR]", profileUpdate.error)
      }
    }

    const [clientsResult, tripsResult, documentsResult] = await Promise.all([
      listClients(resolvedAgency.id),
      listTripsByAgency(resolvedAgency.id),
      listDocuments({ agencyId: resolvedAgency.id }),
    ])
    const membersResult = await listAgencyMembers(resolvedAgency.id)

    const mappedClients: Client[] = (clientsResult.data ?? []).map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email ?? "",
      phone: client.phone ?? "",
      document: client.document ?? undefined,
      notes: client.notes ?? undefined,
      status: client.status === "inactive" ? "inactive" : "active",
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }))

    const tripClientNameMap = new Map(mappedClients.map((client) => [client.id, client.name]))
    const canonicalTrips = tripsResult.data ?? []
    const mappedTrips = canonicalTrips.map((trip) =>
      mapCanonicalTripToAgencyTrip(trip, trip.clientId ? tripClientNameMap.get(trip.clientId) ?? "" : "")
    )

    const conversationsResult = await listConversations({
      agencyId: resolvedAgency.id,
      channel: "concierge",
    })
    const conversations = conversationsResult.data ?? []
    const conversationIds = conversations.map((conversation) => conversation.id)
    const messagesResult = await listMessagesByConversationIds(conversationIds)
    const conversationMessages = messagesResult.data ?? []
    const messagesByConversationId = conversationMessages.reduce<Map<string, typeof conversationMessages>>((accumulator, message) => {
      const current = accumulator.get(message.conversationId) ?? []
      current.push(message)
      accumulator.set(message.conversationId, current)
      return accumulator
    }, new Map())
    const tripById = new Map(canonicalTrips.map((trip) => [trip.id, trip]))

    const mappedDocuments: AgencyDocument[] = (documentsResult.data ?? []).map(mapDocumentRecordToAgencyDocument)
    const mappedTeamMembers: TeamMember[] = (membersResult.data ?? []).map((member) => ({
      id: member.id,
      profileId: member.profileId,
      name: member.name || member.email || "Membro sem nome",
      email: member.email || "",
      role:
        member.role === "owner" || member.role === "admin" || member.role === "viewer"
          ? member.role
          : "agent",
      status:
        member.status === "inactive" || member.status === "pending"
          ? member.status
          : "active",
      avatar: member.avatarUrl,
      createdAt: member.createdAt,
    }))

    const mappedConciergeRequests: ConciergeRequest[] = conversations
      .map((conversation) => {
        if (!conversation.tripId) return null

        const trip = tripById.get(conversation.tripId)
        if (!trip) return null

        const messages = (messagesByConversationId.get(conversation.id) ?? []).slice().sort((left, right) => {
          return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
        })
        const userMessage = messages.find((message) => message.role === "user")
        if (!userMessage) return null

        const responseMessage = [...messages]
          .reverse()
          .find((message) => message.role === "assistant" || message.role === "agent")
        const lastMessage = messages[messages.length - 1]
        const clientId = conversation.clientId ?? trip.clientId ?? ""

        return {
          id: conversation.id,
          conversationId: conversation.id,
          tripId: trip.id,
          clientId,
          clientName: clientId ? tripClientNameMap.get(clientId) ?? "Cliente sem nome" : "Cliente sem nome",
          tripName: trip.title,
          destination: trip.destination,
          question: userMessage.content,
          response: responseMessage?.content,
          status:
            conversation.status === "closed" || conversation.status === "archived"
              ? "resolved"
              : responseMessage
                ? "answered"
                : "pending",
          createdAt: conversation.createdAt,
          lastInteractionAt: lastMessage?.createdAt ?? conversation.updatedAt,
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt,
          })),
        } satisfies ConciergeRequest
      })
      .filter((request): request is ConciergeRequest => Boolean(request))
      .sort((left, right) => {
        return new Date(right.lastInteractionAt ?? right.createdAt).getTime() - new Date(left.lastInteractionAt ?? left.createdAt).getTime()
      })

    const history =
      resolvedAgency.creditsBalance > 0
        ? [{ action: "Saldo da agencia", amount: resolvedAgency.creditsBalance, date: new Date().toISOString(), source: "Supabase" }]
        : []

    setAgency(resolvedAgency)
    setAgencyId(resolvedAgency.id)
    setSetupIncomplete(false)
    setWorkspaceError(
      agencyResult.error || clientsResult.error || tripsResult.error || documentsResult.error || membersResult.error || conversationsResult.error || messagesResult.error || null
    )
    setClients(mappedClients)
    setTrips(mappedTrips)
    setDocuments(mappedDocuments)
    setConciergeRequests(mappedConciergeRequests)
    setTeamMembers(mappedTeamMembers)
    setActivities([])
    setCredits({
      balance: resolvedAgency.creditsBalance,
      plan: resolvedAgency.plan === "pro" ? "professional" : resolvedAgency.plan,
      history,
      ...buildCanonicalCredits(resolvedAgency.creditsBalance, history),
    })
    setIsLoaded(true)
  }, [isUsingRealData, profile?.agencyId, profile?.id, profile?.role, user?.id])

  useEffect(() => {
    if (!isUsingRealData) return
    void refreshAgencyWorkspace()
  }, [isUsingRealData, refreshAgencyWorkspace])

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

  const addClient = useCallback(async (data: Omit<Client, "id" | "createdAt">) => {
    if (isUsingRealData) {
      if (!agencyId) {
        const message = "Agencia nao configurada no Supabase. Finalize o cadastro da agencia antes de criar clientes."
        setWorkspaceError(message)
        console.error("[AUTH ERROR]", message)
        return null
      }

      const result = await createClientRecord({
        agencyId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        document: data.document || null,
        notes: data.notes || null,
        status: data.status === "inactive" ? "inactive" : "active",
      })

      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel criar o cliente no Supabase.")
        return null
      }

      const newClient: Client = {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email ?? "",
        phone: result.data.phone ?? "",
        document: result.data.document ?? undefined,
        notes: result.data.notes ?? undefined,
        status: result.data.status === "inactive" ? "inactive" : "active",
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      }

      setWorkspaceError(null)
      setClients((prev) => [newClient, ...prev])
      return newClient
    }

    const newClient: Client = {
      ...data,
      id: `client-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setClients((prev) => [newClient, ...prev])
    addActivity("Cliente cadastrado", newClient.name, "client")
    return newClient
  }, [addActivity, agencyId, isUsingRealData])

  const updateClient = useCallback(async (id: string, data: Partial<Client>) => {
    if (isUsingRealData) {
      const result = await updateClientRecord(id, {
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        document: data.document ?? null,
        notes: data.notes ?? null,
        status: data.status === "inactive" ? "inactive" : data.status,
      })

      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel atualizar o cliente no Supabase.")
        return null
      }

      const updatedClient: Client = {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email ?? "",
        phone: result.data.phone ?? "",
        document: result.data.document ?? undefined,
        notes: result.data.notes ?? undefined,
        status: result.data.status === "inactive" ? "inactive" : "active",
        createdAt: result.data.createdAt,
        updatedAt: result.data.updatedAt,
      }

      setWorkspaceError(null)
      setClients((prev) => prev.map((client) => (client.id === id ? updatedClient : client)))
      return updatedClient
    }

    let updatedClient: Client | null = null
    setClients((prev) =>
      prev.map((client) => {
        if (client.id !== id) return client
        updatedClient = { ...client, ...data }
        return updatedClient
      })
    )
    return updatedClient
  }, [isUsingRealData])

  const deleteClient = useCallback(async (id: string) => {
    if (isUsingRealData) {
      const result = await deleteClientRecord(id)
      if (!result.success) {
        setWorkspaceError(result.error ?? "Nao foi possivel remover o cliente no Supabase.")
        return false
      }
      setWorkspaceError(null)
      setClients((prev) => prev.filter((item) => item.id !== id))
      return true
    }

    const client = clients.find((item) => item.id === id)
    setClients((prev) => prev.filter((item) => item.id !== id))
    if (client) addActivity("Cliente removido", client.name, "client")
    return true
  }, [addActivity, clients, isUsingRealData])

  const getClientById = useCallback((id: string) => clients.find((client) => client.id === id), [clients])

  const addTrip = useCallback(async (data: Omit<AgencyTrip, "id" | "slug" | "adminLink" | "shareLink" | "createdAt" | "coverImage">) => {
    if (isUsingRealData) {
      if (!agencyId) {
        const message = "Agencia nao configurada no Supabase. Finalize o cadastro da agencia antes de criar viagens."
        setWorkspaceError(message)
        console.error("[AUTH ERROR]", message)
        return null
      }

      const result = await createTripRecord({
        title: data.name,
        destination: data.destination,
        country: data.country,
        city: data.city,
        startDate: data.startDate,
        endDate: data.endDate,
        style: data.style,
        travelersCount: data.passengersCount,
        status: data.status,
        ownerType: "agency",
        ownerUserId: user?.id ?? null,
        agencyId,
        clientId: data.clientId || null,
        coverImage: getImageForDestination(data.destination),
        visibility: "public",
      })

      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel criar a viagem no Supabase.")
        return null
      }

      const mappedTrip = mapCanonicalTripToAgencyTrip(
        result.data,
        data.clientName || (data.clientId ? clientNameById.get(data.clientId) ?? "" : "")
      )

      setWorkspaceError(null)
      setTrips((prev) => [mappedTrip, ...prev])
      return mappedTrip
    }

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
  }, [addActivity, agencyId, clientNameById, isUsingRealData, trips, user?.id])

  const updateTrip = useCallback(async (id: string, data: Partial<AgencyTrip>) => {
    if (isUsingRealData) {
      const result = await updateTripRecord(id, {
        title: data.name,
        destination: data.destination,
        country: data.country,
        city: data.city,
        startDate: data.startDate,
        endDate: data.endDate,
        style: data.style,
        travelersCount: data.passengersCount,
        status: data.status,
        coverImage: data.coverImage,
        clientId: data.clientId,
      })

      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel atualizar a viagem no Supabase.")
        return null
      }

      const mappedTrip = mapCanonicalTripToAgencyTrip(
        result.data,
        data.clientName || (result.data.clientId ? clientNameById.get(result.data.clientId) ?? "" : "")
      )

      setWorkspaceError(null)
      setTrips((prev) => prev.map((trip) => (trip.id === id ? mappedTrip : trip)))
      return mappedTrip
    }

    let updatedTrip: AgencyTrip | null = null
    setTrips((prev) =>
      prev.map((trip) => {
        if (trip.id !== id) return trip
        updatedTrip = { ...trip, ...data }
        return updatedTrip
      })
    )
    return updatedTrip
  }, [clientNameById, isUsingRealData])

  const deleteTrip = useCallback(async (id: string) => {
    if (isUsingRealData) {
      const result = await deleteTripRecord(id)
      if (!result.success) {
        setWorkspaceError(result.error ?? "Nao foi possivel remover a viagem no Supabase.")
        return false
      }
      setWorkspaceError(null)
      setTrips((prev) => prev.filter((item) => item.id !== id))
      setDocuments((prev) => prev.filter((document) => document.tripId !== id))
      return true
    }

    const trip = trips.find((item) => item.id === id)
    setTrips((prev) => prev.filter((item) => item.id !== id))
    if (trip) addActivity("Viagem removida", trip.name, "trip")
    return true
  }, [addActivity, isUsingRealData, trips])

  const getTripById = useCallback((id: string) => trips.find((trip) => trip.id === id), [trips])
  const getTripsByClient = useCallback((clientId: string) => trips.filter((trip) => trip.clientId === clientId), [trips])

  const addDocument = useCallback(async (data: Omit<AgencyDocument, "id" | "createdAt"> & { file?: File | null }) => {
    if (isUsingRealData) {
      if (!agencyId) {
        const message = "Agencia nao configurada no Supabase. Finalize o cadastro antes de enviar documentos."
        setWorkspaceError(message)
        return null
      }

      if (!user?.id) {
        const message = "Usuario autenticado nao encontrado para enviar o documento."
        setWorkspaceError(message)
        return null
      }

      if (!data.file) {
        const message = "Selecione um arquivo real antes de enviar o documento."
        setWorkspaceError(message)
        return null
      }

      if (!data.tripId) {
        const message = "Selecione uma viagem real para vincular este documento."
        setWorkspaceError(message)
        return null
      }

      const safeName = sanitizeFileName(data.file.name)
      const path = `${user.id}/${agencyId}/${data.tripId}/${data.type}/${Date.now()}-${safeName}`
      const uploadResult = await uploadDocumentFile({ file: data.file, path })

      if (!uploadResult.data) {
        setWorkspaceError(uploadResult.error ?? "Nao foi possivel enviar o arquivo para o Storage.")
        return null
      }

      const metadataResult = await createDocumentMetadata({
        tripId: data.tripId ?? null,
        clientId: data.clientId ?? null,
        agencyId,
        ownerUserId: user.id,
        name: data.name || data.file.name,
        type: data.type,
        filePath: uploadResult.data.path,
        fileUrl: uploadResult.data.fileUrl ?? null,
        mimeType: data.file.type || null,
        size: data.file.size ?? null,
        isPrivate: data.isPrivate,
        visibility: data.visibility ?? (data.isPrivate ? "private" : "agency_only"),
      })

      if (!metadataResult.data) {
        setWorkspaceError(metadataResult.error ?? "Nao foi possivel salvar o documento no Supabase.")
        return null
      }

      const newDocument = mapDocumentRecordToAgencyDocument(metadataResult.data)
      setWorkspaceError(null)
      setDocuments((prev) => [newDocument, ...prev])
      return newDocument
    }

    const newDocument: AgencyDocument = {
      ...data,
      id: `doc-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setDocuments((prev) => [newDocument, ...prev])
    addActivity("Documento enviado", data.name, "document")
    return newDocument
  }, [addActivity, agencyId, isUsingRealData, user?.id])

  const deleteDocument = useCallback(async (id: string) => {
    if (isUsingRealData) {
      const result = await deleteDocumentRecord(id)
      if (!result.success) {
        setWorkspaceError(result.error ?? "Nao foi possivel remover o documento no Supabase.")
        return false
      }
      setWorkspaceError(null)
      setDocuments((prev) => prev.filter((document) => document.id !== id))
      return true
    }

    setDocuments((prev) => prev.filter((document) => document.id !== id))
    return true
  }, [isUsingRealData])

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

  const respondToRequest = useCallback(async (id: string, response: string) => {
    const request = conciergeRequests.find((item) => item.id === id)

    if (isUsingRealData && request) {
      const result = await addAiMessage({
        conversationId: request.conversationId ?? request.id,
        tripId: request.tripId,
        userId: user?.id ?? null,
        agencyId: agencyId,
        clientId: request.clientId || null,
        role: "agent",
        content: response,
        metadata: {
          origin: "agency-portal",
        },
      })

      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel salvar a resposta do concierge.")
        return false
      }

      setWorkspaceError(null)
      await refreshAgencyWorkspace()
      return true
    }

    setConciergeRequests((prev) =>
      prev.map((requestItem) =>
        requestItem.id === id
          ? {
              ...requestItem,
              response,
              status: "answered" as const,
              lastInteractionAt: new Date().toISOString(),
              messages: [
                ...(requestItem.messages ?? []),
                {
                  id: `local-agent-${Date.now()}`,
                  role: "agent",
                  content: response,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : requestItem
      )
    )
    addActivity("Solicitacao respondida", `${response.slice(0, 50)}...`, "concierge")
    return true
  }, [addActivity, agencyId, conciergeRequests, isUsingRealData, refreshAgencyWorkspace, user?.id])

  const resolveRequest = useCallback(async (id: string) => {
    if (isUsingRealData) {
      const result = await updateConversationStatus(id, "closed")
      if (!result.data) {
        setWorkspaceError(result.error ?? "Nao foi possivel concluir a solicitacao do concierge.")
        return false
      }
      setWorkspaceError(null)
      await refreshAgencyWorkspace()
      return true
    }

    setConciergeRequests((prev) =>
      prev.map((request) => (request.id === id ? { ...request, status: "resolved" as const } : request))
    )
    return true
  }, [isUsingRealData, refreshAgencyWorkspace])

  const addTeamMember = useCallback(async (data: Omit<TeamMember, "id" | "createdAt">) => {
    if (isUsingRealData) {
      if (!agencyId) {
        const message = "Agencia nao configurada no Supabase. Finalize o cadastro antes de gerenciar a equipe."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const existingProfile = await getProfileByEmail(data.email)
      if (!existingProfile.data) {
        const message = existingProfile.error ?? "Convite de novo usuario ainda depende de fluxo de convite."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const duplicateMember = teamMembers.find((member) => member.profileId === existingProfile.data?.id)
      if (duplicateMember) {
        const message = "Este usuario ja faz parte da equipe da agencia."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const result = await addAgencyMemberRecord({
        agencyId,
        profileId: existingProfile.data.id,
        role: data.role === "agent" ? "member" : data.role,
        status: data.status === "inactive" ? "inactive" : "active",
        name: existingProfile.data.name || data.name,
        email: existingProfile.data.email || data.email,
        avatarUrl: existingProfile.data.avatarUrl ?? undefined,
      })

      if (!result.data) {
        const message = result.error ?? "Nao foi possivel vincular o membro a agencia."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const profileUpdateResult = await updateProfileRecord(existingProfile.data.id, {
        agencyId,
        role: "agency_member",
      })

      if (!profileUpdateResult.data) {
        await updateAgencyMemberRecord(result.data.id, {
          role: result.data.role,
          status: "inactive",
          name: result.data.name,
          email: result.data.email,
          avatarUrl: result.data.avatarUrl,
        })

        const message = profileUpdateResult.error ?? "Membro vinculado, mas falhou ao atualizar o profile da equipe."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const newMember: TeamMember = {
        id: result.data.id,
        profileId: result.data.profileId,
        name: result.data.name || existingProfile.data.name || data.name,
        email: result.data.email || existingProfile.data.email || data.email,
        role:
          result.data.role === "owner" || result.data.role === "admin" || result.data.role === "viewer"
            ? result.data.role
            : "agent",
        status: result.data.status === "inactive" || result.data.status === "pending" ? result.data.status : "active",
        avatar: result.data.avatarUrl,
        createdAt: result.data.createdAt,
      }

      setWorkspaceError(null)
      setTeamMembers((prev) => [newMember, ...prev])
      addActivity("Membro vinculado", newMember.name, "team")
      return { success: true, error: null }
    }

    const newMember: TeamMember = {
      ...data,
      id: `team-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setTeamMembers((prev) => [...prev, newMember])
    addActivity("Membro convidado", data.name, "team")
    return { success: true, error: null }
  }, [addActivity, agencyId, isUsingRealData, teamMembers])

  const updateTeamMember = useCallback(async (id: string, data: Partial<TeamMember>) => {
    if (isUsingRealData) {
      const currentMember = teamMembers.find((member) => member.id === id)
      if (!currentMember) {
        const message = "Membro nao encontrado."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      if (currentMember.role === "owner") {
        const message = "O owner da agencia nao pode ser alterado por esta tela."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const result = await updateAgencyMemberRecord(id, {
        role: data.role === "agent" ? "member" : data.role,
        status: data.status,
        name: currentMember.name,
        email: currentMember.email,
        avatarUrl: currentMember.avatar,
      })

      if (!result.data) {
        const message = result.error ?? "Nao foi possivel atualizar o membro da equipe."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const updatedMember: TeamMember = {
        ...currentMember,
        role:
          result.data.role === "owner" || result.data.role === "admin" || result.data.role === "viewer"
            ? result.data.role
            : "agent",
        status: result.data.status === "inactive" || result.data.status === "pending" ? result.data.status : "active",
      }

      setWorkspaceError(null)
      setTeamMembers((prev) => prev.map((member) => (member.id === id ? updatedMember : member)))
      return { success: true, error: null }
    }

    setTeamMembers((prev) => prev.map((member) => (member.id === id ? { ...member, ...data } : member)))
    return { success: true, error: null }
  }, [isUsingRealData, teamMembers])

  const removeTeamMember = useCallback(async (id: string) => {
    const member = teamMembers.find((item) => item.id === id)
    if (!member) {
      const message = "Membro nao encontrado."
      setWorkspaceError(message)
      return { success: false, error: message }
    }

    if (isUsingRealData) {
      if (member.role === "owner") {
        const message = "O owner da agencia nao pode ser removido por esta tela."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      const result = await updateAgencyMemberRecord(id, {
        status: "inactive",
        role: member.role === "agent" ? "member" : member.role,
        name: member.name,
        email: member.email,
        avatarUrl: member.avatar,
      })

      if (!result.data) {
        const message = result.error ?? "Nao foi possivel desativar o membro da equipe."
        setWorkspaceError(message)
        return { success: false, error: message }
      }

      if (member.profileId) {
        const profileUpdateResult = await updateProfileRecord(member.profileId, {
          agencyId: null,
          role: "traveler",
        })

        if (!profileUpdateResult.data) {
          const message = profileUpdateResult.error ?? "Membro desativado, mas falhou ao atualizar o profile vinculado."
          setWorkspaceError(message)
          return { success: false, error: message }
        }
      }

      setWorkspaceError(null)
      setTeamMembers((prev) => prev.map((item) => (item.id === id ? { ...item, status: "inactive" } : item)))
      addActivity("Membro desativado", member.name, "team")
      return { success: true, error: null }
    }

    setTeamMembers((prev) => prev.filter((item) => item.id !== id))
    addActivity("Membro removido", member.name, "team")
    return { success: true, error: null }
  }, [addActivity, isUsingRealData, teamMembers])

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
        agencyId,
        agency,
        isUsingRealData,
        setupIncomplete,
        workspaceError,
        refreshAgencyWorkspace,
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
