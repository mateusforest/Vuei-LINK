import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import {
  createAgencySubscriptionCheckout,
  getOrCreateAgencyStripeCustomer,
} from "@/lib/billing/agency-stripe"
import { getStripePriceIdForAgencyPlan } from "@/lib/billing/stripe"

interface AgencyCheckoutBody {
  planCode?: "start" | "pro" | "business"
}

function getAgencyPlanCheckoutUnavailableMessage(planCode: AgencyCheckoutBody["planCode"]) {
  if (planCode === "start") {
    return "Pagamentos ainda n?o configurados para o plano Start."
  }

  if (planCode === "pro") {
    return "Pagamentos ainda n?o configurados para o plano Pro."
  }

  return "Pagamentos ainda n?o configurados para o plano Business."
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing da ag?ncia so fica dispon?vel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configura??o administrativa do billing da ag?ncia n?o ?sta dispon?vel." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as AgencyCheckoutBody | null
  if (!body?.planCode || !["start", "pro", "business"].includes(body.planCode)) {
    return NextResponse.json({ error: "Plano inv?lido. O checkout da ag?ncia aceita apenas Start, Pro ou Business." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indispon?vel." }, { status: 503 })
  }

  const adminClient = createSupabaseAdminClient()
  const actorResult = await resolveAgencyBillingActor(supabase, adminClient)
  if (actorResult.error || !actorResult.data) {
    return NextResponse.json({ error: actorResult.error ?? "N?o foi poss?vel validar o billing da ag?ncia." }, { status: actorResult.status ?? 500 })
  }

  if (!actorResult.data.canManageBilling) {
    return NextResponse.json({ error: "Apenas owner ou admin da ag?ncia podem iniciar um upgrade." }, { status: 403 })
  }

  try {
    // Valida o price antes de criar customer/session para devolver um erro claro por plano.
    getStripePriceIdForAgencyPlan(body.planCode)

    const customerResult = await getOrCreateAgencyStripeCustomer(adminClient, {
      agencyId: actorResult.data.agencyId,
      agencyName: actorResult.data.agencyName,
      user: actorResult.data.user,
      existingStripeCustomerId: actorResult.data.stripeCustomerId,
    })

    if (customerResult.error || !customerResult.customerId) {
      return NextResponse.json({ error: customerResult.error ?? "N?o foi poss?vel preparar o cliente Stripe da ag?ncia." }, { status: 500 })
    }

    const session = await createAgencySubscriptionCheckout({
      customerId: customerResult.customerId,
      agencyId: actorResult.data.agencyId,
      agencyName: actorResult.data.agencyName,
      userId: actorResult.data.user.id,
      planCode: body.planCode,
    })

    if (!session.url) {
      return NextResponse.json({ error: "O Stripe n?o retornou uma URL de checkout valida." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const technicalMessage = error instanceof Error ? error.message : "N?o foi poss?vel iniciar o checkout da ag?ncia."
    const normalizedMessage = technicalMessage.toLowerCase()
    const priceIssue =
      normalizedMessage.startsWith("missing required env:") ||
      normalizedMessage.includes("no such price") ||
      normalizedMessage.includes("price") ||
      normalizedMessage.includes("inactive")

    console.error("[AGENCY BILLING] checkout error", {
      planCode: body.planCode,
      error: technicalMessage,
    })

    const message = priceIssue
      ? getAgencyPlanCheckoutUnavailableMessage(body.planCode)
      : technicalMessage

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
