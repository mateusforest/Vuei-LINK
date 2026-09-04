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
import { TRAVELER_TRIP_LINK_PRODUCTS } from "@/lib/billing/traveler-trip-link-catalog"
import { TRAVELER_VUEI_PLUS_OFFER } from "@/lib/billing/traveler-membership"
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

function formatOfferPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100)
}

const INDIVIDUAL_FAQ = [
  {
    id: "subscription",
    question: "Preciso assinar para usar o Vuei?",
    answer: "Não. Você pode criar sua viagem gratuitamente e comprar viagens avulsas quando quiser ativar um link. O Vuei+ é uma assinatura opcional para acessar o arquivo e o histórico depois que a viagem termina.",
  },
  {
    id: "create",
    question: "O que acontece quando crio uma viagem?",
    answer: "A viagem nasce como um rascunho privado. Você pode completar destino, datas, participantes e documentos sem publicar o link e sem consumir uma viagem disponível.",
  },
  {
    id: "consume",
    question: "Quando uma viagem é consumida?",
    answer: "Somente quando você escolhe Ativar viagem. Nesse momento, 1 crédito de viagem é consumido e o link público é liberado para compartilhamento.",
  },
  {
    id: "drafts",
    question: "Posso criar rascunhos sem gastar viagem?",
    answer: "Sim. Você pode montar quantos rascunhos precisar. Criar, editar ou vincular um rascunho à sua conta não reduz o saldo de viagens.",
  },
  {
    id: "draft-active",
    question: "Qual a diferença entre rascunho e viagem ativa?",
    answer: "O rascunho é privado e não pode ser aberto, copiado ou compartilhado como link público. A viagem ativa já consumiu 1 crédito de viagem e pode ser acessada pelo link durante o período previsto.",
  },
  {
    id: "package-validity",
    question: "Quanto tempo tenho para usar cada pacote?",
    answer: "A viagem avulsa pode ser ativada em até 90 dias; o pacote de 3, em até 6 meses; e o pacote de 5, em até 12 meses. A validade começa após a confirmação da compra.",
  },
  {
    id: "after-trip",
    question: "O que acontece depois que a viagem termina?",
    answer: "O link continua disponível por mais 7 dias e depois é encerrado. Os dados não são apagados; com Vuei+, você continua acessando a viagem no arquivo privado autenticado.",
  },
  {
    id: "public-window",
    question: "Por quanto tempo o link fica disponível?",
    answer: "Depois da ativação, o link permanece público durante a viagem e por 7 dias após a data final. Esse prazo do link é independente da validade usada para ativar o crédito comprado.",
  },
  {
    id: "expired-credit",
    question: "O que acontece se eu não ativar dentro da validade?",
    answer: "O crédito vencido deixa de compor o saldo disponível para novas ativações. Seus rascunhos continuam salvos e podem ser ativados depois com uma nova viagem válida.",
  },
  {
    id: "vuei-plus",
    question: "O que é o Vuei+?",
    answer: "É a assinatura opcional do Vuei para manter seu arquivo pessoal acessível, preservar a consulta às viagens encerradas e reunir seu histórico e documentos dentro da conta.",
  },
  {
    id: "vuei-plus-trips",
    question: "O Vuei+ substitui a compra de viagens?",
    answer: "Não. Vuei+ e viagens são produtos independentes. A assinatura não concede créditos de viagem e cada novo link ainda precisa de 1 viagem disponível para ser ativado.",
  },
  {
    id: "archive",
    question: "O que fica salvo no arquivo Vuei+?",
    answer: "As informações preservadas da viagem, como roteiro, documentos, passagens e hospedagens, permanecem acessíveis ao proprietário autenticado. O link público encerrado não é reaberto.",
  },
  {
    id: "ai-vs-trips",
    question: "Créditos de IA são a mesma coisa que viagens?",
    answer: "Não. Créditos de viagem ativam links; créditos de IA são usados nos recursos inteligentes. Os saldos, compras e regras são separados.",
  },
  {
    id: "ai-use",
    question: "Para que servem os créditos de IA?",
    answer: "Eles são consumidos por recursos inteligentes disponíveis na sua conta, como Concierge IA, geração de roteiros e extrações automatizadas, conforme a regra de cada recurso.",
  },
  {
    id: "buy-more",
    question: "Posso comprar mais viagens depois?",
    answer: "Sim. Você pode comprar novos pacotes a qualquer momento. As viagens válidas são somadas ao saldo e o sistema usa primeiro os créditos que vencem antes.",
  },
  {
    id: "activation",
    question: "Como funciona a ativação de uma viagem?",
    answer: "Revise o rascunho e toque em Ativar viagem. O sistema valida seu saldo, consome exatamente 1 crédito e libera o link. Repetir o clique ou atualizar a página não consome novamente a mesma viagem.",
  },
  {
    id: "share-draft",
    question: "Posso compartilhar uma viagem antes de ativar?",
    answer: "Não. Antes da ativação, o rascunho é privado: a URL pública não funciona e as ações de copiar, abrir e compartilhar ficam indisponíveis.",
  },
  {
    id: "packages",
    question: "Como funciona a validade dos pacotes de 1, 3 e 5 viagens?",
    answer: "Cada compra cria créditos com a validade do pacote: 90 dias, 6 meses ou 12 meses. Ao ativar, o sistema consome um crédito válido do lote que vence primeiro; depois disso, o link segue o lifecycle normal da viagem.",
  },
] as const

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
  const hasManageableVueiPlus = Boolean(
    membership?.hasVueiPlus && membership.vueiPlusStripeSubscriptionId,
  )
  const hasManageableLegacyPremium = Boolean(
    membership?.isPremiumLegacy && subscription.stripeSubscriptionId,
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
      setActionError(result.error ?? "Não foi possível iniciar o checkout de créditos de IA.")
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
    <div className="mx-auto max-w-5xl space-y-6">
      <motion.div {...fadeInUp} className="space-y-3">
        <Button asChild variant="ghost" className="w-fit rounded-xl px-0 text-muted-foreground hover:text-foreground">
          <Link href="/portal/viagem">
            <ChevronLeft size={16} className="mr-2" />
            Voltar
          </Link>
        </Button>

        <div>
          <h1 className="text-3xl font-bold">Viagens e Vuei+</h1>
          <p className="text-sm text-muted-foreground">Viagens compradas e Vuei+ são independentes. Assine apenas se quiser manter seu arquivo histórico acessível.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {hasManageableVueiPlus ? (
            <Button variant="outline" className="rounded-xl" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Crown size={16} className="mr-2" />}
              Gerenciar Vuei+
            </Button>
          ) : null}
          {hasManageableLegacyPremium ? (
            <Button variant="outline" className="rounded-xl" onClick={handleOpenPortal} disabled={portalLoading}>
              {portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <ShieldCheck size={16} className="mr-2" />}
              Gerenciar Premium legado
            </Button>
          ) : null}

          {membership?.hasVueiPlus && membership.vueiPlusCurrentPeriodEnd ? (
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
        <Card className="flex min-h-[27rem] flex-col rounded-[1.5rem] border-border/55 bg-card/70 p-5 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.45)]">
          <div className="flex min-h-[5rem] items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Uso sem assinatura</p>
              <h2 className="mt-2 text-[2rem] font-bold leading-none">Viagens avulsas</h2>
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/20">Sempre disponível</Badge>
          </div>

          <div className="mt-6 min-h-[11rem] space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {TRAVELER_TRIP_LINK_PRODUCTS.map((product) => (
                <div key={product.code} className={`rounded-xl border px-3 py-2.5 ${product.featured ? "border-primary/25 bg-primary/[0.06]" : "border-border/50 bg-background/35"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{product.name}</p>
                    {product.featured ? <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-primary">Mais escolhido</span> : null}
                  </div>
                  <p className="mt-1 text-sm font-medium">{formatOfferPrice(product.unitAmount, product.currency)}</p>
                  <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{product.validityLabel} para ativar</p>
                </div>
              ))}
            </div>
            {[
              "Crie rascunhos sem consumir uma viagem",
              "1 crédito de viagem ativa 1 viagem",
              "Créditos com validade por lote e consumo dos que vencem primeiro",
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

        <Card className="relative flex min-h-[27rem] flex-col overflow-hidden rounded-[1.5rem] border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] via-card/80 to-secondary/[0.07] p-5 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.45)]">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="relative flex min-h-[5rem] items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Assinatura opcional</p>
              <h2 className="mt-2 text-[2rem] font-bold leading-none">Vuei+</h2>
              <p className="mt-2 text-xl font-semibold text-foreground">{TRAVELER_VUEI_PLUS_OFFER.priceLabel}</p>
              <p className="mt-1 text-sm text-muted-foreground">Sua viagem termina. Seu histórico não precisa.</p>
            </div>
            <Badge className="bg-amber-500 text-black">
              {membership?.hasVueiPlus ? "Ativo" : "Arquivo Vuei+"}
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
            onClick={membership?.hasVueiPlus ? handleOpenPortal : handleVueiPlusCheckout}
            disabled={vueiPlusLoading || portalLoading || membership === null}
          >
            {vueiPlusLoading || portalLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {membership?.hasVueiPlus ? "Gerenciar Vuei+" : "Assinar Vuei+"}
          </Button>
        </Card>
      </motion.div>

      {membership?.isPremiumLegacy ? (
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="w-fit">{premiumPlan.priceLabel}</Badge>
                {hasManageableLegacyPremium ? (
                  <Button size="sm" variant="outline" onClick={handleOpenPortal} disabled={portalLoading}>
                    Gerenciar Premium legado
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div {...fadeInUp}>
        <Card className="rounded-[1.5rem] border-border/55 bg-card/70 p-5 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.45)]">
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
              <Card key={pkg.code} className="flex min-h-[13.5rem] flex-col rounded-[1.2rem] border-border/50 bg-background/65 p-4 shadow-[0_12px_34px_-30px_rgba(15,23,42,0.42)]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-semibold">{pkg.name}</p>
                  {pkg.code === "popular" ? <Badge className="bg-primary text-primary-foreground">Popular</Badge> : null}
                </div>
                <p className="text-[2rem] font-bold leading-none">{pkg.credits}</p>
                <p className="text-sm text-muted-foreground">créditos de IA</p>
                <p className="mt-3 text-lg font-semibold">{pkg.priceLabel}</p>
                <Button
                  className="mt-auto w-full rounded-xl"
                  variant={pkg.code === "popular" ? "default" : "outline"}
                  onClick={() => handleCreditsCheckout(pkg.code)}
                  disabled={packageLoading !== null}
                >
                  {packageLoading === pkg.code ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
                  Comprar créditos de IA
                </Button>
              </Card>
            ))}
          </div>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="rounded-[1.5rem] border-border/55 bg-card/70 p-5 shadow-[0_16px_48px_-38px_rgba(15,23,42,0.45)] sm:p-6">
          <h2 className="text-xl font-semibold">Perguntas frequentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tudo o que você precisa saber sobre rascunhos, viagens, créditos de IA e Vuei+.</p>
          <Accordion type="single" collapsible className="mt-4">
            {INDIVIDUAL_FAQ.map((item) => (
              <AccordionItem key={item.id} value={item.id} className="border-border/55">
                <AccordionTrigger className="text-left text-[0.95rem] font-medium hover:no-underline">{item.question}</AccordionTrigger>
                <AccordionContent className="max-w-3xl text-sm leading-6 text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </motion.div>
    </div>
  )
}
