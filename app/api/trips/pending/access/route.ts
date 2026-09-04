import { NextResponse } from "next/server"
import { buildAdminTripUrl, buildPublicTripUrl } from "@/lib/security/link-tokens"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { hashPendingTripClaimToken, isPendingTripClaimExpired } from "@/lib/server/pending-trip-claim"
import { checkRateLimit, getRequestIp } from "@/lib/server/request-rate-limit"
import { mapTripRowToTrip } from "@/lib/trips/trip-record"
import type { Database } from "@/lib/supabase/types"

export const runtime = "nodejs"

const CLAIM_TOKEN_PATTERN = /^[a-f0-9]{64}$/i
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACCESS_ATTEMPT_LIMIT = 30
const ACCESS_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  }
}

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status, headers: responseHeaders() })
}

function mapPendingDraft(row: TripRow) {
  const trip = mapTripRowToTrip(row)

  return {
    ...trip,
    adminToken: null,
    publicToken: null,
    adminLink: buildAdminTripUrl(row.slug),
    publicLink: buildPublicTripUrl(row.slug),
    linkActivationTransactionId: null,
    creditsSummary: null,
  }
}

export async function POST(request: Request) {
  if (!hasSupabaseAdminEnv()) {
    return errorResponse("Supabase indisponivel para abrir o rascunho.", "supabase_unavailable", 503)
  }

  const ip = getRequestIp(request)
  const rateLimit = checkRateLimit(`pending-trip-access:${ip}`, {
    limit: ACCESS_ATTEMPT_LIMIT,
    windowMs: ACCESS_ATTEMPT_WINDOW_MS,
  })

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos.", code: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          ...responseHeaders(),
          "Retry-After": String(Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1)),
        },
      },
    )
  }

  let body: { tripId?: string; tripSlug?: string; claimToken?: string }
  try {
    body = await request.json()
  } catch {
    return errorResponse("Payload invalido.", "invalid_payload", 400)
  }

  const tripId = body.tripId?.trim()
  const tripSlug = body.tripSlug?.trim()
  const claimToken = body.claimToken?.trim()

  if (!tripId || !UUID_PATTERN.test(tripId) || !tripSlug || !claimToken || !CLAIM_TOKEN_PATTERN.test(claimToken)) {
    return errorResponse("Referencia local do rascunho invalida.", "pending_access_invalid", 400)
  }

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .eq("slug", tripSlug)
      .eq("claim_token_hash", hashPendingTripClaimToken(claimToken))
      .eq("owner_type", "traveler")
      .maybeSingle()

    if (error) {
      console.error("[TRIP] pending access lookup error", error)
      return errorResponse("Nao foi possivel abrir o rascunho.", "pending_access_failed", 500)
    }

    const trip = data as TripRow | null
    if (!trip) {
      return errorResponse("Rascunho nao encontrado neste navegador.", "pending_access_invalid", 403)
    }

    if (trip.owner_user_id || trip.claim_token_claimed_at) {
      return errorResponse("Este rascunho ja foi vinculado a uma conta.", "pending_access_claimed", 409)
    }

    if (isPendingTripClaimExpired(trip.claim_token_expires_at)) {
      return errorResponse("O acesso temporario deste rascunho expirou.", "pending_access_expired", 410)
    }

    if (trip.visibility !== "private" || trip.link_activated_at || trip.link_activation_transaction_id) {
      return errorResponse("Estado do rascunho invalido.", "pending_access_invalid", 403)
    }

    return NextResponse.json({ trip: mapPendingDraft(trip) }, { headers: responseHeaders() })
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return errorResponse("Supabase indisponivel para abrir o rascunho.", "supabase_unavailable", 503)
    }

    console.error("[TRIP] pending access error", error instanceof Error ? error.message : error)
    return errorResponse("Nao foi possivel abrir o rascunho.", "pending_access_failed", 500)
  }
}
