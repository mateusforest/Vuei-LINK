"use client"

import { Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  Plane,
  Search,
  MoreHorizontal,
  Building2,
  MessageSquare,
  Brain,
  Share2,
  MapPin,
  Calendar,
  Activity,
  Globe,
  X,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Coins
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const statusConfig = {
  upcoming: { label: "Proxima", color: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  ongoing: { label: "Em andamento", color: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  completed: { label: "Finalizada", color: "bg-primary/10 text-primary", dot: "bg-primary" },
}

function MasterViagensPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  
  const { trips, stats, agencies } = useMaster()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [originFilter, setOriginFilter] = useState("all")
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const filteredTrips = trips.filter(trip => {
    const matchesSearch = trip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trip.userName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || trip.status === statusFilter
    const matchesOrigin = originFilter === "all" || trip.origin === originFilter
    return matchesSearch && matchesStatus && matchesOrigin
  })

  const selectedTrip = showDetailsModal ? trips.find(t => t.id === showDetailsModal) : null

  const copyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(`https://${link}`)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
  }

  const pageStats = [
    { label: "Total Viagens", value: stats.totalTrips.toString(), change: "+12", icon: Plane },
    { label: "Em Andamento", value: trips.filter(t => t.status === "ongoing").length.toString(), change: "+3", icon: Activity },
    { label: "Proximas", value: trips.filter(t => t.status === "upcoming").length.toString(), change: "+5", icon: Calendar },
    { label: "Paises", value: "47", change: "+3", icon: Globe },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      {/* Trip Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedTrip && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 overflow-hidden">
                <div 
                  className="h-40 bg-cover bg-center relative"
                  style={{ backgroundImage: `url(${selectedTrip.cover})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowDetailsModal(null)}
                    className="absolute top-4 right-4 bg-black/50 hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="p-6 -mt-12 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedTrip.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedTrip.destination}
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      statusConfig[selectedTrip.status].color
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedTrip.status].dot}`} />
                      {statusConfig[selectedTrip.status].label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-muted-foreground mb-1">Origem</div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        {selectedTrip.origin === "agency" ? (
                          <>
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                            Agencia
                          </>
                        ) : (
                          <>
                            <Plane className="h-3.5 w-3.5 text-primary" />
                            Usuario
                          </>
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-muted-foreground mb-1">Viajante</div>
                      <p className="text-sm font-medium">{selectedTrip.userName || "N/A"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-muted-foreground mb-1">Documentos</div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {selectedTrip.documentsCount}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <div className="text-xs text-muted-foreground mb-1">Creditos Usados</div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-primary" />
                        {selectedTrip.creditsUsed}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{formatDate(selectedTrip.startDate)} - {formatDate(selectedTrip.endDate)}</span>
                    </div>
                    {selectedTrip.agencyName && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedTrip.agencyName}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Links da Viagem</h3>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Admin:</span>
                      <code className="flex-1 text-xs truncate">{selectedTrip.adminLink}</code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyLink(selectedTrip.adminLink, "admin")}
                      >
                        {copiedLink === "admin" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Publico:</span>
                      <code className="flex-1 text-xs truncate">{selectedTrip.shareLink}</code>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyLink(selectedTrip.shareLink, "share")}
                      >
                        {copiedLink === "share" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Link href={`/viagem/${selectedTrip.id}`} className="flex-1">
                      <Button variant="outline" className="w-full border-white/10">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Viagem
                      </Button>
                    </Link>
                    <Link href="/master/concierge" className="flex-1">
                      <Button variant="outline" className="w-full border-white/10">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Ver Concierge
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Viagens</h1>
          <p className="text-sm text-muted-foreground">Visao global de todas as viagens da plataforma</p>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat, index) => (
          <Card key={index} className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-emerald-400">{stat.change} este mes</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar viagens..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-black/40 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ongoing">Em andamento</SelectItem>
              <SelectItem value="upcoming">Proximas</SelectItem>
              <SelectItem value="completed">Finalizadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger className="w-[150px] bg-black/40 border-white/10">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="user">Usuario</SelectItem>
              <SelectItem value="agency">Agencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Trips Table */}
      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Destino</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Origem</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Periodo</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Documentos</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Creditos</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => {
                  const status = statusConfig[trip.status]
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => setShowDetailsModal(trip.id)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                        highlightId === trip.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-10 h-10 rounded-lg bg-cover bg-center border border-white/10"
                            style={{ backgroundImage: `url(${trip.cover})` }}
                          />
                          <div>
                            <div className="text-sm font-medium text-foreground">{trip.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {trip.destination}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {trip.origin === "agency" ? (
                            <>
                              <Building2 className="h-3.5 w-3.5" />
                              {trip.agencyName}
                            </>
                          ) : (
                            <>
                              <Plane className="h-3.5 w-3.5" />
                              {trip.userName}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-foreground">{formatDate(trip.startDate)}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(trip.endDate)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          {trip.documentsCount}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Coins className="h-3.5 w-3.5 text-primary" />
                          {trip.creditsUsed}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10">
                            <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowDetailsModal(trip.id)}>
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs gap-2" onClick={() => copyLink(trip.adminLink, trip.id + "-admin")}>
                              <Copy className="h-3.5 w-3.5" />
                              Copiar Link Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs gap-2" onClick={() => copyLink(trip.shareLink, trip.id + "-share")}>
                              <Share2 className="h-3.5 w-3.5" />
                              Copiar Link Publico
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <span className="text-xs text-muted-foreground">Mostrando {filteredTrips.length} de {trips.length} viagens</span>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default function MasterViagensPage() {
  return (
    <Suspense fallback={<div className="space-y-8"><div className="h-24 rounded-2xl border border-white/5 bg-black/20" /></div>}>
      <MasterViagensPageContent />
    </Suspense>
  )
}
