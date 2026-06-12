import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

let adminClient: ReturnType<typeof createClient<Database>> | null = null

export function hasSupabaseAdminEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export function createSupabaseAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    throw new Error("Supabase admin config is missing. Define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  }

  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )
  }

  return adminClient
}
