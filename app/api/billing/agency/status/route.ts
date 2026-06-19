import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import { getAgencyCreditBalance } from "@/lib/billing/agency-billing"

export async function GET() {
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

  const balanceResult = await getAgencyCreditBalance(adminClient, actorResult.data.agencyId)
  if (balanceResult.error || !balanceResult.data) {
    return NextResponse.json({ error: balanceResult.error ?? "N?o foi poss?vel carregar o billing da ag?ncia." }, { status: 500 })
  }

  return NextResponse.json({
    ...balanceResult.data,
    canManageBilling: actorResult.data.canManageBilling,
  })
}
