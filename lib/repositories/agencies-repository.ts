import type { Agency } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"
import { mapAgencySettingsToAgency } from "@/lib/mappers/agency-mappers"

export interface AgencyMember {
  id: string
  agencyId: string
  profileId: string
  role: string
  status: string
  createdAt: string
  name?: string
  email?: string
  avatarUrl?: string
}

interface CreateAgencyPayload {
  name: string
  ownerUserId: string
  email?: string | null
  phone?: string | null
  plan?: Agency["plan"]
  agentsCount?: string | null
}

interface RepositoryAgencyResult {
  source: "local" | "supabase" | "supabase-placeholder"
  data: Agency | null
  error: string | null
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

function slugifyAgencyName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return base || "agencia-vuei"
}

function mapAgencyRowToAgency(row: Database["public"]["Tables"]["agencies"]["Row"]): Agency {
  const settings = (row.settings ?? {}) as Record<string, unknown>
  const notifications = (settings.notifications ?? {}) as Record<string, unknown>
  const branding = (row.branding ?? {}) as Record<string, unknown>

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logo: row.logo_url,
    ownerUserId: row.owner_user_id,
    plan: row.plan,
    status: row.status,
    creditsBalance: row.credits_balance,
    settings: {
      email: typeof settings.email === "string" ? settings.email : null,
      phone: typeof settings.phone === "string" ? settings.phone : null,
      cnpj: typeof settings.cnpj === "string" ? settings.cnpj : null,
      address: typeof settings.address === "string" ? settings.address : null,
      notifications: {
        concierge: typeof notifications.concierge === "boolean" ? notifications.concierge : true,
        trips: typeof notifications.trips === "boolean" ? notifications.trips : true,
        credits: typeof notifications.credits === "boolean" ? notifications.credits : true,
        newClients: typeof notifications.newClients === "boolean" ? notifications.newClients : false,
      },
      twoFactorEnabled: typeof settings.twoFactorEnabled === "boolean" ? settings.twoFactorEnabled : false,
    },
    branding: {
      logoUrl: typeof branding.logoUrl === "string" ? branding.logoUrl : row.logo_url,
      linkLogoUrl: typeof branding.linkLogoUrl === "string" ? branding.linkLogoUrl : null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function buildUniqueAgencySlug(baseName: string, client: ReturnType<typeof createSupabaseBrowserClient>) {
  const safeBase = slugifyAgencyName(baseName)
  if (!client) return safeBase

  let candidate = safeBase
  let suffix = 2

  while (true) {
    const { data, error } = await client.from("agencies").select("id").eq("slug", candidate).maybeSingle()
    if (error || !data) return candidate
    candidate = `${safeBase}-${suffix}`
    suffix += 1
  }
}

export async function createAgency(payload: CreateAgencyPayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()

    if (client) {
      const existingAgency = await getAgencyByOwner(payload.ownerUserId)
      if (existingAgency.data) {
        return { source: existingAgency.source, data: existingAgency.data, error: null } satisfies RepositoryAgencyResult
      }

      const slug = await buildUniqueAgencySlug(payload.name, client)
      const insertPayload: Database["public"]["Tables"]["agencies"]["Insert"] = {
        name: payload.name,
        slug,
        owner_user_id: payload.ownerUserId,
        plan: payload.plan ?? "starter",
        status: "active",
        settings: {
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          notifications: {
            concierge: true,
            trips: true,
            credits: true,
            newClients: false,
          },
          agentsCount: payload.agentsCount ?? null,
          twoFactorEnabled: false,
        },
        branding: {},
      }

      const { data, error } = await client.from("agencies").insert(insertPayload).select("*").single()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null, error: error.message }
      }

      const { error: membershipError } = await client.from("agency_members").insert({
        agency_id: data.id,
        profile_id: payload.ownerUserId,
        role: "owner",
        status: "active",
      })

      if (membershipError) {
        console.error("[AUTH ERROR]", membershipError.message)
        await client.from("agencies").delete().eq("id", data.id)
        return {
          source: "supabase" as const,
          data: null,
          error: `Agencia criada, mas falhou ao criar o vinculo do owner: ${membershipError.message}`,
        }
      }

      const { error: profileError } = await client.from("profiles").update({ agency_id: data.id, role: "agency_owner" }).eq("id", payload.ownerUserId)
      if (profileError) {
        console.error("[AUTH ERROR]", profileError.message)
        await client.from("agency_members").delete().eq("agency_id", data.id).eq("profile_id", payload.ownerUserId)
        await client.from("agencies").delete().eq("id", data.id)
        return {
          source: "supabase" as const,
          data: null,
          error: `Agencia criada, mas falhou ao atualizar o profile: ${profileError.message}`,
        }
      }

      return { source: "supabase" as const, data: mapAgencyRowToAgency(data), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const agency = buildAgency()
  return { source: "local" as const, data: agency, error: null }
}

export async function getAgencyById(id: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agencies").select("*").eq("id", id).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null, error: error.message }
      }
      return { source: "supabase" as const, data: data ? mapAgencyRowToAgency(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.id === id ? agency : null,
    error: null,
  }
}

export async function listAgencies() {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agencies").select("*").order("created_at", { ascending: false })
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: [] as Agency[], error: error.message }
      }
      return { source: "supabase" as const, data: (data ?? []).map(mapAgencyRowToAgency), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      data: [] as Agency[],
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()
  return { source: "local" as const, data: agency ? [agency] : [], error: null }
}

export async function getAgencyBySlug(slug: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agencies").select("*").eq("slug", slug).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null, error: error.message }
      }
      return { source: "supabase" as const, data: data ? mapAgencyRowToAgency(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.slug === slug ? agency : null,
    error: null,
  }
}

export async function getAgencyByOwner(userId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agencies").select("*").eq("owner_user_id", userId).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null, error: error.message }
      }
      return { source: "supabase" as const, data: data ? mapAgencyRowToAgency(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()
  return {
    source: "local" as const,
    data: agency.ownerUserId === userId ? agency : agency.ownerUserId === null ? agency : null,
    error: null,
  }
}

export async function updateAgency(id: string, payload: Partial<Agency>) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const updatePayload: Database["public"]["Tables"]["agencies"]["Update"] = {
        name: payload.name,
        slug: payload.slug,
        logo_url: payload.logo,
        owner_user_id: payload.ownerUserId,
        plan: payload.plan,
        status: payload.status,
        credits_balance: payload.creditsBalance,
        settings: payload.settings
          ? {
              email: payload.settings.email,
              phone: payload.settings.phone,
              cnpj: payload.settings.cnpj,
              address: payload.settings.address,
              notifications: payload.settings.notifications,
              twoFactorEnabled: payload.settings.twoFactorEnabled,
            }
          : undefined,
        branding: payload.branding
          ? {
              logoUrl: payload.branding.logoUrl,
              linkLogoUrl: payload.branding.linkLogoUrl ?? undefined,
            }
          : undefined,
      }

      const { data, error } = await client.from("agencies").update(updatePayload).eq("id", id).select("*").maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null, error: error.message }
      }

      return { source: "supabase" as const, data: data ? mapAgencyRowToAgency(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()

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

  return { source: "local" as const, data: buildAgency(), error: null }
}

export async function listAgencyMembers(agencyId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agency_members").select("*").eq("agency_id", agencyId)
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: [] as AgencyMember[], error: error.message }
      }

      const profileIds = (data ?? []).map((member) => member.profile_id)
      const { data: profilesData, error: profilesError } = profileIds.length > 0
        ? await client.from("profiles").select("id, email, name, avatar_url").in("id", profileIds)
        : { data: [], error: null }

      if (profilesError) {
        console.error("[AUTH ERROR]", profilesError.message)
      }

      const profileMap = new Map(
        (profilesData ?? []).map((profile) => [
          profile.id,
          {
            name: profile.name,
            email: profile.email,
            avatarUrl: profile.avatar_url,
          },
        ]),
      )

      return {
        source: "supabase" as const,
        data: (data ?? []).map((member) => ({
          id: member.id,
          agencyId: member.agency_id,
          profileId: member.profile_id,
          role: member.role,
          status: member.status,
          createdAt: member.created_at,
          name: profileMap.get(member.profile_id)?.name ?? undefined,
          email: profileMap.get(member.profile_id)?.email ?? undefined,
          avatarUrl: profileMap.get(member.profile_id)?.avatarUrl ?? undefined,
        })),
        error: profilesError?.message ?? null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      data: [] as AgencyMember[],
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  return { source: "local" as const, data: buildAgencyMembers(agencyId), error: null }
}

