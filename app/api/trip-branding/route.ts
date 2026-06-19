import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
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

  let query = supabase.from("trips").select("*")
  if (params.tripId) {
    query = query.eq("id", params.tripId)
  } else if (params.tripSlug) {
    query = query.eq("slug", params.tripSlug)
  } else if (params.accessMode === "admin" && params.adminToken) {
    query = query.eq("admin_token", params.adminToken)
  } else if (params.accessMode === "public" && params.publicToken) {
    query = query.eq("public_token", params.publicToken)
  } else {
    return { trip: null as TripRow | null, error: "Link da viagem invalido." }
  }

  const { data, error } = await query.maybeSingle()
  if (error) {
    return { trip: null as TripRow | null, error: error.message }
  }

  const trip = data as TripRow | null
  if (!trip) {
    return { trip: null as TripRow | null, error: "Viagem nao encontrada." }
  }

  if (params.accessMode === "admin") {
    const tokenMatches = Boolean(params.adminToken && trip.admin_token === params.adminToken)
    const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug)

    if (!tokenMatches && !slugMatches) {
      return { trip: null as TripRow | null, error: "Acesso administrativo invalido para este link." }
    }
  } else {
    const tokenMatches = Boolean(params.publicToken && trip.public_token === params.publicToken)
    const slugMatches = Boolean(params.tripSlug && trip.slug === params.tripSlug && trip.visibility === "public")

    if (trip.visibility !== "public") {
      return { trip: null as TripRow | null, error: "Esta viagem nao esta disponivel publicamente." }
    }

    if (!tokenMatches && !slugMatches) {
      return { trip: null as TripRow | null, error: "Acesso publico invalido para este link." }
    }
  }

  return { trip, error: null as string | null }
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
      return NextResponse.json({ error: "A configuracao administrativa do servidor nao esta disponivel no momento." }, { status: 503 })
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
      return NextResponse.json({ error: accessResult.error ?? "Acesso invalido." }, { status: 403 })
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
      return NextResponse.json({ error: "A configuracao administrativa do servidor nao esta disponivel no momento." }, { status: 503 })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Nao foi possivel carregar o branding da agencia." }, { status: 500 })
  }
}
