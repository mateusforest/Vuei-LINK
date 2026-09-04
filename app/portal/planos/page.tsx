"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { Archive, ChevronLeft, Check, Crown, Coins, FileClock, Loader2, ShieldCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTrips } from "@/contexts/trips-context"
import { TRAVELER_CREDIT_PACKAGES, TRAVELER_PLAN_DEFINITIONS } from "@/lib/billing/traveler-plans"
import {
  createTravelerCreditsCheckout,
  createTravelerCustomerPortal,
  createTravelerVueiPlusCheckout,
  getTravelerVueiPlusStatus,
} from "@/lib/repositories/traveler-billing-repository"
import type { TravelerMembershipStatusSummary } from "@/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function PortalPlanosPage() {
  const { subscription } = useTrips()
  const searchParams = useSearchParams()
  const [vueiPlusLoading, setVueiPlusLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [packageLoading, setPackageLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [membership, setMembership] = useState<TravelerMembershipStatusSummary | null>(null)
  const premiumPlan = TRAVELER_PLAN_DEFINITIONS.premium
  const checkoutStatus = searchParams.get("checkout")
  const canManageSubscription = Boolean(membership?.stripeCustomerId || subscription.stripeCustomerId || subscription.isPremium)
  const hasManageableVueiPlus = Boolean(
    membership?.vueiPlusStripeSubscriptionId &&
    !["none", "canceled"].includes(membership.vueiPlusStatus),
  )

  useEffect(() => {
    let active = true
    const loadMembership = async () => {
      const result = await getTravelerVueiPlusStatus()
      if (active && result.data) setMembership(result.data)
    }
    void loadMembership()
    return () => { active = false }
  }, [checkoutStatus])

  const handleVueiPlusCheckout = async () => {
    setActionError(null)
    setVueiPlusLoading(true)

    const result = await createTravelerVueiPlusCheckout()
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível iniciar o checkout do Vuei+.")
      setVueiPlusLoading(false)
      return
    }

    window.location.href = result.data.url
  }

  const handleCreditsCheckout = async (packageCode: "starter" | "popular" | "pro") => {
    setActionError(null)
    setPackageLoading(packageCode)

    const result = await createTravelerCreditsCheckout(packageCode)
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível iniciar o checkout de créditos.")
      setPackageLoading(null)
      return
    }

    window.location.href = result.data.url
  }

  const handleOpenPortal = async () => {
    setActionError(null)
    setPortalLoading(true)

    const result = await createTravelerCustomerPortal()
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Não foi possível abrir o portal de assinatura.")
      setPortalLoading(false)
      return
    }

    window.location.href = result.data.url
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <motion.div {...fadeInUp} className="space-y-3">
        <Button asChild variant="ghost" className="w-fit rounded-xl px-0 text-muted-foreground hover:text-foreground">
          <Link href="/portal/creditos">
            <ChevronLeft size={16} className="mr-2" />
            Voltar
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Planos e créditos</h1>
          <p className="text-sm text-muted-foreground">Viagens compradas e Vuei+ são independentes. Assine apenas se quiser manter seu arquivo histórico acessível.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageSubscription ? (
            <Button variant="outline" className="rounded-xl" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Crown size={16} className="mr-2" />}
              Gerenciar assinatura
            </Button>
          ) : null}

          {membership?.vueiPlusCurrentPeriodEnd ? (
            <Badge variant="secondary" className="border-border/50 bg-card/60 text-muted-foreground">
              Vuei+ até {new Date(membership.vueiPlusCurrentPeriodEnd).toLocaleDateString("pt-BR")}
            </Badge>
          ) : null}
        </div>

        {checkoutStatus === "vuei-plus-success" ? (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Checkout concluído. O Vuei+ será liberado assim que o webhook do Stripe confirmar o pagamento.
          </Card>
        ) : null}

        {checkoutStatus === "vuei-plus-canceled" ? (
          <Card className="border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Checkout cancelado. Nenhuma alteração foi aplicada ao Vuei+.
          </Card>
        ) : null}

        {actionError ? (
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {actionError}
          </Card>
        ) : null}
      </motion.div>

      <motion.div {...fadeInUp} className="grid gap-5 lg:grid-cols-2">
        <Card className="flex min-h-[31rem] flex-col border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="flex min-h-[5rem] items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Uso sem assinatura</p>
              <h2 className="mt-2 text-[2rem] font-bold leading-none">Viagens avulsas</h2>
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/20">Sempre disponível</Badge>
          </div>

          <div className="mt-6 min-h-[11rem] space-y-3">
            {[
              "Crie rascunhos sem consumir Link",
              "Ative uma viagem com 1 crédito trip_link",
              "Compre pacotes de 1, 5 ou 10 viagens",
              "O link permanece público até o fim da viagem + 7 dias",
              "Seus dados não são apagados ao encerrar",
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button asChild className="mt-auto w-full rounded-xl"><Link href="/portal/viagens/comprar">Comprar viagens</Link></Button>
        </Card>

        <Card className="relative flex min-h-[31rem] flex-col overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/70 to-secondary/10 p-6 vuei-glass">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="relative flex min-h-[5rem] items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Assinatura opcional</p>
              <h2 className="mt-2 text-[2rem] font-bold leading-none">Vuei+</h2>
              <p className="mt-2 text-sm text-muted-foreground">Valor e periodicidade exibidos no checkout seguro.</p>
            </div>
            <Badge className="bg-amber-500 text-black">
              {membership?.state === "VUEI_PLUS_ACTIVE" ? "Ativo" : "Arquivo premium"}
            </Badge>
          </div>

          <div className="mt-6 min-h-[11rem] space-y-4">
            {[
              { icon: Archive, text: "Acesso autenticado às viagens encerradas" },
              { icon: FileClock, text: "Documentos, passagens, hospedagens e roteiros preservados" },
              { icon: ShieldCheck, text: "Histórico privado sem reabrir o link público" },
              { icon: Crown, text: "Base para benefícios recorrentes futuros" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 text-sm">
                <Icon size={17} className="mt-0.5 shrink-0 text-amber-400" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <Button
            className="mt-auto w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold"
            onClick={membership?.canAccessArchivedTrips || hasManageableVueiPlus ? handleOpenPortal : handleVueiPlusCheckout}
            disabled={vueiPlusLoading || portalLoading || membership === null}
          >
            {vueiPlusLoading || portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {membership?.state === "PREMIUM_LEGACY"
              ? "Gerenciar Premium legado"
              : membership?.canAccessArchivedTrips || hasManageableVueiPlus
                ? "Gerenciar Vuei+"
                : "Assinar Vuei+"}
          </Button>
        </Card>
      </motion.div>

      {subscription.isPremium ? (
        <motion.div {...fadeInUp}>
          <Card className="border-primary/20 bg-primary/5 p-6 vuei-glass">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Crown size={18} className="text-amber-400" />
                  <h2 className="font-semibold">Premium legado preservado</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Seus créditos de IA, roteiros e demais benefícios atuais continuam no plano {premiumPlan.name}. O acesso ao arquivo também permanece liberado.
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">{premiumPlan.priceLabel}</Badge>
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Coins size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Créditos de IA adicionais</h2>
              <p className="text-sm text-muted-foreground">
                Saldo separado das viagens e do Vuei+, usado somente nos recursos de inteligência artificial.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {TRAVELER_CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.code} className="flex min-h-[15.5rem] flex-col border-border/50 bg-background/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">{pkg.name}</p>
                  {pkg.code === "popular" ? <Badge className="bg-primary text-primary-foreground">Popular</Badge> : null}
                </div>
                <p className="text-[2rem] font-bold leading-none">{pkg.credits}</p>
                <p className="text-sm text-muted-foreground">créditos</p>
                <p className="mt-3 text-lg font-semibold">{pkg.priceLabel}</p>
                <Button
                  className="mt-auto w-full rounded-xl"
                  variant={pkg.code === "popular" ? "default" : "outline"}
                  onClick={() => handleCreditsCheckout(pkg.code)}
                  disabled={packageLoading !== null}
                >
                  {packageLoading === pkg.code ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Comprar
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <h2 className="text-xl font-semibold">FAQ</h2>
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="credits">
              <AccordionTrigger>O que são créditos de IA?</AccordionTrigger>
              <AccordionContent>
                Créditos de IA são usados em recursos inteligentes e nunca ativam um link de viagem.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="consumption">
              <AccordionTrigger>Quando os créditos são consumidos?</AccordionTrigger>
              <AccordionContent>
                Atualmente, os créditos são consumidos em perguntas ao Concierge IA, geração de roteiros e extração inteligente de passagens.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rollover">
              <AccordionTrigger>Os créditos acumulam?</AccordionTrigger>
              <AccordionContent>
                Créditos comprados acumulam e não expiram. Os créditos do plano são renovados a cada ciclo.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </motion.div>
    </div>
  )
}
