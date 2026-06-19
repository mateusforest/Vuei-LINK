import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { SupportTicketStatus } from "@/types"

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"]
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"]

function mapTicket(row: SupportTicketRow) {
  return {
    id: row.id,
    userId: row.user_id,
    agencyId: row.agency_id,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status: row.status,
    message: row.message,
    context: (row.context ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessage(row: SupportMessageRow) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderId: row.sender_id,
    senderRole: row.sender_role,
    body: row.body,
    createdAt: row.created_at,
  }
}

async function getAuthorizedContext() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return { supabase: null, role: null as string | null, error: "Supabase server client indisponível.", status: 503 }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) return { supabase, role: null as string | null, error: "Faça login novamente para continuar.", status: 401 }
  if (!user) return { supabase, role: null as string | null, error: "Entre para continuar.", status: 401 }

  const profileResult = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profileResult.error || !profileResult.data) {
    return { supabase, role: null as string | null, error: profileResult.error?.message ?? "Perfil não encontrado.", status: 403 }
  }

  return { supabase, role: profileResult.data.role as string, error: null, status: 200 }
}

function isValidStatus(value: unknown): value is SupportTicketStatus {
  return value === "open" || value === "in_progress" || value === "resolved"
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const auth = await getAuthorizedContext()
  if (!auth.supabase || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { ticketId } = await params
  const [ticketResult, messagesResult] = await Promise.all([
    auth.supabase.from("support_tickets").select("*").eq("id", ticketId).maybeSingle(),
    auth.supabase.from("support_messages").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
  ])

  if (ticketResult.error || !ticketResult.data) {
    return NextResponse.json({ error: ticketResult.error?.message ?? "Chamado não encontrado." }, { status: 404 })
  }

  if (messagesResult.error) {
    return NextResponse.json({ error: messagesResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    detail: {
      ticket: mapTicket(ticketResult.data),
      messages: (messagesResult.data ?? []).map(mapMessage),
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const auth = await getAuthorizedContext()
  if (!auth.supabase || !auth.role) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (auth.role !== "master") {
    return NextResponse.json({ error: "Apenas o portal master pode atualizar chamados." }, { status: 403 })
  }

  const { ticketId } = await params
  const body = (await request.json().catch(() => null)) as { status?: SupportTicketStatus } | null
  if (!isValidStatus(body?.status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 })
  }

  const updateResult = await auth.supabase
    .from("support_tickets")
    .update({
      status: body.status,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", ticketId)
    .select("*")
    .single()

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ error: updateResult.error?.message ?? "Não foi possível atualizar o chamado." }, { status: 500 })
  }

  return NextResponse.json({ ticket: mapTicket(updateResult.data) })
}
