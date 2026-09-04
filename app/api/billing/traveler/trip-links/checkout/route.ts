import { NextResponse } from "next/server"
import { buildAbsoluteAppUrl } from "@/lib/app-url"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { getStripeClient } from "@/lib/billing/stripe"
import { ensureTravelerStripeCustomer } from "@/lib/billing/traveler-stripe"
import {
  TRAVELER_TRIP_LINK_BILLING_SCOPE,
  TRAVELER_TRIP_LINK_CHECKOUT_TYPE,
  getTravelerTripLinkProduct,
  type TravelerTripLinkProductCode,
} from "@/lib/billing/traveler-trip-link-catalog"
import { getTravelerTripLinkPriceId } from "@/lib/billing/traveler-trip-link-products"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createWalletService } from "@/lib/wallet"

export const runtime = "nodejs"

interface TravelerTripLinkCheckoutBody {
  packageCode?: string
  tripId?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function buildStoreReturnPath(status: "success" | "canceled", tripId?: string | null) {
  const params = new URLSearchParams({ checkout: status })
  if (tripId && UUID_PATTERN.test(tripId)) params.set("trip_id", tripId)
  return `/portal/viagens/comprar?${params.toString()}`
}

export async function POST(request: Request) {
  try {
    if (!shouldUseSupabase() || !hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "A compra de viagens nao esta disponivel." }, { status: 503 })
    }

    const body = (await request.json().catch(() => null)) as TravelerTripLinkCheckoutBody | null
    const definition = getTravelerTripLinkProduct(body?.packageCode)
    if (!definition) {
      return NextResponse.json({ error: "Pacote de viagens invalido." }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase indisponivel." }, { status: 503 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Entre para comprar viagens." }, { status: 401 })
    }

    const profile = await ensureProfile(user, supabase)
    if (!profile || profile.role !== "traveler") {
      return NextResponse.json({ error: "Esta compra esta disponivel apenas para viajantes." }, { status: 403 })
    }

    const adminClient = createSupabaseAdminClient()
    const walletService = createWalletService(adminClient)
    const walletProduct = await walletService.getProductByCode(definition.code)
    if (
      !walletProduct?.active ||
      walletProduct.assetType !== "trip_link" ||
      walletProduct.quantity !== definition.quantity
    ) {
      return NextResponse.json({ error: "Este pacote ainda nao esta disponivel." }, { status: 503 })
    }

    await walletService.getOrCreateWallet({ ownerType: "traveler", ownerUserId: user.id })

    const priceId = getTravelerTripLinkPriceId(definition.code as TravelerTripLinkProductCode)
    const stripe = getStripeClient()
    const price = await stripe.prices.retrieve(priceId)
    if (
      !price.active ||
      price.type !== "one_time" ||
      price.unit_amount !== definition.unitAmount ||
      price.currency.toLowerCase() !== definition.currency
    ) {
      return NextResponse.json({ error: "O preco deste pacote nao esta ativo no Stripe." }, { status: 503 })
    }

    const customerResult = await ensureTravelerStripeCustomer(adminClient, user)
    if (customerResult.error || !customerResult.customerId) {
      return NextResponse.json({ error: customerResult.error ?? "Nao foi possivel preparar o cliente Stripe." }, { status: 500 })
    }

    const tripId = typeof body?.tripId === "string" && UUID_PATTERN.test(body.tripId) ? body.tripId : null
    const metadata = {
      user_id: user.id,
      billing_scope: TRAVELER_TRIP_LINK_BILLING_SCOPE,
      checkout_type: TRAVELER_TRIP_LINK_CHECKOUT_TYPE,
      product_code: definition.code,
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerResult.customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: buildAbsoluteAppUrl(buildStoreReturnPath("success", tripId)),
      cancel_url: buildAbsoluteAppUrl(buildStoreReturnPath("canceled", tripId)),
      metadata,
      payment_intent_data: { metadata },
    })

    if (!session.url) {
      return NextResponse.json({ error: "O Stripe nao retornou uma URL de checkout valida." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error && (
      error.message.startsWith("Missing required env:") ||
      error.message.startsWith("Invalid Stripe Price ID")
    )
      ? "Os pacotes de viagem ainda nao foram configurados."
      : error instanceof Error
        ? error.message
        : "Nao foi possivel iniciar a compra de viagens."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
