import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

type TripDbClient = SupabaseClient<Database>

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isMatchingTripSlug(slug: string, baseSlug: string) {
  const matcher = new RegExp(`^${escapeRegExp(baseSlug)}(?:-\\d+)?$`)
  return matcher.test(slug)
}

export function isTripSlugConflict(error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined) {
  if (!error) return false

  const diagnostic = [error.code, error.message, error.details].filter(Boolean).join(" ")
  return error.code === "23505" && /trips_slug_key/i.test(diagnostic)
}

export async function listExistingTripSlugs(client: TripDbClient, baseSlug: string) {
  const { data, error } = await client.from("trips").select("slug").like("slug", `${baseSlug}%`)

  if (error) {
    console.error("[TRIP] slug lookup error", error)
    return []
  }

  return (data ?? [])
    .map((row) => row.slug)
    .filter((slug): slug is string => typeof slug === "string" && isMatchingTripSlug(slug, baseSlug))
}
