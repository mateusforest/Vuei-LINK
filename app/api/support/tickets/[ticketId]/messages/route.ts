import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseAdminClient, hasSupabaseAdminEnv, isMissingSupabaseAdminEnvError } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type SupportMessageInsert = Database["public"]["Tables"]["support_messages"]["Insert"]
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"]
type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"]

type AuthorizedProfile = {
  id: string
  role: "traveler" | "agency_owner" | "agency_member" | "master"
  agency_id: string | null
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  if (!hasSupabaseAdminEnv()) {
    return NextResponse.json({ error: "Configuração administrativa do Supabase indisponível." }, { status: 503 })
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

  const body = (await request.json().catch(() => null)) as { body?: string } | null
  const messageBody = typeof body?.body === "string" ? body.body.trim() : ""
  if (!messageBody) {
    return NextResponse.json({ error: "Digite uma resposta antes de enviar." }, { status: 400 })
  }

  const senderRole = auth.profile.role === "master" ? "master" : isAgencyRole(auth.profile.role) ? "agency" : "traveler"
  const nextStatus = auth.profile.role === "master" ? "in_progress" : "open"

  let adminClient: ReturnType<typeof createSupabaseAdminClient>
  try {
    adminClient = createSupabaseAdminClient()
  } catch (error) {
    if (isMissingSupabaseAdminEnvError(error)) {
      return NextResponse.json({ error: "Configuração administrativa do Supabase indisponível." }, { status: 503 })
    }

    return NextResponse.json({ error: "Não foi possível preparar o envio da resposta." }, { status: 500 })
  }

  const messagePayload: SupportMessageInsert = {
    ticket_id: ticketId,
    sender_id: auth.profile.id,
    sender_role: senderRole,
    body: messageBody,
  }

  const messageResult = await adminClient
    .from("support_messages")
    .insert(messagePayload)
    .select("*")
    .single()

  if (messageResult.error || !messageResult.data) {
    return NextResponse.json({ error: messageResult.error?.message ?? "Não foi possível enviar a resposta." }, { status: 500 })
  }

  const ticketUpdateResult = await adminClient
    .from("support_tickets")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", ticketId)

  if (ticketUpdateResult.error) {
    return NextResponse.json({ error: ticketUpdateResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ message: mapMessage(messageResult.data) })
}
