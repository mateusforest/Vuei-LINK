"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import {
  Search,
  Plus,
  MoreHorizontal,
  MapPin,
  Calendar,
  Users,
  Link2,
  MessageSquare,
  FileText,
  Sparkles,
  Eye,
  Share2,
  Plane,
  Copy,
  ExternalLink,
  Trash2,
  X,
  Check,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgency, type AgencyTrip } from "@/contexts/agency-context"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// Modal component
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Links Modal
function LinksModal({ open, onClose, trip }: { open: boolean; onClose: () => void; trip: AgencyTrip | null }) {
  const [copiedAdmin, setCopiedAdmin] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  if (!trip) return null

  const copyToClipboard = (text: string, isAdmin: boolean) => {
    navigator.clipboard.writeText(text)
    if (isAdmin) {
      setCopiedAdmin(true)
      setTimeout(() => setCopiedAdmin(false), 2000)
    } else {
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Links da Viagem">
      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Link Admin</p>
              <p className="text-xs text-white/50">Acesso completo para editar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded-lg bg-black/30 text-xs text-white/70 truncate">
              {trip.adminLink}
            </code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => copyToClipboard(trip.adminLink, true)}
            >
              {copiedAdmin ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => window.open(`/viagem/${trip.slug}?admin=true`, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Share2 className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Link Compartilhavel</p>
              <p className="text-xs text-white/50">Para o cliente/familia</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 rounded-lg bg-black/30 text-xs text-white/70 truncate">
              {trip.shareLink}
            </code>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => copyToClipboard(trip.shareLink, false)}
            >
              {copiedShare ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => window.open(`/viagem/${trip.slug}`, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function TripsPage() {
  const { trips, deleteTrip, getDocumentsByTrip, conciergeRequests } = useAgency()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "upcoming" | "ongoing" | "completed">("all")
  const [linksTrip, setLinksTrip] = useState<AgencyTrip | null>(null)

  const filteredTrips = trips.filter((trip) => {
    const matchesSearch =
      trip.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === "all" || trip.status === filter
    return matchesSearch && matchesFilter
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  }

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta viagem?")) {
      deleteTrip(id)
    }
  }

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link)
  }

  const getConciergeCount = (tripId: string) => {
    return conciergeRequests.filter(r => r.tripId === tripId && r.status === "pending").length
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Viagens</h1>
          <p className="mt-1 text-muted-foreground">{trips.length} viagens cadastradas</p>
        </div>
        <Link href="/agencia/viagens/criar">
          <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
            <Plus className="h-4 w-4" />
            Nova Viagem
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar viagens ou clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Todas" },
            { value: "upcoming", label: "Proximas" },
            { value: "ongoing", label: "Em andamento" },
            { value: "completed", label: "Finalizadas" },
          ].map((item) => (
            <Button
              key={item.value}
              variant="outline"
              size="sm"
              onClick={() => setFilter(item.value as typeof filter)}
              className={`border-white/10 ${
                filter === item.value
                  ? "bg-primary/20 text-primary"
                  : "bg-transparent text-muted-foreground hover:bg-white/5"
              }`}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Trips Grid */}
      {filteredTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Plane className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma viagem encontrada</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Tente buscar com outros termos" : "Crie sua primeira viagem"}
          </p>
          {!searchQuery && (
            <Link href="/agencia/viagens/criar">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nova Viagem
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 lg:grid-cols-2"
        >
          {filteredTrips.map((trip) => {
            const docsCount = getDocumentsByTrip(trip.id).length
            const conciergeCount = getConciergeCount(trip.id)
            
            return (
              <motion.div key={trip.id} variants={itemVariants}>
                <Card className="group overflow-hidden border-white/5 bg-card/50 transition-all hover:border-primary/20 hover:bg-card/80">
                  <CardContent className="p-0">
                    {/* Header with image */}
                    <div className="relative h-24 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent p-4">
                      <div 
                        className="absolute inset-0 opacity-20 bg-cover bg-center"
                        style={{ backgroundImage: `url(${trip.coverImage})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
                      <div className="relative flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white/20">
                            <AvatarImage src={trip.coverImage} />
                            <AvatarFallback className="bg-primary/30 text-white">
                              {trip.clientName.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h3 className="font-semibold text-white">{trip.clientName}</h3>
                            <div className="flex items-center gap-1 text-sm text-white/70">
                              <MapPin className="h-3 w-3" />
                              {trip.destination}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={`border-0 ${
                            trip.status === "ongoing"
                              ? "bg-green-500/80 text-white"
                              : trip.status === "upcoming"
                                ? "bg-yellow-500/80 text-white"
                                : "bg-blue-500/80 text-white"
                          }`}
                        >
                          {trip.status === "ongoing"
                            ? "Em andamento"
                            : trip.status === "upcoming"
                              ? "Proximo"
                              : "Finalizada"}
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4 text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(trip.startDate)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {trip.passengersCount} passageiros
                          </div>
                        </div>
                      </div>

                      {/* Indicators */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">
                          <Link2 className="mr-1 h-3 w-3" />
                          Link ativo
                        </Badge>
                        {conciergeCount > 0 && (
                          <Badge variant="outline" className="border-accent/30 bg-accent/10 text-[10px] text-accent">
                            <MessageSquare className="mr-1 h-3 w-3" />
                            {conciergeCount} pendentes
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-white/10 bg-white/5 text-[10px] text-muted-foreground">
                          <FileText className="mr-1 h-3 w-3" />
                          {docsCount} docs
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => window.open(`/viagem/${trip.slug}?admin=true`, "_blank")}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Abrir
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setLinksTrip(trip)}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Links
                          </Button>
                          <Link href="/agencia/roteiros-ia">
                            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
                              <Sparkles className="h-3.5 w-3.5" />
                              Roteiro IA
                            </Button>
                          </Link>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/10 bg-card">
                            <DropdownMenuItem asChild>
                              <Link href="/agencia/concierge">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Concierge
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href="/agencia/documentos">
                                <FileText className="mr-2 h-4 w-4" />
                                Upload docs
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(trip.shareLink)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(trip.id)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover viagem
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Links Modal */}
      <LinksModal open={!!linksTrip} onClose={() => setLinksTrip(null)} trip={linksTrip} />
    </div>
  )
}
