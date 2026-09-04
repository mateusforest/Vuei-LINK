"use client"

import { ArrowRight, Calendar, Check, ExternalLink, Link2, Loader2, LogIn, MapPin, Minus, Plus, ShoppingBag, Users } from "lucide-react"
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
import {
  PENDING_TRIP_CLAIMS_CHANGED_EVENT,
  clearClaimedTripBagFocus,
  clearPendingTripCreateRequest,
  clearPendingTripClaimSession,
  getOrCreatePendingTripRequestToken,
  isPendingTripClaimSessionActive,
  readClaimedTripBagFocus,
  readPendingTripClaimSession,
  readPendingTripClaimSessions,
  selectPendingTripClaimSession,
  writePendingTripClaimSession,
  type PendingTripClaimSession,
} from "@/lib/pending-trip-claim"
import { claimPendingTrip, createPendingTripClaim } from "@/lib/repositories/pending-trip-claim-repository"
import { getTravelerVueiPlusStatus } from "@/lib/repositories/traveler-billing-repository"
import { resolveDestinationInput, type DestinationOption } from "@/lib/destinations/catalog"
import { cn } from "@/lib/utils"

type Step = "destination" | "dates" | "travelers"

type PendingTripSnapshot = {
  id: string
  slug: string
  title: string
  destination: string
  startDate: string | null
  endDate: string | null
  travelersCount: number
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
    title: session.title || "Rascunho de viagem",
    destination: session.destination || session.tripSlug.replace(/-/g, " "),
    startDate: session.startDate ?? null,
    endDate: session.endDate ?? null,
    travelersCount: session.travelersCount ?? null,
    url: session.shareLink,
    statusLabel: "Rascunho",
    lifecycle: "draft",
    isActivated: false,
    isPending: true,
  }
}

