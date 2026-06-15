import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import { createAgencyBillingPortalSession } from "@/lib/billing/agency-stripe"

export async function POST() {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing da agencia so fica disponivel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do billing da agencia nao esta disponivel." }, { status: 503 })
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
    return NextResponse.json({ error: "Apenas owner ou admin da agencia podem gerenciar a assinatura." }, { status: 403 })
  }

  if (!actorResult.data.stripeCustomerId) {
    return NextResponse.json({ error: "Sua agencia ainda nao possui um cliente Stripe vinculado para abrir o portal." }, { status: 400 })
  }

  try {
    const session = await createAgencyBillingPortalSession(actorResult.data.stripeCustomerId)
    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Missing required env:")
      ? "Pagamentos ainda nao configurados."
      : error instanceof Error
        ? error.message
        : "Nao foi possivel abrir o portal de assinatura."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
