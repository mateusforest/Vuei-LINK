"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Plane,
  Calendar,
  MapPin,
  ExternalLink,
  Plus,
  Copy,
  Share2,
  Check,
  Link2,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTrips, type Trip } from "@/contexts/trips-context"
import { resolveTripHeroImage } from "@/lib/trip-destination"
import { ImageWithFallback } from "@/components/system/image-with-fallback"
import { useAuth } from "@/contexts/auth-context"
import { activateTravelerTrip } from "@/lib/repositories/trips-repository"
import { CreateTripButton } from "@/components/portal/create-trip-button"

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

function NoTripModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(15,23,42,0.28)] backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="portal-dialog relative w-full max-w-md rounded-[28px] border border-black/8 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.12)]"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff]/16 to-[#0b56d8]/14">
            <Plane size={28} className="text-[#0b56d8]" />
          </div>
          <h3 className="text-xl font-bold text-[#101828]">Crie sua primeira viagem</h3>
          <p className="text-sm text-[#667085]">
            Para acessar o link da viagem e os documentos vinculados, você precisa criar uma viagem primeiro.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-black/8 bg-white text-[#344054]" onClick={onClose}>
              Voltar
            </Button>
            <CreateTripButton
              className="flex-1 border-0 bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)]"
            >
              Criar Viagem
            </CreateTripButton>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Toast({ message, visible, tone = "success" }: { message: string; visible: boolean; tone?: "success" | "error" }) {
  if (!visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
        tone === "error"
          ? "border-red-500/30 bg-red-500/20 text-red-300"
          : "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
      }`}
    >
      <Check size={16} />
      {message}
    </motion.div>
  )
}

export default function PortalHomePage() {
  const router = useRouter()
  const { trips, activeTrip, loadingTrips, updateTrip } = useTrips()
  const { profile, loading } = useAuth()
  const [showNoTripModal, setShowNoTripModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null)
  const [activatingTripId, setActivatingTripId] = useState<string | null>(null)
  const firstName = profile?.name?.trim().split(" ")[0]

  const isLinkActive = (trip: Trip) => Boolean(trip.linkActivatedAt && trip.visibility === "public")

  const copyLink = async (link: string, type: string) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopiedLink(type)
      window.setTimeout(() => setCopiedLink(null), 2000)
    } catch {
      setFeedback({ message: "Não foi possível copiar o link neste navegador.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 3500)
    }
  }

  const activateTrip = async (trip: Trip) => {
    if (activatingTripId) return

    setActivatingTripId(trip.id)
    const result = await activateTravelerTrip(trip.id)
    if (!result.data) {
      console.error("[TRIP] activation before public access error", result.error)
      setFeedback({ message: result.error || "Nao foi possivel ativar o link da viagem.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 3500)
      setActivatingTripId(null)
      return
    }

    updateTrip(trip.id, {
      visibility: "public",
      linkActivatedAt: result.data.linkActivatedAt,
      linkAccessUntil: result.data.linkAccessUntil,
      linkActivationTransactionId: result.data.transactionId,
    })
    setFeedback({ message: "Link ativado. Agora você pode abrir, copiar ou compartilhar.", tone: "success" })
    window.setTimeout(() => setFeedback(null), 3500)
    setActivatingTripId(null)
  }

  const handlePrimaryTripAction = (trip: Trip) => {
    if (isLinkActive(trip)) {
      router.push(trip.shareLink.replace(/^https?:\/\/[^/]+/, ""))
      return
    }

    void activateTrip(trip)
  }

  const shareTrip = async (link: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Link da viagem Vuei",
          url: link,
        })
        return
      } catch {
        // Fallback para copia silenciosa
      }
    }

    await copyLink(link, "share")
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="mx-auto max-w-6xl space-y-8"
    >
      <motion.div variants={fadeInUp} className="space-y-2">
        <h1 className="text-2xl font-bold md:text-3xl">
          {loading || !firstName ? "Olá" : <>Olá, <span className="vuei-gradient-text">{firstName}</span></>}
        </h1>
        <p className="text-muted-foreground">
          {loadingTrips ? "Carregando suas viagens..." : trips.length > 0 ? "Gerencie seus rascunhos e links de viagem em um só lugar." : "Crie sua primeira viagem para começar."}
        </p>
      </motion.div>

      <motion.div variants={fadeInUp}>
        {loadingTrips ? (
          <Card className="border-border/50 bg-card/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">Carregando viagens...</p>
          </Card>
        ) : activeTrip ? (
          <Card className="relative overflow-hidden border-border/50 bg-card/50">
            <div className="absolute inset-0">
              <ImageWithFallback
                src={activeTrip.coverImage}
                fallbackSrc={resolveTripHeroImage({
                  destination: activeTrip.destination,
                  city: activeTrip.city,
                  country: activeTrip.country,
                })}
                alt={activeTrip.destination}
                fill
                className="object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            </div>

            <div className="relative p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-2 border-0 bg-primary/20 text-primary">
                    {isLinkActive(activeTrip) ? "Link ativo" : activeTrip.status === "draft" ? "Rascunho" : activeTrip.status === "upcoming" ? "Próxima viagem" : activeTrip.status === "ongoing" ? "Em andamento" : "Concluída"}
                  </Badge>
                  <h2 className="text-xl font-bold">{activeTrip.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin size={14} />
                    {activeTrip.destination}
                  </p>
                </div>
                <CreateTripButton
                  variant="outline"
                  className="border-border/50"
                >
                  <Plus size={16} className="mr-2" />
                  Criar nova viagem
                </CreateTripButton>
              </div>

              <div className="mb-5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(activeTrip.startDate)} - {formatDate(activeTrip.endDate)}
                </span>
              </div>

              <div className="mb-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Link2 size={16} className="text-primary" />
                    <p className="text-sm font-medium">
                      {activeTrip.linkActivatedAt ? "Link da Viagem" : "Rascunho privado"}
                    </p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{activeTrip.shareLink}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                  onClick={() => handlePrimaryTripAction(activeTrip)}
                  disabled={activatingTripId === activeTrip.id}
                >
                  <ExternalLink size={16} className="mr-2" />
                  {activatingTripId === activeTrip.id ? "Ativando..." : isLinkActive(activeTrip) ? "Abrir link" : "Ativar link (1 Link)"}
                </Button>
                <Button
                  variant="outline"
                  className="border-border/50"
                  onClick={() => void copyLink(activeTrip.shareLink, "admin")}
                  disabled={!isLinkActive(activeTrip)}
                >
                  <Copy size={16} className="mr-2" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  className="border-border/50"
                  onClick={() => void shareTrip(activeTrip.shareLink)}
                  disabled={!isLinkActive(activeTrip)}
                >
                  <Share2 size={16} className="mr-2" />
                  Compartilhar
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5de0e6] to-[#004aad]">
              <Plane size={28} className="text-white" />
            </div>
            <h2 className="mb-2 text-xl font-bold">Nenhuma viagem criada ainda.</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Organize tudo em um único link: roteiro, documentos, passagens e mais.
            </p>
            <CreateTripButton className="border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white">
              <Plus size={18} className="mr-2" />
              Nova Viagem
            </CreateTripButton>
          </Card>
        )}
      </motion.div>

      {trips.length > 0 && (
        <motion.div variants={fadeInUp}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Viagens criadas</h2>
            <CreateTripButton variant="ghost" size="sm">
              <Plus size={16} className="mr-1" />
              Criar nova viagem
            </CreateTripButton>
          </div>

          <div className="space-y-3">
            {trips.map((trip) => (
              <Card key={trip.id} className="border-border/50 bg-card/50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div
                    className={`relative h-20 w-full overflow-hidden rounded-xl md:h-16 md:w-24 md:shrink-0 ${isLinkActive(trip) ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (isLinkActive(trip)) handlePrimaryTripAction(trip)
                    }}
                  >
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{trip.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{trip.destination}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="border-border/50" onClick={() => handlePrimaryTripAction(trip)} disabled={activatingTripId === trip.id}>
                      {activatingTripId === trip.id ? "Ativando..." : isLinkActive(trip) ? "Abrir link" : "Ativar link (1 Link)"}
                    </Button>
                    <Button variant="outline" className="border-border/50" onClick={() => void copyLink(trip.shareLink, "admin")} disabled={!isLinkActive(trip)}>
                      Copiar link
                    </Button>
                    <Button variant="outline" className="border-border/50" onClick={() => void shareTrip(trip.shareLink)} disabled={!isLinkActive(trip)}>
                      Compartilhar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {!activeTrip && trips.length === 0 && (
        <div className="hidden">
          <Button onClick={() => setShowNoTripModal(true)}>Abrir modal</Button>
        </div>
      )}

      <NoTripModal open={showNoTripModal} onClose={() => setShowNoTripModal(false)} />
      <Toast
        message={feedback?.message ?? "Link da viagem copiado!"}
        visible={Boolean(copiedLink || feedback)}
        tone={feedback?.tone ?? "success"}
      />
    </motion.div>
  )
}
