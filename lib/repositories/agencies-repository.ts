import type { Agency } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { mapAgencySettingsToAgency } from "@/lib/mappers/agency-mappers"

interface AgencyMember {
  id: string
  agencyId: string
  profileId: string
  role: string
  status: string
  createdAt: string
  name?: string
  email?: string
}

interface AgencyConfigState {
  agencyData?: {
    name?: string
    email?: string
    phone?: string
    cnpj?: string
    address?: string
    logo?: string
    plan?: string
  }
  notifications?: {
    concierge?: boolean
    trips?: boolean
    credits?: boolean
    newClients?: boolean
  }
}

function readAgencyConfig(): AgencyConfigState {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem("vuei_agencia_configuracoes_frontend")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function readAgencyWorkspace() {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem("vuei_agency")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function buildAgency() {
  const config = readAgencyConfig()
  const workspace = readAgencyWorkspace()
  const creditsBalance = typeof workspace?.credits?.balance === "number" ? workspace.credits.balance : 0

  return mapAgencySettingsToAgency(config.agencyData ?? {}, config.notifications ?? {}, creditsBalance)
}

function buildAgencyMembers(agencyId: string): AgencyMember[] {
  const workspace = readAgencyWorkspace()
  const teamMembers = Array.isArray(workspace?.teamMembers) ? workspace.teamMembers : []

  return teamMembers.map((member: Record<string, unknown>) => ({
    id: typeof member.id === "string" ? member.id : `member-${Date.now()}`,
    agencyId,
    profileId: typeof member.id === "string" ? member.id : `profile-${Date.now()}`,
    role: typeof member.role === "string" ? member.role : "member",
    status: typeof member.status === "string" ? member.status : "active",
    createdAt: typeof member.createdAt === "string" ? member.createdAt : new Date().toISOString(),
    name: typeof member.name === "string" ? member.name : undefined,
    email: typeof member.email === "string" ? member.email : undefined,
  }))
}

export async function getAgencyById(id: string) {
  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.id === id ? agency : null,
  }
}

export async function getAgencyBySlug(slug: string) {
  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.slug === slug ? agency : null,
  }
}

export async function getAgencyByOwner(userId: string) {
  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.ownerUserId === userId ? agency : agency.ownerUserId === null ? agency : null,
  }
}

export async function updateAgency(id: string, payload: Partial<Agency>) {
  const agency = buildAgency()

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: agency.id === id ? { ...agency, ...payload, updatedAt: new Date().toISOString() } : null,
    }
  }

  const config = readAgencyConfig()
  const nextConfig = {
    ...config,
    agencyData: {
      ...config.agencyData,
      name: payload.name ?? config.agencyData?.name,
      email: payload.settings?.email ?? config.agencyData?.email,
      phone: payload.settings?.phone ?? config.agencyData?.phone,
      cnpj: payload.settings?.cnpj ?? config.agencyData?.cnpj,
      address: payload.settings?.address ?? config.agencyData?.address,
      logo: payload.logo ?? payload.branding?.logoUrl ?? config.agencyData?.logo,
      plan: payload.plan ?? config.agencyData?.plan,
    },
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("vuei_agencia_configuracoes_frontend", JSON.stringify(nextConfig))
  }

  return { source: "local" as const, data: buildAgency() }
}

export async function listAgencyMembers(agencyId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as AgencyMember[],
    }
  }

  return { source: "local" as const, data: buildAgencyMembers(agencyId) }
}

export async function addAgencyMember(payload: Omit<AgencyMember, "id" | "createdAt">) {
  const member: AgencyMember = {
    ...payload,
    id: `agency-member-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: member,
    }
  }

  const workspace = readAgencyWorkspace()
  const teamMembers = Array.isArray(workspace?.teamMembers) ? workspace.teamMembers : []
  const nextWorkspace = {
    ...workspace,
    teamMembers: [
      {
        id: member.id,
        name: member.name ?? "Novo membro",
        email: member.email ?? "",
        role: member.role,
        status: member.status,
        createdAt: member.createdAt,
      },
      ...teamMembers,
    ],
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem("vuei_agency", JSON.stringify(nextWorkspace))
  }

  return { source: "local" as const, data: member }
}

export async function updateAgencyMember(id: string, payload: Partial<AgencyMember>) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as AgencyMember | null,
    }
  }

  const workspace = readAgencyWorkspace()
  let updatedMember: AgencyMember | null = null
  const teamMembers = (Array.isArray(workspace?.teamMembers) ? workspace.teamMembers : []).map((member: Record<string, unknown>) => {
    if (member.id !== id) return member
    const nextMember = { ...member, ...payload }
    updatedMember = {
      id,
      agencyId: payload.agencyId ?? "agency-frontend",
      profileId: payload.profileId ?? id,
      role: typeof nextMember.role === "string" ? nextMember.role : "member",
      status: typeof nextMember.status === "string" ? nextMember.status : "active",
      createdAt: typeof nextMember.createdAt === "string" ? nextMember.createdAt : new Date().toISOString(),
      name: typeof nextMember.name === "string" ? nextMember.name : undefined,
      email: typeof nextMember.email === "string" ? nextMember.email : undefined,
    }
    return nextMember
  })

  if (typeof window !== "undefined") {
    window.localStorage.setItem("vuei_agency", JSON.stringify({ ...workspace, teamMembers }))
  }

  return { source: "local" as const, data: updatedMember }
}
