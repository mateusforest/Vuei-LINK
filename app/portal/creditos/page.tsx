"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  Coins,
  TrendingUp,
  Gift,
  ChevronRight,
  MessageCircle,
  FileText,
  WifiOff,
  Clock,
  Crown,
  Loader2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useTrips } from "@/contexts/trips-context"
import { shouldUseSupabase } from "@/lib/data-source"
import { useAuth } from "@/contexts/auth-context"
import { listCreditTransactions } from "@/lib/repositories/credits-repository"
import { createTravelerCreditsCheckout, getTravelerBillingStatus } from "@/lib/repositories/traveler-billing-repository"
import { TRAVELER_CREDIT_PACKAGES } from "@/lib/billing/traveler-plans"
import type { CreditTransaction, TravelerBillingStatusSummary } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const iconMap: Record<string, typeof MessageCircle> = {
  Sistema: Gift,
  Concierge: MessageCircle,
  Documentos: FileText,
  Offline: WifiOff,
  Compra: Coins,
}

export default function CreditosPage() {
  const { credits, subscription } = useTrips()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const isRealMode = shouldUseSupabase()
  const [billingStatus, setBillingStatus] = useState<TravelerBillingStatusSummary | null>(null)
  const [realHistory, setRealHistory] = useState<CreditTransaction[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [packageLoading, setPackageLoading] = useState<string | null>(null)
  const checkoutStatus = searchParams.get("checkout")

  useEffect(() => {
    if (!isRealMode || !user?.id) return

    let mounted = true

    const loadCredits = async () => {
      const [statusResult, historyResult] = await Promise.all([
        getTravelerBillingStatus(),
        listCreditTransactions("profile", user.id),
      ])

      if (!mounted) return

      setLoadError(statusResult.error ?? historyResult.error ?? null)
      setBillingStatus(statusResult.data ?? null)
      setRealHistory(historyResult.data ?? [])
    }

    void loadCredits()

    return () => {
      mounted = false
    }
  }, [isRealMode, user?.id])

  const effectiveBalance = isRealMode ? (billingStatus?.totalAvailable ?? 0) : credits.balance
  const effectiveHistory = useMemo(
    () =>
      isRealMode
        ? realHistory.map((transaction) => ({
            action: transaction.source === "plan_cycle"
              ? transaction.metadata?.plan_code === "premium"
                ? "Créditos de IA — Premium legado"
                : "Créditos de IA incluídos neste ciclo"
              : transaction.reason || transaction.type,
            amount: transaction.amount,
            date: transaction.createdAt,
            source: transaction.source || "Supabase",
          }))
        : credits.history,
    [credits.history, isRealMode, realHistory],
  )

  const totalUsedHistory = effectiveHistory.reduce((sum, item) => (item.amount < 0 ? sum + Math.abs(item.amount) : sum), 0)
  const monthlyPlanCredits = subscription.definition.monthlyCredits
  const planCreditsAvailable = Math.max(
    billingStatus?.planCreditsAvailable ?? Math.max(monthlyPlanCredits - totalUsedHistory, 0),
    0,
  )
  const purchasedCreditsAvailable = Math.max(billingStatus?.purchasedCreditsAvailable ?? 0, 0)
  const planCreditsUsed = Math.max(monthlyPlanCredits - planCreditsAvailable, 0)
  const usagePercentage = monthlyPlanCredits > 0 ? (planCreditsUsed / monthlyPlanCredits) * 100 : 0
  const conciergeUsage = effectiveHistory.filter((item) => (item.source || "").toLowerCase().includes("concierge")).length
  const documentsUsage = effectiveHistory.filter((item) => (item.source || "").toLowerCase().includes("document")).length
  const offlineUsage = effectiveHistory.filter((item) => (item.source || "").toLowerCase().includes("offline")).length

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return "Hoje"
    if (diffDays === 1) return "Ontem"
    if (diffDays < 7) return `Há ${diffDays} dias`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  const handleCreditsCheckout = async (packageCode: "starter" | "popular" | "pro") => {
    setLoadError(null)
    setPackageLoading(packageCode)

    const result = await createTravelerCreditsCheckout(packageCode)
    if (result.error || !result.data?.url) {
        setLoadError(result.error ?? "Não foi possível iniciar o checkout de créditos de IA.")
      setPackageLoading(null)
      return
    }

    window.location.href = result.data.url
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="mx-auto max-w-5xl space-y-5"
    >
      <motion.div variants={fadeInUp} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Créditos de IA</h1>
          <p className="text-sm text-muted-foreground">Gerencie seu saldo para recursos de inteligência artificial.</p>
        </div>
        {subscription.isPremium ? (
          <Badge className="bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-400 border-amber-500/30">
            <Crown size={14} className="mr-1" />
            Premium legado
          </Badge>
        ) : null}
      </motion.div>

      {checkoutStatus === "success" ? (
        <motion.div variants={fadeInUp}>
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Checkout concluído. Os créditos de IA aparecem no saldo após a confirmação do Stripe.
          </Card>
        </motion.div>
      ) : null}

      {checkoutStatus === "canceled" ? (
        <motion.div variants={fadeInUp}>
          <Card className="border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Checkout cancelado. Nenhuma alteração foi aplicada ao saldo.
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden rounded-[1.5rem] border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card/80 to-secondary/[0.07] p-5 shadow-[0_18px_52px_-38px_rgba(15,23,42,0.45)] md:p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Coins size={16} className="text-primary" />
                  <span className="text-sm">Saldo de IA</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold vuei-gradient-text md:text-5xl">{effectiveBalance}</span>
                  <span className="text-muted-foreground">créditos IA</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-green-400">
                    <Gift size={14} />
                    <span>Incluídos neste ciclo: {planCreditsAvailable}</span>
                  </div>
                  <div className="text-muted-foreground">
                    Comprados: {purchasedCreditsAvailable}
                  </div>
                </div>
              </div>

              <div className="space-y-3 md:text-right">
                <div className="flex items-center gap-2 md:justify-end">
                  <TrendingUp size={14} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Uso dos créditos incluídos: {planCreditsUsed} de {monthlyPlanCredits}
                  </span>
                </div>
                <Progress value={usagePercentage} className="h-2 w-full md:w-48" />
                <p className="text-xs text-muted-foreground">
                  {billingStatus?.currentPeriodEnd
                    ? `Ciclo atual até ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString("pt-BR")}`
                    : isRealMode
                      ? "Renovação do saldo incluído ainda não disponível."
                      : "Saldo local de demonstração."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Concierge", value: conciergeUsage.toString(), icon: MessageCircle, desc: "usos" },
            { label: "Documentos", value: documentsUsage.toString(), icon: FileText, desc: "transações" },
            { label: "Offline", value: offlineUsage.toString(), icon: WifiOff, desc: "transações" },
          ].map((stat) => (
            <Card key={stat.label} className="rounded-[1.2rem] border-border/55 bg-card/70 p-3 text-center shadow-[0_10px_32px_-28px_rgba(15,23,42,0.45)]">
              <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10">
                <stat.icon size={18} className="text-primary" />
              </div>
              <p className="text-xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.desc}</p>
            </Card>
          ))}
        </div>
      </motion.div>

      {loadError ? (
        <motion.div variants={fadeInUp}>
          <Card className="p-4 bg-red-500/10 border-red-500/20 text-sm text-red-300">
            {loadError}
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeInUp} id="comprar-creditos-ia">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Comprar créditos de IA</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {TRAVELER_CREDIT_PACKAGES.map((pkg) => (
            <Card
              key={pkg.code}
              className={`relative overflow-hidden rounded-[1.3rem] border-border/55 bg-card/70 p-4 shadow-[0_12px_38px_-32px_rgba(15,23,42,0.45)] transition-all duration-300 hover:border-primary/30 ${
                pkg.code === "popular" ? "ring-2 ring-primary/50" : ""
              }`}
            >
              {pkg.code === "popular" ? (
                <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">Popular</Badge>
              ) : null}

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Coins size={20} className="text-primary" />
                  <span className="text-2xl font-bold">{pkg.credits}</span>
                  <span className="text-muted-foreground">créditos de IA</span>
                </div>

                <div>
                  <p className="text-lg text-muted-foreground">{pkg.name}</p>
                  <p className="text-3xl font-bold">{pkg.priceLabel}</p>
                </div>

                <Button
                  className={`w-full rounded-xl ${
                    pkg.code === "popular"
                      ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground vuei-button-glow"
                      : "bg-muted/50 hover:bg-muted"
                  }`}
                  onClick={() => handleCreditsCheckout(pkg.code)}
                  disabled={packageLoading !== null}
                >
                  {packageLoading === pkg.code ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Comprar créditos de IA
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20 relative overflow-hidden">
          <div className="absolute inset-0 vuei-grid opacity-20 pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0">
                <Crown size={24} className="text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Produtos independentes</h3>
                <p className="text-sm text-muted-foreground">
                  Viagens, créditos de IA e Vuei+ são produtos independentes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-xl whitespace-nowrap">
                <Link href="#comprar-creditos-ia">Comprar créditos de IA</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl whitespace-nowrap">
                <Link href="/portal/viagens/comprar">Comprar viagens</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-amber-500 to-amber-600 text-primary-foreground font-semibold rounded-xl whitespace-nowrap">
                <Link href="/portal/planos">
                  Conhecer Vuei+
                  <ChevronRight size={16} className="ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Histórico de uso</h2>
        </div>
        <Card className="bg-card/50 border-border/50 vuei-glass divide-y divide-border/50">
          {effectiveHistory.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhum consumo de créditos de IA registrado ainda.</div>
          ) : (
            effectiveHistory.slice(0, 5).map((item, index) => {
              const Icon = iconMap[item.source] || Gift

              return (
                <div key={`${item.action}-${index}`} className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    item.amount > 0 ? "bg-green-500/20" : "bg-muted/50"
                  }`}>
                    <Icon size={18} className={item.amount > 0 ? "text-green-400" : "text-muted-foreground"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.action}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} />
                      <span>{formatDate(item.date)}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${item.amount > 0 ? "text-green-400" : "text-muted-foreground"}`}>
                    {item.amount > 0 ? "+" : ""}
                    {item.amount}
                  </span>
                </div>
              )
            })
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}
