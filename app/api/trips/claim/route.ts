import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { getTravelerCreditBalance } from "@/lib/billing/traveler-billing"
import { hashPendingTripClaimToken } from "@/lib/server/pending-trip-claim"
import { mapTripRowToTrip } from "@/lib/trips/trip-record"
import { FREE_PLAN_TRIP_LIMIT_ERROR_MESSAGE } from "@/lib/trips/trip-policies"

function unauthorized(error: string) {
  return NextResponse.json({ error }, { status: 401 })
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

function definitiveClaimError(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 })
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Supabase admin indisponível para assumir a viagem." }, { status: 503 })
  }

  const serverClient = await createSupabaseServerClient()
  if (!serverClient) {
    return unauthorized("Sessão indisponível.")
  }

  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser()

  if (authError || !user) {
    return unauthorized("Login obrigatório para assumir a viagem.")
  }

  let body: { claimToken?: string }

  try {
    body = await request.json()
  } catch {
    return badRequest("Payload inválido.")
  }

  const claimToken = body.claimToken?.trim()
  if (!claimToken) {
    return badRequest("Claim token obrigatório.")
  }

  try {
    const supabase = createSupabaseAdminClient()
    const billingStatus = await getTravelerCreditBalance(supabase, user.id)
    if (billingStatus.error || !billingStatus.data) {
      return NextResponse.json(
        { error: billingStatus.error ?? "Não foi possível validar seu plano atual." },
        { status: 500 },
      )
    }

    const maxActiveTrips = billingStatus.data.currentPlan === "premium" ? null : 1
    const claimTokenHash = hashPendingTripClaimToken(claimToken)
    const { data: claimResult, error: claimRpcError } = await supabase.rpc("claim_pending_trip_with_limit", {
      p_claim_token_hash: claimTokenHash,
      p_user_id: user.id,
      p_max_active_trips: maxActiveTrips,
    })

    if (claimRpcError) {
      console.error("[TRIP] claim rpc error", claimRpcError)
      return NextResponse.json({ error: "Não foi possível concluir a posse da viagem." }, { status: 500 })
    }

    const claimStatus = typeof claimResult?.status === "string" ? claimResult.status : null

    if (claimStatus === "invalid") {
      return definitiveClaimError("Posse temporária inválida ou já utilizada.", "claim_invalid")
    }

    if (claimStatus === "expired") {
      return definitiveClaimError("Posse temporária expirada. Gere uma nova viagem para continuar.", "claim_expired")
    }

    if (claimStatus === "already_claimed") {
      return definitiveClaimError("Esta viagem já foi reivindicada.", "claim_already_claimed")
    }

    if (claimStatus === "limit_exceeded") {
      return NextResponse.json({ error: FREE_PLAN_TRIP_LIMIT_ERROR_MESSAGE, code: "claim_limit_exceeded" }, { status: 409 })
    }

    if (claimStatus !== "claimed" || typeof claimResult?.trip_id !== "string") {
      return NextResponse.json({ error: "Não foi possível concluir a posse da viagem." }, { status: 500 })
    }

    const { data: claimedRow, error: claimError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", claimResult.trip_id)
      .maybeSingle()

    if (claimError || !claimedRow) {
      console.error("[TRIP] claim update error", claimError)
      return NextResponse.json({ error: "Não foi possível concluir a posse da viagem." }, { status: 500 })
    }

    return NextResponse.json({
      trip: mapTripRowToTrip(claimedRow),
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "Supabase admin indisponível para assumir a viagem." }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : "Não foi possível concluir a posse da viagem."
    console.error("[TRIP] claim route error", message)
    return NextResponse.json({ error: "Não foi possível concluir a posse da viagem." }, { status: 500 })
  }
}
