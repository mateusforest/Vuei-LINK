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
        <DialogContent className="max-h-[92vh] overflow-hidden rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.18)] sm:max-w-3xl">
          <div className="max-h-[92vh] overflow-y-auto">
            <div className="border-b border-slate-200/80 bg-white/90 px-6 pb-5 pt-6 backdrop-blur">
              <DialogHeader>
                <DialogTitle className="pr-8 text-left text-xl font-semibold tracking-tight text-slate-950">
                  {detail?.ticket.title ?? "Chamado"}
                </DialogTitle>
                <DialogDescription className="mt-2 text-left text-sm text-slate-600">
                  {detail?.ticket ? `${getSupportCategoryLabel(detail.ticket.category)} • ${getStatusLabel(detail.ticket.status)}` : "Carregando detalhes..."}
                </DialogDescription>
              </DialogHeader>
            </div>

            {detail?.ticket ? (
              <div className="space-y-6 px-6 pb-6 pt-5">
                <div className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge className={cn("border-0 shadow-sm", getStatusBadgeClass(detail.ticket.status))}>{getStatusLabel(detail.ticket.status)}</Badge>
                    <span className="text-xs font-medium text-slate-500">Criado em {formatDate(detail.ticket.createdAt)}</span>
                    <span className="text-xs font-medium text-slate-500">Atualizado em {formatDate(detail.ticket.updatedAt)}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-800">{detail.ticket.message}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Mensagens</p>
                  <div className="max-h-[45vh] space-y-3 overflow-y-auto rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fafc_0%,#fdfefe_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    {detail.messages.map((message) => {
                      const isViewerMessage = message.senderRole === props.portalType
                      const isSystem = message.senderRole === "system"

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "rounded-[22px] px-4 py-3 shadow-sm",
                            isSystem && "mx-auto max-w-[92%] border border-amber-200/80 bg-amber-50/95 text-amber-950",
                            isViewerMessage && "ml-auto max-w-[88%] border border-sky-200/70 bg-[linear-gradient(180deg,rgba(224,242,254,0.98)_0%,rgba(219,234,254,0.96)_100%)] text-slate-900 shadow-[0_12px_28px_rgba(14,116,144,0.10)]",
                            !isViewerMessage && !isSystem && "mr-auto max-w-[88%] border border-slate-200/80 bg-white text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.07)]"
                          )}
                        >
                          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                            <span className="font-semibold text-slate-700">{getViewerSenderLabel(message.senderRole, props.portalType)}</span>
                            <span className="text-slate-500">{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-6 text-slate-800">{message.body}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3 rounded-[24px] border border-slate-200/80 bg-white px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                  <p className="text-sm font-semibold text-slate-900">Responder</p>
                  <Textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Escreva sua mensagem para o suporte..."
                    className="min-h-28 resize-none rounded-2xl border-slate-200 bg-slate-50/80 text-slate-900 placeholder:text-slate-400 focus-visible:ring-primary/30"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      As respostas ficam registradas neste histórico.
                    </div>
                    <Button
                      className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 text-white shadow-[0_18px_34px_rgba(11,86,216,0.20)] hover:opacity-95 disabled:opacity-60"
                      onClick={() => void handleReply()}
                      disabled={replying || !reply.trim()}
                    >
                      <Send className="h-4 w-4" />
                      {replying ? "Enviando..." : "Enviar resposta"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-5">
                <p className="text-sm text-slate-600">Carregando detalhes do chamado...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
