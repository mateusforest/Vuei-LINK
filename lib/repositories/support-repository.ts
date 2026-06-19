import type {
  SupportMessage,
  SupportPortalType,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/types"

interface SupportTicketPayload {
  title: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  message: string
  portalType: SupportPortalType
  currentRoute: string | null
  deletionRequest?: boolean
}

interface SupportApiResponse<T> {
  error?: string | null
  ticket?: T
  tickets?: T[]
  messages?: SupportMessage[]
  detail?: {
    ticket: SupportTicket
    messages: SupportMessage[]
  }
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

export async function createSupportTicket(payload: SupportTicketPayload) {
  const response = await fetch("/api/support/tickets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await parseJson<SupportApiResponse<SupportTicket>>(response)

  return {
    data: response.ok ? data?.ticket ?? null : null,
    error: response.ok ? null : data?.error ?? "Não foi possível enviar o chamado.",
  }
}

export async function listSupportTickets() {
  const response = await fetch("/api/support/tickets", {
    method: "GET",
    cache: "no-store",
  })

  const data = await parseJson<SupportApiResponse<SupportTicket>>(response)

  return {
    data: response.ok ? data?.tickets ?? [] : [],
    error: response.ok ? null : data?.error ?? "Não foi possível carregar os chamados.",
  }
}

export async function getSupportTicketDetail(ticketId: string) {
  const response = await fetch(`/api/support/tickets/${ticketId}`, {
    method: "GET",
    cache: "no-store",
  })

  const data = await parseJson<SupportApiResponse<SupportTicket>>(response)

  return {
    data: response.ok ? data?.detail ?? null : null,
    error: response.ok ? null : data?.error ?? "Não foi possível carregar o detalhe do chamado.",
  }
}

export async function updateSupportTicketStatus(ticketId: string, status: SupportTicketStatus) {
  const response = await fetch(`/api/support/tickets/${ticketId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  })

  const data = await parseJson<SupportApiResponse<SupportTicket>>(response)

  return {
    data: response.ok ? data?.ticket ?? null : null,
    error: response.ok ? null : data?.error ?? "Não foi possível atualizar o chamado.",
  }
}

export async function replySupportTicket(ticketId: string, body: string) {
  const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body }),
  })

  const data = await parseJson<{ error?: string | null; message?: SupportMessage | null }>(response)

  return {
    data: response.ok ? data?.message ?? null : null,
    error: response.ok ? null : data?.error ?? "Não foi possível responder o chamado.",
  }
}
