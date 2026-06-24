"use client"

import { useEffect, useMemo, useState } from "react"
import { Clock3, LifeBuoy, Plus, Send } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { getSupportCategoryLabel } from "@/lib/support/labels"
import { cn } from "@/lib/utils"
import { getSupportTicketDetail, listSupportTickets, replySupportTicket } from "@/lib/repositories/support-repository"
import type { SupportMessage, SupportPortalType, SupportTicket, SupportTicketStatus } from "@/types"

type TicketDetail = {
  ticket: SupportTicket
  messages: SupportMessage[]
}

type SupportCenterProps = {
  portalType: SupportPortalType
  title: string
  subtitle: string
  emptyTitle: string
  emptyDescription: string
}

function getStatusLabel(status: SupportTicketStatus | string) {
  switch (status) {
    case "open":
      return "Aberto"
    case "in_progress":
      return "Em andamento"
    case "resolved":
      return "Resolvido"
    default:
      return "Em análise"
  }
}

function getStatusBadgeClass(status: SupportTicketStatus | string) {
  switch (status) {
    case "resolved":
      return "bg-emerald-100 text-emerald-700"
    case "in_progress":
      return "bg-sky-100 text-sky-700"
    case "open":
      return "bg-amber-100 text-amber-700"
    default:
      return "bg-slate-100 text-slate-700"
  }
}

function getViewerSenderLabel(role: SupportMessage["senderRole"], portalType: SupportPortalType) {
  if (role === "master") return "Suporte Vuei"
  if (role === "system") return "Sistema"
  if (role === portalType) return "Você"
  return portalType === "agency" ? "Viajante" : "Agência"
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SupportCenter(props: SupportCenterProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)

  const sortedTickets = useMemo(
    () =>
      [...tickets].sort((a, b) => {
        const left = new Date(b.updatedAt).getTime()
        const right = new Date(a.updatedAt).getTime()
        return left - right
      }),
    [tickets]
  )

  const loadTickets = async () => {
    setLoading(true)
    const result = await listSupportTickets()
    setTickets(result.data)
    setError(result.error)
    setLoading(false)
  }

  const loadDetail = async (ticketId: string) => {
    const result = await getSupportTicketDetail(ticketId)
    setDetail(result.data)
    setError(result.error)
    return result.data
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  useEffect(() => {
    if (!selectedTicketId) {
      setDetail(null)
      setReply("")
      return
    }

    let active = true
    void (async () => {
      const result = await getSupportTicketDetail(selectedTicketId)
      if (!active) return
      setDetail(result.data)
      setError(result.error)
    })()

    return () => {
      active = false
    }
  }, [selectedTicketId])

  const handleReply = async () => {
    if (!selectedTicketId || !reply.trim()) return

    setReplying(true)
    const result = await replySupportTicket(selectedTicketId, reply.trim())
    setReplying(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setReply("")
    await loadDetail(selectedTicketId)
    await loadTickets()
  }

  const handleOpenNewTicket = () => {
    if (typeof window === "undefined") return
    window.dispatchEvent(new Event("vuei:support-open"))
  }

  const openCount = tickets.filter((ticket) => ticket.status === "open").length
  const inProgressCount = tickets.filter((ticket) => ticket.status === "in_progress").length
  const resolvedCount = tickets.filter((ticket) => ticket.status === "resolved").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{props.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
        </div>
        <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={handleOpenNewTicket}>
          <Plus className="h-4 w-4" />
          Abrir novo chamado
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-white/88 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Abertos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{openCount}</p>
        </Card>
        <Card className="border-border/60 bg-white/88 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Em andamento</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{inProgressCount}</p>
        </Card>
        <Card className="border-border/60 bg-white/88 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Resolvidos</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{resolvedCount}</p>
        </Card>
      </div>

      <Card className="border-border/60 bg-white/88 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-primary" />
            <p className="font-semibold text-foreground">Seus chamados</p>
          </div>
          <span className="text-xs text-muted-foreground">{tickets.length} total</span>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Carregando chamados...</p> : null}
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        {!loading && sortedTickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-[#fbfbfc] px-5 py-10 text-center">
            <p className="font-medium text-foreground">{props.emptyTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{props.emptyDescription}</p>
            <Button variant="outline" className="mt-4 border-border/70 bg-white" onClick={handleOpenNewTicket}>
              Abrir primeiro chamado
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {sortedTickets.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              onClick={() => setSelectedTicketId(ticket.id)}
              className="w-full rounded-2xl border border-border/60 bg-[#fbfbfc] p-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{ticket.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{getSupportCategoryLabel(ticket.category)}</p>
                </div>
                <Badge className={cn("w-fit border-0", getStatusBadgeClass(ticket.status))}>
                  {getStatusLabel(ticket.status)}
                </Badge>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
                <span>Criado em {formatDate(ticket.createdAt)}</span>
                <span className="hidden sm:inline">•</span>
                <span>Atualizado em {formatDate(ticket.updatedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={Boolean(selectedTicketId)} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-white sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.ticket.title ?? "Chamado"}</DialogTitle>
            <DialogDescription>
              {detail?.ticket ? `${getSupportCategoryLabel(detail.ticket.category)} • ${getStatusLabel(detail.ticket.status)}` : "Carregando detalhes..."}
            </DialogDescription>
          </DialogHeader>

          {detail?.ticket ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border-0", getStatusBadgeClass(detail.ticket.status))}>{getStatusLabel(detail.ticket.status)}</Badge>
                  <span className="text-xs text-muted-foreground">Criado em {formatDate(detail.ticket.createdAt)}</span>
                  <span className="text-xs text-muted-foreground">Atualizado em {formatDate(detail.ticket.updatedAt)}</span>
                </div>
                <p className="mt-3 text-sm text-foreground">{detail.ticket.message}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Mensagens</p>
                <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
                  {detail.messages.map((message) => {
                    const isViewerMessage = message.senderRole === props.portalType
                    const isSystem = message.senderRole === "system"

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-2xl p-3",
                          isSystem && "border border-amber-200 bg-amber-50",
                          isViewerMessage && "ml-auto max-w-[85%] bg-primary/10 text-foreground",
                          !isViewerMessage && !isSystem && "mr-auto max-w-[85%] border border-border/60 bg-white text-foreground"
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{getViewerSenderLabel(message.senderRole, props.portalType)}</span>
                          <span>{formatDate(message.createdAt)}</span>
                        </div>
                        <p className="text-sm">{message.body}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Responder</p>
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Escreva sua mensagem para o suporte..."
                  className="min-h-28 border-border/70 bg-white"
                />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    As respostas ficam registradas neste histórico.
                  </div>
                  <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => void handleReply()} disabled={replying || !reply.trim()}>
                    <Send className="h-4 w-4" />
                    {replying ? "Enviando..." : "Enviar resposta"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando detalhes do chamado...</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
