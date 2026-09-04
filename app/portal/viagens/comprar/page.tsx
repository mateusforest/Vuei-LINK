"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Luggage,
  PlaneTakeoff,
  ShoppingBag,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTrips } from "@/contexts/trips-context"
import { activateTravelerTrip } from "@/lib/repositories/trips-repository"
import {
  createTravelerTripLinkCheckout,
  getTravelerTripLinkStoreSummary,
  notifyTravelerTripLinkBalanceChanged,
} from "@/lib/repositories/traveler-trip-link-repository"
import type { TravelerTripLinkProductCode } from "@/lib/billing/traveler-trip-link-catalog"
import type { TravelerTripLinkStoreSummary } from "@/types"

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatPerTripPrice(unitAmount: number | null, currency: string | null, quantity: number) {
  if (unitAmount === null || !currency || quantity < 1) return null
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(unitAmount / quantity / 100)
}

export default function ComprarViagensPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { trips, setActiveTrip, updateTrip } = useTrips()
  const [summary, setSummary] = useState<TravelerTripLinkStoreSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [packageLoading, setPackageLoading] = useState<TravelerTripLinkProductCode | null>(null)
  const [activating, setActivating] = useState(false)
  const lastPublishedBalanceRef = useRef<number | null>(null)
  const checkoutStatus = searchParams.get("checkout")
  const tripId = searchParams.get("trip_id")
  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === tripId) ?? null, [tripId, trips])

  const loadSummary = useCallback(async () => {
    const result = await getTravelerTripLinkStoreSummary()
    if (result.data) {
      setSummary(result.data)
      setError(null)
      if (lastPublishedBalanceRef.current !== result.data.balance) {
        lastPublishedBalanceRef.current = result.data.balance
        notifyTravelerTripLinkBalanceChanged()
      }
    } else {
      setError(result.error)
    }
    setLoading(false)
    return result.data
  }, [])

  useEffect(() => {
    let active = true
    let attempts = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const refresh = async () => {
      if (!active) return
      await loadSummary()
      attempts += 1

      if (active && checkoutStatus === "success" && attempts < 12) {
        timeoutId = setTimeout(() => void refresh(), 2000)
      }
    }

    void refresh()
    return () => {
      active = false
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [checkoutStatus, loadSummary])

  const startCheckout = async (packageCode: TravelerTripLinkProductCode) => {
    setError(null)
    setPackageLoading(packageCode)
    const result = await createTravelerTripLinkCheckout(packageCode, tripId)

    if (!result.data?.url) {
      setError(result.error)
      setPackageLoading(null)
      return
    }

    window.location.assign(result.data.url)
  }

  const activateSelectedTrip = async () => {
    if (!selectedTrip || activating) return

    setActivating(true)
    setError(null)
    const result = await activateTravelerTrip(selectedTrip.id)
    if (!result.data) {
      setError(result.error || "Nao foi possivel ativar o Link da Viagem.")
      setActivating(false)
      return
    }

    updateTrip(selectedTrip.id, {
      visibility: "public",
      linkActivatedAt: result.data.linkActivatedAt,
      linkAccessUntil: result.data.linkAccessUntil,
      linkActivationTransactionId: result.data.transactionId,
    })
    setActiveTrip(selectedTrip.id)
    await loadSummary()
    router.push("/portal/compartilhar")
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/portal/viagem" aria-label="Voltar para viagens">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Comprar viagens</h1>
            <p className="text-sm text-muted-foreground">Viagens disponíveis para ativar seus links quando você quiser.</p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-2 text-primary">
          A validade começa após a compra
        </Badge>
      </div>

      {checkoutStatus === "success" ? (
        <Card className="border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
            <p>Pagamento recebido. Estamos confirmando o crédito pelo Stripe; o saldo abaixo atualiza automaticamente.</p>
          </div>
        </Card>
      ) : null}

      {checkoutStatus === "canceled" ? (
        <Card className="border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700">
          Checkout cancelado. Nenhum crédito de viagem foi concedido.
        </Card>
      ) : null}

      {searchParams.get("reason") === "insufficient_balance" ? (
        <Card className="border-blue-500/20 bg-blue-500/8 p-4 text-sm text-foreground">
          Sua viagem continua salva como rascunho. Compre um pacote e depois ative o link explicitamente.
        </Card>
      ) : null}

      <Card className="relative overflow-hidden rounded-[1.5rem] border-primary/15 bg-gradient-to-br from-primary/[0.08] via-card/90 to-secondary/[0.07] p-5 shadow-[0_18px_52px_-38px_rgba(15,23,42,0.42)] md:p-6">
        <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Luggage size={17} className="text-primary" />
              Saldo de viagens
            </div>
            <div className="mt-2 flex items-end gap-2.5">
              <span className="text-5xl font-bold text-primary md:text-6xl">{loading ? "—" : summary?.balance ?? 0}</span>
              <span className="pb-1 text-sm text-muted-foreground">
                {(summary?.balance ?? 0) === 1 ? "viagem disponível" : "viagens disponíveis"}
              </span>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-5 text-muted-foreground">
            Criar rascunhos é grátis. O saldo considera apenas créditos válidos e cada ativação consome exatamente uma viagem.
          </p>
        </div>
      </Card>

      {error ? (
        <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-700">{error}</Card>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <ShoppingBag size={19} className="text-primary" />
          <h2 className="font-semibold">Escolha um pacote</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {(summary?.products ?? []).map((product) => {
            const perTripPrice = formatPerTripPrice(product.unitAmount, product.currency, product.quantity)
            return (
              <Card key={product.code} className={`relative flex flex-col overflow-hidden rounded-[1.35rem] bg-card/80 p-4 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.5)] ${product.featured ? "border-primary/35 ring-1 ring-primary/10" : "border-border/60"}`}>
                {product.featured ? (
                  <Badge className="absolute right-4 top-4 border-0 bg-primary text-primary-foreground">Mais escolhido</Badge>
                ) : null}
                <div className="flex flex-1 flex-col">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <PlaneTakeoff size={18} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{product.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    +{product.quantity} {product.quantity === 1 ? "crédito de viagem" : "créditos de viagem"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{product.description}</p>
                  <p className="mt-5 text-3xl font-bold">{product.priceLabel ?? "Indisponível"}</p>
                  {perTripPrice ? <p className="mt-1 text-sm text-muted-foreground">{perTripPrice}/viagem</p> : null}
                  <div className="mt-4 rounded-xl border border-primary/10 bg-primary/[0.04] px-3 py-2.5">
                    <p className="text-sm font-medium text-foreground">{product.validityLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Prazo para ativar uma viagem</p>
                  </div>
                </div>
                <Button
                  className="mt-4 w-full rounded-xl"
                  disabled={!product.configured || packageLoading !== null}
                  onClick={() => void startCheckout(product.code)}
                >
                  {packageLoading === product.code ? <Loader2 className="mr-2 animate-spin" size={16} /> : null}
                  Comprar
                </Button>
              </Card>
            )
          })}
        </div>
        {!loading && summary?.products.length === 0 ? (
          <Card className="p-5 text-sm text-muted-foreground">Os pacotes serão exibidos após a configuração dos produtos.</Card>
        ) : null}
      </section>

      {selectedTrip ? (
        <Card className="flex flex-col justify-between gap-4 border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Continuar com {selectedTrip.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">A ativação consome exatamente 1 viagem e não acontece automaticamente.</p>
          </div>
          <Button
            className="shrink-0 rounded-xl"
            disabled={activating || (summary?.balance ?? 0) < 1}
            onClick={() => void activateSelectedTrip()}
          >
            {activating ? <Loader2 className="mr-2 animate-spin" size={16} /> : <PlaneTakeoff className="mr-2" size={16} />}
            Ativar viagem
          </Button>
        </Card>
      ) : null}

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Clock3 size={18} className="text-primary" />
          <h2 className="font-semibold">Histórico de viagens</h2>
        </div>
        <Card className="divide-y divide-border/60 overflow-hidden border-border/60 bg-card/80">
          {(summary?.transactions ?? []).length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">Nenhuma compra ou ativação registrada ainda.</div>
          ) : (
            summary?.transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-4 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${transaction.amount > 0 ? "bg-emerald-500/10 text-emerald-600" : transaction.transactionType === "expiration" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"}`}>
                  {transaction.amount > 0 ? <ShoppingBag size={18} /> : transaction.transactionType === "expiration" ? <Clock3 size={18} /> : <PlaneTakeoff size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{transaction.reason}</p>
                  <p className="text-xs text-muted-foreground">{formatHistoryDate(transaction.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${transaction.amount > 0 ? "text-emerald-600" : "text-foreground"}`}>
                    {transaction.amount > 0 ? "+" : ""}{transaction.amount}
                  </p>
                  <p className="text-xs text-muted-foreground">saldo {transaction.balanceAfter}</p>
                </div>
              </div>
            ))
          )}
        </Card>
      </section>
    </motion.div>
  )
}
