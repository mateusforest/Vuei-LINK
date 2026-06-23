"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Coins,
  Plus,
  TrendingUp,
  Gift,
  CreditCard,
  Users,
  Building2,
  Sparkles,
  Zap,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useMaster } from "@/contexts/master-context"
import { useAuth } from "@/contexts/auth-context"
import { shouldUseSupabase } from "@/lib/data-source"
import { getCreditBalance, getCreditsOverview, grantCredits, listAllCreditTransactions } from "@/lib/repositories/credits-repository"
import { formatMasterCreditTransactionDetail, formatMasterCreditTransactionLabel } from "@/lib/master/labels"
import type { CreditOwnerType, CreditTransaction } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

const creditPackages = [
  { name: "Starter", credits: 5000, price: 49, popular: false },
  { name: "Growth", credits: 15000, price: 129, popular: true },
  { name: "Pro", credits: 50000, price: 399, popular: false },
  { name: "Enterprise", credits: 200000, price: 1499, popular: false },
]

type GrantTargetOption = {
  id: string
  ownerType: CreditOwnerType
  name: string
  description: string
  balance: number
  group: "agency" | "user" | "client"
}

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const diffMinutes = Math.max(Math.floor(diffMs / 60000), 0)
  if (diffMinutes < 1) return "agora"
  if (diffMinutes < 60) return `${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d`
}

