import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"
import type { SupportPortalType, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@/types"

type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"]
type SupportTicketInsert = Database["public"]["Tables"]["support_tickets"]["Insert"]
type SupportMessageInsert = Database["public"]["Tables"]["support_messages"]["Insert"]

type SupportProfile = {
  id: string
  email: string
  name: string | null
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

async function getAuthenticatedProfile() {
  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return { supabase: null, profile: null as SupportProfile | null, error: "Supabase server client indisponível.", status: 503 }
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return { supabase, profile: null as SupportProfile | null, error: "Faça login novamente para continuar.", status: 401 }
  }

  if (!user) {
    return { supabase, profile: null as SupportProfile | null, error: "Entre para continuar.", status: 401 }
  }

  const profileResult = await supabase
    .from("profiles")
    .select("id, email, name, role, agency_id")
    .eq("id", user.id)
    .maybeSingle()

  if (profileResult.error || !profileResult.data) {
    return {
      supabase,
      profile: null as SupportProfile | null,
      error: profileResult.error?.message ?? "Perfil não encontrado.",
      status: 403,
    }
  }

  return { supabase, profile: profileResult.data as SupportProfile, error: null, status: 200 }
}

function isValidCategory(value: unknown): value is SupportTicketCategory {
  return ["vuei_help", "technical_issue", "billing", "credits", "trip_link", "other"].includes(String(value))
}

function isValidPriority(value: unknown): value is SupportTicketPriority {
  return value === "normal" || value === "urgent"
}

export async function GET() {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const auth = await getAuthenticatedProfile()
  if (!auth.supabase || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (auth.profile.role !== "master") {
    return NextResponse.json({ error: "Apenas o portal master pode listar chamados." }, { status: 403 })
  }

  const ticketsResult = await auth.supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })

  if (ticketsResult.error) {
    return NextResponse.json({ error: ticketsResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ tickets: (ticketsResult.data ?? []).map(mapTicket) })
}

export async function POST(request: NextRequest) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const auth = await getAuthenticatedProfile()
  if (!auth.supabase || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string
    category?: SupportTicketCategory
    priority?: SupportTicketPriority
    message?: string
    portalType?: SupportPortalType
    currentRoute?: string | null
    deletionRequest?: boolean
  } | null

  const title = typeof body?.title === "string" ? body.title.trim() : ""
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const category = body?.category
  const priority = body?.priority

  if (!title || !message || !isValidCategory(category) || !isValidPriority(priority)) {
    return NextResponse.json({ error: "Preencha assunto, categoria, prioridade e mensagem." }, { status: 400 })
  }

  const portalType: SupportPortalType =
    auth.profile.role === "agency_owner" || auth.profile.role === "agency_member" ? "agency" : "traveler"

  const ticketPayload: SupportTicketInsert = {
    user_id: auth.profile.id,
    agency_id: auth.profile.agency_id,
    title,
    category,
    priority,
    status: "open",
    message,
    context: {
      userId: auth.profile.id,
      email: auth.profile.email,
      name: auth.profile.name,
      portalType,
      agencyId: auth.profile.agency_id,
      currentRoute: typeof body?.currentRoute === "string" ? body.currentRoute : null,
      timestamp: new Date().toISOString(),
      deletionRequest: body?.deletionRequest === true,
      source: "portal_support_fab",
    },
  }

  const ticketResult = await auth.supabase
    .from("support_tickets")
    .insert(ticketPayload)
    .select("*")
    .single()

  if (ticketResult.error || !ticketResult.data) {
    return NextResponse.json({ error: ticketResult.error?.message ?? "Não foi possível abrir o chamado." }, { status: 500 })
  }

  const messagePayload: SupportMessageInsert = {
    ticket_id: ticketResult.data.id,
    sender_id: auth.profile.id,
    sender_role: portalType,
    body: message,
  }

  const messageResult = await auth.supabase.from("support_messages").insert(messagePayload)
  if (messageResult.error) {
    return NextResponse.json({ error: messageResult.error.message }, { status: 500 })
  }

  return NextResponse.json({ ticket: mapTicket(ticketResult.data) })
}
