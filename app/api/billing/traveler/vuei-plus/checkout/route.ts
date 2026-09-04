import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { buildAbsoluteAppUrl } from "@/lib/app-url"
import { getStripeClient, getStripePriceIdForTravelerVueiPlus } from "@/lib/billing/stripe"
import { getTravelerMembershipStatus } from "@/lib/billing/traveler-billing"
import { TRAVELER_VUEI_PLUS_BILLING_SCOPE, TRAVELER_VUEI_PLUS_OFFER } from "@/lib/billing/traveler-membership"
import { ensureTravelerStripeCustomer } from "@/lib/billing/traveler-stripe"
import { ensureProfile } from "@/lib/auth/ensure-profile"

export async function POST() {
  try {
    if (!shouldUseSupabase() || !hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "O checkout Vuei+ ainda nao esta disponivel neste ambiente." }, { status: 503 })
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Sessao indisponivel." }, { status: 503 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Entre para assinar o Vuei+." }, { status: 401 })
    }

    const profile = await ensureProfile(user, supabase)
    if (!profile || profile.role !== "traveler") {
      return NextResponse.json({ error: "O Vuei+ esta disponivel apenas para viajantes." }, { status: 403 })
    }

    const adminClient = createSupabaseAdminClient()
    const membershipResult = await getTravelerMembershipStatus(adminClient, user.id)
    if (membershipResult.error || !membershipResult.data) {
      return NextResponse.json({ error: membershipResult.error ?? "Nao foi possivel validar sua assinatura." }, { status: 500 })
    }

    if (membershipResult.data.canAccessArchivedTrips) {
      return NextResponse.json({ error: "Sua conta ja possui acesso ao arquivo de viagens." }, { status: 409 })
    }

    if (
      membershipResult.data.vueiPlusStripeSubscriptionId &&
      !["none", "canceled"].includes(membershipResult.data.vueiPlusStatus)
    ) {
      return NextResponse.json(
        { error: "Ja existe uma assinatura Vuei+ em andamento. Gerencie-a no portal Stripe." },
        { status: 409 },
      )
    }

    const customerResult = await ensureTravelerStripeCustomer(adminClient, user)
    if (customerResult.error || !customerResult.customerId) {
      return NextResponse.json({ error: customerResult.error ?? "Nao foi possivel preparar o cliente Stripe." }, { status: 500 })
    }

    const stripe = getStripeClient()
    const priceId = getStripePriceIdForTravelerVueiPlus()
    const price = await stripe.prices.retrieve(priceId)
    if (
      !price.active ||
      price.type !== "recurring" ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1 ||
      price.unit_amount !== TRAVELER_VUEI_PLUS_OFFER.unitAmount ||
      price.currency.toLowerCase() !== TRAVELER_VUEI_PLUS_OFFER.currency
    ) {
      return NextResponse.json({ error: "O preco do Vuei+ nao corresponde a oferta atual." }, { status: 503 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerResult.customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: buildAbsoluteAppUrl("/portal/planos?checkout=vuei-plus-success"),
      cancel_url: buildAbsoluteAppUrl("/portal/planos?checkout=vuei-plus-canceled"),
      metadata: {
        user_id: user.id,
        billing_scope: TRAVELER_VUEI_PLUS_BILLING_SCOPE,
        checkout_type: "subscription",
        membership_code: "vuei_plus",
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          billing_scope: TRAVELER_VUEI_PLUS_BILLING_SCOPE,
          checkout_type: "subscription",
          membership_code: "vuei_plus",
        },
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: "O Stripe nao retornou uma URL de checkout valida." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Missing required env:")
      ? "Pagamentos do Vuei+ ainda nao configurados."
      : error instanceof Error
        ? error.message
        : "Nao foi possivel iniciar o checkout Vuei+."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
