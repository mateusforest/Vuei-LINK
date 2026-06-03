"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { AgencyPlanCode, CreditPackage, TripStatus } from "@/types"
import { listProfiles } from "@/lib/repositories/profiles-repository"
import { listAgencies, listAllAgencyMembers, type AgencyMember } from "@/lib/repositories/agencies-repository"
import { listAllClients } from "@/lib/repositories/clients-repository"
import { listTrips } from "@/lib/repositories/trips-repository"
import { listDocuments } from "@/lib/repositories/documents-repository"
import { listConversations, listMessagesByConversationIds, updateConversationStatus } from "@/lib/repositories/ai-repository"
import { shouldUseSupabase } from "@/lib/data-source"
import { useAuth } from "@/contexts/auth-context"

interface Agency {
  id: string
  name: string
  logo?: string
  plan: AgencyPlanCode
  status: "active" | "suspended" | "pending"
  owner: string
  email: string
  phone: string
  createdAt: string
  tripsCount: number
  usersCount: number
  creditsBalance: number
  monthlyRevenue: number
}

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  type: "traveler" | "agency" | "admin"
  status: "active" | "suspended" | "pending"
  agencyId?: string
  agencyName?: string
  plan: "free" | "premium" | "enterprise"
  creditsBalance: number
  tripsCount: number
  createdAt: string
  lastActive: string
}

interface MasterTrip {
  id: string
  name: string
  destination: string
  cover: string
  createdAt: string
  startDate: string
  endDate: string
  status: Extract<TripStatus, "upcoming" | "ongoing" | "completed">
  origin: "user" | "agency"
  userId?: string
  userName?: string
  agencyId?: string
  agencyName?: string
  adminLink: string
  shareLink: string
  documentsCount: number
  creditsUsed: number
}

interface ConciergeRequest {
  id: string
  tripId: string
  tripName: string
  userId?: string
  userName: string
  agencyId?: string
  agencyName?: string
  message: string
  status: "pending" | "in_progress" | "resolved"
  priority: "low" | "medium" | "high"
  createdAt: string
  resolvedAt?: string
  lastInteractionAt?: string
  messages: Array<{
    id: string
    role: "user" | "assistant" | "agent" | "system"
    content: string
    createdAt: string
  }>
}

interface AIPrompt {
  id: string
  name: string
  module: "concierge" | "itinerary" | "documents" | "notifications"
  prompt: string
  isActive: boolean
  usageCount: number
  lastUsed: string
}

interface Template {
  id: string
  name: string
  type: "itinerary" | "concierge" | "documents" | "messages" | "notifications" | "trip" | "email"
  content: string
  isActive: boolean
  usageCount: number
  createdAt: string
}

interface Transaction {
  id: string
  type: "subscription" | "credits" | "refund"
  agencyId?: string
  agencyName?: string
  userId?: string
  userName?: string
  amount: number
  status: "completed" | "pending" | "failed"
  description: string
  createdAt: string
}

interface MasterCredits {
  totalConsumed: number
  totalAvailable: number
  monthlyUsage: number
  packages: CreditPackage[]
}

interface Activity {
  id: string
  type: "agency_created" | "trip_created" | "user_registered" | "credits_purchased" | "concierge_request"
  description: string
  entityId: string
  entityName: string
  createdAt: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  read: boolean
  createdAt: string
}

interface MasterSettings {
  platformName: string
  primaryColor: string
  secondaryColor: string
  logo?: string
  defaultCreditsNewUser: number
  defaultCreditsNewAgency: number
  maxTripsPerUser: number
  maxUsersPerAgency: number
  aiEnabled: boolean
  maintenanceMode: boolean
}

interface MasterStats {
  totalAgencies: number
  activeAgencies: number
  totalUsers: number
  activeUsers: number
  totalTrips: number
  activeTrips: number
  totalClients: number
  totalDocuments: number
  monthlyRevenue: number
  totalCreditsConsumed: number
}

