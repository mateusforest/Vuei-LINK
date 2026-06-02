"use client"

import { Suspense, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Check, Copy, ExternalLink, FileText, MapPin, Plane, Search, Share2, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

const statusConfig = {
  upcoming: { label: "Proxima", color: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  ongoing: { label: "Em andamento", color: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
  completed: { label: "Finalizada", color: "bg-primary/10 text-primary", dot: "bg-primary" },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function MasterViagensPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  const { trips, stats } = useMaster()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) => {
        const normalizedQuery = searchQuery.toLowerCase()
        const matchesSearch =
          trip.name.toLowerCase().includes(normalizedQuery) ||
          trip.destination.toLowerCase().includes(normalizedQuery) ||
          (trip.agencyName || "").toLowerCase().includes(normalizedQuery)
        const matchesStatus = statusFilter === "all" || trip.status === statusFilter
        return matchesSearch && matchesStatus
      }),
    [trips, searchQuery, statusFilter]
  )

  const selectedTrip = showDetailsModal ? trips.find((trip) => trip.id === showDetailsModal) ?? null : null

  const pageStats = [
    { label: "Total Viagens", value: stats.totalTrips.toString(), icon: Plane },
    { label: "Ativas", value: stats.activeTrips.toString(), icon: Plane },
    { label: "Documentos", value: stats.totalDocuments.toString(), icon: FileText },
    { label: "Agencias", value: stats.totalAgencies.toString(), icon: Share2 },
  ]

  const copyLink = async (link: string, type: string) => {
    await navigator.clipboard.writeText(link)
    setCopiedLink(type)
    window.setTimeout(() => setCopiedLink(null), 2000)
  }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
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
                <div className="h-40 bg-cover bg-center relative" style={{ backgroundImage: `url(${selectedTrip.cover})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                  <Button variant="ghost" size="icon" onClick={() => setShowDetailsModal(null)} className="absolute top-4 right-4 bg-black/50 hover:bg-black/70">
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
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[selectedTrip.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedTrip.status].dot}`} />
                      {statusConfig[selectedTrip.status].label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Agencia</p>
                      <p className="text-sm font-medium">{selectedTrip.agencyName || "Viagem de viajante"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Responsavel</p>
                      <p className="text-sm font-medium">{selectedTrip.userName || "Nao informado"}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Periodo</p>
                      <p className="text-sm font-medium">
                        {formatDate(selectedTrip.startDate)} - {formatDate(selectedTrip.endDate)}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-xs text-muted-foreground mb-1">Documentos</p>
                      <p className="text-sm font-medium">{selectedTrip.documentsCount}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Admin:</span>
                      <code className="flex-1 text-xs truncate">{selectedTrip.adminLink}</code>
                      <Button variant="ghost" size="sm" onClick={() => void copyLink(selectedTrip.adminLink, `${selectedTrip.id}-admin`)}>
                        {copiedLink === `${selectedTrip.id}-admin` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Publico:</span>
                      <code className="flex-1 text-xs truncate">{selectedTrip.shareLink}</code>
                      <Button variant="ghost" size="sm" onClick={() => void copyLink(selectedTrip.shareLink, `${selectedTrip.id}-public`)}>
                        {copiedLink === `${selectedTrip.id}-public` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <Link href={selectedTrip.adminLink.replace(/^https?:\/\/[^/]+/, "")} className="flex-1">
                      <Button variant="outline" className="w-full border-white/10">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Admin
                      </Button>
                    </Link>
                    <Link href={selectedTrip.shareLink.replace(/^https?:\/\/[^/]+/, "")} className="flex-1">
                      <Button variant="outline" className="w-full border-white/10">
                        <Share2 className="h-4 w-4 mr-2" />
                        Abrir Publico
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Viagens</h1>
        <p className="text-sm text-muted-foreground">Leitura real de viagens da plataforma</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat) => (
          <Card key={stat.label} className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar viagens..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-black/40 border-white/10">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-card border-white/10">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="upcoming">Proximas</SelectItem>
            <SelectItem value="ongoing">Em andamento</SelectItem>
            <SelectItem value="completed">Finalizadas</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Viagem</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Agencia</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-sm text-center text-muted-foreground">
                      Nenhuma viagem real encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((trip) => {
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
                            <div className="w-10 h-10 rounded-lg bg-cover bg-center border border-white/10" style={{ backgroundImage: `url(${trip.cover})` }} />
                            <div>
                              <div className="text-sm font-medium text-foreground">{trip.name}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {trip.destination}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{trip.agencyName || "Viajante"}</td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(trip.createdAt)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
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
