import { NextRequest, NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/types"

type SupportMessageInsert = Database["public"]["Tables"]["support_messages"]["Insert"]
type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"]

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!shouldUseSupabase()) {
    return NextResponse.json({ error: "Suporte só fica disponível com Supabase ativo." }, { status: 503 })
  }

  const supabase = await createSupabaseServerClient()
  if (!supabase) {
    return NextResponse.json({ error: "Supabase server client indisponível." }, { status: 503 })
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: "Faça login novamente para continuar." }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: "Entre para continuar." }, { status: 401 })
  }

  const profileResult = await supabase.from("profiles").select("id, role").eq("id", user.id).maybeSingle()
  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: profileResult.error?.message ?? "Perfil não encontrado." }, { status: 403 })
  }

  if (profileResult.data.role !== "master") {
    return NextResponse.json({ error: "Apenas o portal master pode responder chamados." }, { status: 403 })
  }

  const { ticketId } = await params
  const body = (await request.json().catch(() => null)) as { body?: string } | null
  const messageBody = typeof body?.body === "string" ? body.body.trim() : ""
  if (!messageBody) {
    return NextResponse.json({ error: "Digite uma resposta antes de enviar." }, { status: 400 })
  }

  const messagePayload: SupportMessageInsert = {
    ticket_id: ticketId,
    sender_id: profileResult.data.id,
    sender_role: "master",
    body: messageBody,
  }

  const messageResult = await supabase
    .from("support_messages")
    .insert(messagePayload)
    .select("*")
    .single()

  if (messageResult.error || !messageResult.data) {
    return NextResponse.json({ error: messageResult.error?.message ?? "Não foi possível enviar a resposta." }, { status: 500 })
  }

  await supabase
    .from("support_tickets")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", ticketId)

  return NextResponse.json({ message: mapMessage(messageResult.data) })
}
