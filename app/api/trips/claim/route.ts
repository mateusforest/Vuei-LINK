import { NextResponse } from "next/server"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { hashPendingTripClaimToken } from "@/lib/server/pending-trip-claim"
import { mapTripRowToTrip } from "@/lib/trips/trip-record"
import { createWalletService } from "@/lib/wallet"

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
    return NextResponse.json({ error: "Supabase admin indisponivel para assumir a viagem." }, { status: 503 })
  }

  const serverClient = await createSupabaseServerClient()
  if (!serverClient) {
    return unauthorized("Sessao indisponivel.")
  }

  const {
    data: { user },
    error: authError,
  } = await serverClient.auth.getUser()

  if (authError || !user) {
    return unauthorized("Login obrigatorio para assumir a viagem.")
  }

  let body: { claimToken?: string }

  try {
    body = await request.json()
  } catch {
    return badRequest("Payload invalido.")
  }

  const claimToken = body.claimToken?.trim()
  if (!claimToken) {
    return badRequest("Claim token obrigatorio.")
  }

  try {
    const profile = await ensureProfile(user, serverClient)
    if (!profile || profile.role !== "traveler") {
      return NextResponse.json(
        { error: "Esta rota esta disponivel apenas para viajantes." },
        { status: 403 },
      )
    }

    const supabase = createSupabaseAdminClient()
    const walletService = createWalletService(supabase)
    const claimResult = await walletService.claimPendingTripWithWallet({
      claimTokenHash: hashPendingTripClaimToken(claimToken),
      userId: user.id,
    })

    if (claimResult.status === "invalid") {
      return definitiveClaimError("Posse temporaria invalida ou ja utilizada.", "claim_invalid")
    }

    if (claimResult.status === "expired") {
      return definitiveClaimError("Posse temporaria expirada. Gere uma nova viagem para continuar.", "claim_expired")
    }

    if (claimResult.status === "already_claimed") {
      return definitiveClaimError("Esta viagem ja foi reivindicada.", "claim_already_claimed")
    }

    if (claimResult.status !== "claimed" || !claimResult.tripId) {
      return NextResponse.json({ error: "Nao foi possivel concluir a posse da viagem." }, { status: 500 })
    }

    const { data: claimedRow, error: claimError } = await supabase
      .from("trips")
      .select("*")
      .eq("id", claimResult.tripId)
      .maybeSingle()

    if (claimError || !claimedRow) {
      console.error("[TRIP] claim update error", claimError)
      return NextResponse.json({ error: "Nao foi possivel concluir a posse da viagem." }, { status: 500 })
    }

    return NextResponse.json({
      trip: mapTripRowToTrip(claimedRow),
    })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "Supabase admin indisponivel para assumir a viagem." }, { status: 503 })
    }

    const message = error instanceof Error ? error.message : "Nao foi possivel concluir a posse da viagem."
    console.error("[TRIP] claim route error", message)
    return NextResponse.json({ error: "Nao foi possivel concluir a posse da viagem." }, { status: 500 })
  }
}
