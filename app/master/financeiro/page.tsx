"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"
import { mapLegacyAgencyPlanToCommercialPlan } from "@/lib/billing/agency-plans"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDateLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  }).format(date)
}

function buildMonthlySeries(
  transactions: Array<{ amount: number; createdAt: string; status: string }>,
  months = 6
) {
  const now = new Date()
  const series = Array.from({ length: months }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - index - 1), 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: getMonthLabel(date),
      value: 0,
    }
  })

  const seriesMap = new Map(series.map((item) => [item.key, item]))

  for (const transaction of transactions) {
    if (transaction.status !== "completed") continue
    const date = new Date(transaction.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const bucket = seriesMap.get(key)
    if (bucket) {
      bucket.value += Math.max(transaction.amount, 0)
    }
  }

  return series
}

export default function MasterFinanceiroPage() {
  const { transactions, agencies, credits } = useMaster()
  const [dateRange, setDateRange] = useState("30d")
  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    setExporting(true)
    window.setTimeout(() => setExporting(false), 1500)
  }

  const completedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.status === "completed"),
    [transactions]
  )

  const pendingTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.status === "pending"),
    [transactions]
  )

  const totalRevenue = completedTransactions.reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0)
  const totalCreditsSold = completedTransactions
    .filter((transaction) => transaction.type === "credits")
    .reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0)

  const activePaidAgencies = agencies.filter(
    (agency) => agency.status === "active" && mapLegacyAgencyPlanToCommercialPlan(agency.plan) !== "free"
  ).length
  const monthlySeries = useMemo(() => buildMonthlySeries(transactions), [transactions])
  const maxMonthlyValue = Math.max(...monthlySeries.map((item) => item.value), 0)

  const breakdown = useMemo(() => {
    const groups = [
      {
        key: "subscription",
        label: "Assinaturas",
        total: completedTransactions
          .filter((transaction) => transaction.type === "subscription")
          .reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0),
      },
      {
        key: "credits",
        label: "Pacotes de créditos",
        total: completedTransactions
          .filter((transaction) => transaction.type === "credits")
          .reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0),
      },
      {
        key: "refund",
        label: "Reembolsos",
        total: completedTransactions
          .filter((transaction) => transaction.type === "refund")
          .reduce((sum, transaction) => sum + Math.max(transaction.amount, 0), 0),
      },
    ].filter((group) => group.total > 0)

    return groups.map((group) => ({
      ...group,
      percentage: totalRevenue > 0 ? Math.round((group.total / totalRevenue) * 100) : 0,
    }))
  }, [completedTransactions, totalRevenue])

  const metrics = [
    {
      label: "Receita confirmada",
      value: formatCurrency(totalRevenue),
      change: `${completedTransactions.length} transações concluídas`,
      trend: completedTransactions.length > 0 ? "up" : "neutral",
      icon: DollarSign,
    },
    {
      label: "Agências pagas ativas",
      value: activePaidAgencies.toString(),
      change: `${agencies.length} agências no total`,
      trend: activePaidAgencies > 0 ? "up" : "neutral",
      icon: Wallet,
    },
    {
      label: "Pacotes de créditos",
      value: formatCurrency(totalCreditsSold),
      change: `${credits.totalConsumed} créditos consumidos na plataforma`,
      trend: totalCreditsSold > 0 ? "up" : "neutral",
      icon: CreditCard,
    },
    {
      label: "Transações pendentes",
      value: pendingTransactions.length.toString(),
      change: pendingTransactions.length > 0 ? "Acompanhamento necessário" : "Nenhuma pendência",
      trend: pendingTransactions.length > 0 ? "down" : "neutral",
      icon: Clock,
    },
  ] as const

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      <motion.div variants={fadeInUp} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Visão operacional baseada apenas em dados disponíveis no portal master.
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px] border-white/10 bg-black/40">
              <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-card">
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="gap-2 border-white/10 hover:bg-white/5"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Preparando..." : "Exportar"}
          </Button>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((metric) => {
          const iconColor =
            metric.trend === "down"
              ? "text-amber-400"
              : metric.trend === "up"
                ? "text-emerald-400"
                : "text-muted-foreground"

          return (
            <Card
              key={metric.label}
              className="border-white/5 bg-black/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                  <div className="text-2xl font-bold text-foreground">{metric.value}</div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${iconColor}`}>
                    {metric.trend === "down" ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    <span>{metric.change}</span>
                  </div>
                </div>
                <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/20 to-accent/10 p-2">
                  <metric.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </Card>
          )
        })}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 p-6 backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">Receita mensal</h2>
              <p className="text-xs text-muted-foreground">
                Consolidado dos últimos meses com base nas transações reais registradas.
              </p>
            </div>

            {maxMonthlyValue === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Sem receita consolidada ainda</p>
                  <p className="text-xs text-muted-foreground">
                    Quando houver transações concluídas no master, a evolução mensal aparecerá aqui.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-end gap-3">
                {monthlySeries.map((data) => (
                  <div key={data.key} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{formatCurrency(data.value)}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary to-accent transition-all duration-500 hover:opacity-80"
                      style={{ height: `${Math.max((data.value / maxMonthlyValue) * 100, 8)}%` }}
                    />
                    <span className="text-[10px] uppercase text-muted-foreground">{data.month}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 p-6 backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">Composição da receita</h2>
              <p className="text-xs text-muted-foreground">
                Distribuição por tipo de transação financeira disponível hoje.
              </p>
            </div>

            {breakdown.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Sem composição para exibir</p>
                  <p className="text-xs text-muted-foreground">
                    O painel não cria percentuais artificiais quando não há transações reais.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {breakdown.map((item) => (
                  <div key={item.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-sm font-semibold text-foreground">{formatCurrency(item.total)}</span>
                        <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeInUp}>
        <Card className="overflow-hidden border-white/5 bg-black/40 backdrop-blur-xl">
          <div className="border-b border-white/5 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Transações recentes</h2>
                <p className="text-xs text-muted-foreground">
                  Últimas movimentações reais disponíveis no master.
                </p>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary/80">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="flex min-h-56 items-center justify-center px-6 py-12 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Nenhuma transação registrada</p>
                <p className="text-xs text-muted-foreground">
                  O master permanece vazio até existirem eventos financeiros reais na plataforma.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Entidade</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Descrição</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-muted-foreground">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 5).map((transaction) => {
                    const entityName =
                      transaction.agencyName || transaction.userName || "Registro financeiro"

                    const badgeClass =
                      transaction.type === "subscription"
                        ? "bg-primary/10 text-primary"
                        : transaction.type === "credits"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-amber-500/10 text-amber-300"

                    const badgeLabel =
                      transaction.type === "subscription"
                        ? "Assinatura"
                        : transaction.type === "credits"
                          ? "Créditos"
                          : "Reembolso"

                    const statusClass =
                      transaction.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : transaction.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-red-500/10 text-red-400"

                    return (
                      <tr
                        key={transaction.id}
                        className="border-b border-white/5 transition-colors hover:bg-white/5"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 to-accent/10">
                              <Building2 className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <span className="text-sm font-medium text-foreground">{entityName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{transaction.description || "-"}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}>
                            {transaction.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                            {transaction.status === "pending" && <Clock className="h-3 w-3" />}
                            {transaction.status === "failed" && <TrendingDown className="h-3 w-3" />}
                            {transaction.status === "completed"
                              ? "Concluída"
                              : transaction.status === "pending"
                                ? "Pendente"
                                : "Falhou"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDateLabel(transaction.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
