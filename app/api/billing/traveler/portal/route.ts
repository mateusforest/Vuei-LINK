import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { buildAbsoluteAppUrl } from "@/lib/app-url"
import { getStripeClient } from "@/lib/billing/stripe"
import { ensureTravelerSubscriptionRow } from "@/lib/billing/traveler-billing"

export async function POST() {
  try {
    if (!shouldUseSupabase()) {
      return NextResponse.json({ error: "Billing traveler so fica dispon?vel com Supabase ativo." }, { status: 503 })
    }

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "A configura??o administrativa do billing traveler n?o ?sta dispon?vel." }, { status: 503 })
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase server client indispon?vel." }, { status: 503 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: "Faça login novamente para continuar." }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: "Entre para gerenciar sua assinatura." }, { status: 401 })
    }

    const adminClient = createSupabaseAdminClient()
    const subscriptionResult = await ensureTravelerSubscriptionRow(adminClient, user.id)
    if (subscriptionResult.error || !subscriptionResult.data) {
      return NextResponse.json({ error: subscriptionResult.error ?? "N?o foi poss?vel carregar o billing traveler." }, { status: 500 })
    }

    if (!subscriptionResult.data.stripe_customer_id) {
      return NextResponse.json({ error: "Sua conta ainda n?o possui um cliente Stripe vinculado para abrir o portal." }, { status: 400 })
    }

    const stripe = getStripeClient()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscriptionResult.data.stripe_customer_id,
      return_url: buildAbsoluteAppUrl("/portal/planos"),
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Missing required env:")
      ? "Pagamentos ainda n?o configurados."
      : error instanceof Error
        ? error.message
        : "N?o foi poss?vel abrir o portal de assinatura."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
