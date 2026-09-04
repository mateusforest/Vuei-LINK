import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { getTravelerMembershipStatus } from "@/lib/billing/traveler-billing"
import { ensureProfile } from "@/lib/auth/ensure-profile"

export async function GET() {
  if (!shouldUseSupabase() || !hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "O Vuei+ ainda nao esta disponivel neste ambiente." }, { status: 503 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Sessao indisponivel." }, { status: 503 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Entre para consultar o Vuei+." }, { status: 401 })
  }

  const profile = await ensureProfile(user, supabase)
  if (!profile || profile.role !== "traveler") {
    return NextResponse.json({ error: "O Vuei+ esta disponivel apenas para viajantes." }, { status: 403 })
  }

  const result = await getTravelerMembershipStatus(createSupabaseAdminClient(), user.id)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? "Nao foi possivel carregar o Vuei+." }, { status: 500 })
  }

  return NextResponse.json(result.data, { headers: { "Cache-Control": "no-store" } })
}
