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
    return "Pagamentos ainda nao configurados para o plano Start."
  }

  if (planCode === "pro") {
    return "Pagamentos ainda nao configurados para o plano Pro."
  }

  return "Pagamentos ainda nao configurados para o plano Business."
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing da agencia so fica disponivel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do billing da agencia nao esta disponivel." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as AgencyCheckoutBody | null
  if (!body?.planCode || !["start", "pro", "business"].includes(body.planCode)) {
    return NextResponse.json({ error: "Plano invalido. O checkout da agencia aceita apenas Start, Pro ou Business." }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponivel." }, { status: 503 })
  }

  const adminClient = createSupabaseAdminClient()
  const actorResult = await resolveAgencyBillingActor(supabase, adminClient)
  if (actorResult.error || !actorResult.data) {
    return NextResponse.json({ error: actorResult.error ?? "Nao foi possivel validar o billing da agencia." }, { status: actorResult.status ?? 500 })
  }

  if (!actorResult.data.canManageBilling) {
    return NextResponse.json({ error: "Apenas owner ou admin da agencia podem iniciar um upgrade." }, { status: 403 })
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
      return NextResponse.json({ error: customerResult.error ?? "Nao foi possivel preparar o cliente Stripe da agencia." }, { status: 500 })
    }

    const session = await createAgencySubscriptionCheckout({
      customerId: customerResult.customerId,
      agencyId: actorResult.data.agencyId,
      agencyName: actorResult.data.agencyName,
      userId: actorResult.data.user.id,
      planCode: body.planCode,
    })

    if (!session.url) {
      return NextResponse.json({ error: "O Stripe nao retornou uma URL de checkout valida." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const technicalMessage = error instanceof Error ? error.message : "Nao foi possivel iniciar o checkout da agencia."
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
