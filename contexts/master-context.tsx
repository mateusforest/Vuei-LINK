"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { AgencyPlanCode, CreditPackage, TripStatus } from "@/types"
import { listProfiles } from "@/lib/repositories/profiles-repository"
import { listAgencies, listAllAgencyMembers, type AgencyMember } from "@/lib/repositories/agencies-repository"
import { listAllClients } from "@/lib/repositories/clients-repository"
import { listTrips } from "@/lib/repositories/trips-repository"
import { listDocuments } from "@/lib/repositories/documents-repository"
import { shouldUseSupabase } from "@/lib/data-source"

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
  userId: string
  userName: string
  agencyId?: string
  agencyName?: string
  message: string
  status: "pending" | "in_progress" | "resolved"
  priority: "low" | "medium" | "high"
  createdAt: string
  resolvedAt?: string
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
  activities: [],
  stats: EMPTY_STATS,
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

function buildMasterState(data: {
  profiles: Awaited<ReturnType<typeof listProfiles>>["data"]
  agencies: Awaited<ReturnType<typeof listAgencies>>["data"]
  agencyMembers: AgencyMember[]
  clients: Awaited<ReturnType<typeof listAllClients>>["data"]
  trips: Awaited<ReturnType<typeof listTrips>>["data"]
  documents: Awaited<ReturnType<typeof listDocuments>>["data"]
}): MasterState {
  const profiles = data.profiles ?? []
  const agenciesData = data.agencies ?? []
  const agencyMembers = data.agencyMembers ?? []
  const clients = data.clients ?? []
  const tripsData = data.trips ?? []
  const documents = data.documents ?? []

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
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12)

  return {
    agencies,
    users,
    trips,
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
  const [state, setState] = useState<MasterState>(INITIAL_STATE)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<MasterSettings>(INITIAL_SETTINGS)

  useEffect(() => {
    let active = true

    async function loadMasterData() {
      if (!shouldUseSupabase()) {
        if (!active) return
        setState(INITIAL_STATE)
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

      const [profilesResult, agenciesResult, membersResult, clientsResult, tripsResult, documentsResult] = await Promise.all([
        listProfiles(),
        listAgencies(),
        listAllAgencyMembers(),
        listAllClients(),
        listTrips(),
        listDocuments(),
      ])

      if (!active) return

      const nextState = buildMasterState({
        profiles: profilesResult.data ?? [],
        agencies: agenciesResult.data ?? [],
        agencyMembers: membersResult.data ?? [],
        clients: clientsResult.data ?? [],
        trips: tripsResult.data ?? [],
        documents: documentsResult.data ?? [],
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
      ].filter((notification): notification is Notification => Boolean(notification))

      setState(nextState)
      setNotifications(nextNotifications)
    }

    void loadMasterData()

    return () => {
      active = false
    }
  }, [])

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

  return (
    <MasterContext.Provider
      value={{
        agencies: state.agencies,
        users: state.users,
        trips: state.trips,
        conciergeRequests: [],
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
        updateConciergeStatus: () => noopWithLog("Atualizacao de concierge no master"),
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
