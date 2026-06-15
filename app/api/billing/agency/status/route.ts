import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { resolveAgencyBillingActor } from "@/lib/billing/agency-access"
import { getAgencyCreditBalance } from "@/lib/billing/agency-billing"

export async function GET() {
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

  const balanceResult = await getAgencyCreditBalance(adminClient, actorResult.data.agencyId)
  if (balanceResult.error || !balanceResult.data) {
    return NextResponse.json({ error: balanceResult.error ?? "Nao foi possivel carregar o billing da agencia." }, { status: 500 })
  }

  return NextResponse.json({
    ...balanceResult.data,
    canManageBilling: actorResult.data.canManageBilling,
  })
}
