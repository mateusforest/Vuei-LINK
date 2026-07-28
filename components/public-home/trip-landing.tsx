"use client"

import { ArrowRight, Calendar, Check, Copy, ExternalLink, Link2, Loader2, LogIn, MapPin, Minus, Plus, Share2, ShoppingBag, Users } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useTrips } from "@/contexts/trips-context"
import type { Trip as CanonicalTrip } from "@/types"
import { DateRangePicker, formatRange } from "@/components/public-home/date-range-picker"
import { DestinationCombobox } from "@/components/public-home/destination-combobox"
import { TripBag } from "@/components/public-home/trip-bag"
import { TripsPopup, mapLegacyTripToBagItem, type PublicBagTripItem } from "@/components/public-home/trips-popup"
import { VueiWordmark } from "@/components/public-home/vuei-mark"
import { clearPendingTripClaimSession, isPendingTripClaimSessionActive, readPendingTripClaimSession, writePendingTripClaimSession, type PendingTripClaimSession } from "@/lib/pending-trip-claim"
import { claimPendingTrip, createPendingTripClaim } from "@/lib/repositories/pending-trip-claim-repository"
import { resolveDestinationInput, type DestinationOption } from "@/lib/destinations/catalog"
import { cn } from "@/lib/utils"

type Step = "destination" | "dates" | "travelers"

type PendingTripSnapshot = {
  id: string
  slug: string
  title: string
  destination: string
  publicLink: string
}

const companionOptions = [
  { id: 1, label: "1 pessoa" },
  { id: 2, label: "2 pessoas" },
  { id: 4, label: "4 pessoas" },
  { id: 6, label: "6 pessoas" },
]

