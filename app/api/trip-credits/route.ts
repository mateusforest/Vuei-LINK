import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { getTravelerCreditBalance } from "@/lib/billing/traveler-billing"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
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

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { error: "A configuracao administrativa do servidor nao esta disponivel no momento." },
        { status: 503 },
      )
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

    if (accessResult.trip.agency_id) {
      return NextResponse.json(
        {
          hidden: true,
          isAgencyTrip: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      )
    }

    if (!accessResult.trip.owner_user_id) {
      return NextResponse.json(
        { error: "Nao foi possivel identificar o traveler responsavel por esta viagem." },
        { status: 400 },
      )
    }

    const adminClient = createSupabaseAdminClient()
    const balanceResult = await getTravelerCreditBalance(adminClient, accessResult.trip.owner_user_id)

    if (balanceResult.error || !balanceResult.data) {
      return NextResponse.json(
        { error: balanceResult.error ?? "Nao foi possivel carregar o saldo real desta viagem." },
        { status: 500 },
      )
    }

    return NextResponse.json(
      {
        hidden: false,
        isAgencyTrip: false,
        balance: balanceResult.data.totalAvailable,
        planCreditsAvailable: balanceResult.data.planCreditsAvailable,
        purchasedCreditsAvailable: balanceResult.data.purchasedCreditsAvailable,
        currentPeriodEnd: balanceResult.data.currentPeriodEnd,
        currentPlan: balanceResult.data.currentPlan,
        subscriptionStatus: balanceResult.data.subscriptionStatus,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("[TRIP][CREDITS] failed to resolve trip credits", error)

    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json(
        { error: "A configuracao administrativa do servidor nao esta disponivel no momento." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar os creditos desta viagem." },
      { status: 500 },
    )
  }
}
