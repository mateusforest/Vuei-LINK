import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { SupportTicketStatus } from "@/types"

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"]
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"]

type AuthorizedProfile = {
  id: string
  role: "traveler" | "agency_owner" | "agency_member" | "master"
  agency_id: string | null
}

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

function isAgencyRole(role: AuthorizedProfile["role"]) {
  return role === "agency_owner" || role === "agency_member"
}

async function getAuthorizedContext() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return {
      supabase: null,
      profile: null as AuthorizedProfile | null,
      error: "Supabase server client indisponível.",
      status: 503,
    }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return { supabase, profile: null as AuthorizedProfile | null, error: "Faça login novamente para continuar.", status: 401 }
  }

  if (!user) {
    return { supabase, profile: null as AuthorizedProfile | null, error: "Entre para continuar.", status: 401 }
  }

  const profileResult = await supabase.from("profiles").select("id, role, agency_id").eq("id", user.id).maybeSingle()
  if (profileResult.error || !profileResult.data) {
    return {
      supabase,
      profile: null as AuthorizedProfile | null,
      error: profileResult.error?.message ?? "Perfil não encontrado.",
      status: 403,
    }
  }

  return {
    supabase,
    profile: {
      id: profileResult.data.id,
      role: profileResult.data.role as AuthorizedProfile["role"],
      agency_id: profileResult.data.agency_id ?? null,
    },
    error: null,
    status: 200,
  }
}

async function getAccessibleTicket(supabase: NonNullable<Awaited<ReturnType<typeof getAuthorizedContext>>["supabase"]>, profile: AuthorizedProfile, ticketId: string) {
  let query = supabase.from("support_tickets").select("*").eq("id", ticketId)

  if (profile.role === "master") {
    // master vê tudo
  } else if (isAgencyRole(profile.role)) {
    if (!profile.agency_id) {
      return { data: null as SupportTicketRow | null, error: "Sua conta de agência não está vinculada a uma agência ativa.", status: 403 }
    }

    query = query.eq("agency_id", profile.agency_id)
  } else {
    query = query.eq("user_id", profile.id)
  }

  const ticketResult = await query.maybeSingle()
  if (ticketResult.error) {
    return { data: null as SupportTicketRow | null, error: ticketResult.error.message, status: 500 }
  }

  if (!ticketResult.data) {
    return {
      data: null as SupportTicketRow | null,
      error: profile.role === "master" ? "Chamado não encontrado." : "Você não tem acesso a este chamado.",
      status: profile.role === "master" ? 404 : 403,
    }
  }

  return { data: ticketResult.data, error: null, status: 200 }
}

function isValidStatus(value: unknown): value is SupportTicketStatus {
  return value === "open" || value === "in_progress" || value === "resolved"
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const auth = await getAuthorizedContext()
  if (!auth.supabase || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { ticketId } = await params
  const ticketResult = await getAccessibleTicket(auth.supabase, auth.profile, ticketId)
  if (!ticketResult.data) {
    return NextResponse.json({ error: ticketResult.error }, { status: ticketResult.status })
  }

  const messagesResult = await auth.supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

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
  if (!auth.supabase || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (auth.profile.role !== "master") {
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
