import type { Profile, UserRole } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"
import { mapProfileRowToProfile } from "@/lib/auth/get-current-profile"

interface PortalSettingsState {
  profile?: {
    name?: string
    email?: string
    phone?: string
    avatar?: string
  }
  settings?: {
    language?: string
    darkMode?: boolean
    notifications?: boolean
    faceId?: boolean
    pinEnabled?: boolean
  }
}

interface ListProfilesParams {
  role?: UserRole
  query?: string
}

function readProfileState(): PortalSettingsState {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem("vuei_portal_settings")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function buildLocalProfile(): Profile {
  const state = readProfileState()
  const now = new Date().toISOString()

  return {
    id: "local-traveler",
    email: state.profile?.email || "",
    name: state.profile?.name || "Conta",
    phone: state.profile?.phone || null,
    avatarUrl: state.profile?.avatar || null,
    role: "traveler",
    agencyId: null,
    creditsBalance: 150,
    settings: {
      language: state.settings?.language || "pt-BR",
      darkMode: state.settings?.darkMode ?? true,
      notificationsEnabled: state.settings?.notifications ?? true,
      biometricEnabled: state.settings?.faceId ?? false,
      pinEnabled: state.settings?.pinEnabled ?? false,
      quickAccess: null,
    },
    createdAt: now,
    updatedAt: now,
  }
}

export async function getProfile(id: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("profiles").select("*").eq("id", id).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null }
      }

      return { source: "supabase" as const, data: data ? mapProfileRowToProfile(data) : null }
    }
  }

  const profile = buildLocalProfile()
  return { source: "local" as const, data: profile.id === id ? profile : null }
}

export async function getProfileByEmail(email: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("profiles").select("*").eq("email", email).maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null }
      }

      return { source: "supabase" as const, data: data ? mapProfileRowToProfile(data) : null }
    }
  }

  const profile = buildLocalProfile()
  return { source: "local" as const, data: profile.email === email ? profile : null }
}

export async function createProfile(payload: Omit<Profile, "createdAt" | "updatedAt">) {
  const now = new Date().toISOString()
  const profile: Profile = { ...payload, createdAt: now, updatedAt: now }

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const insertPayload: Database["public"]["Tables"]["profiles"]["Insert"] = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        avatar_url: profile.avatarUrl,
        role: profile.role,
        agency_id: profile.agencyId,
        credits_balance: profile.creditsBalance ?? 0,
        settings: {
          language: profile.settings?.language ?? "pt-BR",
          darkMode: profile.settings?.darkMode ?? true,
          notificationsEnabled: profile.settings?.notificationsEnabled ?? true,
          biometricEnabled: profile.settings?.biometricEnabled ?? false,
          pinEnabled: profile.settings?.pinEnabled ?? false,
          quickAccess: profile.settings?.quickAccess ?? { enabled: false },
        },
      }

      const { data, error } = await client.from("profiles").insert(insertPayload).select("*").single()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null as Profile | null }
      }

      return { source: "supabase" as const, data: mapProfileRowToProfile(data) }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: profile,
    }
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      "vuei_portal_settings",
      JSON.stringify({
        profile: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          avatar: profile.avatarUrl,
        },
        settings: {
          language: profile.settings?.language ?? "pt-BR",
          darkMode: profile.settings?.darkMode ?? true,
          notifications: profile.settings?.notificationsEnabled ?? true,
          faceId: profile.settings?.biometricEnabled ?? false,
          pinEnabled: profile.settings?.pinEnabled ?? false,
        },
      })
    )
  }

  return { source: "local" as const, data: profile }
}

export async function updateProfile(id: string, payload: Partial<Profile>) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const currentRemote = await getProfile(id)
      const baseProfile = currentRemote.data ?? buildLocalProfile()
      const nextProfile: Profile = {
        ...baseProfile,
        ...payload,
        settings: {
          ...baseProfile.settings,
          ...payload.settings,
        },
        updatedAt: new Date().toISOString(),
      }

      const updatePayload: Database["public"]["Tables"]["profiles"]["Update"] = {
        email: nextProfile.email,
        name: nextProfile.name,
        phone: nextProfile.phone,
        avatar_url: nextProfile.avatarUrl,
        role: nextProfile.role,
        agency_id: nextProfile.agencyId,
        credits_balance: nextProfile.creditsBalance ?? 0,
        settings: {
          language: nextProfile.settings?.language ?? "pt-BR",
          darkMode: nextProfile.settings?.darkMode ?? true,
          notificationsEnabled: nextProfile.settings?.notificationsEnabled ?? true,
          biometricEnabled: nextProfile.settings?.biometricEnabled ?? false,
          pinEnabled: nextProfile.settings?.pinEnabled ?? false,
          quickAccess: nextProfile.settings?.quickAccess ?? { enabled: false },
        },
      }

      const { data, error } = await client.from("profiles").update(updatePayload).eq("id", id).select("*").maybeSingle()
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: null as Profile | null }
      }

      return { source: "supabase" as const, data: data ? mapProfileRowToProfile(data) : null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
    }
  }

  const current = buildLocalProfile()
  if (current.id !== id && id !== "local-traveler") return { source: "local" as const, data: null as Profile | null }

  const nextProfile: Profile = {
    ...current,
    ...payload,
    settings: {
      ...current.settings,
      ...payload.settings,
    },
    updatedAt: new Date().toISOString(),
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      "vuei_portal_settings",
      JSON.stringify({
        profile: {
          name: nextProfile.name,
          email: nextProfile.email,
          phone: nextProfile.phone,
          avatar: nextProfile.avatarUrl,
        },
        settings: {
          language: nextProfile.settings?.language ?? "pt-BR",
          darkMode: nextProfile.settings?.darkMode ?? true,
          notifications: nextProfile.settings?.notificationsEnabled ?? true,
          faceId: nextProfile.settings?.biometricEnabled ?? false,
          pinEnabled: nextProfile.settings?.pinEnabled ?? false,
        },
      })
    )
  }

  return { source: "local" as const, data: nextProfile }
}

export async function listProfiles(params?: ListProfilesParams) {
  const profiles = [buildLocalProfile()]
  const filtered = profiles.filter((profile) => {
    if (params?.role && profile.role !== params.role) return false
    if (params?.query) {
      const query = params.query.toLowerCase()
      return profile.name.toLowerCase().includes(query) || profile.email.toLowerCase().includes(query)
    }
    return true
  })

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      let query = client.from("profiles").select("*")
      if (params?.role) query = query.eq("role", params.role)
      if (params?.query) query = query.or(`name.ilike.%${params.query}%,email.ilike.%${params.query}%`)
      const { data, error } = await query
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: [] as Profile[] }
      }
      return { source: "supabase" as const, data: (data ?? []).map(mapProfileRowToProfile) }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: filtered,
    }
  }

  return { source: "local" as const, data: filtered }
}

export async function listProfilesByAgency(agencyId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.from("profiles").select("*").eq("agency_id", agencyId)
      if (error) {
        console.error("[AUTH ERROR]", error.message)
        return { source: "supabase" as const, data: [] as Profile[] }
      }
      return { source: "supabase" as const, data: (data ?? []).map(mapProfileRowToProfile) }
    }
  }

  const profiles = [buildLocalProfile()].filter((profile) => profile.agencyId === agencyId)
  return { source: "local" as const, data: profiles }
}