interface MasterContextType {
  agencies: Agency[]
  users: User[]
  trips: MasterTrip[]
  dataErrors: {
    profiles: string | null
    agencies: string | null
    agencyMembers: string | null
    clients: string | null
    trips: string | null
    documents: string | null
    conciergeConversations: string | null
    conciergeMessages: string | null
  }
  conciergeRequests: ConciergeRequest[]
  aiPrompts: AIPrompt[]
  templates: Template[]
  transactions: Transaction[]
  credits: MasterCredits
  activities: Activity[]
  notifications: Notification[]
  settings: MasterSettings
  stats: MasterStats
  addAgency: (agency: Omit<Agency, "id" | "createdAt">) => void
  updateAgency: (id: string, data: Partial<Agency>) => void
  suspendAgency: (id: string) => void
  activateAgency: (id: string) => void
  addUser: (user: Omit<User, "id" | "createdAt">) => void
  updateUser: (id: string, data: Partial<User>) => void
  suspendUser: (id: string) => void
  activateUser: (id: string) => void
  adjustUserCredits: (id: string, amount: number) => void
  updateConciergeStatus: (id: string, status: ConciergeRequest["status"]) => void
  addPrompt: (prompt: Omit<AIPrompt, "id" | "usageCount" | "lastUsed">) => void
  updatePrompt: (id: string, data: Partial<AIPrompt>) => void
  togglePrompt: (id: string) => void
  addTemplate: (template: Omit<Template, "id" | "createdAt" | "usageCount">) => void
  updateTemplate: (id: string, data: Partial<Template>) => void
  toggleTemplate: (id: string) => void
  duplicateTemplate: (id: string) => void
  addCreditsPackage: (pkg: Omit<MasterCredits["packages"][0], "id">) => void
  updateCreditsPackage: (id: string, data: Partial<MasterCredits["packages"][0]>) => void
  updateSettings: (data: Partial<MasterSettings>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  searchGlobal: (query: string) => { agencies: Agency[]; users: User[]; trips: MasterTrip[] }
}

type MasterState = {
  agencies: Agency[]
  users: User[]
  trips: MasterTrip[]
  conciergeRequests: ConciergeRequest[]
  activities: Activity[]
  stats: MasterStats
}

const MasterContext = createContext<MasterContextType | null>(null)

const EMPTY_STATS: MasterStats = {
  totalAgencies: 0,
  activeAgencies: 0,
  totalUsers: 0,
  activeUsers: 0,
  totalTrips: 0,
  activeTrips: 0,
  totalClients: 0,
  totalDocuments: 0,
  monthlyRevenue: 0,
  totalCreditsConsumed: 0,
}

const INITIAL_SETTINGS: MasterSettings = {
  platformName: "Vuei",
  primaryColor: "#5de0e6",
  secondaryColor: "#004aad",
  defaultCreditsNewUser: 50,
  defaultCreditsNewAgency: 200,
  maxTripsPerUser: 10,
  maxUsersPerAgency: 20,
  aiEnabled: false,
  maintenanceMode: false,
}

const INITIAL_STATE: MasterState = {
  agencies: [],
  users: [],
  trips: [],
  conciergeRequests: [],
  activities: [],
  stats: EMPTY_STATS,
}

const EMPTY_DATA_ERRORS = {
  profiles: null,
  agencies: null,
  agencyMembers: null,
  clients: null,
  trips: null,
  documents: null,
  conciergeConversations: null,
  conciergeMessages: null,
}

function noopWithLog(action: string) {
  console.info(`[MASTER] ${action} ainda nao foi habilitado em modo operacional real.`)
}

function mapAgencyPlanToUserPlan(plan: AgencyPlanCode | null | undefined): "free" | "premium" | "enterprise" {
  if (plan === "enterprise") return "enterprise"
  if (plan === "pro") return "premium"
  return "free"
}

function normalizeTripStatus(status: TripStatus): Extract<TripStatus, "upcoming" | "ongoing" | "completed"> {
  if (status === "ongoing") return "ongoing"
  if (status === "completed") return "completed"
  return "upcoming"
}

function resolveConciergePriority(createdAt: string, hasResponse: boolean): ConciergeRequest["priority"] {
  if (hasResponse) return "low"

  const ageInHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (ageInHours >= 24) return "high"
  if (ageInHours >= 2) return "medium"
  return "low"
}

function buildMasterState(data: {
  profiles: Awaited<ReturnType<typeof listProfiles>>["data"]
  agencies: Awaited<ReturnType<typeof listAgencies>>["data"]
  agencyMembers: AgencyMember[]
  clients: Awaited<ReturnType<typeof listAllClients>>["data"]
  trips: Awaited<ReturnType<typeof listTrips>>["data"]
  documents: Awaited<ReturnType<typeof listDocuments>>["data"]
  conversations: Awaited<ReturnType<typeof listConversations>>["data"]
  messages: Awaited<ReturnType<typeof listMessagesByConversationIds>>["data"]
}): MasterState {
  const profiles = data.profiles ?? []
  const agenciesData = data.agencies ?? []
  const agencyMembers = data.agencyMembers ?? []
  const clients = data.clients ?? []
  const tripsData = data.trips ?? []
  const documents = data.documents ?? []
  const conversations = data.conversations ?? []
  const messages = data.messages ?? []

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
  const agencyMap = new Map(agenciesData.map((agency) => [agency.id, agency]))
  const clientMap = new Map(clients.map((client) => [client.id, client]))

  const membersByAgency = agencyMembers.reduce<Map<string, AgencyMember[]>>((accumulator, member) => {
    const current = accumulator.get(member.agencyId) ?? []
    current.push(member)
    accumulator.set(member.agencyId, current)
    return accumulator
  }, new Map())

  const tripsByAgency = tripsData.reduce<Map<string, number>>((accumulator, trip) => {
    if (!trip.agencyId) return accumulator
    accumulator.set(trip.agencyId, (accumulator.get(trip.agencyId) ?? 0) + 1)
    return accumulator
  }, new Map())

  const tripsByUser = tripsData.reduce<Map<string, number>>((accumulator, trip) => {
    if (!trip.ownerUserId) return accumulator
    accumulator.set(trip.ownerUserId, (accumulator.get(trip.ownerUserId) ?? 0) + 1)
    return accumulator
  }, new Map())

  const documentsByTrip = documents.reduce<Map<string, number>>((accumulator, document) => {
    if (!document.tripId) return accumulator
    accumulator.set(document.tripId, (accumulator.get(document.tripId) ?? 0) + 1)
    return accumulator
  }, new Map())

  const messagesByConversation = messages.reduce<Map<string, typeof messages>>((accumulator, message) => {
    const current = accumulator.get(message.conversationId) ?? []
    current.push(message)
    accumulator.set(message.conversationId, current)
    return accumulator
  }, new Map())

  const agencies: Agency[] = agenciesData.map((agency) => {
    const ownerProfile = agency.ownerUserId ? profileMap.get(agency.ownerUserId) : null
    const members = membersByAgency.get(agency.id) ?? []

    return {
      id: agency.id,
      name: agency.name,
      logo: agency.logo ?? undefined,
      plan: agency.plan,
      status: agency.status === "archived" ? "suspended" : agency.status,
      owner: ownerProfile?.name || ownerProfile?.email || "Sem responsavel definido",
      email: agency.settings?.email || ownerProfile?.email || "",
      phone: agency.settings?.phone || ownerProfile?.phone || "",
      createdAt: agency.createdAt,
      tripsCount: tripsByAgency.get(agency.id) ?? 0,
      usersCount: members.filter((member) => member.status === "active").length || (agency.ownerUserId ? 1 : 0),
      creditsBalance: agency.creditsBalance ?? 0,
      monthlyRevenue: 0,
    }
  })

  const users: User[] = profiles
    .map((profile) => {
      const linkedAgency = profile.agencyId ? agencyMap.get(profile.agencyId) : null
      const isAgencyRole = profile.role === "agency_owner" || profile.role === "agency_member"
      const type: User["type"] =
        profile.role === "master" ? "admin" : isAgencyRole ? "agency" : "traveler"

      return {
        id: profile.id,
        name: profile.name || profile.email || "Usuario sem nome",
        email: profile.email,
        avatar: profile.avatarUrl ?? undefined,
        type,
        status: "active",
        agencyId: linkedAgency?.id ?? profile.agencyId ?? undefined,
        agencyName: linkedAgency?.name,
        plan: profile.role === "master" ? "enterprise" : mapAgencyPlanToUserPlan(linkedAgency?.plan),
        creditsBalance: profile.creditsBalance ?? 0,
        tripsCount: isAgencyRole && linkedAgency ? tripsByAgency.get(linkedAgency.id) ?? 0 : tripsByUser.get(profile.id) ?? 0,
        createdAt: profile.createdAt,
        lastActive: profile.updatedAt || profile.createdAt,
      }
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  const trips: MasterTrip[] = tripsData
    .map((trip) => {
      const travelerProfile = trip.ownerUserId ? profileMap.get(trip.ownerUserId) : null
      const agency = trip.agencyId ? agencyMap.get(trip.agencyId) : null
      const client = trip.clientId ? clientMap.get(trip.clientId) : null

      return {
        id: trip.id,
        name: trip.title,
        destination: trip.destination,
        cover: trip.coverImage || "/placeholder.svg",
        createdAt: trip.createdAt,
        startDate: trip.startDate || trip.createdAt,
        endDate: trip.endDate || trip.createdAt,
        status: normalizeTripStatus(trip.status),
        origin: trip.ownerType === "agency" ? "agency" : "user",
        userId: trip.ownerType === "traveler" ? trip.ownerUserId ?? undefined : undefined,
        userName:
          trip.ownerType === "agency"
            ? client?.name || "Cliente sem nome"
            : travelerProfile?.name || travelerProfile?.email || "Viajante",
        agencyId: trip.agencyId ?? undefined,
        agencyName: agency?.name,
        adminLink: trip.adminLink,
        shareLink: trip.publicLink,
        documentsCount: documentsByTrip.get(trip.id) ?? 0,
        creditsUsed: trip.creditsSummary?.used ?? 0,
      }
    })
    .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime())

  const conciergeRequests: ConciergeRequest[] = conversations
    .filter((conversation) => conversation.channel === "concierge" && conversation.tripId)
    .map((conversation) => {
      const trip = tripsData.find((entry) => entry.id === conversation.tripId)
      if (!trip) return null

      const agency = trip.agencyId ? agencyMap.get(trip.agencyId) : null
      const client = trip.clientId ? clientMap.get(trip.clientId) : null
      const travelerProfile = conversation.userId ? profileMap.get(conversation.userId) : null
      const conversationMessages = (messagesByConversation.get(conversation.id) ?? []).slice().sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      })
      const firstUserMessage = conversationMessages.find((message) => message.role === "user")
      if (!firstUserMessage) return null

      const latestMessage = conversationMessages[conversationMessages.length - 1]
      const hasResponse = conversationMessages.some((message) => message.role === "assistant" || message.role === "agent")

      return {
        id: conversation.id,
        tripId: trip.id,
        tripName: trip.title,
        userId: conversation.userId ?? undefined,
        userName: client?.name || travelerProfile?.name || travelerProfile?.email || "Viajante",
        agencyId: agency?.id,
        agencyName: agency?.name,
        message: firstUserMessage.content,
        status:
          conversation.status === "closed" || conversation.status === "archived"
            ? "resolved"
            : hasResponse
              ? "in_progress"
              : "pending",
        priority: resolveConciergePriority(conversation.createdAt, hasResponse),
        createdAt: conversation.createdAt,
        resolvedAt: conversation.status === "closed" || conversation.status === "archived" ? conversation.updatedAt : undefined,
        lastInteractionAt: latestMessage?.createdAt ?? conversation.updatedAt,
        messages: conversationMessages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt,
        })),
      } satisfies ConciergeRequest
    })
    .filter((request): request is ConciergeRequest => Boolean(request))
    .sort((left, right) => new Date(right.lastInteractionAt ?? right.createdAt).getTime() - new Date(left.lastInteractionAt ?? left.createdAt).getTime())

  const activities: Activity[] = [
    ...agencies.map((agency) => ({
      id: `agency-${agency.id}`,
      type: "agency_created" as const,
      description: "Nova agencia cadastrada",
      entityId: agency.id,
      entityName: agency.name,
      createdAt: agency.createdAt,
    })),
    ...users.map((user) => ({
      id: `user-${user.id}`,
      type: "user_registered" as const,
      description: "Novo usuario registrado",
      entityId: user.id,
      entityName: user.name,
      createdAt: user.createdAt,
    })),
    ...trips.map((trip) => ({
      id: `trip-${trip.id}`,
      type: "trip_created" as const,
      description: "Nova viagem criada",
      entityId: trip.id,
      entityName: trip.name,
      createdAt: trip.createdAt,
    })),
    ...conciergeRequests.map((request) => ({
      id: `concierge-${request.id}`,
      type: "concierge_request" as const,
      description: "Nova interacao no concierge",
      entityId: request.id,
      entityName: request.tripName,
      createdAt: request.lastInteractionAt ?? request.createdAt,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12)

  return {
    agencies,
    users,
    trips,
    conciergeRequests,
    activities,
    stats: {
      totalAgencies: agencies.length,
      activeAgencies: agencies.filter((agency) => agency.status === "active").length,
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.status === "active").length,
      totalTrips: trips.length,
      activeTrips: trips.filter((trip) => trip.status === "ongoing" || trip.status === "upcoming").length,
      totalClients: clients.length,
      totalDocuments: documents.length,
      monthlyRevenue: 0,
      totalCreditsConsumed: 0,
    },
  }
}

export function MasterProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [state, setState] = useState<MasterState>(INITIAL_STATE)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<MasterSettings>(INITIAL_SETTINGS)
  const [dataErrors, setDataErrors] = useState(EMPTY_DATA_ERRORS)

  useEffect(() => {
    let active = true

    async function loadMasterData() {
      if (loading) return

      if (!shouldUseSupabase()) {
        if (!active) return
        setState(INITIAL_STATE)
        setDataErrors(EMPTY_DATA_ERRORS)
        setNotifications([
          {
            id: "master-no-supabase",
            title: "Supabase inativo",
            message: "O portal master esta em modo leitura vazio porque o Supabase nao esta habilitado.",
            type: "warning",
            read: false,
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }

      if (!user || profile?.role !== "master") {
        if (!active) return
        setState(INITIAL_STATE)
        setDataErrors(EMPTY_DATA_ERRORS)
        setNotifications([])
        return
      }

      const [profilesResult, agenciesResult, membersResult, clientsResult, tripsResult, documentsResult, conversationsResult] = await Promise.all([
        listProfiles(),
        listAgencies(),
        listAllAgencyMembers(),
        listAllClients(),
        listTrips(),
        listDocuments(),
        listConversations({ channel: "concierge" }),
      ])

      const messagesResult = await listMessagesByConversationIds(
        (conversationsResult.data ?? []).map((conversation) => conversation.id)
      )

      if (!active) return

      const nextErrors = {
        profiles: profilesResult.error,
        agencies: agenciesResult.error,
        agencyMembers: membersResult.error,
        clients: clientsResult.error,
        trips: tripsResult.error,
        documents: documentsResult.error,
        conciergeConversations: conversationsResult.error,
        conciergeMessages: messagesResult.error,
      }

      if (nextErrors.profiles) {
        console.error("[MASTER] profiles read error", nextErrors.profiles)
      }

      if (nextErrors.agencies) {
        console.error("[MASTER] agencies read error", nextErrors.agencies)
      }

      const nextState = buildMasterState({
        profiles: profilesResult.data ?? [],
        agencies: agenciesResult.data ?? [],
        agencyMembers: membersResult.data ?? [],
        clients: clientsResult.data ?? [],
        trips: tripsResult.data ?? [],
        documents: documentsResult.data ?? [],
        conversations: conversationsResult.data ?? [],
        messages: messagesResult.data ?? [],
      })

      const nextNotifications: Notification[] = [
        profilesResult.error
          ? {
              id: "profiles-error",
              title: "Falha ao ler usuarios",
              message: profilesResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        agenciesResult.error
          ? {
              id: "agencies-error",
              title: "Falha ao ler agencias",
              message: agenciesResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        membersResult.error
          ? {
              id: "members-error",
              title: "Falha ao ler membros de agencias",
              message: membersResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        clientsResult.error
          ? {
              id: "clients-error",
              title: "Falha ao ler clientes",
              message: clientsResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        tripsResult.error
          ? {
              id: "trips-error",
              title: "Falha ao ler viagens",
              message: tripsResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        documentsResult.error
          ? {
              id: "documents-error",
              title: "Falha ao ler documentos",
              message: documentsResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        conversationsResult.error
          ? {
              id: "concierge-conversations-error",
              title: "Falha ao ler conversas do concierge",
              message: conversationsResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
        messagesResult.error
          ? {
              id: "concierge-messages-error",
              title: "Falha ao ler mensagens do concierge",
              message: messagesResult.error,
              type: "error",
              read: false,
              createdAt: new Date().toISOString(),
            }
          : null,
      ].filter((notification): notification is Notification => Boolean(notification))

      setState(nextState)
      setDataErrors(nextErrors)
      setNotifications(nextNotifications)
    }

    void loadMasterData()

    return () => {
      active = false
    }
  }, [loading, profile?.role, user?.id])

  const credits = useMemo<MasterCredits>(
    () => ({
      totalConsumed: state.stats.totalCreditsConsumed,
      totalAvailable: 0,
      monthlyUsage: 0,
      packages: [],
    }),
    [state.stats.totalCreditsConsumed]
  )

  const searchGlobal = (query: string) => {
    const normalizedQuery = query.toLowerCase()
    return {
      agencies: state.agencies.filter(
        (agency) =>
          agency.name.toLowerCase().includes(normalizedQuery) ||
          agency.owner.toLowerCase().includes(normalizedQuery) ||
          agency.email.toLowerCase().includes(normalizedQuery)
      ),
      users: state.users.filter(
        (user) =>
          user.name.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery)
      ),
      trips: state.trips.filter(
        (trip) =>
          trip.name.toLowerCase().includes(normalizedQuery) ||
          trip.destination.toLowerCase().includes(normalizedQuery) ||
          trip.userName?.toLowerCase().includes(normalizedQuery) ||
          trip.agencyName?.toLowerCase().includes(normalizedQuery)
      ),
    }
  }

  const handleUpdateConciergeStatus = (id: string, status: ConciergeRequest["status"]) => {
    setState((current) => ({
      ...current,
      conciergeRequests: current.conciergeRequests.map((request) =>
        request.id === id
          ? {
              ...request,
              status,
              resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
            }
          : request
      ),
    }))

    if (shouldUseSupabase() && user && profile?.role === "master") {
      void (async () => {
        const nextStatus = status === "resolved" ? "closed" : "open"
        const result = await updateConversationStatus(id, nextStatus)
        if (!result.data && result.error) {
          console.error("[MASTER] concierge update error", result.error)
        }
      })()
    }
  }

  return (
    <MasterContext.Provider
      value={{
        agencies: state.agencies,
        users: state.users,
        trips: state.trips,
        dataErrors,
        conciergeRequests: state.conciergeRequests,
        aiPrompts: [],
        templates: [],
        transactions: [],
        credits,
        activities: state.activities,
        notifications,
        settings,
        stats: state.stats,
        addAgency: () => noopWithLog("Criacao de agencia no master"),
        updateAgency: () => noopWithLog("Edicao de agencia no master"),
        suspendAgency: () => noopWithLog("Suspensao de agencia no master"),
        activateAgency: () => noopWithLog("Reativacao de agencia no master"),
        addUser: () => noopWithLog("Criacao de usuario no master"),
        updateUser: () => noopWithLog("Edicao de usuario no master"),
        suspendUser: () => noopWithLog("Suspensao de usuario no master"),
        activateUser: () => noopWithLog("Reativacao de usuario no master"),
        adjustUserCredits: () => noopWithLog("Ajuste de creditos no master"),
        updateConciergeStatus: handleUpdateConciergeStatus,
        addPrompt: () => noopWithLog("Criacao de prompt no master"),
        updatePrompt: () => noopWithLog("Edicao de prompt no master"),
        togglePrompt: () => noopWithLog("Ativacao de prompt no master"),
        addTemplate: () => noopWithLog("Criacao de template no master"),
        updateTemplate: () => noopWithLog("Edicao de template no master"),
        toggleTemplate: () => noopWithLog("Ativacao de template no master"),
        duplicateTemplate: () => noopWithLog("Duplicacao de template no master"),
        addCreditsPackage: () => noopWithLog("Criacao de pacote de creditos no master"),
        updateCreditsPackage: () => noopWithLog("Edicao de pacote de creditos no master"),
        updateSettings: (data) => setSettings((current) => ({ ...current, ...data })),
        markNotificationRead: (id) =>
          setNotifications((current) => current.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))),
        markAllNotificationsRead: () =>
          setNotifications((current) => current.map((notification) => ({ ...notification, read: true }))),
        searchGlobal,
      }}
    >
      {children}
    </MasterContext.Provider>
  )
}

export function useMaster() {
  const context = useContext(MasterContext)
  if (!context) {
    throw new Error("useMaster must be used within a MasterProvider")
  }
  return context
}
