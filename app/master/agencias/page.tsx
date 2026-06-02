"use client"

import { Suspense, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { Building2, Calendar, Mail, Phone, Plane, Search, Users, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function MasterAgenciasPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  const { agencies, stats } = useMaster()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)

  const filteredAgencies = useMemo(
    () =>
      agencies.filter((agency) => {
        const normalizedQuery = searchQuery.toLowerCase()
        const matchesSearch =
          agency.name.toLowerCase().includes(normalizedQuery) ||
          agency.owner.toLowerCase().includes(normalizedQuery) ||
          agency.email.toLowerCase().includes(normalizedQuery)
        const matchesStatus = statusFilter === "all" || agency.status === statusFilter
        return matchesSearch && matchesStatus
      }),
    [agencies, searchQuery, statusFilter]
  )

  const selectedAgency = showDetailsModal ? agencies.find((agency) => agency.id === showDetailsModal) ?? null : null

  const pageStats = [
    { label: "Total Agencias", value: stats.totalAgencies.toString(), icon: Building2 },
    { label: "Agencias Ativas", value: stats.activeAgencies.toString(), icon: Building2 },
    { label: "Clientes", value: stats.totalClients.toString(), icon: Users },
    { label: "Viagens", value: stats.totalTrips.toString(), icon: Plane },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <AnimatePresence>
        {showDetailsModal && selectedAgency && (
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl z-50"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-white/10">
                      <AvatarImage src={selectedAgency.logo} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-lg font-semibold text-primary">
                        {selectedAgency.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedAgency.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedAgency.owner}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDetailsModal(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Plano</p>
                    <p className="text-sm font-medium capitalize">{selectedAgency.plan}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <p className="text-sm font-medium capitalize">{selectedAgency.status}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Viagens</p>
                    <p className="text-sm font-medium">{selectedAgency.tripsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Equipe</p>
                    <p className="text-sm font-medium">{selectedAgency.usersCount}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {selectedAgency.email || "Sem e-mail informado"}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {selectedAgency.phone || "Sem telefone informado"}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(selectedAgency.createdAt)}
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Agencias</h1>
        <p className="text-sm text-muted-foreground">Leitura real de agências e memberships do Supabase</p>
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
            placeholder="Buscar agencias..."
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
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="suspended">Suspensas</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Agencia</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Responsavel</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Plano</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgencies.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-sm text-center text-muted-foreground">
                      Nenhuma agencia real encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredAgencies.map((agency) => (
                    <tr
                      key={agency.id}
                      onClick={() => setShowDetailsModal(agency.id)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                        highlightId === agency.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-white/10">
                            <AvatarImage src={agency.logo} />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                              {agency.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium text-foreground">{agency.name}</div>
                            <div className="text-xs text-muted-foreground">{agency.email || "Sem e-mail"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{agency.owner}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground capitalize">{agency.plan}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(agency.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default function MasterAgenciasPage() {
  return (
    <Suspense fallback={<div className="space-y-8"><div className="h-24 rounded-2xl border border-white/5 bg-black/20" /></div>}>
      <MasterAgenciasPageContent />
    </Suspense>
  )
}
