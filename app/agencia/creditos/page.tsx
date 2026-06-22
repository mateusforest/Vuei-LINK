"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Coins, TrendingUp, Clock, Crown, ChevronRight, Gift } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useAgency } from "@/contexts/agency-context"
import { getAgencyBillingStatusFromApi } from "@/lib/repositories/agency-billing-repository"
import type { AgencyBillingApiStatus } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function AgencyCreditsPage() {
  const { credits, subscription } = useAgency()
  const [resolvedBilling, setResolvedBilling] = useState<AgencyBillingApiStatus | null>(null)

  useEffect(() => {
    let isMounted = true

    void (async () => {
      const result = await getAgencyBillingStatusFromApi()
      if (!isMounted || !result.data) return

      setResolvedBilling(result.data)
    })()

    return () => {
      isMounted = false
    }
  }, [])

  const availableCredits = resolvedBilling?.totalAvailable ?? credits.balance
  const monthlyCredits = resolvedBilling?.monthlyCredits ?? subscription.definition.monthlyCredits
  const planCreditsAvailable = Math.max(
    resolvedBilling?.planCreditsAvailable ?? Math.min(availableCredits, monthlyCredits),
    0,
  )
  const purchasedCreditsAvailable = Math.max(
    resolvedBilling?.purchasedCreditsAvailable ?? Math.max(availableCredits - planCreditsAvailable, 0),
    0,
  )
  const usedCredits = Math.max(resolvedBilling?.usedCredits ?? monthlyCredits - planCreditsAvailable, 0)
  const usagePercentage = monthlyCredits > 0 ? (usedCredits / monthlyCredits) * 100 : 0

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

  const formatHistoryLabel = (item: (typeof credits.history)[number]) => {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null
    const tripTitle = typeof metadata?.trip_title === "string" ? metadata.trip_title.trim() : ""
    const clientName = typeof metadata?.client_name === "string" ? metadata.client_name.trim() : ""
    const sourceContext = typeof metadata?.source_context === "string" ? metadata.source_context.trim() : ""
    const mode = typeof metadata?.mode === "string" ? metadata.mode.trim() : ""

    let featureLabel = item.action?.trim() || "Consumo de creditos"

    if (item.source === "ai_concierge" || sourceContext.includes("link_") || sourceContext.includes("portal_")) {
      featureLabel = "Concierge IA"
    } else if (item.source === "ai_itinerary_generation") {
      featureLabel = mode === "complete_pdf" ? "Roteiro completo IA" : "Roteiro simples IA"
    } else if (item.source === "ai_flight_extraction") {
      featureLabel = "Leitura de passagem"
    } else {
      featureLabel = featureLabel
        .replace(/^Geracao/i, "Geracao")
        .replace(/^Consumo do concierge ia/i, "Concierge IA")
        .replace(/^Consumo da leitura de passagem/i, "Leitura de passagem")
    }

    const parts = [featureLabel]
    if (tripTitle) parts.push(tripTitle)
    if (clientName) parts.push(`Cliente ${clientName}`)

    return parts.join(" • ")
  }

  const formatHistoryDetail = (item: (typeof credits.history)[number]) => {
    const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : null
    const sourceContext = typeof metadata?.source_context === "string" ? metadata.source_context.trim() : ""

    if (sourceContext === "link_public") return "Link publico"
    if (sourceContext === "link_admin") return "Link admin"
    if (sourceContext === "portal_agency") return "Portal da agencia"
    if (sourceContext === "portal_traveler") return "Portal do viajante"

    return formatDate(item.date)
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
                <span className="text-5xl font-bold vuei-gradient-text">{availableCredits}</span>
                <span className="text-muted-foreground">creditos</span>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-green-400">
                  <Gift size={14} />
                  <span>{planCreditsAvailable} de {monthlyCredits} creditos do plano disponiveis neste ciclo</span>
                </div>
                <div>{purchasedCreditsAvailable} creditos comprados acumulados</div>
                <div>{subscription.definition.maxUsers} usuarios e {subscription.definition.maxActiveTrips} viagens ativas inclusos</div>
              </div>
            </div>

            <div className="space-y-3 lg:text-right">
              <div className="flex items-center gap-2 lg:justify-end">
                <TrendingUp size={14} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {usedCredits} de {monthlyCredits} creditos mensais utilizados
                </span>
              </div>
              <Progress value={usagePercentage} className="h-2 w-full lg:w-52" />
              <p className="text-xs text-muted-foreground">
                O saldo total soma o ciclo mensal do plano com os creditos comprados ainda disponiveis.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-amber-600/10 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Planos, limites e pacotes extras</h2>
              <p className="text-sm text-muted-foreground">
                Compare Free, Start, Pro e Business e acompanhe a capacidade operacional da sua agencia.
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
          {credits.history.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhum consumo de creditos registrado ainda.</div>
          ) : (
            credits.history.slice(0, 8).map((item, index) => (
              <div key={`${item.action}-${index}`} className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.amount > 0 ? "bg-green-500/20" : "bg-muted/50"}`}>
                  <Clock size={16} className={item.amount > 0 ? "text-green-400" : "text-muted-foreground"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{formatHistoryLabel(item)}</p>
                  <p className="text-xs text-muted-foreground">{formatHistoryDetail(item)}</p>
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
