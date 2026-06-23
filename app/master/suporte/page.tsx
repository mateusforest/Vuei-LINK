"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Gift, LifeBuoy, MessageCircleReply, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { applySupportBonus, getSupportTicketDetail, listSupportTickets, replySupportTicket, updateSupportTicketStatus } from "@/lib/repositories/support-repository"
import { getSupportCategoryLabel, getSupportPortalLabel, getSupportPriorityLabel, getSupportSenderRoleLabel, getSupportStatusLabel } from "@/lib/support/labels"
import { cn } from "@/lib/utils"
import type { SupportBonusPayload, SupportBonusType, SupportMessage, SupportTicket, SupportTicketPriority, SupportTicketStatus } from "@/types"

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

type TicketDetail = { ticket: SupportTicket; messages: SupportMessage[] }

export default function MasterSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [reply, setReply] = useState("")
  const [replying, setReplying] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState<SupportTicketStatus | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | SupportTicketStatus>("all")
  const [priorityFilter, setPriorityFilter] = useState<"all" | SupportTicketPriority>("all")
  const [search, setSearch] = useState("")
  const [bonusTarget, setBonusTarget] = useState("")
  const [bonusType, setBonusType] = useState<SupportBonusType>("credits")
  const [bonusQuantity, setBonusQuantity] = useState("1")
  const [bonusReason, setBonusReason] = useState("")
  const [bonusTripTitle, setBonusTripTitle] = useState("")
  const [bonusClientName, setBonusClientName] = useState("")
  const [bonusSubmitting, setBonusSubmitting] = useState(false)
  const [bonusError, setBonusError] = useState<string | null>(null)
  const [bonusSuccess, setBonusSuccess] = useState<string | null>(null)

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
      setBonusError(null)
      setBonusSuccess(null)
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

  const ticketTargets = useMemo(() => {
    if (!detail?.ticket) return []

    const portalType = detail.ticket.context?.portalType
    const targets: Array<{ value: string; label: string; type: "agency" | "traveler" }> = []

    if (detail.ticket.agencyId) {
      targets.push({
        value: `agency:${detail.ticket.agencyId}`,
        type: "agency",
        label: detail.ticket.context?.agencyName
          ? `Agência: ${detail.ticket.context.agencyName}`
          : "Agência vinculada",
      })
    }

    if (portalType === "traveler" && detail.ticket.userId) {
      const travelerLabel =
        typeof detail.ticket.context?.name === "string" && detail.ticket.context.name.trim()
          ? detail.ticket.context.name.trim()
          : typeof detail.ticket.context?.email === "string" && detail.ticket.context.email.trim()
            ? detail.ticket.context.email.trim()
            : "Viajante"

      targets.push({
        value: `traveler:${detail.ticket.userId}`,
        type: "traveler",
        label: `Viajante: ${travelerLabel}`,
      })
    }

    return targets
  }, [detail])

  useEffect(() => {
    if (ticketTargets.length === 0) {
      setBonusTarget("")
      return
    }

    setBonusTarget((current) => (ticketTargets.some((target) => target.value === current) ? current : ticketTargets[0].value))
  }, [ticketTargets])

  useEffect(() => {
    const targetType = bonusTarget.startsWith("agency:") ? "agency" : bonusTarget.startsWith("traveler:") ? "traveler" : null
    if (targetType === "traveler" && bonusType === "client_extra") {
      setBonusType("trip_extra")
    }
  }, [bonusTarget, bonusType])

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

  const handleStatusUpdate = async (status: SupportTicketStatus) => {
    if (!selectedTicketId) return
    setStatusUpdating(status)
    const result = await updateSupportTicketStatus(selectedTicketId, status)
    setStatusUpdating(null)
    if (result.error) {
      setError(result.error)
      return
    }
    await loadDetail(selectedTicketId)
    await loadTickets()
  }

  const handleBonusSubmit = async () => {
    if (!selectedTicketId || !bonusTarget) {
      setBonusError("Selecione a conta que vai receber a bonificação.")
      return
    }

    const normalizedQuantity = Number.parseInt(bonusQuantity, 10)
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      setBonusError("Informe uma quantidade positiva.")
      return
    }

    if (!bonusReason.trim()) {
      setBonusError("Informe o motivo da bonificação.")
      return
    }

    const [targetType, targetId] = bonusTarget.split(":") as ["agency" | "traveler", string]
    const payload: SupportBonusPayload = {
      targetType,
      targetId,
      bonusType,
      quantity: normalizedQuantity,
      reason: bonusReason.trim(),
      relatedClientName: bonusClientName.trim() || null,
      relatedTripTitle: bonusTripTitle.trim() || null,
    }

    setBonusSubmitting(true)
    setBonusError(null)
    setBonusSuccess(null)

    const result = await applySupportBonus(selectedTicketId, payload)

    setBonusSubmitting(false)

    if (result.error) {
      setBonusError(result.error)
      return
    }

    setBonusSuccess("Bonificação aplicada com sucesso.")
    setBonusQuantity("1")
    setBonusReason("")
    setBonusTripTitle("")
    setBonusClientName("")
    await loadDetail(selectedTicketId)
    await loadTickets()
  }

  const urgentCount = tickets.filter((ticket) => ticket.priority === "urgent" && ticket.status !== "resolved").length
  const selectedTargetType = bonusTarget.startsWith("agency:") ? "agency" : "traveler"

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
          <p className="text-sm font-semibold text-foreground">Resumo rapido</p>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border/60 bg-white sm:max-w-4xl">
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
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Agência</p>
                  <p className="mt-1 font-medium">{String(detail.ticket.context?.agencyName ?? detail.ticket.agencyId ?? "Não vinculada")}</p>
                </div>
                <div className="text-xs text-slate-500">
                  Criado em {new Date(detail.ticket.createdAt).toLocaleString("pt-BR")}
                </div>
                <div className="flex items-center gap-2">
                  <TicketPriorityBadge priority={detail.ticket.priority as any} />
                  <TicketStatusBadge status={detail.ticket.status as any} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Mensagem inicial</p>
                  <p className="mt-1 text-sm text-slate-700">{detail.ticket.message}</p>
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

              <div className="space-y-3 rounded-2xl border border-border/60 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-slate-900">Bonificar conta</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Conta alvo</label>
                    <select
                      value={bonusTarget}
                      onChange={(event) => setBonusTarget(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      {ticketTargets.length === 0 ? <option value="">Sem conta disponível</option> : null}
                      {ticketTargets.map((target) => (
                        <option key={target.value} value={target.value}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Tipo de bonificação</label>
                    <select
                      value={bonusType}
                      onChange={(event) => setBonusType(event.target.value as SupportBonusType)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                    >
                      <option value="credits">Créditos extras</option>
                      {selectedTargetType === "agency" ? <option value="client_extra">Cliente extra</option> : null}
                      <option value="trip_extra">Viagem extra</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Quantidade</label>
                    <Input value={bonusQuantity} onChange={(event) => setBonusQuantity(event.target.value)} placeholder="1" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Viagem relacionada</label>
                    <Input value={bonusTripTitle} onChange={(event) => setBonusTripTitle(event.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Cliente relacionado</label>
                    <Input value={bonusClientName} onChange={(event) => setBonusClientName(event.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Motivo</label>
                    <Textarea value={bonusReason} onChange={(event) => setBonusReason(event.target.value)} placeholder="Explique a compensação aplicada." className="min-h-28" />
                  </div>
                </div>

                {bonusError ? <p className="text-sm text-red-600">{bonusError}</p> : null}
                {bonusSuccess ? <p className="text-sm text-emerald-700">{bonusSuccess}</p> : null}

                <div className="flex justify-end">
                  <Button className="bg-gradient-to-r from-primary to-accent text-white" disabled={bonusSubmitting || ticketTargets.length === 0} onClick={() => void handleBonusSubmit()}>
                    {bonusSubmitting ? "Aplicando..." : "Aplicar bonificação"}
                  </Button>
                </div>
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
