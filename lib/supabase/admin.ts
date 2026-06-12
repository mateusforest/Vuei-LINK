import "server-only"

import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"

let adminClient: ReturnType<typeof createClient<Database>> | null = null

const MISSING_ADMIN_ENV_ERROR_CODE = "missing_supabase_admin_env"

function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  return {
    url,
    serviceRoleKey,
  }
}

export function hasSupabaseAdminEnv() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()
  return Boolean(url && serviceRoleKey)
}

export function isMissingSupabaseAdminEnvError(error: unknown) {
  return error instanceof Error && error.name === MISSING_ADMIN_ENV_ERROR_CODE
}

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  if (!hasSupabaseAdminEnv()) {
    const error = new Error("Supabase admin config is missing. Define NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    error.name = MISSING_ADMIN_ENV_ERROR_CODE
    throw error
  }

  if (!adminClient) {
    adminClient = createClient<Database>(
      url!,
      serviceRoleKey!,
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
