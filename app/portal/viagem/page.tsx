"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { 
  Plus, 
  MapPin, 
  Calendar, 
  Users, 
  ChevronRight,
  Copy,
  Share2,
  ExternalLink,
  MoreHorizontal,
  Trash2,
  Shield,
  Link2,
  Check,
  Plane,
  Clock,
  Archive,
  LockKeyhole,
  Crown,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTrips, type Trip } from "@/contexts/trips-context"
import { activateTravelerTrip } from "@/lib/repositories/trips-repository"
import {
  getTripLinkAccessDaysRemaining,
  resolveTripLinkLifecycle,
  type TripLinkLifecycleStatus,
} from "@/lib/security/trip-link-lifecycle"
import { formatTripLinkPreview, getTripPublicLinkCopyHint } from "@/lib/trips/trip-link-display"
import { resolveTripHeroImage } from "@/lib/trip-destination"
import { ImageWithFallback } from "@/components/system/image-with-fallback"
import { CreateTripButton } from "@/components/portal/create-trip-button"
import { getTravelerVueiPlusStatus } from "@/lib/repositories/traveler-billing-repository"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

function Toast({ message, visible, tone = "success" }: { message: string; visible: boolean; tone?: "success" | "error" }) {
  if (!visible) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm flex items-center gap-2 ${
        tone === "error"
          ? "bg-red-500/20 border border-red-500/30 text-red-300"
          : "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
      }`}
    >
      <Check size={16} />
      {message}
    </motion.div>
  )
}

export default function ViagemListPage() {
  const router = useRouter()
  const { trips, deleteTrip, setActiveTrip, updateTrip } = useTrips()
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null)
  const [filter, setFilter] = useState<"all" | TripLinkLifecycleStatus>("all")
  const [activatingTripId, setActivatingTripId] = useState<string | null>(null)
  const [canAccessArchive, setCanAccessArchive] = useState(false)
  const [archiveAccessLoaded, setArchiveAccessLoaded] = useState(false)

  useEffect(() => {
    let active = true
    const loadMembership = async () => {
      const result = await getTravelerVueiPlusStatus()
      if (!active) return
      setCanAccessArchive(Boolean(result.data?.canAccessArchivedTrips))
      setArchiveAccessLoaded(true)
    }
    void loadMembership()
    return () => { active = false }
  }, [])

  const copyLink = async (link: string, type: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable")
      }

      await navigator.clipboard.writeText(link)
      setCopiedLink(type)
      window.setTimeout(() => setCopiedLink(null), 2000)
      return true
    } catch (error) {
      console.error("[TRIP] copy link error", error)
      setFeedback({ message: "Não foi possível copiar o link.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 2500)
      return false
    }
  }

  const handleDeleteTrip = async (tripId: string) => {
    const result = await deleteTrip(tripId)
    if (!result.success) {
      setFeedback({ message: result.error || "Não foi possível excluir a viagem.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 2500)
      return
    }

    setFeedback({ message: "Viagem excluida.", tone: "success" })
    window.setTimeout(() => setFeedback(null), 2500)
  }

  const activateForPublicAccess = async (tripId: string) => {
    if (activatingTripId !== null) return

    setActivatingTripId(tripId)
    setFeedback(null)

    try {
      const result = await activateTravelerTrip(tripId)
      if (!result.data) {
        if (result.code === "wallet_insufficient_balance") {
          router.push(`/portal/viagens/comprar?reason=insufficient_balance&trip_id=${encodeURIComponent(tripId)}`)
          return
        }
        console.error("[TRIP] explicit link activation error", result.error)
        setFeedback({ message: result.error || "Não foi possível ativar o link da viagem.", tone: "error" })
        window.setTimeout(() => setFeedback(null), 3500)
        return
      }

      updateTrip(tripId, {
        visibility: "public",
        linkActivatedAt: result.data.linkActivatedAt,
        linkAccessUntil: result.data.linkAccessUntil,
        linkActivationTransactionId: result.data.transactionId,
      })
      setFeedback({ message: "Link da viagem ativado.", tone: "success" })
      window.setTimeout(() => setFeedback(null), 2500)
    } catch (error) {
      console.error("[TRIP] explicit link activation error", error)
      setFeedback({ message: "Não foi possível ativar o link da viagem.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 3500)
    } finally {
      setActivatingTripId(null)
    }
  }

  const getTripLinkLifecycle = (trip: Trip) => {
    return resolveTripLinkLifecycle({
      ownerType: "traveler",
      visibility: trip.visibility,
      status: trip.status,
      endDate: trip.endDate,
      linkActivatedAt: trip.linkActivatedAt,
      linkAccessUntil: trip.linkAccessUntil,
    })
  }

  const isTripLinkActive = (trip: Trip) => {
    const lifecycle = getTripLinkLifecycle(trip)
    return trip.visibility === "public" && (lifecycle === "active" || lifecycle === "post_trip")
  }

  const getLinkPreview = (trip: Trip) => formatTripLinkPreview(trip.shareLink, { maxSlugLength: 22 })

  const getShareHint = (trip: Trip) => {
    const lifecycle = getTripLinkLifecycle(trip)
    return getTripPublicLinkCopyHint(lifecycle)
  }

  const getLifecycleLabel = (lifecycle: TripLinkLifecycleStatus) => {
    switch (lifecycle) {
      case "active": return "Ativa"
      case "post_trip": return "Pós-viagem"
      case "ended": return "Encerrada"
      default: return "Rascunho"
    }
  }

  const getLifecycleColor = (lifecycle: TripLinkLifecycleStatus) => {
    switch (lifecycle) {
      case "active": return "bg-emerald-500/20 text-emerald-400"
      case "post_trip": return "bg-sky-500/20 text-sky-400"
      case "ended": return "bg-slate-500/20 text-slate-400"
      default: return "bg-amber-500/20 text-amber-500"
    }
  }

  const getLifecycleDetail = (trip: Trip) => {
    const lifecycle = getTripLinkLifecycle(trip)
    if (lifecycle === "active" && trip.linkAccessUntil) {
      return `Ativa até ${new Date(trip.linkAccessUntil).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })}`
    }
    if (lifecycle === "post_trip") {
      const days = getTripLinkAccessDaysRemaining(trip.linkAccessUntil)
      return days <= 1 ? "Acesso encerra hoje" : `Acesso encerra em ${days} dias`
    }
    if (lifecycle === "ended") return "Acesso público encerrado"
    return "Ative para publicar"
  }

  const openShareLink = (trip: Trip) => {
    if (!isTripLinkActive(trip)) return
    router.push(trip.shareLink.replace(/^https?:\/\/[^/]+/, ""))
  }

  const shareTripLink = (trip: Trip, copyType: string) => {
    if (!isTripLinkActive(trip)) return

    if (typeof navigator.share === "function") {
      void navigator.share({ title: trip.name, url: trip.shareLink }).catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        console.error("[TRIP] share link error", error)
        setFeedback({ message: "Não foi possível compartilhar o link.", tone: "error" })
        window.setTimeout(() => setFeedback(null), 2500)
      })
      return
    }

    void copyLink(trip.shareLink, copyType)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  }

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const archivedTrips = trips.filter((trip) => getTripLinkLifecycle(trip) === "ended")
  const filteredTrips = trips.filter(trip => {
    if (getTripLinkLifecycle(trip) === "ended") return false
    if (filter === "all") return true
    return getTripLinkLifecycle(trip) === filter
  })

  const getFilterLabel = (value: typeof filter) => {
    switch (value) {
      case "draft": return "Rascunho"
      case "active": return "Ativa"
      case "post_trip": return "Pós-viagem"
      case "ended": return "Encerrada"
      default: return "Todas"
    }
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="mx-auto max-w-5xl space-y-5"
    >
      <motion.div variants={fadeInUp} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Minhas Viagens</h1>
          <p className="text-muted-foreground text-sm">{trips.length} {trips.length === 1 ? "viagem" : "viagens"} criadas</p>
        </div>
        <CreateTripButton 
          className="h-10 rounded-xl border-0 bg-gradient-to-r from-[#37beff] to-[#0b56d8] px-4 text-white shadow-[0_12px_28px_-16px_rgba(11,86,216,0.65)]"
        >
          <Plus size={18} className="mr-2" />
          Nova Viagem
        </CreateTripButton>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: "all", label: "Todas" },
          { value: "draft", label: "Rascunho" },
          { value: "active", label: "Ativa" },
          { value: "post_trip", label: "Pós-viagem" },
          { value: "ended", label: "Encerrada" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            className={filter === f.value ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0" : "border-border/50"}
            onClick={() => setFilter(f.value as typeof filter)}
          >
            {f.label}
          </Button>
        ))}
      </motion.div>

      {filteredTrips.length > 0 ? (
        <motion.div variants={fadeInUp} className="space-y-3">
          {filteredTrips.map((trip) => {
            const lifecycle = getTripLinkLifecycle(trip)
            const linkActive = isTripLinkActive(trip)
            const canRequestActivation = lifecycle !== "ended" && !linkActive
            return (
            <Card 
              key={trip.id}
              className="overflow-hidden rounded-[1.4rem] border-border/55 bg-card/70 shadow-[0_14px_42px_-32px_rgba(15,23,42,0.45)] transition-all hover:border-primary/25 hover:shadow-[0_18px_46px_-30px_rgba(15,23,42,0.5)]"
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative h-36 w-full shrink-0 md:h-auto md:w-44">
                  <ImageWithFallback
                    src={trip.coverImage}
                    fallbackSrc={resolveTripHeroImage({
                      destination: trip.destination,
                      city: trip.city,
                      country: trip.country,
                    })}
                    alt={trip.destination}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r" />
                  <Badge className={`absolute top-3 left-3 ${getLifecycleColor(lifecycle)} border-0`}>
                    {getLifecycleLabel(lifecycle)}
                  </Badge>
                </div>

                <div className="min-w-0 flex-1 p-4 sm:p-5">
                  <div className="mb-2.5 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">{trip.name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin size={14} />
                        {trip.destination}
                      </p>
                    </div>
                    {trip.status === "upcoming" && getDaysUntil(trip.startDate) > 0 && (
                      <div className="text-right">
                        <p className="text-2xl font-bold vuei-gradient-text">{getDaysUntil(trip.startDate)}</p>
                        <p className="text-xs text-muted-foreground">dias</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {trip.passengersCount} {trip.passengersCount === 1 ? "pessoa" : "pessoas"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {getLifecycleDetail(trip)}
                    </span>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-2">
                    {false && (
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield size={14} className="text-amber-400" />
                        <span className="text-xs text-muted-foreground">Link da Viagem</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs truncate flex-1">{trip.adminLink}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void copyLink(trip.adminLink, `admin-${trip.id}`)}>
                          {copiedLink === `admin-${trip.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </Button>
                      </div>
                    </div>
                    )}
                    <div className="rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2.5">
                      <div className="mb-1 flex items-center gap-2">
                        <Link2 size={14} className="text-primary" />
                        <span className="text-xs text-muted-foreground">Link da Viagem</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-xs text-foreground/75">
                          {linkActive ? getLinkPreview(trip) : getShareHint(trip)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            if (!linkActive) return
                            void copyLink(trip.shareLink, `share-${trip.id}`)
                          }}
                          disabled={!linkActive}
                        >
                          {copiedLink === `share-${trip.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button 
                      className="min-w-[12rem] flex-1 rounded-xl border-0 bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_12px_26px_-17px_rgba(11,86,216,0.8)]"
                      onClick={() => {
                        if (linkActive) {
                          openShareLink(trip)
                          return
                        }

                        if (canRequestActivation) {
                          void activateForPublicAccess(trip.id)
                        }
                      }}
                      disabled={!linkActive && (!canRequestActivation || activatingTripId !== null)}
                    >
                      {linkActive ? <ExternalLink size={16} className="mr-2" /> : <Link2 size={16} className="mr-2" />}
                      {linkActive
                        ? "Abrir link"
                        : lifecycle === "ended"
                          ? "Viagem encerrada"
                        : activatingTripId === trip.id
                          ? "Ativando..."
                          : trip.linkActivatedAt
                            ? "Reabrir link"
                            : "Ativar viagem (1 crédito)"}
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-border/50"
                      onClick={() => {
                        if (!linkActive) return
                        void copyLink(trip.shareLink, `share-${trip.id}`)
                      }}
                      disabled={!linkActive}
                    >
                      <Copy size={16} className="mr-2" />
                      Copiar link
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="border-border/50">
                          <MoreHorizontal size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="portal-dropdown border-border/50">
                        <DropdownMenuItem onClick={() => { setActiveTrip(trip.id); router.push("/portal") }} className="cursor-pointer">
                          <Plane size={14} className="mr-2" />
                          Definir como ativa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => shareTripLink(trip, `share-${trip.id}`)}
                          disabled={!linkActive}
                          className="cursor-pointer"
                        >
                          <Share2 size={14} className="mr-2" />
                          Compartilhar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border/70" />
                        <DropdownMenuItem onClick={() => void handleDeleteTrip(trip.id)} className="cursor-pointer text-red-400 focus:text-red-400">
                          <Trash2 size={14} className="mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </Card>
            )
          })}
        </motion.div>
      ) : filter === "ended" && archivedTrips.length > 0 ? null : (
        <motion.div variants={fadeInUp}>
          <Card className="rounded-[1.5rem] border-border/55 bg-card/70 p-8 text-center shadow-[0_16px_44px_-36px_rgba(15,23,42,0.45)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
              <Plane size={22} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {filter === "all"
                ? archivedTrips.length > 0 ? "Nenhuma viagem em andamento" : "Nenhuma viagem ainda"
                : `Nenhuma viagem no estado ${getFilterLabel(filter).toLowerCase()}`}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {filter === "all"
                ? archivedTrips.length > 0
                  ? "Suas viagens encerradas continuam disponíveis no arquivo abaixo."
                  : "Crie sua primeira viagem e organize tudo em um único link."
                : "Altere o filtro ou crie uma nova viagem."}
            </p>
            <CreateTripButton 
              className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
            >
              <Plus size={18} className="mr-2" />
              Nova Viagem
            </CreateTripButton>
          </Card>
        </motion.div>
      )}

      {archivedTrips.length > 0 && (filter === "all" || filter === "ended") ? (
        <motion.section variants={fadeInUp} className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Archive size={19} className="text-primary" />
                <h2 className="text-xl font-semibold">Viagens arquivadas</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Seus dados continuam preservados depois que o link publico encerra.
              </p>
            </div>
            {!canAccessArchive && archiveAccessLoaded ? (
              <Button variant="outline" onClick={() => router.push("/portal/planos")}>
                <Crown size={15} className="mr-2 text-amber-400" />Conhecer Vuei+
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {archivedTrips.map((trip) => (
              <Card key={trip.id} className="rounded-[1.25rem] border-border/55 bg-card/70 p-3.5 shadow-[0_12px_36px_-30px_rgba(15,23,42,0.42)]">
                <div className="flex items-start gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <ImageWithFallback
                      src={trip.coverImage}
                      fallbackSrc={resolveTripHeroImage({ destination: trip.destination, city: trip.city, country: trip.country })}
                      alt={trip.destination}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{trip.name}</p>
                      {canAccessArchive ? <Archive size={15} className="text-primary" /> : <LockKeyhole size={15} className="text-muted-foreground" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{trip.destination}</p>
                    <Button
                      size="sm"
                      variant={canAccessArchive ? "outline" : "ghost"}
                      className="mt-3 h-8"
                      onClick={() => router.push(canAccessArchive ? `/portal/viagem/arquivo/${trip.id}` : "/portal/planos")}
                      disabled={!archiveAccessLoaded}
                    >
                      {canAccessArchive ? "Abrir arquivo" : "Desbloquear com Vuei+"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.section>
      ) : null}

      <Toast message={feedback?.message ?? "Link copiado!"} visible={Boolean(copiedLink || feedback)} tone={feedback?.tone ?? "success"} />
    </motion.div>
  )
}
