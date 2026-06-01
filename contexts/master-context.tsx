"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import type { AgencyPlanCode, CreditPackage, TripStatus } from "@/types"
import { getAppUrl } from "@/lib/app-url"
import { buildAdminTripUrl, buildPublicTripUrl } from "@/lib/security/link-tokens"

// Types
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

interface MasterContextType {
  // Data
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
  
  // Stats
  stats: {
    totalAgencies: number
    activeAgencies: number
    totalUsers: number
    activeUsers: number
    totalTrips: number
    activeTrips: number
    monthlyRevenue: number
    totalCreditsConsumed: number
  }
  
  // Actions
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

const MasterContext = createContext<MasterContextType | null>(null)
const masterSupportEmail = `admin@${new URL(getAppUrl()).hostname.replace(/^www\./, "")}`

// O portal master permanece mockado nesta fase.
// A agregacao via repositories sera feita depois que os portais de usuario e agencia migrarem com seguranca.

// Initial mock data
const initialAgencies: Agency[] = [
  {
    id: "ag1",
    name: "Viagens Premium",
    plan: "enterprise",
    status: "active",
    owner: "Carlos Silva",
    email: "carlos@viagenspremium.com",
    phone: "(11) 99999-1234",
    createdAt: "2024-01-15",
    tripsCount: 45,
    usersCount: 8,
    creditsBalance: 2500,
    monthlyRevenue: 4500
  },
  {
    id: "ag2",
    name: "Destinos Incriveis",
    plan: "pro",
    status: "active",
    owner: "Ana Santos",
    email: "ana@destinosincriveis.com",
    phone: "(21) 98888-5678",
    createdAt: "2024-02-20",
    tripsCount: 32,
    usersCount: 5,
    creditsBalance: 1200,
    monthlyRevenue: 2800
  },
  {
    id: "ag3",
    name: "Turismo Global",
    plan: "starter",
    status: "active",
    owner: "Pedro Lima",
    email: "pedro@turismoglobal.com",
    phone: "(31) 97777-9012",
    createdAt: "2024-03-10",
    tripsCount: 18,
    usersCount: 3,
    creditsBalance: 450,
    monthlyRevenue: 980
  },
  {
    id: "ag4",
    name: "Voo Alto Viagens",
    plan: "pro",
    status: "suspended",
    owner: "Maria Costa",
    email: "maria@vooalto.com",
    phone: "(41) 96666-3456",
    createdAt: "2024-01-05",
    tripsCount: 12,
    usersCount: 2,
    creditsBalance: 0,
    monthlyRevenue: 0
  }
]

const initialUsers: User[] = [
  {
    id: "u1",
    name: "Joao Viajante",
    email: "joao@email.com",
    type: "traveler",
    status: "active",
    plan: "premium",
    creditsBalance: 150,
    tripsCount: 3,
    createdAt: "2024-04-01",
    lastActive: "2024-07-15"
  },
  {
    id: "u2",
    name: "Maria Exploradora",
    email: "maria@email.com",
    type: "traveler",
    status: "active",
    plan: "free",
    creditsBalance: 50,
    tripsCount: 1,
    createdAt: "2024-05-10",
    lastActive: "2024-07-14"
  },
  {
    id: "u3",
    name: "Carlos Silva",
    email: "carlos@viagenspremium.com",
    type: "agency",
    status: "active",
    agencyId: "ag1",
    agencyName: "Viagens Premium",
    plan: "enterprise",
    creditsBalance: 2500,
    tripsCount: 45,
    createdAt: "2024-01-15",
    lastActive: "2024-07-15"
  },
  {
    id: "u4",
    name: "Admin Master",
    email: masterSupportEmail,
    type: "admin",
    status: "active",
    plan: "enterprise",
    creditsBalance: 9999,
    tripsCount: 0,
    createdAt: "2024-01-01",
    lastActive: "2024-07-15"
  }
]

const initialTrips: MasterTrip[] = [
  {
    id: "t1",
    name: "Lua de Mel em Paris",
    destination: "Paris, Franca",
    cover: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
    startDate: "2024-08-15",
    endDate: "2024-08-25",
    status: "upcoming",
    origin: "agency",
    agencyId: "ag1",
    agencyName: "Viagens Premium",
    userName: "Cliente Premium",
    adminLink: buildAdminTripUrl("paris-lm"),
    shareLink: buildPublicTripUrl("paris-lm"),
    documentsCount: 8,
    creditsUsed: 45
  },
  {
    id: "t2",
    name: "Aventura em Tokyo",
    destination: "Tokyo, Japao",
    cover: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800",
    startDate: "2024-07-20",
    endDate: "2024-08-05",
    status: "ongoing",
    origin: "user",
    userId: "u1",
    userName: "Joao Viajante",
    adminLink: buildAdminTripUrl("tokyo-adv"),
    shareLink: buildPublicTripUrl("tokyo-adv"),
    documentsCount: 12,
    creditsUsed: 78
  },
  {
    id: "t3",
    name: "Ferias em Cancun",
    destination: "Cancun, Mexico",
    cover: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=800",
    startDate: "2024-06-01",
    endDate: "2024-06-10",
    status: "completed",
    origin: "agency",
    agencyId: "ag2",
    agencyName: "Destinos Incriveis",
    userName: "Familia Santos",
    adminLink: buildAdminTripUrl("cancun-fam"),
    shareLink: buildPublicTripUrl("cancun-fam"),
    documentsCount: 6,
    creditsUsed: 32
  }
]

const initialConciergeRequests: ConciergeRequest[] = [
  {
    id: "cr1",
    tripId: "t1",
    tripName: "Lua de Mel em Paris",
    userId: "u5",
    userName: "Cliente Premium",
    agencyId: "ag1",
    agencyName: "Viagens Premium",
    message: "Preciso de recomendacao de restaurante romantico para o jantar de aniversario",
    status: "pending",
    priority: "high",
    createdAt: "2024-07-15T10:30:00"
  },
  {
    id: "cr2",
    tripId: "t2",
    tripName: "Aventura em Tokyo",
    userId: "u1",
    userName: "Joao Viajante",
    message: "Como chego do aeroporto ate o hotel usando transporte publico?",
    status: "in_progress",
    priority: "medium",
    createdAt: "2024-07-14T15:45:00"
  },
  {
    id: "cr3",
    tripId: "t3",
    tripName: "Ferias em Cancun",
    userId: "u6",
    userName: "Familia Santos",
    agencyId: "ag2",
    agencyName: "Destinos Incriveis",
    message: "Existe passeio de snorkel para criancas?",
    status: "resolved",
    priority: "low",
    createdAt: "2024-06-05T09:00:00",
    resolvedAt: "2024-06-05T11:30:00"
  }
]

const initialAIPrompts: AIPrompt[] = [
  {
    id: "p1",
    name: "Concierge Geral",
    module: "concierge",
    prompt: "Voce e um concierge de viagens experiente e prestativo. Responda de forma amigavel e detalhada...",
    isActive: true,
    usageCount: 1250,
    lastUsed: "2024-07-15"
  },
  {
    id: "p2",
    name: "Gerador de Roteiros",
    module: "itinerary",
    prompt: "Crie um roteiro detalhado dia a dia considerando preferencias do viajante, orcamento e estilo...",
    isActive: true,
    usageCount: 456,
    lastUsed: "2024-07-14"
  },
  {
    id: "p3",
    name: "Extrator de Documentos",
    module: "documents",
    prompt: "Analise o documento anexado e extraia as informacoes relevantes como datas, numeros, locais...",
    isActive: true,
    usageCount: 890,
    lastUsed: "2024-07-15"
  }
]

const initialTemplates: Template[] = [
  {
    id: "tpl1",
    name: "Roteiro Romantico",
    type: "itinerary",
    content: "Template para viagens romanticas com foco em experiencias a dois...",
    isActive: true,
    usageCount: 45,
    createdAt: "2024-02-01"
  },
  {
    id: "tpl2",
    name: "Viagem em Familia",
    type: "itinerary",
    content: "Template para viagens em familia com atividades para todas as idades...",
    isActive: true,
    usageCount: 78,
    createdAt: "2024-02-15"
  },
  {
    id: "tpl3",
    name: "Boas-vindas Concierge",
    type: "concierge",
    content: "Ola! Sou seu concierge virtual. Estou aqui para ajudar com qualquer duvida...",
    isActive: true,
    usageCount: 234,
    createdAt: "2024-01-10"
  },
  {
    id: "tpl4",
    name: "Lembrete de Viagem",
    type: "notifications",
    content: "Sua viagem para {destino} comeca em {dias} dias! Confira seu roteiro...",
    isActive: true,
    usageCount: 156,
    createdAt: "2024-03-01"
  }
]

const initialTransactions: Transaction[] = [
  {
    id: "tx1",
    type: "subscription",
    agencyId: "ag1",
    agencyName: "Viagens Premium",
    amount: 299,
    status: "completed",
    description: "Assinatura Enterprise - Julho 2024",
    createdAt: "2024-07-01"
  },
  {
    id: "tx2",
    type: "credits",
    agencyId: "ag2",
    agencyName: "Destinos Incriveis",
    amount: 149,
    status: "completed",
    description: "Pacote 500 creditos",
    createdAt: "2024-07-10"
  },
  {
    id: "tx3",
    type: "subscription",
    agencyId: "ag3",
    agencyName: "Turismo Global",
    amount: 49,
    status: "pending",
    description: "Assinatura Starter - Julho 2024",
    createdAt: "2024-07-01"
  },
  {
    id: "tx4",
    type: "credits",
    userId: "u1",
    userName: "Joao Viajante",
    amount: 29,
    status: "completed",
    description: "Pacote 100 creditos",
    createdAt: "2024-07-05"
  }
]

const initialActivities: Activity[] = [
  {
    id: "act1",
    type: "trip_created",
    description: "Nova viagem criada",
    entityId: "t1",
    entityName: "Lua de Mel em Paris",
    createdAt: "2024-07-15T08:00:00"
  },
  {
    id: "act2",
    type: "agency_created",
    description: "Nova agencia cadastrada",
    entityId: "ag3",
    entityName: "Turismo Global",
    createdAt: "2024-07-14T14:30:00"
  },
  {
    id: "act3",
    type: "credits_purchased",
    description: "Compra de creditos",
    entityId: "ag2",
    entityName: "Destinos Incriveis",
    createdAt: "2024-07-14T10:15:00"
  },
  {
    id: "act4",
    type: "user_registered",
    description: "Novo usuario registrado",
    entityId: "u2",
    entityName: "Maria Exploradora",
    createdAt: "2024-07-13T16:45:00"
  },
  {
    id: "act5",
    type: "concierge_request",
    description: "Solicitacao ao concierge",
    entityId: "cr1",
    entityName: "Restaurante romantico",
    createdAt: "2024-07-13T11:20:00"
  }
]

const initialNotifications: Notification[] = [
  {
    id: "n1",
    title: "Nova agencia pendente",
    message: "Turismo Global aguarda aprovacao",
    type: "warning",
    read: false,
    createdAt: "2024-07-15T09:00:00"
  },
  {
    id: "n2",
    title: "Concierge prioritario",
    message: "3 solicitacoes aguardando resposta",
    type: "info",
    read: false,
    createdAt: "2024-07-15T08:30:00"
  },
  {
    id: "n3",
    title: "Meta atingida",
    message: "100 viagens criadas este mes",
    type: "success",
    read: true,
    createdAt: "2024-07-14T18:00:00"
  }
]

const initialCredits: MasterCredits = {
  totalConsumed: 45680,
  totalAvailable: 125000,
  monthlyUsage: 8450,
  packages: [
    { id: "pkg1", name: "Starter", credits: 100, price: 19.90, isActive: true },
    { id: "pkg2", name: "Pro", credits: 300, price: 49.90, isActive: true },
    { id: "pkg3", name: "Business", credits: 500, price: 79.90, isActive: true },
    { id: "pkg4", name: "Enterprise", credits: 1000, price: 149.90, isActive: true }
  ]
}

const initialSettings: MasterSettings = {
  platformName: "Vuei",
  primaryColor: "#5de0e6",
  secondaryColor: "#004aad",
  defaultCreditsNewUser: 50,
  defaultCreditsNewAgency: 200,
  maxTripsPerUser: 10,
  maxUsersPerAgency: 20,
  aiEnabled: true,
  maintenanceMode: false
}

export function MasterProvider({ children }: { children: ReactNode }) {
  const [agencies, setAgencies] = useState<Agency[]>(initialAgencies)
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [trips, setTrips] = useState<MasterTrip[]>(initialTrips)
  const [conciergeRequests, setConciergeRequests] = useState<ConciergeRequest[]>(initialConciergeRequests)
  const [aiPrompts, setAIPrompts] = useState<AIPrompt[]>(initialAIPrompts)
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
  const [credits, setCredits] = useState<MasterCredits>(initialCredits)
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [settings, setSettings] = useState<MasterSettings>(initialSettings)

  // Calculate stats
  const stats = {
    totalAgencies: agencies.length,
    activeAgencies: agencies.filter(a => a.status === "active").length,
    totalUsers: users.length,
    activeUsers: users.filter(u => u.status === "active").length,
    totalTrips: trips.length,
    activeTrips: trips.filter(t => t.status === "ongoing" || t.status === "upcoming").length,
    monthlyRevenue: transactions.filter(t => t.status === "completed").reduce((sum, t) => sum + t.amount, 0),
    totalCreditsConsumed: credits.totalConsumed
  }

  // Agency actions
  const addAgency = (agency: Omit<Agency, "id" | "createdAt">) => {
    const newAgency: Agency = {
      ...agency,
      id: `ag${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0]
    }
    setAgencies(prev => [newAgency, ...prev])
    addActivity("agency_created", "Nova agencia cadastrada", newAgency.id, newAgency.name)
  }

  const updateAgency = (id: string, data: Partial<Agency>) => {
    setAgencies(prev => prev.map(a => a.id === id ? { ...a, ...data } : a))
  }

  const suspendAgency = (id: string) => {
    setAgencies(prev => prev.map(a => a.id === id ? { ...a, status: "suspended" } : a))
  }

  const activateAgency = (id: string) => {
    setAgencies(prev => prev.map(a => a.id === id ? { ...a, status: "active" } : a))
  }

  // User actions
  const addUser = (user: Omit<User, "id" | "createdAt">) => {
    const newUser: User = {
      ...user,
      id: `u${Date.now()}`,
      createdAt: new Date().toISOString().split("T")[0]
    }
    setUsers(prev => [newUser, ...prev])
    addActivity("user_registered", "Novo usuario registrado", newUser.id, newUser.name)
  }

  const updateUser = (id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
  }

  const suspendUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: "suspended" } : u))
  }

  const activateUser = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: "active" } : u))
  }

  const adjustUserCredits = (id: string, amount: number) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, creditsBalance: u.creditsBalance + amount } : u))
  }

  // Concierge actions
  const updateConciergeStatus = (id: string, status: ConciergeRequest["status"]) => {
    setConciergeRequests(prev => prev.map(r => r.id === id ? { 
      ...r, 
      status,
      resolvedAt: status === "resolved" ? new Date().toISOString() : r.resolvedAt
    } : r))
  }

  // AI Prompt actions
  const addPrompt = (prompt: Omit<AIPrompt, "id" | "usageCount" | "lastUsed">) => {
    const newPrompt: AIPrompt = {
      ...prompt,
      id: `p${Date.now()}`,
      usageCount: 0,
      lastUsed: new Date().toISOString().split("T")[0]
    }
    setAIPrompts(prev => [newPrompt, ...prev])
  }

  const updatePrompt = (id: string, data: Partial<AIPrompt>) => {
    setAIPrompts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }

  const togglePrompt = (id: string) => {
    setAIPrompts(prev => prev.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p))
  }

  // Template actions
  const addTemplate = (template: Omit<Template, "id" | "createdAt" | "usageCount">) => {
    const newTemplate: Template = {
      ...template,
      id: `tpl${Date.now()}`,
      usageCount: 0,
      createdAt: new Date().toISOString().split("T")[0]
    }
    setTemplates(prev => [newTemplate, ...prev])
  }

  const updateTemplate = (id: string, data: Partial<Template>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }

  const toggleTemplate = (id: string) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t))
  }

  const duplicateTemplate = (id: string) => {
    const template = templates.find(t => t.id === id)
    if (template) {
      addTemplate({
        name: `${template.name} (copia)`,
        type: template.type,
        content: template.content,
        isActive: false
      })
    }
  }

  // Credits actions
  const addCreditsPackage = (pkg: Omit<MasterCredits["packages"][0], "id">) => {
    setCredits(prev => ({
      ...prev,
      packages: [...prev.packages, { ...pkg, id: `pkg${Date.now()}` }]
    }))
  }

  const updateCreditsPackage = (id: string, data: Partial<MasterCredits["packages"][0]>) => {
    setCredits(prev => ({
      ...prev,
      packages: prev.packages.map(p => p.id === id ? { ...p, ...data } : p)
    }))
  }

  // Settings actions
  const updateSettings = (data: Partial<MasterSettings>) => {
    setSettings(prev => ({ ...prev, ...data }))
  }

  // Notification actions
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // Activity helper
  const addActivity = (type: Activity["type"], description: string, entityId: string, entityName: string) => {
    const newActivity: Activity = {
      id: `act${Date.now()}`,
      type,
      description,
      entityId,
      entityName,
      createdAt: new Date().toISOString()
    }
    setActivities(prev => [newActivity, ...prev.slice(0, 49)])
  }

  // Global search
  const searchGlobal = (query: string) => {
    const q = query.toLowerCase()
    return {
      agencies: agencies.filter(a => 
        a.name.toLowerCase().includes(q) || 
        a.owner.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      ),
      users: users.filter(u => 
        u.name.toLowerCase().includes(q) || 
        u.email.toLowerCase().includes(q)
      ),
      trips: trips.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.destination.toLowerCase().includes(q) ||
        t.userName?.toLowerCase().includes(q) ||
        t.agencyName?.toLowerCase().includes(q)
      )
    }
  }

  return (
    <MasterContext.Provider value={{
      agencies,
      users,
      trips,
      conciergeRequests,
      aiPrompts,
      templates,
      transactions,
      credits,
      activities,
      notifications,
      settings,
      stats,
      addAgency,
      updateAgency,
      suspendAgency,
      activateAgency,
      addUser,
      updateUser,
      suspendUser,
      activateUser,
      adjustUserCredits,
      updateConciergeStatus,
      addPrompt,
      updatePrompt,
      togglePrompt,
      addTemplate,
      updateTemplate,
      toggleTemplate,
      duplicateTemplate,
      addCreditsPackage,
      updateCreditsPackage,
      updateSettings,
      markNotificationRead,
      markAllNotificationsRead,
      searchGlobal
    }}>
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