export default function MasterCreditosPage() {
  const { agencies, users, clients } = useMaster()
  const { user } = useAuth()
  const isRealMode = shouldUseSupabase()
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [overview, setOverview] = useState({
    totalAvailable: 0,
    totalConsumed: 0,
    monthlyUsage: 0,
    transactionsCount: 0,
  })
  const [loadError, setLoadError] = useState<string | null>(null)
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantSubmitting, setGrantSubmitting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const [grantTargetId, setGrantTargetId] = useState("")
  const [grantAmount, setGrantAmount] = useState("100")
  const [grantReason, setGrantReason] = useState("")
  const [balanceOverrides, setBalanceOverrides] = useState<Record<string, number>>({})

  const grantTargets = useMemo<GrantTargetOption[]>(() => {
    const agencyTargets = agencies.map((agency) => ({
      id: `agency:${agency.id}`,
      ownerType: "agency" as const,
      name: agency.name,
      description: "Agência",
      balance: balanceOverrides[`agency:${agency.id}`] ?? agency.creditsBalance,
      group: "agency" as const,
    }))

    const userTargets = users
      .filter((profile) => profile.type !== "agency")
      .map((profile) => ({
        id: `profile:${profile.id}`,
        ownerType: "profile" as const,
        name: profile.name,
        description: profile.email,
        balance: balanceOverrides[`profile:${profile.id}`] ?? profile.creditsBalance,
        group: "user" as const,
      }))

    const clientTargets = clients.map((client) => ({
      id: `client:${client.id}`,
      ownerType: "client" as const,
      name: client.name,
      description: client.agencyName ? `Cliente de ${client.agencyName}` : "Cliente",
      balance: balanceOverrides[`client:${client.id}`] ?? client.creditsBalance,
      group: "client" as const,
    }))

    return [...agencyTargets, ...userTargets, ...clientTargets]
  }, [agencies, balanceOverrides, clients, users])

  const groupedTargets = useMemo(
    () => ({
      agencies: grantTargets.filter((target) => target.group === "agency"),
      users: grantTargets.filter((target) => target.group === "user"),
      clients: grantTargets.filter((target) => target.group === "client"),
    }),
    [grantTargets],
  )

  const selectedGrantTarget = useMemo(
    () => grantTargets.find((target) => target.id === grantTargetId) ?? null,
    [grantTargetId, grantTargets],
  )

  const loadCredits = useCallback(async () => {
    const [overviewResult, transactionsResult] = await Promise.all([
      getCreditsOverview(),
      listAllCreditTransactions(20),
    ])

    setLoadError(overviewResult.error ?? transactionsResult.error ?? null)
    setOverview(
      overviewResult.data ?? {
        totalAvailable: 0,
        totalConsumed: 0,
        monthlyUsage: 0,
        transactionsCount: 0,
      },
    )
    setTransactions(transactionsResult.data ?? [])
  }, [])

  useEffect(() => {
    if (!isRealMode) return
    void loadCredits()
  }, [isRealMode, loadCredits])

  const normalizedTopConsumers = useMemo(
    () =>
      [
        ...agencies.map((agency) => ({
          name: agency.name,
          type: "agency" as const,
          currentBalance: balanceOverrides[`agency:${agency.id}`] ?? agency.creditsBalance,
        })),
        ...users
          .filter((profile) => profile.type !== "agency")
          .map((profile) => ({
            name: profile.name,
            type: "user" as const,
            currentBalance: balanceOverrides[`profile:${profile.id}`] ?? profile.creditsBalance,
          })),
        ...clients.map((client) => ({
          name: client.agencyName ? `${client.name} • ${client.agencyName}` : client.name,
          type: "client" as const,
          currentBalance: balanceOverrides[`client:${client.id}`] ?? client.creditsBalance,
        })),
      ]
        .sort((a, b) => b.currentBalance - a.currentBalance)
        .slice(0, 4)
        .filter((item) => item.currentBalance > 0),
    [agencies, balanceOverrides, clients, users],
  )

  const availableBase = Math.max(overview.totalAvailable + overview.totalConsumed, 1)
  const pageStats = [
    {
      label: "Créditos disponíveis",
      value: `${(overview.totalAvailable / 1000).toFixed(0)}K`,
      change: "saldo real",
      icon: Coins,
    },
    {
      label: "Créditos consumidos",
      value: `${(overview.totalConsumed / 1000).toFixed(0)}K`,
      change: "ledger acumulado",
      icon: TrendingUp,
    },
    {
      label: "Uso Mensal",
      value: `${(overview.monthlyUsage / 1000).toFixed(1)}K`,
      change: "mês atual",
      icon: Zap,
    },
    {
      label: "Transações",
      value: overview.transactionsCount.toString(),
      change: "histórico real",
      icon: CreditCard,
    },
  ]

  const resetGrantForm = () => {
    setGrantTargetId("")
    setGrantAmount("100")
    setGrantReason("")
    setGrantError(null)
  }

  const handleGrantCredits = async () => {
    setGrantError(null)

    if (!selectedGrantTarget) {
      setGrantError("Selecione quem vai receber os créditos.")
      return
    }

    const normalizedAmount = Number.parseInt(grantAmount, 10)
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      setGrantError("Informe uma quantidade positiva de créditos.")
      return
    }

    if (!grantReason.trim()) {
      setGrantError("Informe o motivo da concessão.")
      return
    }

    setGrantSubmitting(true)

    try {
      const result = await grantCredits({
        ownerType: selectedGrantTarget.ownerType,
        ownerId: selectedGrantTarget.id.split(":")[1] ?? "",
        amount: normalizedAmount,
        reason: grantReason.trim(),
        source: "admin_grant",
        createdBy: user?.id ?? null,
        metadata: {
          targetName: selectedGrantTarget.name,
          targetType: selectedGrantTarget.ownerType,
          grantedFrom: "master",
        },
      })

      if (!result.data) {
        setGrantError(result.error ?? "Não foi possível conceder créditos.")
        return
      }

      const ownerId = selectedGrantTarget.id.split(":")[1] ?? ""
      const balanceResult = await getCreditBalance(selectedGrantTarget.ownerType, ownerId)
      if (balanceResult.data) {
        setBalanceOverrides((current) => ({
          ...current,
          [selectedGrantTarget.id]: balanceResult.data!.balance,
        }))
      }

      await loadCredits()
      setGrantOpen(false)
      resetGrantForm()
    } finally {
      setGrantSubmitting(false)
    }
  }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Créditos</h1>
          <p className="text-sm text-muted-foreground">Leitura real do saldo e ledger de créditos da plataforma</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5" onClick={() => setGrantOpen(true)}>
            <Gift className="h-4 w-4" />
            Enviar créditos
          </Button>
          <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5" disabled>
            <Gift className="h-4 w-4" />
            Campanhas em breve
          </Button>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2" disabled>
            <Plus className="h-4 w-4" />
            Pacotes em breve
          </Button>
        </div>
      </motion.div>

      {loadError ? (
        <motion.div variants={fadeInUp}>
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{loadError}</Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat, index) => (
          <Card
            key={index}
            className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-emerald-400">{stat.change}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pacotes de créditos</h2>
          <Badge variant="outline" className="border-white/10 bg-white/5 text-xs text-muted-foreground">
            Pagamento ainda não integrado
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPackages.map((pkg, index) => (
            <Card
              key={pkg.name}
              className={`relative border-white/5 bg-black/40 backdrop-blur-xl p-6 transition-all duration-300 ${
                index === 1 ? "border-primary/30 ring-1 ring-primary/20" : ""
              }`}
            >
              {index === 1 ? (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-medium text-white">
                  Popular
                </div>
              ) : null}
              <div className="text-center space-y-4">
                <div className="text-sm font-medium text-muted-foreground">{pkg.name}</div>
                <div className="text-3xl font-bold text-foreground">
                  {pkg.credits.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">créditos</span>
                </div>
                <div className="text-2xl font-bold text-primary">R$ {pkg.price}</div>
                <div className="text-xs text-muted-foreground">Pagamento real em breve</div>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Transações Recentes</h2>
              <span className="text-xs text-muted-foreground">ledger operacional</span>
            </div>

            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  Nenhuma transacao real registrada ainda.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 0
                          ? "bg-emerald-500/10 border border-emerald-500/20"
                          : "bg-red-500/10 border border-red-500/20"
                      }`}
                    >
                      {tx.amount > 0 ? (
                        <CreditCard className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Zap className="h-4 w-4 text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{formatMasterCreditTransactionLabel(tx)}</div>
                      <div className="text-xs text-muted-foreground">{formatMasterCreditTransactionDetail(tx)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${tx.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(tx.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Maior Saldo Atual</h2>
              <span className="text-xs text-muted-foreground">agências, usuários e clientes</span>
            </div>

            <div className="space-y-4">
              {normalizedTopConsumers.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                  Nenhum saldo real disponível ainda.
                </div>
              ) : (
                normalizedTopConsumers.map((consumer, index) => {
                  const percentage = Math.round((consumer.currentBalance / availableBase) * 100)
                  return (
                    <div key={`${consumer.name}-${index}`} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                            {consumer.type === "agency" ? (
                              <Building2 className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Users className="h-3.5 w-3.5 text-primary" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-foreground">{consumer.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{consumer.currentBalance.toLocaleString()} créditos</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden border-white/5 bg-gradient-to-br from-primary/10 to-accent/5 backdrop-blur-xl p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(93,224,230,0.1)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Campanhas de bonus</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  O ledger real ja esta preparado. Compra, bonus promocional e billing entram na proxima fase.
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Sem graficos fake</span>
                  <span>Sem compras reais ainda</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 hover:bg-white/5" disabled>
                Configurar depois
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <Dialog
        open={grantOpen}
        onOpenChange={(open) => {
          setGrantOpen(open)
          if (!open) resetGrantForm()
        }}
      >
        <DialogContent className="border-white/10 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Enviar créditos</DialogTitle>
            <DialogDescription>
              Conceda créditos manualmente para agências, usuários individuais ou clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Destino</label>
              <select
                value={grantTargetId}
                onChange={(event) => setGrantTargetId(event.target.value)}
                className="h-10 w-full rounded-md border border-white/10 bg-black/40 px-3 text-sm text-foreground"
              >
                <option value="">Selecione uma entidade</option>
                {groupedTargets.agencies.length > 0 ? (
                  <optgroup label="Agências">
                    {groupedTargets.agencies.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} • {target.description}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupedTargets.users.length > 0 ? (
                  <optgroup label="Usuários">
                    {groupedTargets.users.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} • {target.description}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {groupedTargets.clients.length > 0 ? (
                  <optgroup label="Clientes">
                    {groupedTargets.clients.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} • {target.description}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {selectedGrantTarget ? (
                <p className="text-xs text-muted-foreground">
                  Saldo atual: {selectedGrantTarget.balance.toLocaleString()} créditos
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quantidade</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={grantAmount}
                onChange={(event) => setGrantAmount(event.target.value)}
                placeholder="100"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Motivo</label>
              <Textarea
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                placeholder="Ex.: concessão manual aprovada pelo Master"
                className="min-h-24 border-white/10 bg-black/40"
              />
            </div>

            {grantError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{grantError}</div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" className="border-white/10" onClick={() => setGrantOpen(false)} disabled={grantSubmitting}>
              Cancelar
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
              onClick={handleGrantCredits}
              disabled={grantSubmitting}
            >
              {grantSubmitting ? "Enviando..." : "Confirmar envio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
