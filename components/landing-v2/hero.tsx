"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { ArrowRight, MapPin, Sparkles } from "lucide-react"
import { LinkCeremony } from "@/components/landing-v2/link-ceremony"
import { PrepareTrip } from "@/components/landing-v2/prepare-trip"
import { useAuth } from "@/contexts/auth-context"
import { writePendingTripClaimSession } from "@/lib/pending-trip-claim"
import { createPendingTripClaim } from "@/lib/repositories/pending-trip-claim-repository"
import { createTrip } from "@/lib/repositories/trips-repository"

type HeroProps = {
  destination: string
  startDate: string
  endDate: string
  submitted: boolean
  ceremony: boolean
  onDestinationChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onCeremonyChange: (value: boolean) => void
  onOpenPreparation: (destination?: string) => void
}

export function Hero({
  destination,
  startDate,
  endDate,
  submitted,
  ceremony,
  onDestinationChange,
  onStartDateChange,
  onEndDateChange,
  onCeremonyChange,
  onOpenPreparation,
}: HeroProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [createdTripUrl, setCreatedTripUrl] = useState<string | null>(null)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [isCreatingTrip, setIsCreatingTrip] = useState(false)

  function buildSameOriginTripPath(url: string) {
    try {
      const parsed = new URL(url)
      return `${parsed.pathname}${parsed.search}${parsed.hash}`
    } catch {
      return url
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!destination.trim()) return
    onOpenPreparation(destination)
  }

  async function handleContinue(nextStartDate: string, nextEndDate: string) {
    if (!destination.trim()) return

    onStartDateChange(nextStartDate)
    onEndDateChange(nextEndDate)
    setCreatedTripUrl(null)
    setCreationError(null)
    setIsCreatingTrip(true)
    onCeremonyChange(true)

    if (user) {
      const result = await createTrip({
        title: destination.trim(),
        destination: destination.trim(),
        startDate: nextStartDate || undefined,
        endDate: nextEndDate || undefined,
        ownerType: "traveler",
        ownerUserId: user.id,
        status: "draft",
        visibility: "public",
        creditsSummary: { balance: null, used: null, total: null },
      })

      setIsCreatingTrip(false)

      if (result.data?.publicLink) {
        setCreatedTripUrl(result.data.publicLink)
        return
      }

      setCreationError(result.error ?? "Não foi possível criar a viagem agora.")
      return
    }

    const pendingResult = await createPendingTripClaim({
      title: destination.trim(),
      destination: destination.trim(),
      startDate: nextStartDate || undefined,
      endDate: nextEndDate || undefined,
    })

    setIsCreatingTrip(false)

    if (pendingResult.data) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      writePendingTripClaimSession({
        tripId: pendingResult.data.trip.id,
        tripSlug: pendingResult.data.trip.slug,
        claimToken: pendingResult.data.claimToken,
        shareLink: pendingResult.data.trip.publicLink,
        createdAt: new Date().toISOString(),
        expiresAt,
      })
      setCreatedTripUrl(pendingResult.data.trip.publicLink)
      return
    }

    setCreationError(pendingResult.error ?? "Não foi possível criar a viagem agora.")
  }

  function handleOpenTrip() {
    if (!createdTripUrl) return
    window.location.assign(buildSameOriginTripPath(createdTripUrl))
  }

  async function handleCopyLink() {
    if (!createdTripUrl || typeof navigator === "undefined" || !navigator.clipboard) return
    await navigator.clipboard.writeText(createdTripUrl)
  }

  function handleProtectTrip() {
    router.push(`/signup?redirect=${encodeURIComponent("/portal")}`)
  }

  function handleContinueWithoutAccount() {
    if (!createdTripUrl) return
    window.location.assign(buildSameOriginTripPath(createdTripUrl))
  }

  return (
    <>
      <section className="relative w-full bg-[radial-gradient(130%_90%_at_50%_-10%,#ffffff_0%,#faf8f4_60%)]">
        <div className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-6xl flex-col items-center gap-16 px-6 py-16 lg:flex-row lg:gap-12 lg:py-8">
          <div className="flex w-full flex-col lg:w-[46%]">
            <h1 className="text-balance text-5xl font-bold leading-[1.03] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Sua viagem começa aqui.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground sm:text-xl">Crie seu link em segundos.</p>

            <form
              onSubmit={handleSubmit}
              className="mt-10 flex items-center gap-2 rounded-full bg-card p-2 pl-5 shadow-[0_30px_70px_-30px_rgba(16,26,44,0.28)] ring-1 ring-border/60"
            >
              <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <label htmlFor="hero-destination" className="sr-only">
                Para onde você vai?
              </label>
              <input
                id="hero-destination"
                type="text"
                value={destination}
                onChange={(event) => onDestinationChange(event.target.value)}
                placeholder="Para onde você vai?"
                className="w-full bg-transparent py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Criar link da viagem"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-10 flex items-center gap-3">
              <div className="flex -space-x-3">
                {[1, 2, 3].map((avatar) => (
                  <Image
                    key={avatar}
                    src={`/landing-v2/avatar-${avatar}.png`}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                +12 mil pessoas já organizam
                <br />
                suas viagens com o Vuei
              </p>
            </div>
          </div>

          <div className="flex w-full justify-center lg:w-[54%]">
            <div className="relative w-[310px]">
              <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
              <div className="relative w-full rounded-[2.9rem] bg-[#0e1420] p-2.5 shadow-[0_60px_120px_-40px_rgba(16,26,44,0.55),0_20px_50px_-30px_rgba(16,26,44,0.4)]">
                <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2.4rem] bg-[#0e1420]">
                  <video
                    className="absolute left-0 z-0 w-full object-cover object-top"
                    style={{ top: "-6%", height: "108%" }}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-label="Demonstração do aplicativo Vuei"
                  >
                    <source src="/videos/vuei-demo.mp4" type="video/mp4" />
                  </video>

                  <div className="absolute left-1/2 top-2.5 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0e1420]" />

                  <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
                    <div
                      className="absolute -inset-y-4 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      style={{ animation: "vuei-sheen 7s ease-in-out 2s infinite" }}
                    />
                  </div>

                  <div
                    className="absolute left-3 right-3 top-11 z-20 flex items-center gap-2.5 rounded-2xl bg-white/95 px-3 py-2.5 shadow-[0_12px_30px_-12px_rgba(16,26,44,0.45)] ring-1 ring-border/40 backdrop-blur"
                    style={{ animation: "vuei-notify 8s ease-in-out 1.2s infinite" }}
                    aria-hidden="true"
                  >
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#16a34a]/12 text-[#16a34a]">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold leading-tight text-foreground">Roteiro atualizado</p>
                      <p className="truncate text-[10px] leading-tight text-muted-foreground">
                        Tudo sincronizado no seu link
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PrepareTrip
        destination={destination}
        startDate={startDate}
        endDate={endDate}
        visible={submitted}
        onDestinationChange={onDestinationChange}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        onContinue={handleContinue}
      />

      <LinkCeremony
        visible={ceremony}
        tripUrl={createdTripUrl}
        error={creationError}
        isLoading={isCreatingTrip}
        needsClaim={!user}
        onClose={() => onCeremonyChange(false)}
        onOpenTrip={handleOpenTrip}
        onCopyLink={handleCopyLink}
        onProtectTrip={handleProtectTrip}
        onContinueWithoutAccount={handleContinueWithoutAccount}
      />
    </>
  )
}
