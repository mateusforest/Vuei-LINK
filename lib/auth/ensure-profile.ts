import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getCurrentProfile } from "@/lib/auth/get-current-profile"

const DEFAULT_TRAVELER_CREDITS = 0
type ProfileRole = Database["public"]["Tables"]["profiles"]["Row"]["role"]

const ALLOWED_PROFILE_ROLES = new Set<ProfileRole>(["traveler", "agency_owner", "agency_member", "master"])

function getUserRole(user: User): ProfileRole {
  const role = user.user_metadata?.role

  if (typeof role === "string" && ALLOWED_PROFILE_ROLES.has(role as ProfileRole)) {
    return role as ProfileRole
  }

  return "traveler"
}

function getUserName(user: User) {
  return (
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    (user.email ? user.email.split("@")[0] : "Viajante")
  )
}

export async function ensureProfile(user: User, client?: SupabaseClient<Database>) {
  const resolvedClient = client ?? null
  if (!resolvedClient) return null

  const existingProfile = await getCurrentProfile(user.id, resolvedClient)
  const nextRole = getUserRole(user)
  const nextName = getUserName(user)
  const nextPhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null
  const nextAvatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null

  if (existingProfile) {
    const updates: Database["public"]["Tables"]["profiles"]["Update"] = {}

    if (!existingProfile.email || existingProfile.email !== (user.email ?? "")) {
      updates.email = user.email ?? existingProfile.email
    }
    if (!existingProfile.name || existingProfile.name === "Viajante") {
      updates.name = nextName
    }
    if (!existingProfile.phone && nextPhone) {
      updates.phone = nextPhone
    }
    if (!existingProfile.avatarUrl && nextAvatarUrl) {
      updates.avatar_url = nextAvatarUrl
    }
    if (existingProfile.role !== nextRole && nextRole !== "traveler") {
      updates.role = nextRole
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await (resolvedClient.from("profiles") as any).update(updates as any).eq("id", user.id)
      if (error) {
        console.error("[AUTH ERROR]", error.message)
      }
    }

    return getCurrentProfile(user.id, resolvedClient)
  }

  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    email: user.email ?? "",
    name: nextName,
    phone: nextPhone,
    avatar_url: nextAvatarUrl,
    role: nextRole,
    credits_balance: DEFAULT_TRAVELER_CREDITS,
    settings: {
      language: "pt-BR",
      darkMode: true,
      notificationsEnabled: true,
      biometricEnabled: false,
      pinEnabled: false,
      quickAccess: {
        enabled: false,
      },
    },
  }

  const { error } = await (resolvedClient.from("profiles") as any).insert(payload as any)
  if (error) {
    console.error("[AUTH ERROR]", error.message)
    return null
  }

  return getCurrentProfile(user.id, resolvedClient)
}
