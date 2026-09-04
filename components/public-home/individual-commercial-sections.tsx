"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowRight,
  Check,
  FileClock,
  LockKeyhole,
  PlaneTakeoff,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { getPublicTravelerTripLinkProducts } from "@/lib/repositories/traveler-trip-link-repository"
import { TRAVELER_VUEI_PLUS_OFFER } from "@/lib/billing/traveler-membership"
import type { TravelerTripLinkStoreProduct } from "@/types"

const journeySteps = [
  {
    title: "Crie",
    description: "Monte sua viagem gratuitamente, sem precisar entrar ou assinar.",
  },
  {
    title: "Ative",
    description: "Use 1 viagem quando tudo estiver pronto para compartilhar.",
  },
  {
    title: "Viaje",
    description: "Tenha documentos e informações organizados em um único link.",
  },
  {
    title: "Guarde",
    description: "Com Vuei+, mantenha viagens e documentos no seu arquivo pessoal.",
  },
]

const faqItems = [
  {
    question: "Preciso assinar para usar o Vuei?",
    answer: "Não. Você pode começar e montar sua viagem gratuitamente. A assinatura Vuei+ é opcional e serve para manter seu arquivo e histórico acessíveis.",
  },
  {
    question: "O que acontece quando crio uma viagem?",
    answer: "Ela nasce como um rascunho privado. Você pode preencher e revisar tudo antes de ativar, sem publicar um link e sem consumir uma viagem disponível.",
  },
  {
    question: "Quando uma viagem é consumida?",
    answer: "Somente quando você toca em Ativar viagem para publicar e compartilhar o link. Criar, completar ou vincular o rascunho à sua conta não consome saldo.",
  },
  {
    question: "Posso criar rascunhos sem gastar viagem?",
    answer: "Sim. Seus rascunhos permanecem privados e não reduzem o saldo até que você escolha ativar um deles.",
  },
  {
    question: "Qual a diferença entre rascunho e viagem ativa?",
    answer: "O rascunho é privado e não pode ser compartilhado. A viagem ativa consumiu 1 crédito de viagem e possui um link público disponível durante o período da viagem.",
  },
  {
    question: "Quanto tempo tenho para usar cada pacote?",
    answer: "Você tem 90 dias para ativar a viagem avulsa, 6 meses no pacote de 3 e 12 meses no pacote de 5. O prazo começa após a confirmação da compra.",
  },
  {
    question: "O que acontece depois que a viagem termina?",
    answer: "O link continua disponível por 7 dias e depois é encerrado. Seus dados não são apagados; o Vuei+ mantém o acesso autenticado ao arquivo.",
  },
  {
    question: "Por quanto tempo o link fica disponível?",
    answer: "Depois da ativação, ele permanece público durante a viagem e por mais 7 dias após a data final cadastrada.",
  },
  {
    question: "O que acontece se eu não ativar dentro da validade?",
    answer: "O crédito vencido deixa de ficar disponível para ativação. O rascunho continua salvo e poderá ser ativado depois com uma nova viagem válida.",
  },
  {
    question: "O que é o Vuei+?",
    answer: "É a assinatura opcional para manter seu arquivo de viagens, documentos e histórico pessoal acessível depois que o link público encerra.",
  },
  {
    question: "O Vuei+ substitui a compra de viagens?",
    answer: "Não. O Vuei+ não concede viagens e não substitui os pacotes. Cada link novo ainda usa 1 crédito de viagem na ativação.",
  },
  {
    question: "O que fica salvo no arquivo Vuei+?",
    answer: "Roteiro, documentos, passagens, hospedagens e demais informações preservadas da viagem ficam disponíveis ao proprietário autenticado.",
  },
  {
    question: "Créditos de IA são a mesma coisa que viagens?",
    answer: "Não. Viagens ativam links públicos; créditos de IA são usados em recursos inteligentes. Os dois saldos são totalmente separados.",
  },
  {
    question: "Para que servem os créditos de IA?",
    answer: "Eles abastecem recursos inteligentes disponíveis na conta, como Concierge IA, roteiros e extrações automatizadas, conforme a regra de cada recurso.",
  },
  {
    question: "Posso comprar mais viagens depois?",
    answer: "Sim. Você pode comprar novos pacotes quando quiser. Os créditos válidos são somados e o sistema usa primeiro os que vencem antes.",
  },
  {
    question: "Como funciona a ativação de uma viagem?",
    answer: "Ao tocar em Ativar viagem, o sistema confirma seu saldo, consome exatamente 1 crédito e libera o link. Repetir a ação não cobra duas vezes a mesma viagem.",
  },
  {
    question: "Posso compartilhar uma viagem antes de ativar?",
    answer: "Não. Enquanto for rascunho, a URL pública não funciona e as ações de abrir, copiar e compartilhar permanecem bloqueadas.",
  },
  {
    question: "Como funciona a validade dos pacotes de 1, 3 e 5 viagens?",
    answer: "Cada compra gera créditos válidos por 90 dias, 6 meses ou 12 meses. Após a ativação, a validade do pacote dá lugar ao período normal do link: viagem + 7 dias.",
  },
]

