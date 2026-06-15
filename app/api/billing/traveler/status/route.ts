import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { getTravelerCreditBalance } from "@/lib/billing/traveler-billing"

export async function GET() {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Billing traveler so fica disponivel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do billing traveler nao esta disponivel." }, { status: 503 })
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
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: "Entre para consultar seu billing." }, { status: 401 })
  }

  const adminClient = createSupabaseAdminClient()
  const balanceResult = await getTravelerCreditBalance(adminClient, user.id)

  if (balanceResult.error || !balanceResult.data) {
    return NextResponse.json({ error: balanceResult.error ?? "Nao foi possivel carregar o billing traveler." }, { status: 500 })
  }

  return NextResponse.json(balanceResult.data)
}
