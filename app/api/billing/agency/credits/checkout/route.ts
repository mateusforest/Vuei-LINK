import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import {
  createAgencyCreditPackageCheckout,
  getOrCreateAgencyStripeCustomer,
} from "@/lib/billing/agency-stripe"

interface AgencyCreditsCheckoutBody {
  packageCode?: "starter" | "popular" | "pro"
}

export async function POST(request: Request) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing da agencia so fica disponivel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do billing da agencia nao esta disponivel." }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as AgencyCreditsCheckoutBody | null
  if (!body?.packageCode || !["starter", "popular", "pro"].includes(body.packageCode)) {
    return NextResponse.json({ error: "Pacote de creditos invalido." }, { status: 400 })
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
    return NextResponse.json({ error: "Apenas owner ou admin da agencia podem comprar creditos." }, { status: 403 })
  }

  try {
    const customerResult = await getOrCreateAgencyStripeCustomer(adminClient, {
      agencyId: actorResult.data.agencyId,
      agencyName: actorResult.data.agencyName,
      user: actorResult.data.user,
      existingStripeCustomerId: actorResult.data.stripeCustomerId,
    })

    if (customerResult.error || !customerResult.customerId) {
      return NextResponse.json({ error: customerResult.error ?? "Nao foi possivel preparar o cliente Stripe da agencia." }, { status: 500 })
    }

    const session = await createAgencyCreditPackageCheckout({
      customerId: customerResult.customerId,
      agencyId: actorResult.data.agencyId,
      userId: actorResult.data.user.id,
      packageCode: body.packageCode,
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
        : "Nao foi possivel iniciar a compra de creditos."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
