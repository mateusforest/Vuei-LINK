"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, LifeBuoy, MessageCircleReply, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getSupportCategoryLabel, getSupportPortalLabel, getSupportPriorityLabel, getSupportSenderRoleLabel, getSupportStatusLabel } from "@/lib/support/labels"
import { getSupportTicketDetail, listSupportTickets, replySupportTicket, updateSupportTicketStatus } from "@/lib/repositories/support-repository"
import { cn } from "@/lib/utils"
import type { SupportMessage, SupportTicket, SupportTicketPriority, SupportTicketStatus } from "@/types"

function TicketPriorityBadge({ priority }: { priority: SupportTicketPriority }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        priority === "urgent" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700",
      )}
    >
      {getSupportPriorityLabel(priority)}
    </span>
  )
}

function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        status === "resolved" && "bg-emerald-100 text-emerald-700",
        status === "in_progress" && "bg-sky-100 text-sky-700",
        status === "open" && "bg-amber-100 text-amber-700",
      )}
    >
      {getSupportStatusLabel(status)}
    </span>
  )
}

export default function MasterSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ ticket: SupportTicket; messages: SupportMessage[] } | null>(null)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<SupportTicketStatus | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicketStatus>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | SupportTicketPriority>("all")
  const [search, setSearch] = useState("")

  const loadTickets = async () => {
    setLoading(true)
    const result = await listSupportTickets()
    setTickets(result.data)
    setError(result.error)
    setLoading(false)
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  useEffect(() => {
    if (!selectedTicketId) {
      setDetail(null)
      return
    }

    let active = true
    const loadDetail = async () => {
      const result = await getSupportTicketDetail(selectedTicketId)
      if (!active) return
      setDetail(result.data)
      setError(result.error)
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [selectedTicketId])

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return tickets.filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false
      if (!normalizedSearch) return true
      const portalType = typeof ticket.context?.portalType === "string" ? ticket.context.portalType : ""
      return [ticket.title, ticket.message, ticket.context?.email, ticket.context?.name, portalType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch))
    })
  }, [tickets, statusFilter, priorityFilter, search])

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
    const detailResult = await getSupportTicketDetail(selectedTicketId)
    setDetail(detailResult.data)
    await loadTickets()
  }

  const handleStatusUpdate = async (status: SupportTicketStatus) => {
    if (!selectedTicketId) return
    setStatusUpdating(status)
    const result = await updateSupportTicketStatus(selectedTicketId, status)
    setStatusUpdating(null)
    if (result.error) {
      setError(result.error)
      return
    }
    const detailResult = await getSupportTicketDetail(selectedTicketId)
    setDetail(detailResult.data)
    await loadTickets()
  }

  const urgentCount = tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acompanhe chamados enviados pelos portais viajante e agência.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {urgentCount} urgente(s) em aberto
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Card className="border-border/60 bg-card/80 p-4">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por assunto, usuário ou portal..." className="pl-9" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | SupportTicketStatus)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">Todos os status</option>
              <option value="open">Aberto</option>
              <option value="in_progress">Em andamento</option>
              <option value="resolved">Resolvido</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "all" | SupportTicketPriority)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">Todas as prioridades</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Carregando chamados...</p> : null}
            {!loading && filteredTickets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                Nenhum chamado encontrado com os filtros atuais.
              </div>
            ) : null}

            {filteredTickets.map((ticket) => {
              const portalType = typeof ticket.context?.portalType === "string" ? ticket.context.portalType : "traveler"
              const travelerName = typeof ticket.context?.name === "string" ? ticket.context.name : "Usuário"
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    ticket.priority === "urgent" ? "border-red-200 bg-red-50/60" : "border-border/60 bg-background/70",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <LifeBuoy className="h-4 w-4 text-primary" />
                        <p className="font-semibold text-foreground">{ticket.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TicketPriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{travelerName}</span>
                    <span>•</span>
                    <span>{getSupportPortalLabel(portalType as any)}</span>
                    <span>•</span>
                    <span>{getSupportCategoryLabel(ticket.category as any)}</span>
                    <span>•</span>
                    <span>{new Date(ticket.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="border-border/60 bg-card/80 p-4">
          <p className="text-sm font-semibold text-foreground">Resumo rápido</p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <span>Chamados abertos</span>
              <strong className="text-foreground">{tickets.filter((ticket) => ticket.status === "open").length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <span>Em andamento</span>
              <strong className="text-foreground">{tickets.filter((ticket) => ticket.status === "in_progress").length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
              <span>Resolvidos</span>
              <strong className="text-foreground">{tickets.filter((ticket) => ticket.status === "resolved").length}</strong>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <span>Urgentes</span>
              <strong>{urgentCount}</strong>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </Card>
      </div>

      <Dialog open={Boolean(selectedTicketId)} onOpenChange={(open) => !open && setSelectedTicketId(null)}>
        <DialogContent className="max-w-3xl border-border/60 bg-white">
          <DialogHeader>
            <DialogTitle>{detail?.ticket.title ?? "Chamado"}</DialogTitle>
            <DialogDescription>
              {detail?.ticket ? `${getSupportCategoryLabel(detail.ticket.category as any)} • ${getSupportStatusLabel(detail.ticket.status as any)}` : "Carregando detalhes..."}
            </DialogDescription>
          </DialogHeader>

          {detail?.ticket ? (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-border/60 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Usuário</p>
                  <p className="mt-1 font-medium">{String(detail.ticket.context?.name ?? "Usuário")}</p>
                  <p className="text-xs text-slate-500">{String(detail.ticket.context?.email ?? "Sem email")}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Origem</p>
                  <p className="mt-1 font-medium">{getSupportPortalLabel((detail.ticket.context?.portalType as any) ?? "traveler")}</p>
                  <p className="text-xs text-slate-500">{String(detail.ticket.context?.currentRoute ?? "Rota não informada")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <TicketPriorityBadge priority={detail.ticket.priority as any} />
                  <TicketStatusBadge status={detail.ticket.status as any} />
                </div>
                <div className="text-xs text-slate-500">
                  Criado em {new Date(detail.ticket.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Histórico</p>
                <div className="max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-slate-50 p-4">
                  {detail.messages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-white bg-white p-3 shadow-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                        <span>{getSupportSenderRoleLabel(message.senderRole as any)}</span>
                        <span>{new Date(message.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="text-sm text-slate-800">{message.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Button variant="outline" onClick={() => void handleStatusUpdate("open")} disabled={statusUpdating !== null}>
                  Reabrir
                </Button>
                <Button variant="outline" onClick={() => void handleStatusUpdate("in_progress")} disabled={statusUpdating !== null}>
                  Em andamento
                </Button>
                <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void handleStatusUpdate("resolved")} disabled={statusUpdating !== null}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Resolver
                </Button>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">Responder</p>
                <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Escreva a resposta do suporte..." className="min-h-32" />
                <div className="flex justify-end">
                  <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => void handleReply()} disabled={replying || !reply.trim()}>
                    <MessageCircleReply className="h-4 w-4" />
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
