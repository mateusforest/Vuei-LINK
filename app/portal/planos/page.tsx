"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import Link from "next/link"
import { ChevronLeft, Check, Crown, Coins, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTrips } from "@/contexts/trips-context"
import { TRAVELER_CREDIT_PACKAGES, TRAVELER_PLAN_DEFINITIONS } from "@/lib/billing/traveler-plans"
import {
  createTravelerCreditsCheckout,
  createTravelerCustomerPortal,
  createTravelerPremiumCheckout,
} from "@/lib/repositories/traveler-billing-repository"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function PortalPlanosPage() {
  const { subscription } = useTrips()
  const searchParams = useSearchParams()
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [packageLoading, setPackageLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const freePlan = TRAVELER_PLAN_DEFINITIONS.free
  const premiumPlan = TRAVELER_PLAN_DEFINITIONS.premium
  const checkoutStatus = searchParams.get("checkout")
  const canManageSubscription = Boolean(subscription.stripeCustomerId || subscription.isPremium)

  const handlePremiumCheckout = async () => {
    setActionError(null)
    setPremiumLoading(true)

    const result = await createTravelerPremiumCheckout()
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Nao foi possivel iniciar o checkout Premium.")
      setPremiumLoading(false)
      return
    }

    window.location.href = result.data.url
  }

  const handleCreditsCheckout = async (packageCode: "starter" | "popular" | "pro") => {
    setActionError(null)
    setPackageLoading(packageCode)

    const result = await createTravelerCreditsCheckout(packageCode)
    if (result.error || !result.data?.url) {
      setActionError(result.error ?? "Nao foi possivel iniciar o checkout de creditos.")
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
      setActionError(result.error ?? "Nao foi possivel abrir o portal de assinatura.")
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
          <h1 className="text-3xl font-bold">Planos e Creditos</h1>
          <p className="text-sm text-muted-foreground">
            Escolha o plano ideal para suas viagens e acompanhe seu consumo de creditos.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {canManageSubscription ? (
            <Button variant="outline" className="rounded-xl" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Crown size={16} className="mr-2" />}
              Gerenciar assinatura
            </Button>
          ) : null}

          {subscription.currentPeriodEnd ? (
            <Badge variant="secondary" className="border-border/50 bg-card/60 text-muted-foreground">
              Ciclo atual ate {new Date(subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}
            </Badge>
          ) : null}
        </div>

        {checkoutStatus === "success" ? (
          <Card className="border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            Checkout concluido. O billing so e atualizado quando o webhook real do Stripe confirma o pagamento.
          </Card>
        ) : null}

        {checkoutStatus === "canceled" ? (
          <Card className="border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
            Checkout cancelado. Nenhuma alteracao foi aplicada ao billing.
          </Card>
        ) : null}

        {actionError ? (
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {actionError}
          </Card>
        ) : null}
      </motion.div>

      <motion.div {...fadeInUp} className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano Free</p>
              <h2 className="mt-2 text-3xl font-bold">{freePlan.priceLabel}</h2>
            </div>
            {subscription.code === "free" ? <Badge className="bg-primary/15 text-primary border-primary/20">Plano Atual</Badge> : null}
          </div>

          <div className="mt-6 space-y-3">
            {freePlan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </div>
            ))}
            {freePlan.limitations.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                <span className="mt-0.5 shrink-0 text-red-400">x</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button disabled={subscription.code === "free"} className="mt-8 w-full rounded-xl bg-muted/50 text-foreground hover:bg-muted">
            Comecar gratis
          </Button>
        </Card>

        <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/70 to-secondary/10 p-6 vuei-glass">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Plano Premium</p>
              <h2 className="mt-2 text-3xl font-bold">{premiumPlan.priceLabel}</h2>
            </div>
            <Badge className="bg-amber-500 text-black">{premiumPlan.badge}</Badge>
          </div>

          <div className="mt-6 space-y-3">
            {premiumPlan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <Button
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold"
            onClick={handlePremiumCheckout}
            disabled={premiumLoading}
          >
            {premiumLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            Assinar Premium
          </Button>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Coins size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Precisa de mais creditos?</h2>
              <p className="text-sm text-muted-foreground">
                Compre creditos adicionais e utilize quando precisar.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {TRAVELER_CREDIT_PACKAGES.map((pkg) => (
              <Card key={pkg.code} className="border-border/50 bg-background/60 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">{pkg.name}</p>
                  {pkg.code === "popular" ? <Badge className="bg-primary text-primary-foreground">Popular</Badge> : null}
                </div>
                <p className="text-3xl font-bold">{pkg.credits}</p>
                <p className="text-sm text-muted-foreground">creditos</p>
                <p className="mt-4 text-xl font-semibold">{pkg.priceLabel}</p>
                <Button
                  className="mt-5 w-full rounded-xl"
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
              <AccordionTrigger>O que sao creditos?</AccordionTrigger>
              <AccordionContent>
                Creditos sao utilizados para recursos que consomem inteligencia artificial.
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
                Creditos comprados acumulam e nao expiram. Creditos inclusos no plano renovam a cada ciclo.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </motion.div>
    </div>
  )
}
