import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

export interface SupabaseBrowserConfig {
  url: string
  anonKey: string
  schema: "public"
}

let browserClient: SupabaseClient<Database> | null = null

export function hasSupabaseBrowserEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseBrowserConfig(): SupabaseBrowserConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase browser config is missing. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  return {
    url,
    anonKey,
    schema: "public",
  }
}

export type SupabasePhase1Database = Database

export function createSupabaseBrowserClient() {
  if (typeof window === "undefined" || !hasSupabaseBrowserEnv()) return null

  if (!browserClient) {
    const { url, anonKey } = getSupabaseBrowserConfig()
    browserClient = createBrowserClient<Database>(url, anonKey)
  }

  return browserClient
}

export function createSupabaseBrowserClientPlaceholder() {
  if (!hasSupabaseBrowserEnv()) {
    return {
      status: "missing-env",
      message: "Supabase envs are not configured for the browser client.",
    }
  }

  return {
    ...getSupabaseBrowserConfig(),
    status: "connected-helper",
    message: "Supabase browser helper is configured and ready.",
  }
}
