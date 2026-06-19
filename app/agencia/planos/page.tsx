"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { ChevronDown, ChevronLeft, Check, Coins, Crown, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useAgency } from "@/contexts/agency-context"
import type { AgencyBillingApiStatus } from "@/types"
import { AGENCY_PLAN_DEFINITIONS } from "@/lib/billing/agency-plans"
import { TRAVELER_CREDIT_PACKAGES } from "@/lib/billing/traveler-plans"
import {
  createAgencyCreditsCheckout,
  createAgencyCustomerPortal,
  createAgencyPlanCheckout,
  getAgencyBillingStatusFromApi,
} from "@/lib/repositories/agency-billing-repository"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function AgencyPlansPage() {
  const { subscription, activeTripsCount, teamSeatsUsed } = useAgency()
  const searchParams = useSearchParams()
  const plans = Object.values(AGENCY_PLAN_DEFINITIONS)
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [billingStatus, setBillingStatus] = useState<AgencyBillingApiStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [planLoading, setPlanLoading] = useState<"start" | "pro" | "business" | null>(null)
  const [packageLoading, setPackageLoading] = useState<"starter" | "popular" | "pro" | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const checkoutStatus = searchParams.get("checkout")

  useEffect(() => {
    let active = true

    void (async () => {
      const result = await getAgencyBillingStatusFromApi()
      if (!active) return

      setBillingStatus(result.data)
      setStatusError(result.error)
    })()

    return () => {
      active = false
    }
  }, [])

  const currentPlanCode = billingStatus?.planCode ?? subscription.code
  const currentPeriodEnd = billingStatus?.currentPeriodEnd ?? null
  const canManageSubscription = Boolean(billingStatus?.stripeCustomerId || currentPlanCode !== "free")

  const currentPlanDefinition = useMemo(() => {
    return AGENCY_PLAN_DEFINITIONS[currentPlanCode]
  }, [currentPlanCode])

  const handlePlanCheckout = async (planCode: "start" | "pro" | "business") => {
    setActionError(null)
    setPlanLoading(planCode)

    const result = await createAgencyPlanCheckout(planCode)
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível iniciar o checkout da agência.")
      setPlanLoading(null)
      return
    }

    window.location.href = result.data.url
  }

  const handleCreditsCheckout = async (packageCode: "starter" | "popular" | "pro") => {
    setActionError(null)
    setPackageLoading(packageCode)

    const result = await createAgencyCreditsCheckout(packageCode)
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível iniciar a compra de créditos.")
      setPackageLoading(null)
      return
    }

    window.location.href = result.data.url
  }

  const handleOpenPortal = async () => {
    setActionError(null)
    setPortalLoading(true)

    const result = await createAgencyCustomerPortal()
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível abrir o portal de assinatura.")
      setPortalLoading(false)
      return
    }

    window.location.href = result.data.url
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div {...fadeInUp} className="space-y-3">
        <Button asChild variant="ghost" className="w-fit rounded-xl px-0 text-muted-foreground hover:text-foreground">
          <Link href="/agencia/creditos">
            <ChevronLeft size={16} className="mr-2" />
            Voltar
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Planos, Limites e Créditos</h1>
          <p className="text-sm text-muted-foreground">
            Compare a capacidade operacional da sua agência, os créditos mensais inclusos e os limites de equipe e viagens.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="border-border/60 bg-white/90 text-muted-foreground">
            {activeTripsCount} viagens ativas em uso
          </Badge>
          <Badge variant="secondary" className="border-border/60 bg-white/90 text-muted-foreground">
            {teamSeatsUsed} usuários ativos na equipe
          </Badge>
          {canManageSubscription ? (
            <Button variant="outline" className="rounded-xl" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Crown size={16} className="mr-2" />}
              Gerenciar assinatura
            </Button>
          ) : null}
          {currentPeriodEnd ? (
            <Badge variant="secondary" className="border-border/60 bg-white/90 text-muted-foreground">
              Ciclo atual ate {new Date(currentPeriodEnd).toLocaleDateString("pt-BR")}
            </Badge>
          ) : null}
        </div>

        {checkoutStatus === "success" ? (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Checkout concluido. O billing da agencia so muda quando o webhook real do Stripe confirma o evento.
          </Card>
        ) : null}

        {checkoutStatus === "canceled" ? (
          <Card className="border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Checkout cancelado. Nenhuma alteracao foi aplicada ao billing da agencia.
          </Card>
        ) : null}

        {statusError ? (
          <Card className="border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            {statusError}
          </Card>
        ) : null}

        {actionError ? (
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {actionError}
          </Card>
        ) : null}
      </motion.div>

      <motion.div {...fadeInUp} className="grid gap-5 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = currentPlanCode === plan.code
          const isExpanded = expandedPlan === plan.code
          const isPaidPlan = plan.code === "start" || plan.code === "pro" || plan.code === "business"
          const paidPlanCode = isPaidPlan ? (plan.code as "start" | "pro" | "business") : null
          const highlights = plan.code === "free"
            ? ["Sistema completo", "1 usuário", "1 viagem ativa", "40 créditos/mês"]
            : plan.code === "start"
              ? ["3 usuários", "20 viagens ativas", "350 créditos/mês"]
              : plan.code === "pro"
                ? ["5 usuários", "100 viagens ativas", "600 créditos/mês"]
                : ["15 usuários", "220 viagens ativas", "1.500 créditos/mês", "Atendimento prioritário"]

          return (
            <Card
              key={plan.code}
              className={`relative flex min-h-[33rem] flex-col overflow-hidden p-6 vuei-glass ${
                plan.code === "pro"
                  ? "border-amber-500/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,251,235,0.96))]"
                  : "border-border/60 bg-white/88"
              }`}
            >
              {plan.code === "pro" ? (
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
              ) : null}

              <div className="relative flex min-h-[5rem] items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Plano {plan.name}</p>
                  <h2 className="mt-2 text-[2rem] font-bold leading-none">{plan.priceLabel}</h2>
                </div>
                {isCurrent ? (
                  <Badge className="shrink-0 whitespace-nowrap border-primary/20 bg-primary/15 text-primary">Plano atual</Badge>
                ) : plan.badge ? (
                  <Badge className="shrink-0 whitespace-nowrap bg-amber-500 px-3 py-1 text-black">{plan.badge}</Badge>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-border/60 bg-[#fbfbfc] p-3">
                  <p className="text-base font-semibold leading-none">{plan.maxUsers}</p>
                  <p className="mt-2 break-words text-[11px] leading-4 text-muted-foreground">usuários</p>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-border/60 bg-[#fbfbfc] p-3">
                  <p className="text-base font-semibold leading-none">{plan.maxActiveTrips}</p>
                  <p className="mt-2 break-words text-[11px] leading-4 text-muted-foreground">viagens ativas</p>
                </div>
                <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-border/60 bg-[#fbfbfc] p-3">
                  <p className="text-base font-semibold leading-none">{plan.monthlyCredits}</p>
                  <p className="mt-2 break-words text-[11px] leading-4 text-muted-foreground">créditos/mês</p>
                </div>
              </div>

              <div className="mt-6 min-h-[7.5rem] space-y-3">
                {highlights.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-5 flex min-h-6 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setExpandedPlan(isExpanded ? null : plan.code)}
              >
                <span>Ver funcionalidades</span>
                <ChevronDown size={16} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "mt-4 max-h-80" : "max-h-0"}`}>
                <div className="space-y-3 border-t border-border/60 pt-4">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3 text-sm">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-6">
                <Button
                  className="w-full rounded-xl whitespace-normal text-center shadow-none"
                  variant={plan.code === "pro" ? "default" : "outline"}
                  disabled={isCurrent || Boolean(planLoading) || !isPaidPlan}
                  onClick={() => {
                    if (paidPlanCode) {
                      void handlePlanCheckout(paidPlanCode)
                    }
                  }}
                >
                  {planLoading === plan.code ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  {isCurrent ? "Plano atual" : isPaidPlan ? "Fazer upgrade" : "Disponível por padrão"}
                </Button>
              </div>
            </Card>
          )
        })}
      </motion.div>

      <motion.div {...fadeInUp}>
          <Card className="border-border/60 bg-white/88 p-6 vuei-glass">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Coins size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Créditos extras</h2>
              <p className="text-sm text-muted-foreground">
                Os mesmos pacotes do traveler agora tambem ficam preparados para o checkout B2B da agencia.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {TRAVELER_CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.code} className="flex min-h-[15rem] flex-col border-border/60 bg-[#fbfbfc] p-5 shadow-none">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">{pkg.name}</p>
                  {pkg.code === "popular" ? <Badge className="bg-primary text-primary-foreground">Popular</Badge> : null}
                </div>
                <p className="text-[2rem] font-bold leading-none">{pkg.credits}</p>
                <p className="text-sm text-muted-foreground">creditos</p>
                <p className="mt-3 text-lg font-semibold">{pkg.priceLabel}</p>
                <Button
                  className="mt-auto w-full rounded-xl"
                  variant={pkg.code === "popular" ? "default" : "outline"}
                  onClick={() => handleCreditsCheckout(pkg.code)}
                  disabled={packageLoading !== null}
                >
                  {packageLoading === pkg.code ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Comprar creditos
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
          <Card className="border-border/60 bg-white/88 p-6 vuei-glass">
          <div className="mb-4 flex items-center gap-2">
            <Crown size={18} className="text-primary" />
            <h2 className="text-xl font-semibold">FAQ</h2>
          </div>
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="credits">
              <AccordionTrigger>O que sao creditos?</AccordionTrigger>
              <AccordionContent>
                Créditos são usados em recursos que consomem inteligência artificial no portal da agência.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="consumption">
              <AccordionTrigger>Quando creditos sao consumidos?</AccordionTrigger>
              <AccordionContent>
                Atualmente os creditos sao consumidos em perguntas ao Concierge IA, geracao de roteiros e extracao inteligente de passagens.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rollover">
              <AccordionTrigger>Os creditos acumulam?</AccordionTrigger>
              <AccordionContent>
                Créditos comprados acumulam. Os créditos do plano valem para o ciclo atual e são renovados pela assinatura.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="limits">
              <AccordionTrigger>Como funcionam os limites de viagens?</AccordionTrigger>
              <AccordionContent>
                Os limites operacionais consideram apenas viagens ativas. Viagens concluidas ou canceladas deixam de consumir capacidade.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="excursions">
              <AccordionTrigger>Uma excursao conta como varias viagens?</AccordionTrigger>
              <AccordionContent>
                Não. Uma excursão conta como apenas uma viagem ativa.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
          <Card className="border-border/60 bg-white/88 p-5 vuei-glass">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Plano atual: <span className="font-medium text-foreground">{currentPlanDefinition.name}</span>
            </span>
            {billingStatus ? (
              <span>
                Saldo atual resolvido no backend: <span className="font-medium text-foreground">{billingStatus.totalAvailable} creditos</span>
              </span>
            ) : null}
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
