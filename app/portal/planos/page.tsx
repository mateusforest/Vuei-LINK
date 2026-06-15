"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { ChevronLeft, Check, Crown, Coins } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTrips } from "@/contexts/trips-context"
import { PortalActionDialog } from "@/components/portal/portal-action-dialog"
import { TRAVELER_CREDIT_PACKAGES, TRAVELER_PLAN_DEFINITIONS } from "@/lib/billing/traveler-plans"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function PortalPlanosPage() {
  const { subscription } = useTrips()
  const [showPremiumDialog, setShowPremiumDialog] = useState(false)
  const [showCreditsDialog, setShowCreditsDialog] = useState(false)
  const freePlan = TRAVELER_PLAN_DEFINITIONS.free
  const premiumPlan = TRAVELER_PLAN_DEFINITIONS.premium

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-8">
        <motion.div {...fadeInUp} className="space-y-3">
          <Button asChild variant="ghost" className="w-fit rounded-xl px-0 text-muted-foreground hover:text-foreground">
            <Link href="/portal/creditos">
              <ChevronLeft size={16} className="mr-2" />
              Voltar
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Planos e Créditos</h1>
            <p className="text-sm text-muted-foreground">
              Escolha o plano ideal para suas viagens e acompanhe seu consumo de créditos.
            </p>
          </div>
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
                  <span className="mt-0.5 shrink-0 text-red-400">✗</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Button disabled={subscription.code === "free"} className="mt-8 w-full rounded-xl bg-muted/50 text-foreground hover:bg-muted">
              Começar grátis
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
              onClick={() => setShowPremiumDialog(true)}
            >
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
                <h2 className="text-xl font-semibold">Precisa de mais créditos?</h2>
                <p className="text-sm text-muted-foreground">
                  Compre créditos adicionais e utilize quando precisar.
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
                  <p className="text-sm text-muted-foreground">créditos</p>
                  <p className="mt-4 text-xl font-semibold">{pkg.priceLabel}</p>
                  <Button className="mt-5 w-full rounded-xl" variant={pkg.code === "popular" ? "default" : "outline"} onClick={() => setShowCreditsDialog(true)}>
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
                <AccordionTrigger>O que são créditos?</AccordionTrigger>
                <AccordionContent>
                  Créditos são utilizados para recursos que consomem inteligência artificial.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="consumption">
                <AccordionTrigger>Quando créditos são consumidos?</AccordionTrigger>
                <AccordionContent>
                  Atualmente os créditos são consumidos em perguntas ao Concierge IA, geração de roteiros e extração inteligente de passagens.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="rollover">
                <AccordionTrigger>Os créditos acumulam?</AccordionTrigger>
                <AccordionContent>
                  Créditos comprados acumulam e não expiram. Créditos inclusos no plano renovam a cada ciclo.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </motion.div>
      </div>

      <PortalActionDialog
        open={showPremiumDialog}
        onOpenChange={setShowPremiumDialog}
        title="Premium em breve"
        description="A assinatura Premium estará disponível em breve. Enquanto isso, acompanhe as novidades do Vuei."
      />

      <PortalActionDialog
        open={showCreditsDialog}
        onOpenChange={setShowCreditsDialog}
        title="Compra de créditos em breve"
        description="Os pacotes de créditos estarão disponíveis após a integração de pagamentos."
      />
    </>
  )
}