function formatPerTripPrice(product: TravelerTripLinkStoreProduct) {
  if (product.unitAmount === null || !product.currency || product.quantity < 1) return null

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: product.currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(product.unitAmount / product.quantity / 100)
}

function getSavingsPercentage(
  product: TravelerTripLinkStoreProduct,
  singleTripProduct: TravelerTripLinkStoreProduct | null,
) {
  if (
    product.quantity < 2 ||
    product.unitAmount === null ||
    !product.currency ||
    singleTripProduct?.unitAmount === null ||
    !singleTripProduct?.currency ||
    product.currency !== singleTripProduct.currency ||
    singleTripProduct.unitAmount <= 0
  ) {
    return null
  }

  const fullSinglePrice = singleTripProduct.unitAmount * product.quantity
  const percentage = Math.round((1 - product.unitAmount / fullSinglePrice) * 100)
  return percentage > 0 ? percentage : null
}

export function IndividualCommercialSections() {
  const router = useRouter()
  const { user } = useAuth()
  const [products, setProducts] = useState<TravelerTripLinkStoreProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadProducts = async () => {
      const result = await getPublicTravelerTripLinkProducts()
      if (!active) return
      setProducts((result.data?.products ?? []).slice().sort((left, right) => left.quantity - right.quantity))
      setProductsError(result.error)
      setLoadingProducts(false)
    }

    void loadProducts()
    return () => { active = false }
  }, [])

  const singleTripProduct = useMemo(
    () => products.find((product) => product.quantity === 1) ?? null,
    [products],
  )

  const openTravelerProduct = (destination: "/portal/viagens/comprar" | "/portal/planos") => {
    if (user) {
      router.push(destination)
      return
    }

    router.push(`/signup?redirect=${encodeURIComponent(destination)}`)
  }

  return (
    <div className="relative z-20 -mt-8 overflow-hidden rounded-t-[2.5rem] border-t border-white/75 bg-[linear-gradient(180deg,#fbfaf7_0%,#f7f9fc_44%,#f5f7fb_100%)] text-slate-950 shadow-[0_-24px_70px_-54px_rgba(15,23,42,0.35)] sm:-mt-10 sm:rounded-t-[3.25rem]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(52%_70%_at_16%_10%,rgba(55,190,255,0.13),transparent_72%),radial-gradient(45%_65%_at_88%_24%,rgba(255,196,116,0.14),transparent_75%)]" />

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-14 md:px-10 md:pb-24 md:pt-20" aria-labelledby="como-funciona-title">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0b56d8]">Do primeiro plano à lembrança</p>
          <h2 id="como-funciona-title" className="mt-4 text-balance text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
            Comece livre. Compartilhe quando estiver pronto.
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-8 text-slate-600">
            Você monta tudo primeiro e usa uma viagem somente quando decidir colocar o link no ar.
          </p>
        </div>

        <div className="mt-12 grid gap-0 md:mt-14 md:grid-cols-4">
          {journeySteps.map((step, index) => (
            <div key={step.title} className="group relative border-l border-slate-200 py-5 pl-6 pr-6 md:border-l-0 md:border-t md:pb-0 md:pl-0 md:pr-8 md:pt-8">
              <span className="absolute -left-[5px] top-7 size-2.5 rounded-full border-2 border-white bg-[#0b56d8] shadow-[0_0_0_4px_rgba(11,86,216,0.08)] md:-top-[5px] md:left-0" />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">0{index + 1}</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="viagens" className="relative mx-auto max-w-6xl scroll-mt-8 px-6 py-24 md:px-10 md:py-32" aria-labelledby="viagens-title">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0b56d8]">Compra única</p>
            <h2 id="viagens-title" className="mt-4 text-balance text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
              Escolha quantas viagens você quer ter disponíveis
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-600">
            Cada crédito ativa uma viagem. A validade indicada é o prazo para ativar; depois, vale o lifecycle normal do link.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {loadingProducts
            ? [0, 1, 2].map((index) => (
                <div key={index} className="min-h-[25rem] animate-pulse rounded-[2rem] border border-white/80 bg-white/60 p-7 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)]" />
              ))
            : products.map((product) => {
                const perTripPrice = formatPerTripPrice(product)
                const savings = getSavingsPercentage(product, singleTripProduct)
                const packageTitle = product.quantity === 1 ? "1 viagem" : `Pacote ${product.quantity} viagens`

                return (
                  <article
                    key={product.code}
                    className="relative flex min-h-[25rem] flex-col overflow-hidden rounded-[2rem] border border-white/90 bg-white/76 p-7 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.3)] ring-1 ring-slate-950/[0.04] backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1"
                  >
                    <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#37beff]/70 to-transparent" />
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-12 place-items-center rounded-2xl bg-[#0b56d8]/[0.07] text-[#0b56d8] ring-1 ring-[#0b56d8]/10">
                        <PlaneTakeoff className="size-5" />
                      </span>
                      <div className="flex flex-col items-end gap-2">
                        {product.featured ? (
                          <span className="rounded-full bg-[#0b56d8] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                            Mais escolhido
                          </span>
                        ) : null}
                        {savings ? (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
                            Economize {savings}%
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-8">
                      <h3 className="text-2xl font-semibold tracking-tight">{packageTitle}</h3>
                      <p className="mt-2 text-sm text-slate-500">{product.description}</p>
                    </div>

                    <div className="mt-9">
                      <p className="text-4xl font-semibold tracking-[-0.04em]">{product.priceLabel ?? "Preço indisponível"}</p>
                      {perTripPrice ? <p className="mt-2 text-sm text-slate-500">{perTripPrice}/viagem</p> : null}
                    </div>

                    <div className="mt-7 space-y-3 text-sm text-slate-600">
                      <p className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> Compra única</p>
                      <p className="flex items-center gap-2"><Check className="size-4 text-emerald-600" /> {product.validityShortLabel}</p>
                      <p className="pl-6 text-xs text-slate-500">Prazo para ativar a viagem</p>
                    </div>

                    <Button
                      size="lg"
                      className="mt-auto h-12 rounded-2xl bg-slate-950 text-white shadow-[0_16px_36px_-20px_rgba(15,23,42,0.7)] hover:bg-slate-800"
                      disabled={!product.configured}
                      onClick={() => openTravelerProduct("/portal/viagens/comprar")}
                    >
                      Comprar
                      <ArrowRight className="ml-1 size-4" />
                    </Button>
                  </article>
                )
              })}
        </div>

        {productsError ? <p className="mt-5 text-sm text-slate-500">Não foi possível atualizar os preços agora. Tente novamente em instantes.</p> : null}
      </section>

      <section id="vuei-plus" className="relative mx-auto max-w-6xl scroll-mt-8 px-6 py-24 md:px-10 md:py-32" aria-labelledby="vuei-plus-title">
        <div className="relative overflow-hidden rounded-[2.75rem] border border-slate-800/80 bg-[radial-gradient(70%_90%_at_90%_10%,rgba(49,112,220,0.26),transparent_68%),linear-gradient(145deg,#101722_0%,#0a0f17_68%,#080b10_100%)] px-7 py-10 text-white shadow-[0_42px_120px_-54px_rgba(2,8,23,0.9)] md:px-14 md:py-16">
          <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] size-[28rem] rounded-full border border-white/10 bg-white/[0.025] blur-[1px]" />
          <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/70 backdrop-blur-lg">
                <Sparkles className="size-4 text-amber-300" />
                Assinatura opcional
              </div>
              <h2 id="vuei-plus-title" className="mt-7 max-w-2xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] md:text-6xl">
                Sua viagem termina. Seu histórico não precisa.
              </h2>
              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-white/60 md:text-lg">
                Vuei+ mantém seu arquivo pessoal vivo, privado e pronto para ser revisitado.
              </p>
              <p className="mt-5 text-2xl font-semibold tracking-tight text-white">{TRAVELER_VUEI_PLUS_OFFER.priceLabel}</p>

              <Button
                size="lg"
                onClick={() => openTravelerProduct("/portal/planos")}
                className="mt-9 h-12 rounded-2xl bg-white px-6 text-slate-950 hover:bg-white/90"
              >
                Conhecer Vuei+
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-xl md:p-8">
              <div className="space-y-5">
                {[
                  { icon: Archive, text: "Arquivo de viagens" },
                  { icon: FileClock, text: "Documentos preservados" },
                  { icon: ShieldCheck, text: "Histórico pessoal e privado" },
                  { icon: LockKeyhole, text: "Acesso às viagens encerradas" },
                  { icon: Sparkles, text: "Benefícios recorrentes e novidades futuras" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-4 border-b border-white/[0.07] pb-5 last:border-b-0 last:pb-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-amber-200">
                      <Icon className="size-4" />
                    </span>
                    <p className="font-medium text-white/85">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm leading-6 text-white/50 md:flex-row md:items-center md:justify-between">
            <p>Vuei+ não substitui a compra de viagens.</p>
            <p>Os links públicos continuam temporários e encerram após a viagem + 7 dias.</p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-6 py-24 md:px-10 md:py-32" aria-labelledby="faq-title">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0b56d8]">Sem letras miúdas</p>
          <h2 id="faq-title" className="mt-4 text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Perguntas frequentes</h2>
        </div>

        <div className="mx-auto mt-14 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {faqItems.map((item) => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left text-lg font-medium marker:content-none">
                {item.question}
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition-transform group-open:rotate-45">
                  <span className="text-xl leading-none">+</span>
                </span>
              </summary>
              <p className="max-w-2xl pb-7 pr-12 text-sm leading-7 text-slate-600">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative px-6 pb-28 pt-10 text-center md:px-10 md:pb-36">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0b56d8]">Sua próxima viagem começa aqui</p>
        <h2 className="mx-auto mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.04em] md:text-6xl">Comece grátis. Ative quando estiver pronta.</h2>
        <Button asChild size="lg" className="mt-8 h-12 rounded-2xl bg-slate-950 px-7 text-white hover:bg-slate-800">
          <Link href="#criar-viagem">
            Começar minha viagem
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </section>

      <footer className="border-t border-slate-200/80 px-6 py-8 text-center text-sm text-slate-500">
        <p>Vuei — sua viagem organizada do começo ao arquivo.</p>
      </footer>
    </div>
  )
}
