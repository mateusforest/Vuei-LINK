"use client"

import { Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import {
  Building2,
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  TrendingUp,
  Users,
  Plane,
  Coins,
  ExternalLink,
  Edit,
  Ban,
  CheckCircle2,
  Crown,
  Star,
  X,
  Wallet,
  Mail,
  Phone
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

function MasterAgenciasPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  
  const { agencies, stats, addAgency, updateAgency, suspendAgency, activateAgency, trips } = useMaster()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [planFilter, setPlanFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)
  const [showCreditsModal, setShowCreditsModal] = useState<string | null>(null)
  const [creditsAmount, setCreditsAmount] = useState("")
  
  const [newAgency, setNewAgency] = useState({
    name: "",
    owner: "",
    email: "",
    phone: "",
    plan: "starter" as "starter" | "pro" | "enterprise"
  })

  const filteredAgencies = agencies.filter(agency => {
    const matchesSearch = agency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agency.owner.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesPlan = planFilter === "all" || agency.plan === planFilter
    const matchesStatus = statusFilter === "all" || agency.status === statusFilter
    return matchesSearch && matchesPlan && matchesStatus
  })

  const selectedAgency = showDetailsModal ? agencies.find(a => a.id === showDetailsModal) : null
  const creditsAgency = showCreditsModal ? agencies.find(a => a.id === showCreditsModal) : null
  const agencyTrips = selectedAgency ? trips.filter(t => t.agencyId === selectedAgency.id) : []

  const handleCreateAgency = () => {
    if (!newAgency.name || !newAgency.email) return
    addAgency({
      name: newAgency.name,
      owner: newAgency.owner,
      email: newAgency.email,
      phone: newAgency.phone,
      plan: newAgency.plan,
      status: "active",
      tripsCount: 0,
      usersCount: 1,
      creditsBalance: newAgency.plan === "enterprise" ? 500 : newAgency.plan === "pro" ? 200 : 100,
      monthlyRevenue: 0
    })
    setNewAgency({ name: "", owner: "", email: "", phone: "", plan: "starter" })
    setShowCreateModal(false)
  }

  const handleAddCredits = () => {
    if (!showCreditsModal || !creditsAmount) return
    const amount = parseInt(creditsAmount)
    if (isNaN(amount)) return
    updateAgency(showCreditsModal, { 
      creditsBalance: (creditsAgency?.creditsBalance || 0) + amount 
    })
    setCreditsAmount("")
    setShowCreditsModal(null)
  }

  const pageStats = [
    { label: "Total Agencias", value: stats.totalAgencies.toString(), change: "+12", icon: Building2 },
    { label: "Agencias Ativas", value: stats.activeAgencies.toString(), change: "+8", icon: CheckCircle2 },
    { label: "Plano Enterprise", value: agencies.filter(a => a.plan === "enterprise").length.toString(), change: "+5", icon: Crown },
    { label: "Receita Total", value: `R$ ${(agencies.reduce((sum, a) => sum + a.monthlyRevenue, 0) / 1000).toFixed(0)}K`, change: "+23%", icon: TrendingUp },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      {/* Create Agency Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Nova Agencia</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreateModal(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Agencia</Label>
                    <Input 
                      value={newAgency.name}
                      onChange={e => setNewAgency(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Viagens Premium"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Responsavel</Label>
                    <Input 
                      value={newAgency.owner}
                      onChange={e => setNewAgency(prev => ({ ...prev, owner: e.target.value }))}
                      placeholder="Nome do responsavel"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input 
                      type="email"
                      value={newAgency.email}
                      onChange={e => setNewAgency(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contato@agencia.com"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input 
                      value={newAgency.phone}
                      onChange={e => setNewAgency(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(11) 99999-9999"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select value={newAgency.plan} onValueChange={(v: "starter" | "pro" | "enterprise") => setNewAgency(prev => ({ ...prev, plan: v }))}>
                      <SelectTrigger className="bg-black/40 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-white/10">
                        <SelectItem value="starter">Starter</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreateAgency} className="w-full bg-gradient-to-r from-primary to-accent text-white">
                    Criar Agencia
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Agency Details Modal */}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-lg font-semibold text-primary">
                        {selectedAgency.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedAgency.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedAgency.owner}</p>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        selectedAgency.plan === "enterprise"
                          ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          : selectedAgency.plan === "pro"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}>
                        {selectedAgency.plan === "enterprise" && <Star className="h-3 w-3" />}
                        {selectedAgency.plan.charAt(0).toUpperCase() + selectedAgency.plan.slice(1)}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDetailsModal(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Plane className="h-3.5 w-3.5" />
                      <span className="text-xs">Viagens</span>
                    </div>
                    <p className="text-lg font-semibold">{selectedAgency.tripsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-xs">Equipe</span>
                    </div>
                    <p className="text-lg font-semibold">{selectedAgency.usersCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Coins className="h-3.5 w-3.5" />
                      <span className="text-xs">Creditos</span>
                    </div>
                    <p className="text-lg font-semibold">{selectedAgency.creditsBalance.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Wallet className="h-3.5 w-3.5" />
                      <span className="text-xs">Receita</span>
                    </div>
                    <p className="text-lg font-semibold">R$ {(selectedAgency.monthlyRevenue / 1000).toFixed(1)}K</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAgency.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedAgency.phone}</span>
                  </div>
                </div>

                {agencyTrips.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-3">Viagens Recentes</h3>
                    <div className="space-y-2">
                      {agencyTrips.slice(0, 3).map(trip => (
                        <div key={trip.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                          <Plane className="h-4 w-4 text-primary" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{trip.name}</p>
                            <p className="text-xs text-muted-foreground">{trip.destination}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            trip.status === "ongoing" ? "bg-emerald-500/10 text-emerald-400" :
                            trip.status === "upcoming" ? "bg-primary/10 text-primary" :
                            "bg-white/5 text-muted-foreground"
                          }`}>
                            {trip.status === "ongoing" ? "Em andamento" : trip.status === "upcoming" ? "Proxima" : "Concluida"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-white/10" onClick={() => {
                    setShowDetailsModal(null)
                    setShowCreditsModal(selectedAgency.id)
                  }}>
                    <Coins className="h-4 w-4 mr-2" />
                    Adicionar Creditos
                  </Button>
                  <Button 
                    variant="outline" 
                    className={`flex-1 ${selectedAgency.status === "active" ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                    onClick={() => {
                      if (selectedAgency.status === "active") {
                        suspendAgency(selectedAgency.id)
                      } else {
                        activateAgency(selectedAgency.id)
                      }
                      setShowDetailsModal(null)
                    }}
                  >
                    {selectedAgency.status === "active" ? (
                      <>
                        <Ban className="h-4 w-4 mr-2" />
                        Suspender
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Ativar
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Credits Modal */}
      <AnimatePresence>
        {showCreditsModal && creditsAgency && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreditsModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm z-50"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Adicionar Creditos</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreditsModal(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {creditsAgency.name} - Saldo atual: <span className="text-primary font-semibold">{creditsAgency.creditsBalance.toLocaleString()}</span>
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantidade de creditos</Label>
                    <Input 
                      type="number"
                      value={creditsAmount}
                      onChange={e => setCreditsAmount(e.target.value)}
                      placeholder="Ex: 1000"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[100, 500, 1000, 5000].map(amount => (
                      <Button 
                        key={amount}
                        variant="outline" 
                        size="sm"
                        className="flex-1 border-white/10"
                        onClick={() => setCreditsAmount(amount.toString())}
                      >
                        +{amount}
                      </Button>
                    ))}
                  </div>
                  <Button onClick={handleAddCredits} className="w-full bg-gradient-to-r from-primary to-accent text-white">
                    Adicionar Creditos
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Agencias</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as agencias da plataforma</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2 w-fit">
          <Plus className="h-4 w-4" />
          Nova Agencia
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat, index) => (
          <Card key={index} className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-emerald-400">{stat.change}</div>
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
            placeholder="Buscar agencias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex gap-3">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[140px] bg-black/40 border-white/10">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-black/40 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="suspended">Suspensas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Agencies Table */}
      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Agencia</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Plano</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Viagens</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Equipe</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Creditos</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Receita</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAgencies.map((agency) => (
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
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                            {agency.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-foreground">{agency.name}</div>
                          <div className="text-xs text-muted-foreground">{agency.owner}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        agency.plan === "enterprise"
                          ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                          : agency.plan === "pro"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}>
                        {agency.plan === "enterprise" && <Star className="h-3 w-3" />}
                        {agency.plan.charAt(0).toUpperCase() + agency.plan.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        agency.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          agency.status === "active" ? "bg-emerald-400" : "bg-red-400"
                        }`} />
                        {agency.status === "active" ? "Ativa" : "Suspensa"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                        {agency.tripsCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {agency.usersCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Coins className="h-3.5 w-3.5 text-primary" />
                        {agency.creditsBalance.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-foreground">R$ {(agency.monthlyRevenue / 1000).toFixed(1)}K</span>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card/95 backdrop-blur-xl border-white/10">
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowDetailsModal(agency.id)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowCreditsModal(agency.id)}>
                            <Coins className="h-3.5 w-3.5" />
                            Adicionar Creditos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            className={`text-xs gap-2 ${agency.status === "active" ? "text-red-400" : "text-emerald-400"}`}
                            onClick={() => agency.status === "active" ? suspendAgency(agency.id) : activateAgency(agency.id)}
                          >
                            {agency.status === "active" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {agency.status === "active" ? "Suspender" : "Ativar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <span className="text-xs text-muted-foreground">Mostrando {filteredAgencies.length} de {agencies.length} agencias</span>
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
