"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ChevronLeft, Check, Coins, Crown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useAgency } from "@/contexts/agency-context"
import { AGENCY_PLAN_DEFINITIONS } from "@/lib/billing/agency-plans"
import { TRAVELER_CREDIT_PACKAGES } from "@/lib/billing/traveler-plans"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function AgencyPlansPage() {
  const { subscription, activeTripsCount, teamSeatsUsed } = useAgency()
  const plans = Object.values(AGENCY_PLAN_DEFINITIONS)

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
          <h1 className="text-3xl font-bold">Planos, Limites e Creditos</h1>
          <p className="text-sm text-muted-foreground">
            Compare a capacidade operacional da sua agencia, os creditos mensais inclusos e os limites de equipe e viagens.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="border-border/50 bg-card/60 text-muted-foreground">
            {activeTripsCount} viagens ativas em uso
          </Badge>
          <Badge variant="secondary" className="border-border/50 bg-card/60 text-muted-foreground">
            {teamSeatsUsed} usuarios ativos na equipe
          </Badge>
        </div>
      </motion.div>

      <motion.div {...fadeInUp} className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = subscription.code === plan.code

          return (
            <Card
              key={plan.code}
              className={`relative overflow-hidden p-6 vuei-glass ${
                plan.code === "pro"
                  ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card/70 to-secondary/10"
                  : "border-border/50 bg-card/50"
              }`}
            >
              {plan.code === "pro" ? (
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
              ) : null}

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Plano {plan.name}</p>
                  <h2 className="mt-2 text-3xl font-bold">{plan.priceLabel}</h2>
                </div>
                {isCurrent ? (
                  <Badge className="border-primary/20 bg-primary/15 text-primary">Plano atual</Badge>
                ) : plan.badge ? (
                  <Badge className="bg-amber-500 text-black">{plan.badge}</Badge>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-white/10 bg-background/50 p-3">
                  <p className="text-lg font-semibold">{plan.maxUsers}</p>
                  <p className="text-[11px] text-muted-foreground">usuarios</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-background/50 p-3">
                  <p className="text-lg font-semibold">{plan.maxActiveTrips}</p>
                  <p className="text-[11px] text-muted-foreground">viagens ativas</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-background/50 p-3">
                  <p className="text-lg font-semibold">{plan.monthlyCredits}</p>
                  <p className="text-[11px] text-muted-foreground">creditos/mes</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Button disabled className="mt-8 w-full rounded-xl">
                Em breve
              </Button>
            </Card>
          )
        })}
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Coins size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Creditos extras</h2>
              <p className="text-sm text-muted-foreground">
                Os mesmos pacotes do traveler ja ficam preparados para a futura integracao de pagamentos da agencia.
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
                <Button className="mt-5 w-full rounded-xl" variant={pkg.code === "popular" ? "default" : "outline"} disabled>
                  Em breve
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <div className="mb-4 flex items-center gap-2">
            <Crown size={18} className="text-primary" />
            <h2 className="text-xl font-semibold">FAQ</h2>
          </div>
          <Accordion type="single" collapsible className="mt-4">
            <AccordionItem value="credits">
              <AccordionTrigger>O que sao creditos?</AccordionTrigger>
              <AccordionContent>
                Creditos sao utilizados para recursos que consomem inteligencia artificial no portal da agencia.
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
                Nesta etapa a compra real ainda nao foi integrada. A arquitetura ja separa o plano da agencia para futura integracao Stripe.
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
                Nao. Uma excursao conta como apenas uma viagem ativa.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </motion.div>
    </div>
  )
}