export function TripLanding() {
  const router = useRouter()
  const { user } = useAuth()
  const { trips, loadingTrips, syncTripFromBackend, setActiveTrip } = useTrips()
  const destinationStepRef = useRef<HTMLDivElement>(null)
  const datesStepRef = useRef<HTMLDivElement>(null)
  const travelersStepRef = useRef<HTMLDivElement>(null)
  const createButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingBagHydratedRef = useRef(false)
  const autoClaimTokenRef = useRef<string | null>(null)

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
  const [pendingSessions, setPendingSessions] = useState<PendingTripClaimSession[]>([])
  const [creationError, setCreationError] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  const [showBalloon, setShowBalloon] = useState(false)
  const [highlightTripId, setHighlightTripId] = useState<string | null>(null)
  const [bagPulseToken, setBagPulseToken] = useState(0)
  const [pendingNoticeDismissed, setPendingNoticeDismissed] = useState(false)
  const [loginChoiceOpen, setLoginChoiceOpen] = useState(false)
  const [canAccessArchive, setCanAccessArchive] = useState(false)

  useEffect(() => {
    if (!user) {
      setCanAccessArchive(false)
      return
    }

    let active = true
    const loadMembership = async () => {
      const result = await getTravelerVueiPlusStatus()
      if (active) setCanAccessArchive(Boolean(result.data?.canAccessArchivedTrips))
    }
    void loadMembership()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    const syncPendingBag = () => {
      const sessions = readPendingTripClaimSessions()
      const current = readPendingTripClaimSession()
      const activeSession = current && sessions.some((session) => session.tripId === current.tripId)
        ? current
        : sessions[0] ?? null

      setPendingSessions(sessions)
      setPendingSession(activeSession)

      if (activeSession && !pendingBagHydratedRef.current) {
        setCreatedTrip({
          id: activeSession.tripId,
          slug: activeSession.tripSlug,
          title: activeSession.title || "Rascunho de viagem",
          destination: activeSession.destination || activeSession.tripSlug.replace(/-/g, " "),
          startDate: activeSession.startDate ?? null,
          endDate: activeSession.endDate ?? null,
          travelersCount: activeSession.travelersCount ?? 1,
          publicLink: activeSession.shareLink,
        })
        setActive(null)
      }
      pendingBagHydratedRef.current = true
    }

    syncPendingBag()
    window.addEventListener(PENDING_TRIP_CLAIMS_CHANGED_EVENT, syncPendingBag)
    window.addEventListener("storage", syncPendingBag)
    return () => {
      window.removeEventListener(PENDING_TRIP_CLAIMS_CHANGED_EVENT, syncPendingBag)
      window.removeEventListener("storage", syncPendingBag)
    }
  }, [])

  useEffect(() => {
    if (!pendingSession) {
      autoClaimTokenRef.current = null
      return
    }
    setPendingNoticeDismissed(false)
  }, [pendingSession?.claimToken])

  useEffect(() => {
    if (!user || loadingTrips || !pendingSession || claiming) return
    if (autoClaimTokenRef.current === pendingSession.claimToken) return

    autoClaimTokenRef.current = pendingSession.claimToken
    void executePendingClaim()
  }, [claiming, loadingTrips, pendingSession?.claimToken, user?.id])

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

  function blurActiveElement() {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) {
      activeElement.blur()
    }
  }

  function scrollElementIntoView(element: HTMLElement | null, block: ScrollLogicalPosition = "nearest") {
    if (!element) return

    requestAnimationFrame(() => {
      element.scrollIntoView({
        behavior: "smooth",
        block,
        inline: "nearest",
      })
    })
  }

  function openStep(step: Step) {
    setPopupOpen(false)
    setActive(step)
    const target =
      step === "destination" ? destinationStepRef.current : step === "dates" ? datesStepRef.current : travelersStepRef.current
    scrollElementIntoView(target, "center")
  }

  function advanceToDates() {
    blurActiveElement()
    setActive("dates")
    scrollElementIntoView(datesStepRef.current, "center")
  }

  function advanceToTravelers() {
    blurActiveElement()
    setActive("travelers")
    scrollElementIntoView(travelersStepRef.current, "center")
  }

  function focusCreateCta() {
    blurActiveElement()
    setActive(null)
    requestAnimationFrame(() => {
      createButtonRef.current?.focus()
      scrollElementIntoView(createButtonRef.current, "center")
    })
  }

  const realTrips = useMemo(() => trips.map(mapLegacyTripToBagItem), [trips])
  const ownedCreatedTrip = useMemo(
    () => (createdTrip ? realTrips.some((trip) => trip.id === createdTrip.id) : false),
    [createdTrip, realTrips],
  )
  const bagTrips = useMemo(() => {
    const items = [...realTrips]
    for (const session of pendingSessions) {
      if (!items.some((trip) => trip.id === session.tripId)) {
        items.push(toPendingBagItem(session))
      }
    }
    return items.sort((left, right) => Number(right.isPending) - Number(left.isPending))
  }, [pendingSessions, realTrips])

  const hasPendingCreatedTrip = Boolean(createdTrip && pendingSession)
  const canCreate = destination.trim().length > 1 && Boolean(startDate)
  const glow = bagTrips.length > 0 && !hasPendingCreatedTrip

  useEffect(() => {
    if (!ownedCreatedTrip) return
    if (pendingSession?.tripId === createdTrip?.id) return

    setCreatedTrip(null)
  }, [createdTrip?.id, ownedCreatedTrip, pendingSession?.tripId])

  useEffect(() => {
    const focusedTripId = readClaimedTripBagFocus()
    if (!focusedTripId) return
    if (!bagTrips.some((trip) => trip.id === focusedTripId && !trip.isPending)) return

    clearClaimedTripBagFocus()
    setHighlightTripId(focusedTripId)
    setPopupOpen(true)
    setShowBalloon(true)
  }, [bagTrips])

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
    clearPendingTripCreateRequest()
  }

  function openTravelerSignup() {
    router.push(`/signup?redirect=${encodeURIComponent("/")}`)
  }

  function openTravelerLogin() {
    router.push(`/login?redirect=${encodeURIComponent("/")}`)
  }

  function openAgencyLogin() {
    router.push(`/login?redirect=${encodeURIComponent("/agencia")}`)
  }

  async function handleCreate() {
    if (!canCreate || creating) return

    setCreating(true)
    setCreationError(null)
    setClaimError(null)

    try {
      const resolvedDestination = resolveDestinationInput(destination, selectedDestination?.id ?? null)
      const requestFingerprint = JSON.stringify({
        destination: resolvedDestination.label,
        startDate,
        endDate,
        travelers,
      })
      const requestToken = getOrCreatePendingTripRequestToken(requestFingerprint)
      const result = await createPendingTripClaim({
        title: resolvedDestination.label,
        destination: resolvedDestination.label,
        startDate,
        endDate,
        travelersCount: travelers,
        requestToken,
      })

      if (!result.data) {
        if (result.code === "pending_request_claimed" || result.code === "pending_request_expired") {
          clearPendingTripCreateRequest(requestToken)
        }
        setCreationError(result.error ?? "Nao foi possivel criar a viagem agora.")
        return
      }

      const nextSession: PendingTripClaimSession = {
        tripId: result.data.trip.id,
        tripSlug: result.data.trip.slug,
        claimToken: result.data.claimToken,
        shareLink: result.data.trip.publicLink,
        createdAt: new Date().toISOString(),
        expiresAt: result.data.claimExpiresAt,
        title: result.data.trip.title,
        destination: result.data.trip.destination,
        startDate: result.data.trip.startDate,
        endDate: result.data.trip.endDate,
        travelersCount: result.data.trip.travelersCount,
      }

      writePendingTripClaimSession(nextSession)
      clearPendingTripCreateRequest(requestToken)
      setPendingSession(nextSession)
      setPendingSessions((current) => [nextSession, ...current.filter((session) => session.tripId !== nextSession.tripId)])
      setCreatedTrip({
        id: result.data.trip.id,
        slug: result.data.trip.slug,
        title: result.data.trip.title,
        destination: result.data.trip.destination,
        startDate: result.data.trip.startDate,
        endDate: result.data.trip.endDate,
        travelersCount: result.data.trip.travelersCount,
        publicLink: result.data.trip.publicLink,
      })
      setHighlightTripId(result.data.trip.id)
      setActive(null)
      setShowBalloon(true)
    } finally {
      setCreating(false)
    }
  }

  function handleOpenTrip(url?: string | null) {
    if (!url) return
    window.location.assign(buildSameOriginPath(url))
  }

  function handleBagTripOpen(trip: PublicBagTripItem) {
    setPopupOpen(false)
    if (trip.lifecycle === "ended") {
      if (!user) {
        openTravelerLogin()
        return
      }

      router.push(canAccessArchive ? `/portal/viagem/arquivo/${trip.id}` : "/portal/planos")
      return
    }

    if (trip.isActivated) {
      handleOpenTrip(trip.url)
      return
    }

    if (trip.isPending) {
      const session = selectPendingTripClaimSession(trip.id)
      if (!session || !isPendingTripClaimSessionActive(session)) {
        clearPendingTripClaimSession(trip.id)
        setCreationError("O acesso temporario deste rascunho expirou.")
        return
      }

      setPendingSession(session)
      handleOpenTrip(session.shareLink)
      return
    }

    if (user) {
      setActiveTrip(trip.id)
      router.push("/portal")
      return
    }

    openTravelerSignup()
  }

  function handleOpenPendingDraft() {
    if (!pendingSession) return
    handleBagTripOpen(toPendingBagItem(pendingSession))
  }

  async function executePendingClaim() {
    if (!pendingSession || claiming || !user) return
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
        clearPendingTripClaimSession(pendingSession.tripId)
        setPendingSessions((current) => current.filter((session) => session.tripId !== pendingSession.tripId))
        setPendingSession(null)
        setCreatedTrip(null)
        setHighlightTripId(trip.id)
        setPopupOpen(true)
        setShowBalloon(true)
        return
      }

      if (isDefinitiveError) {
        clearPendingTripClaimSession(pendingSession.tripId)
        setPendingSessions((current) => current.filter((session) => session.tripId !== pendingSession.tripId))
        setPendingSession(null)
      }

      setClaimError(result.error ?? "Nao foi possivel guardar a viagem na Bolsa agora.")
    } finally {
      setClaiming(false)
    }
  }

  function handleCreateMyBag() {
    setBagPulseToken((current) => current + 1)
    openTravelerSignup()
  }

  function handleIAlreadyHaveBag() {
    setBagPulseToken((current) => current + 1)
    openTravelerLogin()
  }

  function openStart() {
    setPopupOpen(false)
    setActive("destination")
    requestAnimationFrame(() => {
      scrollElementIntoView(destinationStepRef.current, "center")
      inputRef.current?.focus()
    })
  }

  const bagInteractionBlocked = popupOpen

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
            onClick={() => setLoginChoiceOpen(true)}
            className="vuei-glass h-10 rounded-full border border-border/60 px-5 text-[0.9rem] text-foreground shadow-sm"
          >
            Entrar
          </Button>
          <Button
            size="lg"
            onClick={openStart}
            className="h-10 rounded-full bg-foreground px-5 text-[0.9rem] text-background shadow-[0_8px_30px_-8px_var(--brand)] ring-1 ring-inset ring-white/10 hover:bg-foreground/90"
          >
            Começar agora
          </Button>
        </nav>
      </header>

      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 items-start px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 md:items-center md:px-10 md:pb-8",
          hasPendingCreatedTrip ? "overflow-hidden" : "overflow-y-auto overscroll-contain md:overflow-hidden",
        )}
      >
        <div className={cn("w-full max-w-xl py-3 md:py-0", hasPendingCreatedTrip && "flex min-h-0 flex-1 flex-col justify-center")}>
          <h1 className="text-balance text-[2.45rem] font-semibold leading-[1.05] tracking-tight text-foreground md:text-[3.25rem]">
            Sua viagem começa <span className="text-brand-gradient">aqui.</span>
          </h1>
          <p className="mt-3 text-pretty text-lg text-muted-foreground">Um único link para organizar tudo.</p>

          <div
            className={cn(
              "mt-8 flex flex-col gap-2.5 transition-[opacity,transform,max-height] duration-500 [transition-timing-function:var(--ease-out-soft)]",
              hasPendingCreatedTrip && "max-h-0 -translate-y-3 overflow-hidden opacity-0 pointer-events-none",
            )}
          >
            <StepRow
              rowRef={destinationStepRef}
              index={1}
              done={destination.trim().length > 1}
              active={active === "destination"}
              onOpen={() => openStep("destination")}
              icon={<MapPin className="size-[1.15rem] text-brand" />}
              title="Para onde você vai?"
              subtitle="Digite o destino da sua próxima viagem."
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
                onSelect={(nextDestination) => {
                  setSelectedDestination(nextDestination)
                  advanceToDates()
                }}
                onSubmitValue={() => advanceToDates()}
                placeholder="Ex.: Lisboa, Aruba, Rio de Janeiro..."
              />
            </StepRow>

            <StepRow
              rowRef={datesStepRef}
              index={2}
              done={Boolean(startDate)}
              active={active === "dates"}
              onOpen={() => openStep("dates")}
              icon={<Calendar className="size-[1.15rem] text-emerald-600" />}
              title="Quando será?"
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
                onComplete={advanceToTravelers}
              />
            </StepRow>

            <StepRow
              rowRef={travelersStepRef}
              index={3}
              done
              active={active === "travelers"}
              onOpen={() => openStep("travelers")}
              icon={<Users className="size-[1.15rem] text-indigo-500" />}
              title="Quem vai com você?"
              subtitle="Adicione os participantes da viagem."
              value={`${travelers} ${travelers === 1 ? "pessoa" : "pessoas"}`}
              valueIcon={<Users className="size-4" />}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1">
                  <button
                    type="button"
                    aria-label="Menos viajantes"
                    onClick={() => {
                      setTravelers((current) => Math.max(1, current - 1))
                      focusCreateCta()
                    }}
                    className="grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    disabled={travelers <= 1}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-base font-semibold tabular-nums">{travelers}</span>
                  <button
                    type="button"
                    aria-label="Mais viajantes"
                    onClick={() => {
                      setTravelers((current) => Math.min(20, current + 1))
                      focusCreateCta()
                    }}
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
                      onClick={() => {
                        setTravelers(option.id)
                        focusCreateCta()
                      }}
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

          </div>

          {createdTrip && !ownedCreatedTrip && !pendingNoticeDismissed ? (
            <div className="mt-6 flex min-h-0 flex-col justify-center">
              <div className="vuei-celebrate overflow-hidden rounded-[2rem] border border-border/60 bg-background/78 p-4 shadow-[0_22px_60px_-28px_rgba(20,60,120,0.42)] backdrop-blur-xl sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/12">
                    <Link2 className="size-5 text-brand" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold leading-tight text-foreground sm:text-[1.15rem]">Seu rascunho está pronto.</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-[0.72rem] font-medium text-amber-700">
                        <Check className="size-3.5" />
                        Privado
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Ela já está salva na Bolsa deste navegador. Abra para revisar e entre quando quiser ativar o link.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2.5">
                  {pendingSession ? (
                    user ? (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => void executePendingClaim()}
                        disabled={claiming || loadingTrips}
                        className="h-11 w-full rounded-2xl border-border/70 bg-background/88 px-4 text-[0.9rem] text-foreground shadow-[0_10px_28px_-18px_rgba(20,60,120,0.28)] sm:w-auto sm:self-start"
                      >
                        {claiming || loadingTrips ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
                        {claiming || loadingTrips ? "Adicionando à sua Bolsa..." : "Vincular à minha Bolsa"}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          size="lg"
                          onClick={handleOpenPendingDraft}
                          className="h-11 rounded-2xl bg-foreground px-5 text-[0.9rem] text-background"
                        >
                          <ExternalLink className="size-4" />
                          Continuar rascunho
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={handleCreateMyBag}
                          className="h-11 rounded-2xl border-border/70 bg-background/88 px-4 text-[0.9rem] text-foreground"
                        >
                          Criar conta para ativar
                        </Button>
                      </div>
                    )
                  ) : (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setPopupOpen(true)}
                      className="h-11 w-full rounded-2xl border-border/70 bg-background/88 px-4 text-[0.9rem] text-foreground shadow-[0_10px_28px_-18px_rgba(20,60,120,0.28)] sm:w-auto sm:self-start"
                    >
                      <ShoppingBag className="size-4" />
                      Ver na Bolsa
                    </Button>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.82rem] text-muted-foreground">
                    {!user && pendingSession ? (
                      <button
                        type="button"
                        onClick={handleIAlreadyHaveBag}
                        className="inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        <LogIn className="size-3.5" />
                        Já tenho uma Bolsa
                      </button>
                    ) : null}
                    {pendingSession ? (
                      <button
                        type="button"
                        onClick={() => setPendingNoticeDismissed(true)}
                        className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        Agora não
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      Criar outra
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!createdTrip || ownedCreatedTrip || pendingNoticeDismissed ? (
            <div className="mt-7">
              <Button
                ref={createButtonRef}
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
            </div>
          ) : null}

          {creationError ? <p className="mt-3 max-w-md text-sm text-red-600">{creationError}</p> : null}
          {claimError ? <p className="mt-3 max-w-md text-sm text-red-600">{claimError}</p> : null}
        </div>
      </div>

      <TripBag
        count={bagTrips.length}
        disabled={bagInteractionBlocked}
        glow={glow}
        pulseToken={bagPulseToken}
        showBalloon={showBalloon}
        onDismissBalloon={() => setShowBalloon(false)}
        onOpen={() => setPopupOpen(true)}
      />

      <TripsPopup
        open={popupOpen}
        loading={Boolean(user) && loadingTrips}
        trips={bagTrips}
        highlightTripId={highlightTripId}
        canAccessArchive={canAccessArchive}
        emptyStateMode={!user && bagTrips.length === 0 ? "guest-bag" : "default"}
        onClose={() => setPopupOpen(false)}
        onNewTrip={() => {
          setPopupOpen(false)
          openStart()
        }}
        onOpenTrip={handleBagTripOpen}
        onEmptyPrimaryAction={openStart}
        onEmptySecondaryAction={handleIAlreadyHaveBag}
      />

      <LoginChoiceDialog
        open={loginChoiceOpen}
        onClose={() => setLoginChoiceOpen(false)}
        onChooseTraveler={() => {
          setLoginChoiceOpen(false)
          openTravelerLogin()
        }}
        onChooseAgency={() => {
          setLoginChoiceOpen(false)
          openAgencyLogin()
        }}
      />
    </main>
  )
}

function LoginChoiceDialog({
  open,
  onClose,
  onChooseTraveler,
  onChooseAgency,
}: {
  open: boolean
  onClose: () => void
  onChooseTraveler: () => void
  onChooseAgency: () => void
}) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Como você usa o Vuei?"
        className="relative w-full max-w-md rounded-[2rem] border border-border/70 bg-background/95 p-6 shadow-[0_24px_80px_-24px_rgba(20,60,120,0.45)]"
      >
        <div className="mb-5">
          <p className="text-xl font-semibold tracking-tight text-foreground">Como você usa o Vuei?</p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onChooseTraveler}
            className="rounded-[1.5rem] border border-border/60 bg-background/80 p-4 text-left transition-colors hover:border-brand/30 hover:bg-brand/5"
          >
            <span className="block text-base font-semibold text-foreground">Minha Bolsa</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Acesse suas viagens pessoais.</span>
          </button>

          <button
            type="button"
            onClick={onChooseAgency}
            className="rounded-[1.5rem] border border-border/60 bg-background/80 p-4 text-left transition-colors hover:border-brand/30 hover:bg-brand/5"
          >
            <span className="block text-base font-semibold text-foreground">Portal da Agência</span>
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">Gerencie clientes e viagens.</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function StepRow({
  rowRef,
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
  rowRef?: React.RefObject<HTMLDivElement | null>
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
    <div ref={rowRef} className="flex scroll-mt-6 items-start gap-3">
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
