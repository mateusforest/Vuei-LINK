import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { createAccountLimitOverride } from "@/lib/billing/account-limit-overrides"
import type { Database } from "@/lib/supabase/types"
import type { SupportBonusPayload } from "@/types"

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"]

async function requireMasterContext() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return { supabase: null, userId: null as string | null, error: "Supabase server client indisponivel.", status: 503 }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return { supabase, userId: null as string | null, error: "Faca login novamente para continuar.", status: 401 }
  }

  if (!user) {
    return { supabase, userId: null as string | null, error: "Entre para continuar.", status: 401 }
  }

  const profileResult = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (profileResult.error || !profileResult.data || profileResult.data.role !== "master") {
    return { supabase, userId: null as string | null, error: "Apenas o portal master pode bonificar contas.", status: 403 }
  }

  return { supabase, userId: profileResult.data.id, error: null, status: 200 }
}

function isValidSupportBonusPayload(payload: SupportBonusPayload | null): payload is SupportBonusPayload {
  if (!payload) return false
  if (!["agency", "traveler"].includes(payload.targetType)) return false
  if (!["credits", "client_extra", "trip_extra"].includes(payload.bonusType)) return false
  if (typeof payload.targetId !== "string" || !payload.targetId.trim()) return false
  if (typeof payload.reason !== "string" || !payload.reason.trim()) return false
  return Number.isFinite(payload.quantity) && payload.quantity > 0
}

function buildBonusKey(ticketId: string, payload: SupportBonusPayload) {
  return [
    ticketId,
    payload.targetType,
    payload.targetId,
    payload.bonusType,
    String(payload.quantity),
    payload.reason.trim(),
    payload.relatedClientName?.trim() ?? "",
    payload.relatedTripTitle?.trim() ?? "",
  ].join("::")
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte so fica disponivel com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "A configuracao administrativa do suporte nao esta disponivel." }, { status: 503 })
  }

  const auth = await requireMasterContext()
  if (!auth.userId) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { ticketId } = await params
  const payload = (await request.json().catch(() => null)) as SupportBonusPayload | null
  if (!isValidSupportBonusPayload(payload)) {
    return NextResponse.json({ error: "Preencha tipo, conta alvo, quantidade e motivo da bonificacao." }, { status: 400 })
  }

  if (payload.bonusType === "client_extra" && payload.targetType !== "agency") {
    return NextResponse.json({ error: "Cliente extra so pode ser concedido para agencia." }, { status: 400 })
  }

  const adminClient = createSupabaseAdminClient()
  const ticketResult = await adminClient.from("support_tickets").select("*").eq("id", ticketId).maybeSingle()
  if (ticketResult.error || !ticketResult.data) {
    return NextResponse.json({ error: ticketResult.error?.message ?? "Chamado nao encontrado." }, { status: 404 })
  }

  const ticket = ticketResult.data as SupportTicketRow
  const ticketContext =
    ticket.context && typeof ticket.context === "object" && !Array.isArray(ticket.context)
      ? (ticket.context as Record<string, unknown>)
      : {}
  const bonusKey = buildBonusKey(ticketId, payload)
  let createdNewBonus = false

  if (payload.bonusType === "credits") {
    const existingTransaction = await (adminClient.from("credit_transactions") as any)
      .select("id")
      .eq("source", "master_support_bonus")
      .contains("metadata", { bonus_key: bonusKey })
      .maybeSingle()

    if (existingTransaction.error) {
      return NextResponse.json({ error: existingTransaction.error.message }, { status: 500 })
    }

    if (!existingTransaction.data) {
      const insertResult = await (adminClient.from("credit_transactions") as any).insert({
        owner_type: payload.targetType === "agency" ? "agency" : "traveler",
        agency_id: payload.targetType === "agency" ? payload.targetId : null,
        owner_user_id: payload.targetType === "traveler" ? payload.targetId : null,
        type: "grant",
        amount: Math.abs(Math.trunc(payload.quantity)),
        reason: payload.reason.trim(),
        source: "master_support_bonus",
        metadata: {
          bonus_key: bonusKey,
          ticket_id: ticketId,
          source: "master_support_bonus",
          support_bonus_type: "credits",
          granted_by: auth.userId,
          target_type: payload.targetType,
          amount: Math.abs(Math.trunc(payload.quantity)),
          related_client_name: payload.relatedClientName?.trim() || null,
          related_trip_title: payload.relatedTripTitle?.trim() || null,
          portal_type: typeof ticketContext.portalType === "string" ? ticketContext.portalType : null,
        },
        created_by: auth.userId,
      } as any)

      if (insertResult.error) {
        return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
      }

      createdNewBonus = true
    }
  } else {
    const existingOverride = await (adminClient.from("account_limit_overrides") as any)
      .select("id")
      .eq("owner_type", payload.targetType)
      .eq("owner_id", payload.targetId)
      .eq("limit_type", payload.bonusType === "client_extra" ? "clients" : "active_trips")
      .eq("ticket_id", ticketId)
      .eq("quantity", Math.abs(Math.trunc(payload.quantity)))
      .eq("reason", payload.reason.trim())
      .maybeSingle()

    if (existingOverride.error) {
      return NextResponse.json({ error: existingOverride.error.message }, { status: 500 })
    }

    if (!existingOverride.data) {
      const overrideResult = await createAccountLimitOverride(adminClient, {
        ownerType: payload.targetType,
        ownerId: payload.targetId,
        limitType: payload.bonusType === "client_extra" ? "clients" : "active_trips",
        quantity: Math.abs(Math.trunc(payload.quantity)),
        reason: payload.reason.trim(),
        ticketId,
        grantedBy: auth.userId,
      })

      if (overrideResult.error) {
        return NextResponse.json({ error: overrideResult.error }, { status: 500 })
      }

      createdNewBonus = true
    }
  }

  if (createdNewBonus) {
    const messageBody =
      payload.bonusType === "credits"
        ? `Bonificacao aplicada: ${payload.quantity} creditos extras. Motivo: ${payload.reason.trim()}`
        : `Bonificacao aplicada: ${payload.quantity} ${payload.bonusType === "client_extra" ? "cliente(s) extra" : "viagem(ns) extra"}. Motivo: ${payload.reason.trim()}`

    await adminClient.from("support_messages").insert({
      ticket_id: ticketId,
      sender_id: auth.userId,
      sender_role: "master",
      body: messageBody,
    } as any)
  }

  await adminClient
    .from("support_tickets")
    .update({
      status: ticket.status === "resolved" ? "resolved" : "in_progress",
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", ticketId)

  return NextResponse.json({ success: true })
}
