import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { getCurrentProfile } from "@/lib/auth/get-current-profile"

const DEFAULT_TRAVELER_CREDITS = 150
const ALLOWED_PROFILE_ROLES = new Set(["traveler", "agency_owner", "agency_member", "master"])

export async function ensureProfile(user: User, client?: SupabaseClient<Database>) {
  const resolvedClient = client ?? null
  if (!resolvedClient) return null

  const existingProfile = await getCurrentProfile(user.id, resolvedClient)
  if (existingProfile) return existingProfile

  const payload: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: user.id,
    email: user.email ?? "",
    name:
      (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
      (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
      (user.email ? user.email.split("@")[0] : "Viajante"),
    phone: typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null,
    avatar_url: typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null,
    role:
      typeof user.user_metadata?.role === "string" && ALLOWED_PROFILE_ROLES.has(user.user_metadata.role)
        ? user.user_metadata.role
        : "traveler",
    credits_balance: DEFAULT_TRAVELER_CREDITS,
    settings: {
      language: "pt-BR",
      darkMode: true,
      notificationsEnabled: true,
      biometricEnabled: false,
      pinEnabled: false,
    },
  }

  const { error } = await resolvedClient.from("profiles").insert(payload)
  if (error) return null

  return getCurrentProfile(user.id, resolvedClient)
}
