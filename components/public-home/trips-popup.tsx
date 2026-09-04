"use client"

import { Check, Copy, ExternalLink, Loader2, Plus, ShoppingBag, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { Trip as LegacyTrip } from "@/contexts/trips-context"
import { VueiSymbol } from "@/components/public-home/vuei-mark"
import { formatRange } from "@/components/public-home/date-range-picker"
import { cn } from "@/lib/utils"
import {
  resolveTripLinkLifecycle,
  type TripLinkLifecycleStatus,
} from "@/lib/security/trip-link-lifecycle"

export interface PublicBagTripItem {
  id: string
  title: string
  destination: string
  startDate: string | null
  endDate: string | null
  travelersCount: number | null
  url: string
  statusLabel: string
  lifecycle: TripLinkLifecycleStatus
  isActivated: boolean
  isPending?: boolean
}

export function mapLegacyTripToBagItem(trip: LegacyTrip): PublicBagTripItem {
  const lifecycle = resolveTripLinkLifecycle({
    ownerType: "traveler",
    visibility: trip.visibility,
    status: trip.status,
    endDate: trip.endDate,
    linkActivatedAt: trip.linkActivatedAt,
    linkAccessUntil: trip.linkAccessUntil,
  })
  const isActivated = trip.visibility === "public" && (lifecycle === "active" || lifecycle === "post_trip")
  const statusLabel = lifecycle === "active"
    ? "Ativa"
    : lifecycle === "post_trip"
      ? "Pós-viagem"
      : lifecycle === "ended"
        ? "Encerrada"
        : "Rascunho"

  return {
    id: trip.id,
    title: trip.name,
    destination: trip.destination,
    startDate: trip.startDate || null,
    endDate: trip.endDate || null,
    travelersCount: trip.passengersCount,
    url: trip.shareLink,
    statusLabel,
    lifecycle,
    isActivated,
    isPending: false,
  }
}

export function TripsPopup({
  open,
  loading,
  trips,
  highlightTripId,
  walletBalanceLabel,
  canAccessArchive = false,
  emptyStateMode = "default",
  onClose,
  onNewTrip,
  onOpenTrip,
  onOpenWalletAction,
  onEmptyPrimaryAction,
  onEmptySecondaryAction,
}: {
  open: boolean
  loading?: boolean
  trips: PublicBagTripItem[]
  highlightTripId?: string | null
  walletBalanceLabel?: string | null
  canAccessArchive?: boolean
  emptyStateMode?: "default" | "guest-bag"
  onClose: () => void
  onNewTrip: () => void
  onOpenTrip: (trip: PublicBagTripItem) => void
  onOpenWalletAction?: () => void
  onEmptyPrimaryAction?: () => void
  onEmptySecondaryAction?: () => void
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
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <div className="vuei-scrim absolute inset-0 bg-foreground/15 backdrop-blur-[4px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sua bolsa Vuei"
        className="vuei-drawer relative flex h-[92dvh] w-full flex-col overflow-hidden border border-border/60 bg-popover shadow-[0_0_120px_-20px_rgba(20,60,120,0.55)] max-sm:max-w-none max-sm:rounded-t-[2rem] max-sm:border-b-0 sm:h-full sm:max-w-[396px] sm:rounded-none sm:border-b sm:border-r-0 sm:border-t-0"
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-2xl bg-brand/10">
              <VueiSymbol className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[1rem] font-semibold leading-tight tracking-tight">Sua bolsa Vuei</p>
              <p className="text-[0.8rem] leading-tight text-muted-foreground">
                {loading
                  ? "Carregando viagens..."
                  : trips.length === 0
                    ? "Nenhuma viagem guardada"
                    : `${trips.length} ${trips.length === 1 ? "viagem guardada" : "viagens guardadas"}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-[1.05rem]" />
          </button>
        </div>

        {(emptyStateMode !== "guest-bag" || trips.length > 0) && walletBalanceLabel != null && onOpenWalletAction ? (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-border/55 bg-background/55 p-3 shadow-[0_8px_24px_-20px_rgba(20,60,120,0.3)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Viagens disponíveis</p>
                  <p className="mt-0.5 text-lg font-semibold text-foreground">
                    {walletBalanceLabel ?? "0"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onOpenWalletAction}
                  className="h-9 rounded-xl border-border/60 bg-background/70 px-3 text-[0.82rem] text-foreground"
                >
                  Comprar viagens
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="max-w-[16rem] text-pretty text-sm leading-relaxed text-muted-foreground">
                Carregando suas viagens reais...
              </p>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted">
                <ShoppingBag className="size-6 text-muted-foreground" />
              </span>
              {emptyStateMode === "guest-bag" ? (
                <>
                  <p className="text-lg font-semibold tracking-tight text-foreground">Sua Bolsa Vuei</p>
                  <p className="max-w-[18rem] text-pretty text-sm leading-relaxed text-muted-foreground">
                    Guarde suas viagens, acesse de qualquer dispositivo e mantenha tudo em um só lugar.
                  </p>
                </>
              ) : (
                <p className="max-w-[16rem] text-pretty text-sm leading-relaxed text-muted-foreground">
                  Crie sua primeira viagem para guardá-la aqui.
                </p>
              )}
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {trips.map((trip, index) => (
                <li key={trip.id} className="vuei-rise" style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}>
                  <TripCard
                    trip={trip}
                    highlighted={highlightTripId === trip.id}
                    onOpen={onOpenTrip}
                    canAccessArchive={canAccessArchive}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/50 p-4">
          {emptyStateMode === "guest-bag" && trips.length === 0 ? (
            <div className="flex flex-col gap-2.5">
              <Button
                size="lg"
                onClick={onEmptyPrimaryAction}
                className="h-11 w-full rounded-2xl bg-foreground text-[0.9rem] text-background shadow-[0_14px_40px_-16px_var(--brand)] transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)] hover:bg-foreground/90 active:scale-[0.98]"
              >
                Criar uma viagem
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onEmptySecondaryAction}
                className="h-11 w-full rounded-2xl border-border/70 bg-background/88 text-[0.9rem] shadow-[0_10px_28px_-18px_rgba(20,60,120,0.28)]"
              >
                Já tenho uma Bolsa
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={onNewTrip}
              className="h-11 w-full rounded-2xl bg-foreground text-[0.9rem] text-background shadow-[0_14px_40px_-16px_var(--brand)] transition-transform duration-300 [transition-timing-function:var(--ease-out-soft)] hover:bg-foreground/90 active:scale-[0.98]"
            >
              <Plus className="size-4" />
              Nova viagem
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function TripCard({
  trip,
  highlighted,
  onOpen,
  canAccessArchive,
}: {
  trip: PublicBagTripItem
  highlighted?: boolean
  onOpen: (trip: PublicBagTripItem) => void
  canAccessArchive: boolean
}) {
  const [copied, setCopied] = useState(false)
  const range = formatRange(trip.startDate, trip.endDate)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(trip.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Mantem fallback silencioso.
    }
  }

  return (
    <div
      className={cn(
        "group rounded-[1.25rem] border border-border/55 bg-background/58 p-4 shadow-[0_8px_28px_-24px_rgba(20,60,120,0.34)] transition-[border-color,box-shadow] duration-300 [transition-timing-function:var(--ease-out-soft)] hover:border-border hover:shadow-[0_14px_38px_-24px_rgba(20,60,120,0.42)]",
        highlighted && "border-brand/40 shadow-[0_18px_44px_-20px_rgba(20,60,120,0.42)]",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-[1.04rem] font-semibold tracking-tight text-foreground">{trip.destination}</span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-medium",
                trip.lifecycle === "active"
                  ? "bg-emerald-500/12 text-emerald-700"
                  : trip.lifecycle === "post_trip"
                    ? "bg-sky-500/12 text-sky-700"
                    : trip.lifecycle === "ended"
                      ? "bg-slate-500/12 text-slate-600"
                      : "bg-amber-500/12 text-amber-700",
              )}
            >
              <span className={cn(
                "size-1.5 rounded-full",
                trip.lifecycle === "active"
                  ? "bg-emerald-500"
                  : trip.lifecycle === "post_trip"
                    ? "bg-sky-500"
                    : trip.lifecycle === "ended"
                      ? "bg-slate-500"
                      : "bg-amber-500",
              )} />
              {trip.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[0.8rem] text-muted-foreground">
            {range ? range : "Datas a definir"} · {trip.travelersCount ?? 1} {(trip.travelersCount ?? 1) === 1 ? "pessoa" : "pessoas"}
          </p>
          <p className="mt-1.5 text-[0.75rem] leading-5 text-muted-foreground">
            {trip.isActivated
              ? trip.lifecycle === "post_trip" ? "Link ativo no período pós-viagem" : "Link ativo e pronto para compartilhar"
              : trip.lifecycle === "ended"
                ? "Link público encerrado"
              : trip.isPending
                ? "Rascunho privado · entre para vincular e ativar"
                : "Rascunho privado na sua Bolsa"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 border-t border-border/45 pt-2.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpen(trip)}
            className="h-8 rounded-xl px-2.5 text-[0.78rem] font-medium text-foreground/78 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            {trip.isActivated
              ? "Abrir"
              : trip.lifecycle === "ended"
                ? canAccessArchive ? "Abrir arquivo" : "Conhecer Vuei+"
                : trip.isPending
                  ? "Ativar viagem"
                  : "Ativar viagem"}
          </Button>
          {trip.isActivated ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="h-8 rounded-xl px-2.5 text-[0.78rem] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