export async function listAllAgencyMembers() {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agency_members").select("*").order("created_at", { ascending: false })
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: [] as AgencyMember[], error: error.message }
      }

      return {
        source: "supabase" as const,
        data: (data ?? []).map((member) => ({
          id: member.id,
          agencyId: member.agency_id,
          profileId: member.profile_id,
          role: member.role,
          status: member.status,
          createdAt: member.created_at,
        })),
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      data: [] as AgencyMember[],
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
    }
  }

  const agency = buildAgency()
  return { source: "local" as const, data: agency ? buildAgencyMembers(agency.id) : [], error: null }
}

export async function addAgencyMember(payload: Omit<AgencyMember, "id" | "createdAt">) {
  const member: AgencyMember = {
    ...payload,
    id: `agency-member-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agency_members").insert({
        agency_id: payload.agencyId,
        profile_id: payload.profileId,
        role: payload.role as Database["public"]["Tables"]["agency_members"]["Insert"]["role"],
        status: payload.status as Database["public"]["Tables"]["agency_members"]["Insert"]["status"],
      }).select("*").single()

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null as AgencyMember | null, error: error.message }
      }

      return {
        source: "supabase" as const,
        data: {
          id: data.id,
          agencyId: data.agency_id,
          profileId: data.profile_id,
          role: data.role,
          status: data.status,
          createdAt: data.created_at,
          name: payload.name,
          email: payload.email,
          avatarUrl: payload.avatarUrl,
        },
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null as AgencyMember | null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
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

  return { source: "local" as const, data: member, error: null }
}

export async function updateAgencyMember(id: string, payload: Partial<AgencyMember>) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("agency_members").update({
        role: payload.role as Database["public"]["Tables"]["agency_members"]["Update"]["role"],
        status: payload.status as Database["public"]["Tables"]["agency_members"]["Update"]["status"],
      }).eq("id", id).select("*").maybeSingle()

      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null as AgencyMember | null, error: error.message }
      }

      return {
        source: "supabase" as const,
        data: data
          ? {
              id: data.id,
              agencyId: data.agency_id,
              profileId: data.profile_id,
              role: data.role,
              status: data.status,
              createdAt: data.created_at,
              name: payload.name,
              email: payload.email,
              avatarUrl: payload.avatarUrl,
            }
          : null,
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      data: null as AgencyMember | null,
      error: "Supabase browser client indisponivel.",
      config: createSupabaseBrowserClientPlaceholder(),
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

  return { source: "local" as const, data: updatedMember, error: null }
}
