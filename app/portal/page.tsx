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
import { useTrips } from "@/contexts/trips-context"
import { useAuth } from "@/contexts/auth-context"

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
  const router = useRouter()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6"
      >
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20">
            <Plane size={28} className="text-[#5de0e6]" />
          </div>
          <h3 className="text-xl font-bold text-white">Crie sua primeira viagem</h3>
          <p className="text-sm text-white/60">
            Para acessar o link da viagem e os documentos vinculados, voce precisa criar uma viagem primeiro.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 border-white/10" onClick={onClose}>
              Voltar
            </Button>
            <Button
              className="flex-1 border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
              onClick={() => router.push("/portal/criar-viagem")}
            >
              Criar Viagem
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-400"
    >
      <Check size={16} />
      {message}
    </motion.div>
  )
}

export default function PortalHomePage() {
  const router = useRouter()
  const { trips, activeTrip, loadingTrips } = useTrips()
  const { profile, loading } = useAuth()
  const [showNoTripModal, setShowNoTripModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const firstName = profile?.name?.trim().split(" ")[0]

  const copyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(`https://${link}`)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const shareTrip = async (link: string) => {
    const url = `https://${link}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Link da viagem Vuei",
          url,
        })
        return
      } catch {
        // Fallback para copia silenciosa
      }
    }

    copyLink(link, "share")
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
          {loading || !firstName ? "Ola" : <>Ola, <span className="vuei-gradient-text">{firstName}</span></>}
        </h1>
        <p className="text-muted-foreground">
          {loadingTrips ? "Carregando suas viagens..." : trips.length > 0 ? "Seu link de viagem esta pronto para abrir, copiar e compartilhar." : "Crie sua primeira viagem para comecar."}
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
              <Image
                src={activeTrip.coverImage}
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
                    {activeTrip.status === "upcoming" ? "Proxima viagem" : activeTrip.status === "ongoing" ? "Em andamento" : "Concluida"}
                  </Badge>
                  <h2 className="text-xl font-bold">{activeTrip.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-muted-foreground">
                    <MapPin size={14} />
                    {activeTrip.destination}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-border/50"
                  onClick={() => router.push("/portal/criar-viagem")}
                >
                  <Plus size={16} className="mr-2" />
                  Criar nova viagem
                </Button>
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
                    <p className="text-sm font-medium">Link administrador</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{activeTrip.adminLink}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/40 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Share2 size={16} className="text-primary" />
                    <p className="text-sm font-medium">Link compartilhavel</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{activeTrip.shareLink}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  className="border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                  onClick={() => router.push(`/viagem/${activeTrip.slug}?admin=true`)}
                >
                  <ExternalLink size={16} className="mr-2" />
                  Abrir viagem
                </Button>
                <Button
                  variant="outline"
                  className="border-border/50"
                  onClick={() => copyLink(activeTrip.adminLink, "admin")}
                >
                  <Copy size={16} className="mr-2" />
                  Copiar link admin
                </Button>
                <Button
                  variant="outline"
                  className="border-border/50"
                  onClick={() => shareTrip(activeTrip.shareLink)}
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
              Organize tudo em um unico link: roteiro, documentos, passagens e mais.
            </p>
            <Button
              className="border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
              onClick={() => router.push("/portal/criar-viagem")}
            >
              <Plus size={18} className="mr-2" />
              Nova Viagem
            </Button>
          </Card>
        )}
      </motion.div>

      {trips.length > 0 && (
        <motion.div variants={fadeInUp}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Viagens criadas</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/portal/criar-viagem")}>
              <Plus size={16} className="mr-1" />
              Criar nova viagem
            </Button>
          </div>

          <div className="space-y-3">
            {trips.map((trip) => (
              <Card key={trip.id} className="border-border/50 bg-card/50 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div
                    className="relative h-20 w-full overflow-hidden rounded-xl md:h-16 md:w-24 md:shrink-0"
                    onClick={() => router.push(`/viagem/${trip.slug}?admin=true`)}
                  >
                    <Image src={trip.coverImage} alt={trip.destination} fill className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{trip.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{trip.destination}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="border-border/50" onClick={() => router.push(`/viagem/${trip.slug}?admin=true`)}>
                      Abrir viagem
                    </Button>
                    <Button variant="outline" className="border-border/50" onClick={() => copyLink(trip.adminLink, "admin")}>
                      Copiar link
                    </Button>
                    <Button variant="outline" className="border-border/50" onClick={() => shareTrip(trip.shareLink)}>
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
        message={copiedLink === "admin" ? "Link administrador copiado!" : "Link compartilhavel copiado!"}
        visible={!!copiedLink}
      />
    </motion.div>
  )
}
