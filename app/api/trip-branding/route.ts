import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { resolveTripLinkAccess as resolveTripLinkRequest } from "@/lib/security/trip-link-access"
import { resolveAgencyBrandLogo } from "@/lib/trip-destination"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type AgencyRow = Database["public"]["Tables"]["agencies"]["Row"]
type AccessMode = "admin" | "public"

async function resolveTripByLinkAccess(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: AccessMode
}) {
  const supabase = createSupabaseAdminClient()

  if (params.accessMode === "admin" && !params.adminToken && (params.tripId || params.tripSlug)) {
    let query = supabase.from("trips").select("*")

    if (params.tripId) {
      query = query.eq("id", params.tripId)
    } else if (params.tripSlug) {
      query = query.eq("slug", params.tripSlug)
    }

    const { data, error } = await query.maybeSingle()
    return {
      trip: (data as TripRow | null) ?? null,
      error: error?.message ?? null,
    }
  }

  return resolveTripLinkRequest(supabase, {
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    adminToken: params.adminToken,
    publicToken: params.publicToken,
    accessMode: params.accessMode,
  })
}

async function resolveAgencyBranding(agencyId: string | null) {
  if (!agencyId) {
    return {
      agencyId: null,
      name: null,
      logoUrl: null,
      linkLogoUrl: null,
      isAgency: false,
    }
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("agencies")
    .select("id, name, logo_url, branding")
    .eq("id", agencyId)
    .maybeSingle()

  if (error) {
    return { error: error.message }
  }

  const agency = data as Pick<AgencyRow, "id" | "name" | "logo_url" | "branding"> | null
  const branding = agency?.branding && typeof agency.branding === "object"
    ? (agency.branding as { logoUrl?: string | null; linkLogoUrl?: string | null })
    : null

  return {
    agencyId,
    name: agency?.name ?? null,
    logoUrl: resolveAgencyBrandLogo(
      branding?.linkLogoUrl,
      branding?.logoUrl,
      agency?.logo_url ?? null,
    ),
    linkLogoUrl: branding?.linkLogoUrl ?? null,
    isAgency: true,
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." }, { status: 503 })
    }

    const url = new URL(request.url)
    const tripId = url.searchParams.get("tripId")
    const tripSlug = url.searchParams.get("tripSlug")
    const adminToken = url.searchParams.get("adminToken")
    const publicToken = url.searchParams.get("publicToken") || url.searchParams.get("token")
    const accessMode = (url.searchParams.get("accessMode") === "admin" ? "admin" : "public") as AccessMode

    const accessResult = await resolveTripByLinkAccess({
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode,
    })

    if (!accessResult.trip) {
      return NextResponse.json({ error: accessResult.error ?? "Acesso inv?lido." }, { status: 403 })
    }

    const agencyBranding = await resolveAgencyBranding(accessResult.trip.agency_id)
    if ("error" in agencyBranding) {
      return NextResponse.json({ error: agencyBranding.error }, { status: 500 })
    }

    return NextResponse.json(agencyBranding, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[TRIP][BRANDING] failed to resolve trip branding", error)

    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "N?o foi poss?vel carregar o branding da ag?ncia." }, { status: 500 })
  }
}
