import { NextRequest, NextResponse } from "next/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { resolveTripLinkAccess as resolveTripLinkRequest } from "@/lib/security/trip-link-access"
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
  return resolveTripLinkRequest(supabase, {
    tripId: params.tripId,
    tripSlug: params.tripSlug,
    adminToken: params.adminToken,
    publicToken: params.publicToken,
    accessMode: params.accessMode,
  })
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." },
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
      return NextResponse.json({ error: accessResult.error ?? "Acesso inv?lido." }, { status: 403 })
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
        { error: "N?o foi poss?vel identificar o traveler responsavel por esta viagem." },
        { status: 400 },
      )
    }

    const adminClient = createSupabaseAdminClient()
    const balanceResult = await getTravelerCreditBalance(adminClient, accessResult.trip.owner_user_id)

    if (balanceResult.error || !balanceResult.data) {
      return NextResponse.json(
        { error: balanceResult.error ?? "N?o foi poss?vel carregar o saldo real desta viagem." },
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
        { error: "A configura??o administrativa do servidor n?o ?sta dispon?vel no momento." },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "N?o foi poss?vel carregar os cr?ditos desta viagem." },
      { status: 500 },
    )
  }
}
