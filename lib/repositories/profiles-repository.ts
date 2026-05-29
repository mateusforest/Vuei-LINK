import type { Profile, UserRole } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"

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
    email: state.profile?.email || "viajante@email.com",
    name: state.profile?.name || "Viajante",
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
    },
    createdAt: now,
    updatedAt: now,
  }
}

export async function getProfile(id: string) {
  const profile = buildLocalProfile()
  return { source: "local" as const, data: profile.id === id ? profile : null }
}

export async function getProfileByEmail(email: string) {
  const profile = buildLocalProfile()
  return { source: "local" as const, data: profile.email === email ? profile : null }
}

export async function createProfile(payload: Omit<Profile, "createdAt" | "updatedAt">) {
  const now = new Date().toISOString()
  const profile: Profile = { ...payload, createdAt: now, updatedAt: now }

  if (shouldUseSupabase()) {
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
  const current = buildLocalProfile()
  if (current.id !== id) return { source: "local" as const, data: null as Profile | null }

  const nextProfile: Profile = {
    ...current,
    ...payload,
    settings: {
      ...current.settings,
      ...payload.settings,
    },
    updatedAt: new Date().toISOString(),
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: nextProfile,
    }
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
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: filtered,
    }
  }

  return { source: "local" as const, data: filtered }
}

export async function listProfilesByAgency(agencyId: string) {
  const profiles = [buildLocalProfile()].filter((profile) => profile.agencyId === agencyId)
  return { source: "local" as const, data: profiles }
}
