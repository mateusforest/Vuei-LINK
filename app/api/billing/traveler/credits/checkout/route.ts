import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { buildAbsoluteAppUrl } from "@/lib/app-url"
import { getStripeClient, getStripePriceIdForCreditPackage } from "@/lib/billing/stripe"
import { ensureTravelerStripeCustomer } from "@/lib/billing/traveler-stripe"
import { TRAVELER_CREDIT_PACKAGES } from "@/lib/billing/traveler-plans"

interface TravelerCreditsCheckoutBody {
  packageCode?: "starter" | "popular" | "pro"
}

export async function POST(request: Request) {
  try {
    if (!shouldUseSupabase()) {
      return NextResponse.json({ error: "Billing traveler so fica disponivel com Supabase ativo." }, { status: 503 })
    }

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "A configuracao administrativa do billing traveler nao esta disponivel." }, { status: 503 })
    }

    const body = (await request.json().catch(() => null)) as TravelerCreditsCheckoutBody | null
    const selectedPackage = TRAVELER_CREDIT_PACKAGES.find((pkg) => pkg.code === body?.packageCode)

    if (!selectedPackage) {
      return NextResponse.json({ error: "Pacote de creditos invalido." }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      return NextResponse.json({ error: "Faça login novamente para continuar." }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: "Entre para comprar creditos." }, { status: 401 })
    }

    const adminClient = createSupabaseAdminClient()
    const customerResult = await ensureTravelerStripeCustomer(adminClient, user)
    if (customerResult.error || !customerResult.customerId) {
      return NextResponse.json({ error: customerResult.error ?? "Nao foi possivel preparar o cliente Stripe." }, { status: 500 })
    }

    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerResult.customerId,
      client_reference_id: user.id,
      line_items: [
        {
          price: getStripePriceIdForCreditPackage(selectedPackage.code),
          quantity: 1,
        },
      ],
      success_url: buildAbsoluteAppUrl("/portal/creditos?checkout=success"),
      cancel_url: buildAbsoluteAppUrl("/portal/creditos?checkout=canceled"),
      metadata: {
        user_id: user.id,
        billing_scope: "traveler",
        checkout_type: "credit_package",
        package_code: selectedPackage.code,
        credits: String(selectedPackage.credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          billing_scope: "traveler",
          checkout_type: "credit_package",
          package_code: selectedPackage.code,
          credits: String(selectedPackage.credits),
        },
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: "O Stripe nao retornou uma URL de checkout valida." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Missing required env:")
      ? "Pagamentos ainda nao configurados."
      : error instanceof Error
        ? error.message
        : "Nao foi possivel iniciar o checkout de creditos."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
