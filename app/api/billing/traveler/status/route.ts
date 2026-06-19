import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { getTravelerCreditBalance } from "@/lib/billing/traveler-billing"

export async function GET() {
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
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: "Entre para consultar seu billing." }, { status: 401 })
  }

  const adminClient = createSupabaseAdminClient()
  const balanceResult = await getTravelerCreditBalance(adminClient, user.id)

  if (balanceResult.error || !balanceResult.data) {
    return NextResponse.json({ error: balanceResult.error ?? "N?o foi poss?vel carregar o billing traveler." }, { status: 500 })
  }

  return NextResponse.json(balanceResult.data)
}
