import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export async function getCurrentUser(client?: SupabaseClient<Database>): Promise<User | null> {
  const resolvedClient = client ?? (await createSupabaseServerClient())
  if (!resolvedClient) return null

  const {
    data: { user },
  } = await resolvedClient.auth.getUser()

  return user ?? null
}
