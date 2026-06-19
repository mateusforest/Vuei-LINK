import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import { createAgencyBillingPortalSession } from "@/lib/billing/agency-stripe"

export async function POST() {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing da ag?ncia so fica dispon?vel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configura??o administrativa do billing da ag?ncia n?o ?sta dispon?vel." }, { status: 503 })
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
    return NextResponse.json({ error: "Apenas owner ou admin da ag?ncia podem gerenciar a assinatura." }, { status: 403 })
  }

  if (!actorResult.data.stripeCustomerId) {
    return NextResponse.json({ error: "Sua ag?ncia ainda n?o possui um cliente Stripe vinculado para abrir o portal." }, { status: 400 })
  }

  try {
    const session = await createAgencyBillingPortalSession(actorResult.data.stripeCustomerId)
    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith("Missing required env:")
      ? "Pagamentos ainda n?o configurados."
      : error instanceof Error
        ? error.message
        : "N?o foi poss?vel abrir o portal de assinatura."

    return NextResponse.json({ error: message }, { status: 503 })
  }
}
