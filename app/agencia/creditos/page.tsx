"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Coins, TrendingUp, Clock, Crown, ChevronRight, Gift } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useAgency } from "@/contexts/agency-context"
import { shouldUseSupabase } from "@/lib/data-source"
import { getCreditBalance, listCreditTransactions } from "@/lib/repositories/credits-repository"
import type { CreditTransaction } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function AgencyCreditsPage() {
  const { agencyId, credits, subscription } = useAgency()
  const isRealMode = shouldUseSupabase()
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [realHistory, setRealHistory] = useState<CreditTransaction[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isRealMode || !agencyId) return

    let mounted = true

    const loadCredits = async () => {
      const [balanceResult, historyResult] = await Promise.all([
        getCreditBalance("agency", agencyId),
        listCreditTransactions("agency", agencyId),
      ])

      if (!mounted) return

      setLoadError(balanceResult.error ?? historyResult.error ?? null)
      setRealBalance(balanceResult.data?.balance ?? 0)
      setRealHistory(historyResult.data ?? [])
    }

    void loadCredits()

    return () => {
      mounted = false
    }
  }, [agencyId, isRealMode])

  const effectiveBalance = isRealMode ? (realBalance ?? 0) : credits.balance
  const effectiveHistory = useMemo(
    () =>
      isRealMode
        ? realHistory.map((transaction) => ({
            action: transaction.reason || transaction.type,
            amount: transaction.amount,
            date: transaction.createdAt,
            source: transaction.source || "Supabase",
          }))
        : credits.history,
    [credits.history, isRealMode, realHistory],
  )

  const grantedCredits = effectiveHistory.reduce((sum, item) => (item.amount > 0 ? sum + item.amount : sum), 0)
  const usedCredits = effectiveHistory.reduce((sum, item) => (item.amount < 0 ? sum + Math.abs(item.amount) : sum), 0)
  const usageBase = Math.max(grantedCredits, effectiveBalance + usedCredits, subscription.definition.monthlyCredits, 1)
  const usagePercentage = (usedCredits / usageBase) * 100

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Hoje"
    if (diffDays === 1) return "Ontem"
    if (diffDays < 7) return `Ha ${diffDays} dias`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div {...fadeInUp} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Creditos IA</h1>
          <p className="text-sm text-muted-foreground">Saldo, consumo e capacidade do plano atual da agencia.</p>
        </div>
        <Badge className="border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-300">
          <Crown size={14} className="mr-1" />
          {subscription.definition.name}
        </Badge>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-secondary/10 p-6 vuei-glass">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins size={16} className="text-primary" />
                Saldo disponivel
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold vuei-gradient-text">{effectiveBalance}</span>
                <span className="text-muted-foreground">creditos</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-green-400">
                  <Gift size={14} />
                  <span>{subscription.definition.monthlyCredits} creditos mensais no plano {subscription.definition.name}</span>
                </div>
                <div>{subscription.definition.maxUsers} usuarios e {subscription.definition.maxActiveTrips} viagens ativas inclusos</div>
              </div>
            </div>

            <div className="space-y-3 lg:text-right">
              <div className="flex items-center gap-2 lg:justify-end">
                <TrendingUp size={14} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {usedCredits} de {usageBase} utilizados
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2 w-full lg:w-52" />
              <p className="text-xs text-muted-foreground">
                Sem compra real nesta etapa. O plano da agencia prepara a arquitetura para futura integracao Stripe.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {loadError ? (
        <motion.div {...fadeInUp}>
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {loadError}
          </Card>
        </motion.div>
      ) : null}

      <motion.div {...fadeInUp}>
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Planos, limites e pacotes extras</h2>
              <p className="text-sm text-muted-foreground">
                Compare Start, Pro e Business, veja a capacidade operacional e os pacotes de creditos extras.
              </p>
            </div>
            <Button asChild className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold">
              <Link href="/agencia/planos">
                Ver planos
                <ChevronRight size={16} className="ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Historico de consumo</h2>
        </div>
        <Card className="divide-y divide-border/50 border-border/50 bg-card/50 vuei-glass">
          {effectiveHistory.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhum consumo de creditos registrado ainda.</div>
          ) : (
            effectiveHistory.slice(0, 8).map((item, index) => (
              <div key={`${item.action}-${index}`} className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.amount > 0 ? "bg-green-500/20" : "bg-muted/50"}`}>
                  <Clock size={16} className={item.amount > 0 ? "text-green-400" : "text-muted-foreground"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.action}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>
                </div>
                <span className={`text-sm font-semibold ${item.amount > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                  {item.amount > 0 ? "+" : ""}
                  {item.amount}
                </span>
              </div>
            ))
          )}
        </Card>
      </motion.div>
    </div>
  )
}
