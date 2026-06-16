"use client"

import { useState } from "react"
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
  Plane
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTrips } from "@/contexts/trips-context"
import { ensureTripIsPublic } from "@/lib/repositories/trips-repository"
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
  const { trips, deleteTrip, setActiveTrip } = useTrips()
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; tone: "success" | "error" } | null>(null)
  const [filter, setFilter] = useState<"all" | "upcoming" | "ongoing" | "completed">("all")

  const copyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(link)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const handleDeleteTrip = async (tripId: string) => {
    const result = await deleteTrip(tripId)
    if (!result.success) {
      setFeedback({ message: result.error || "Nao foi possivel excluir a viagem.", tone: "error" })
      window.setTimeout(() => setFeedback(null), 2500)
      return
    }

    setFeedback({ message: "Viagem excluida.", tone: "success" })
    window.setTimeout(() => setFeedback(null), 2500)
  }

  const copyShareLink = async (tripId: string, link: string, type: string) => {
    const result = await ensureTripIsPublic(tripId)
    if (result.error) {
      console.error("[TRIP] publish before share error", result.error)
      return
    }
    copyLink(link, type)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  }

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  }

  const filteredTrips = trips.filter(trip => {
    if (filter === "all") return true
    return trip.status === filter
  })

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "upcoming": return "Proxima"
      case "ongoing": return "Em andamento"
      case "completed": return "Concluida"
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-primary/20 text-primary"
      case "ongoing": return "bg-emerald-500/20 text-emerald-400"
      case "completed": return "bg-white/10 text-white/60"
      default: return "bg-white/10 text-white/60"
    }
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minhas Viagens</h1>
          <p className="text-muted-foreground text-sm">{trips.length} {trips.length === 1 ? "viagem" : "viagens"} criadas</p>
        </div>
        <Button 
          className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
          onClick={() => router.push("/portal/criar-viagem")}
        >
          <Plus size={18} className="mr-2" />
          Nova Viagem
        </Button>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-2 overflow-x-auto pb-2">
        {[
          { value: "all", label: "Todas" },
          { value: "upcoming", label: "Proximas" },
          { value: "ongoing", label: "Em andamento" },
          { value: "completed", label: "Concluidas" },
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
        <motion.div variants={fadeInUp} className="space-y-4">
          {filteredTrips.map((trip) => (
            <Card 
              key={trip.id}
              className="overflow-hidden bg-card/50 border-border/50 hover:border-primary/30 transition-all"
            >
              <div className="flex flex-col md:flex-row">
                <div className="relative w-full md:w-48 h-40 md:h-auto shrink-0">
                  <Image 
                    src={trip.coverImage} 
                    alt={trip.destination} 
                    fill 
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r" />
                  <Badge className={`absolute top-3 left-3 ${getStatusColor(trip.status)} border-0`}>
                    {getStatusLabel(trip.status)}
                  </Badge>
                </div>

                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between mb-3">
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

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={14} />
                      {trip.passengersCount} {trip.passengersCount === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield size={14} className="text-amber-400" />
                        <span className="text-xs text-muted-foreground">Link Admin</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs truncate flex-1">{trip.adminLink}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyLink(trip.adminLink, `admin-${trip.id}`)}>
                          {copiedLink === `admin-${trip.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </Button>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 mb-1">
                        <Link2 size={14} className="text-primary" />
                        <span className="text-xs text-muted-foreground">Link Publico</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs truncate flex-1">{trip.shareLink}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void copyShareLink(trip.id, trip.shareLink, `share-${trip.id}`)}>
                          {copiedLink === `share-${trip.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
                      onClick={() => router.push(`/viagem/${trip.slug}/admin`)}
                    >
                      <ExternalLink size={16} className="mr-2" />
                      Abrir Viagem
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-border/50"
                      onClick={() => router.push(`/viagem/${trip.slug}/admin`)}
                    >
                      <Shield size={16} className="mr-2" />
                      Admin
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
                        <DropdownMenuItem onClick={() => void copyShareLink(trip.id, trip.shareLink, `share-${trip.id}`)} className="cursor-pointer">
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
          ))}
        </motion.div>
      ) : (
        <motion.div variants={fadeInUp}>
          <Card className="p-12 bg-card/50 border-border/50 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Plane size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {filter === "all" ? "Nenhuma viagem ainda" : `Nenhuma viagem ${getStatusLabel(filter).toLowerCase()}`}
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              {filter === "all" 
                ? "Crie sua primeira viagem e organize tudo em um unico link."
                : "Altere o filtro ou crie uma nova viagem."}
            </p>
            <Button 
              className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
              onClick={() => router.push("/portal/criar-viagem")}
            >
              <Plus size={18} className="mr-2" />
              Nova Viagem
            </Button>
          </Card>
        </motion.div>
      )}

      <Toast message={feedback?.message ?? "Link copiado!"} visible={Boolean(copiedLink || feedback)} tone={feedback?.tone ?? "success"} />
    </motion.div>
  )
}
