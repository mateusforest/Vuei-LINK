import type { SupabaseClient } from "@supabase/supabase-js"
import type { Profile } from "@/types"
import type { Database } from "@/lib/supabase/types"

export function mapProfileRowToProfile(row: Database["public"]["Tables"]["profiles"]["Row"]): Profile {
  const settings = row.settings as Record<string, unknown>

  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role,
    agencyId: row.agency_id,
    creditsBalance: row.credits_balance,
    settings: {
      language: typeof settings.language === "string" ? settings.language : "pt-BR",
      darkMode: typeof settings.darkMode === "boolean" ? settings.darkMode : true,
      notificationsEnabled: typeof settings.notificationsEnabled === "boolean" ? settings.notificationsEnabled : true,
      biometricEnabled: typeof settings.biometricEnabled === "boolean" ? settings.biometricEnabled : false,
      pinEnabled: typeof settings.pinEnabled === "boolean" ? settings.pinEnabled : false,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function getCurrentProfile(userId: string, client?: SupabaseClient<Database>): Promise<Profile | null> {
  const resolvedClient = client ?? null
  if (!resolvedClient) return null

  const { data, error } = await resolvedClient.from("profiles").select("*").eq("id", userId).maybeSingle()

  if (error || !data) return null
  return mapProfileRowToProfile(data)
}
