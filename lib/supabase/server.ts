import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./types"

export interface SupabaseServerConfig {
  url: string
  anonKey: string
  schema: "public"
}

export function hasSupabaseServerEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error("Supabase server config is missing. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.")
  }

  return {
    url,
    anonKey,
    schema: "public",
  }
}

export type SupabaseServerDatabase = Database

export async function createSupabaseServerClient() {
  if (!hasSupabaseServerEnv()) return null

  const cookieStore = await cookies()
  const { url, anonKey } = getSupabaseServerConfig()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Em alguns contextos server o cookie store e somente leitura.
        }
      },
    },
  })
}

export function createSupabaseServerClientPlaceholder() {
  if (!hasSupabaseServerEnv()) {
    return {
      status: "missing-env",
      message: "Supabase envs are not configured for the server client.",
    }
  }

  return {
    ...getSupabaseServerConfig(),
    status: "connected-helper",
    message: "Supabase server helper is configured and ready.",
  }
}

export type SupabaseServerClient = SupabaseClient<Database>
