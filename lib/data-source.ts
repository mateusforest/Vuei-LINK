const SUPABASE_FLAG = "NEXT_PUBLIC_USE_SUPABASE_DATA"

export const USE_SUPABASE_DATA = process.env.NEXT_PUBLIC_USE_SUPABASE_DATA === "true"

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export type DataSource = "local" | "supabase"

export function shouldUseSupabase() {
  return USE_SUPABASE_DATA && hasSupabaseEnv
}

export function getDataSource(): DataSource {
  return shouldUseSupabase() ? "supabase" : "local"
}

export function getDataSourceDebugInfo() {
  return {
    source: getDataSource(),
    flags: {
      [SUPABASE_FLAG]: process.env.NEXT_PUBLIC_USE_SUPABASE_DATA ?? "false",
    },
    hasSupabaseEnv,
  }
}