function buildSameOriginPath(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

function toPendingBagItem(session: PendingTripClaimSession): PublicBagTripItem {
  return {
    id: session.tripId,
    title: "Link da Viagem",
    destination: session.tripSlug.replace(/-/g, " "),
    startDate: null,
    endDate: null,
    travelersCount: null,
    url: session.shareLink,
    statusLabel: "Pendente",
    isPending: true,
  }
}

export function TripLanding() {
  const router = useRouter()
  const { user, initialized, loading } = useAuth()
  const { trips, loadingTrips, syncTripFromBackend } = useTrips()
  const inputRef = useRef<HTMLInputElement>(null)

  const [destination, setDestination] = useState("")
  const [selectedDestination, setSelectedDestination] = useState<DestinationOption | null>(null)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [travelers, setTravelers] = useState(2)
  const [active, setActive] = useState<Step | null>("destination")
  const [creating, setCreating] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [createdTrip, setCreatedTrip] = useState<PendingTripSnapshot | null>(null)
  const [pendingSession, setPendingSession] = useState<PendingTripClaimSession | null>(null)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [popupOpen, setPopupOpen] = useState(false)
  const [showBalloon, setShowBalloon] = useState(false)
  const [highlightTripId, setHighlightTripId] = useState<string | null>(null)

  useEffect(() => {
    const session = readPendingTripClaimSession()
    if (!isPendingTripClaimSessionActive(session)) {
      if (session) {
        clearPendingTripClaimSession()
      }
      return
    }

    const activeSession = session
    if (!activeSession) return

    setPendingSession(activeSession)
    setCreatedTrip({
      id: activeSession.tripId,
      slug: activeSession.tripSlug,
      title: "Link da Viagem",
      destination: activeSession.tripSlug.replace(/-/g, " "),
      publicLink: activeSession.shareLink,
    })
    setActive(null)
  }, [])

  useEffect(() => {
    if (!showBalloon) return
    const timer = window.setTimeout(() => setShowBalloon(false), 9000)
    return () => window.clearTimeout(timer)
  }, [showBalloon])

  useEffect(() => {
    if (active === "destination") {
      inputRef.current?.focus()
    }
  }, [active])

  const realTrips = useMemo(() => trips.map(mapLegacyTripToBagItem), [trips])
  const bagTrips = useMemo(() => {
    const items = [...realTrips]
    if (pendingSession && !items.some((trip) => trip.id === pendingSession.tripId)) {
      items.unshift(toPendingBagItem(pendingSession))
    }
    return items
  }, [pendingSession, realTrips])

  const canCreate = destination.trim().length > 1 && Boolean(startDate)
  const glow = bagTrips.length > 0

  function resetWizard() {
    setDestination("")
    setSelectedDestination(null)
    setStartDate(null)
    setEndDate(null)
    setTravelers(2)
    setActive("destination")
    setCreationError(null)
    setClaimError(null)
    setCreatedTrip(null)
    setCopied(false)
  }

  async function handleCreate() {
    if (!canCreate || creating) return

    setCreating(true)
    setCreationError(null)
    setClaimError(null)
    setCopied(false)

    try {
      const resolvedDestination = resolveDestinationInput(destination, selectedDestination?.id ?? null)
      const result = await createPendingTripClaim({
        title: resolvedDestination.label,
        destination: resolvedDestination.label,
        startDate,
        endDate,
        travelersCount: travelers,
      })

      if (!result.data) {
        setCreationError(result.error ?? "Nao foi possivel criar a viagem agora.")
        return
      }

      const nextSession: PendingTripClaimSession = {
        tripId: result.data.trip.id,
        tripSlug: result.data.trip.slug,
        claimToken: result.data.claimToken,
        shareLink: result.data.trip.publicLink,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }

      writePendingTripClaimSession(nextSession)
      setPendingSession(nextSession)
      setCreatedTrip({
        id: result.data.trip.id,
        slug: result.data.trip.slug,
        title: result.data.trip.title,
        destination: result.data.trip.destination,
        publicLink: result.data.trip.publicLink,
      })
      setHighlightTripId(result.data.trip.id)
      setActive(null)
      setShowBalloon(true)
    } finally {
      setCreating(false)
    }
  }

  async function handleCopyLink() {
    const url = createdTrip?.publicLink ?? pendingSession?.shareLink
    if (!url || typeof navigator === "undefined" || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Mantem fallback silencioso.
    }
  }

  async function handleShareLink() {
    const url = createdTrip?.publicLink ?? pendingSession?.shareLink
    if (!url) return

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Minha viagem no Vuei",
          url,
        })
        return
      } catch {
        // Usa fallback abaixo.
      }
    }

    await handleCopyLink()
  }

  function handleOpenTrip(url?: string | null) {
    if (!url) return
    window.location.assign(buildSameOriginPath(url))
  }

  async function handleGuardInWallet() {
    if (!pendingSession || claiming) return

    if (!user) {
      router.push(`/signup?redirect=${encodeURIComponent("/")}`)
      return
    }

    setClaiming(true)
    setClaimError(null)

    try {
      const result = await claimPendingTrip(pendingSession.claimToken)
      const isDefinitiveError =
        result.code === "claim_invalid" ||
        result.code === "claim_expired" ||
        result.code === "claim_already_claimed"

      if (result.data && "ownerType" in result.data) {
        const trip = syncTripFromBackend(result.data as CanonicalTrip)
        clearPendingTripClaimSession()
        setPendingSession(null)
        setHighlightTripId(trip.id)
        setPopupOpen(true)
        setShowBalloon(true)
        return
      }

      if (isDefinitiveError) {
        clearPendingTripClaimSession()
        setPendingSession(null)
      }

      setClaimError(result.error ?? "Nao foi possivel guardar a viagem na Bolsa agora.")
    } finally {
      setClaiming(false)
    }
  }

  function openLogin() {
    router.push(`/login?redirect=${encodeURIComponent("/")}`)
  }

  function openStart() {
    setPopupOpen(false)
    setActive("destination")
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <main className="landing-shell relative flex h-[100dvh] w-full flex-col overflow-hidden overscroll-none text-foreground">
      <img
        src="/beach-landing/beach-scene.png"
        alt="Praia ao entardecer com uma cadeira e uma bolsa de viagem Vuei"
        className="absolute inset-0 z-0 h-full w-full object-cover object-[68%_center] md:object-[58%_center] lg:object-[center_90%]"
      />
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(90deg, color-mix(in oklch, var(--background) 90%, transparent) 0%, color-mix(in oklch, var(--background) 74%, transparent) 32%, color-mix(in oklch, var(--background) 18%, transparent) 58%, transparent 76%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10 md:py-7">
        <VueiWordmark />
        <nav className="flex items-center gap-2 md:gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={openLogin}
            className="vuei-glass h-10 rounded-full border border-border/60 px-5 text-[0.9rem] text-foreground shadow-sm"
          >
            Entrar
          </Button>
          <Button
            size="lg"
            onClick={openStart}
            className="h-10 rounded-full bg-foreground px-5 text-[0.9rem] text-background shadow-[0_8px_30px_-8px_var(--brand)] ring-1 ring-inset ring-white/10 hover:bg-foreground/90"
          >
            Comecar agora
          </Button>
        </nav>
      </header>

      <div className="relative z-10 flex flex-1 items-center overflow-hidden px-6 pb-8 pt-2 md:px-10">
        <div className="w-full max-w-xl">
          <h1 className="text-balance text-[2.45rem] font-semibold leading-[1.05] tracking-tight text-foreground md:text-[3.25rem]">
            Sua viagem comeca <span className="text-brand-gradient">aqui.</span>
          </h1>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">Um unico link para organizar tudo.</p>

          <div className="mt-8 flex flex-col gap-2.5">
            <StepRow
              index={1}
              done={destination.trim().length > 1}
              active={active === "destination"}
              onOpen={() => setActive("destination")}
              icon={<MapPin className="size-[1.15rem] text-brand" />}
              title="Para onde voce vai?"
              subtitle="Digite o destino da sua proxima viagem."
              value={destination.trim() || undefined}
              valueIcon={<MapPin className="size-4" />}
            >
              <DestinationCombobox
                inputRef={inputRef}
                value={destination}
                onChange={(value) => {
                  setDestination(value)
                  if (selectedDestination && value !== selectedDestination.label) {
                    setSelectedDestination(null)
                  }
                }}
                onSelect={setSelectedDestination}
                placeholder="Ex.: Lisboa, Aruba, Rio de Janeiro..."
              />
            </StepRow>

            <StepRow
              index={2}
              done={Boolean(startDate)}
              active={active === "dates"}
              onOpen={() => setActive("dates")}
              icon={<Calendar className="size-[1.15rem] text-emerald-600" />}
              title="Quando sera?"
              subtitle="Informe as datas da sua viagem."
              value={formatRange(startDate, endDate) ?? undefined}
              valueIcon={<Calendar className="size-4" />}
            >
              <DateRangePicker
                start={startDate}
                end={endDate}
                onChange={(nextStartDate, nextEndDate) => {
                  setStartDate(nextStartDate)
                  setEndDate(nextEndDate)
                }}
              />
            </StepRow>

            <StepRow
              index={3}
              done
              active={active === "travelers"}
              onOpen={() => setActive("travelers")}
              icon={<Users className="size-[1.15rem] text-indigo-500" />}
              title="Quem vai com voce?"
              subtitle="Adicione os participantes da viagem."
              value={`${travelers} ${travelers === 1 ? "pessoa" : "pessoas"}`}
              valueIcon={<Users className="size-4" />}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
                  <button
                    type="button"
                    aria-label="Menos viajantes"
                    onClick={() => setTravelers((current) => Math.max(1, current - 1))}
                    className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    disabled={travelers <= 1}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-base font-semibold tabular-nums">{travelers}</span>
                  <button
                    type="button"
                    aria-label="Mais viajantes"
                    onClick={() => setTravelers((current) => Math.min(20, current + 1))}
                    className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {companionOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTravelers(option.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        travelers === option.id
                          ? "border-brand/40 bg-brand/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </StepRow>

            {createdTrip ? (
              <div className="vuei-celebrate">
                <StepRow
                  index={4}
                  done
                  active={false}
                  onOpen={() => undefined}
                  icon={<Link2 className="size-[1.15rem] text-brand" />}
                  title="Seu link ja esta pronto!"
                  subtitle="Sua viagem foi criada pela API real e ja pode ser compartilhada."
                  value={createdTrip.publicLink.replace(/^https?:\/\//, "")}
                  valueIcon={<Check className="size-4 text-emerald-600" />}
                  static
                  highlight
                />
              </div>
            ) : null}
          </div>

          <div className="mt-7">
            {!createdTrip ? (
              <Button
                size="lg"
                disabled={!canCreate || creating}
                onClick={handleCreate}
                className="h-12 w-full rounded-2xl bg-foreground text-[0.95rem] text-background shadow-[0_14px_40px_-12px_var(--brand)] ring-1 ring-inset ring-white/10 transition-[transform,background-color,box-shadow] duration-300 [transition-timing-function:var(--ease-out-soft)] hover:bg-foreground/90 hover:shadow-[0_18px_48px_-14px_var(--brand)] active:scale-[0.98] disabled:opacity-100 disabled:shadow-none sm:w-auto sm:px-7"
              >
                {creating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    Criar meu link
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            ) : (
              <div className="vuei-rise flex flex-wrap items-center gap-1.5">
                <Button
                  size="lg"
                  onClick={() => handleOpenTrip(createdTrip.publicLink)}
                  className="h-12 rounded-2xl bg-foreground px-6 text-[0.95rem] text-background shadow-[0_14px_40px_-16px_var(--brand)] ring-1 ring-inset ring-white/10 transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)] hover:bg-foreground/90 active:scale-[0.98]"
                >
                  <ExternalLink className="size-4" />
                  Abrir viagem
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleShareLink}
                  className="h-12 rounded-2xl px-4 text-[0.9rem] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <Share2 className="size-4" />
                  Compartilhar
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={handleCopyLink}
                  className="h-12 rounded-2xl px-4 text-[0.9rem] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copied ? "Copiado" : "Copiar link"}
                </Button>
                <Button
                  size="lg"
                  variant={pendingSession ? "outline" : "ghost"}
                  disabled={claiming || !pendingSession}
                  onClick={pendingSession ? handleGuardInWallet : () => setPopupOpen(true)}
                  className="h-12 rounded-2xl px-4 text-[0.9rem]"
                >
                  {claiming ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                  {pendingSession ? "Guardar na Bolsa" : "Ver na Bolsa"}
                </Button>
                <button
                  type="button"
                  onClick={resetWizard}
                  className="ml-auto text-[0.82rem] text-muted-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Criar outra
                </button>
              </div>
            )}

            {creationError ? <p className="mt-3 max-w-md text-sm text-red-600">{creationError}</p> : null}
            {claimError ? <p className="mt-3 max-w-md text-sm text-red-600">{claimError}</p> : null}
            {createdTrip && !user && initialized && !loading ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Button size="sm" variant="ghost" onClick={() => router.push(`/signup?redirect=${encodeURIComponent("/")}`)} className="rounded-full">
                  <ShoppingBag className="size-4" />
                  Guardar na Bolsa
                </Button>
                <Button size="sm" variant="ghost" onClick={openLogin} className="rounded-full">
                  <LogIn className="size-4" />
                  Entrar para reivindicar
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <TripBag
        count={bagTrips.length}
        glow={glow}
        showBalloon={showBalloon}
        onDismissBalloon={() => setShowBalloon(false)}
        onOpen={() => setPopupOpen(true)}
      />

      <TripsPopup
        open={popupOpen}
        loading={Boolean(user) && loadingTrips}
        trips={bagTrips}
        highlightTripId={highlightTripId}
        walletBalanceLabel={null}
        onClose={() => setPopupOpen(false)}
        onNewTrip={() => {
          setPopupOpen(false)
          openStart()
        }}
        onOpenTrip={(url) => handleOpenTrip(url)}
      />
    </main>
  )
}

function StepRow({
  index,
  done,
  active,
  onOpen,
  icon,
  title,
  subtitle,
  value,
  valueIcon,
  children,
  static: isStatic,
  highlight,
}: {
  index: number
  done?: boolean
  active: boolean
  onOpen: () => void
  icon: React.ReactNode
  title: string
  subtitle: string
  value?: string
  valueIcon?: React.ReactNode
  children?: React.ReactNode
  static?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center pt-3.5">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold transition-colors",
            done ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="size-3.5" /> : index}
        </span>
      </div>

      <div
        className={cn(
          "vuei-glass flex-1 overflow-hidden rounded-2xl border transition-[border-color,box-shadow,transform] duration-500 [transition-timing-function:var(--ease-out-soft)]",
          active ? "border-brand/25 shadow-[0_20px_56px_-28px_rgba(20,60,120,0.45)]" : "border-border/60 shadow-[0_2px_10px_-6px_rgba(20,60,120,0.15)]",
          highlight && "vuei-ring border-brand/40",
        )}
      >
        <button
          type="button"
          onClick={isStatic ? undefined : onOpen}
          className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", !isStatic && "cursor-pointer")}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-semibold text-foreground">{title}</span>
            <span className="block truncate text-[0.82rem] text-muted-foreground">{subtitle}</span>
          </span>
          {value ? (
            <span className={cn("flex shrink-0 items-center gap-1.5 text-[0.9rem] font-medium", isStatic ? "text-brand" : "text-foreground")}>
              {value}
              {valueIcon}
            </span>
          ) : null}
        </button>

        {active && !isStatic && children ? <div className="vuei-expand border-t border-border/50 px-4 py-4">{children}</div> : null}
      </div>
    </div>
  )
}
