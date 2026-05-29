"use client"

import { Suspense, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import {
  Users,
  Search,
  MoreHorizontal,
  TrendingUp,
  Plane,
  Coins,
  ExternalLink,
  Ban,
  CheckCircle2,
  Crown,
  Mail,
  Calendar,
  Activity,
  X,
  Building2,
  Shield
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

function MasterUsuariosPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  
  const { users, stats, trips, suspendUser, activateUser, adjustUserCredits, updateUser } = useMaster()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)
  const [showCreditsModal, setShowCreditsModal] = useState<string | null>(null)
  const [creditsAmount, setCreditsAmount] = useState("")

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === "all" || user.type === typeFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const selectedUser = showDetailsModal ? users.find(u => u.id === showDetailsModal) : null
  const creditsUser = showCreditsModal ? users.find(u => u.id === showCreditsModal) : null
  const userTrips = selectedUser ? trips.filter(t => t.userId === selectedUser.id || t.agencyId === selectedUser.agencyId) : []

  const handleAddCredits = () => {
    if (!showCreditsModal || !creditsAmount) return
    const amount = parseInt(creditsAmount)
    if (isNaN(amount)) return
    adjustUserCredits(showCreditsModal, amount)
    setCreditsAmount("")
    setShowCreditsModal(null)
  }

  const pageStats = [
    { label: "Total Usuarios", value: stats.totalUsers.toString(), change: "+324", icon: Users },
    { label: "Usuarios Ativos", value: stats.activeUsers.toString(), change: "+218", icon: Activity },
    { label: "Premium", value: users.filter(u => u.plan === "premium" || u.plan === "enterprise").length.toString(), change: "+89", icon: Crown },
    { label: "Viagens Criadas", value: stats.totalTrips.toString(), change: "+12", icon: Plane },
  ]

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Hoje"
    if (diffDays === 1) return "Ontem"
    if (diffDays < 7) return `${diffDays} dias atras`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      {/* User Details Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedUser && (
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
                        {selectedUser.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedUser.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedUser.type === "admin"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : selectedUser.type === "agency"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-white/5 text-muted-foreground border border-white/10"
                        }`}>
                          {selectedUser.type === "admin" && <Shield className="h-3 w-3" />}
                          {selectedUser.type === "agency" && <Building2 className="h-3 w-3" />}
                          {selectedUser.type.charAt(0).toUpperCase() + selectedUser.type.slice(1)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          selectedUser.plan === "enterprise" || selectedUser.plan === "premium"
                            ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            : "bg-white/5 text-muted-foreground border border-white/10"
                        }`}>
                          {(selectedUser.plan === "enterprise" || selectedUser.plan === "premium") && <Crown className="h-3 w-3" />}
                          {selectedUser.plan.charAt(0).toUpperCase() + selectedUser.plan.slice(1)}
                        </span>
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
                    <p className="text-lg font-semibold">{selectedUser.tripsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Coins className="h-3.5 w-3.5" />
                      <span className="text-xs">Creditos</span>
                    </div>
                    <p className="text-lg font-semibold">{selectedUser.creditsBalance.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-xs">Membro desde</span>
                    </div>
                    <p className="text-lg font-semibold">{new Date(selectedUser.createdAt).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Activity className="h-3.5 w-3.5" />
                      <span className="text-xs">Ultima atividade</span>
                    </div>
                    <p className="text-lg font-semibold">{formatDate(selectedUser.lastActive)}</p>
                  </div>
                </div>

                {selectedUser.agencyName && (
                  <div className="mb-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm">Vinculado a agencia: <strong>{selectedUser.agencyName}</strong></span>
                    </div>
                  </div>
                )}

                {userTrips.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-3">Viagens</h3>
                    <div className="space-y-2">
                      {userTrips.slice(0, 3).map(trip => (
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
                    setShowCreditsModal(selectedUser.id)
                  }}>
                    <Coins className="h-4 w-4 mr-2" />
                    Ajustar Creditos
                  </Button>
                  <Button 
                    variant="outline" 
                    className={`flex-1 ${selectedUser.status === "active" ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}`}
                    onClick={() => {
                      if (selectedUser.status === "active") {
                        suspendUser(selectedUser.id)
                      } else {
                        activateUser(selectedUser.id)
                      }
                      setShowDetailsModal(null)
                    }}
                  >
                    {selectedUser.status === "active" ? (
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
        {showCreditsModal && creditsUser && (
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
                  <h2 className="text-lg font-semibold">Ajustar Creditos</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreditsModal(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {creditsUser.name} - Saldo atual: <span className="text-primary font-semibold">{creditsUser.creditsBalance.toLocaleString()}</span>
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Quantidade (positivo para adicionar, negativo para remover)</Label>
                    <Input 
                      type="number"
                      value={creditsAmount}
                      onChange={e => setCreditsAmount(e.target.value)}
                      placeholder="Ex: 100 ou -50"
                      className="bg-black/40 border-white/10"
                    />
                  </div>
                  <div className="flex gap-2">
                    {[50, 100, 500, -50].map(amount => (
                      <Button 
                        key={amount}
                        variant="outline" 
                        size="sm"
                        className={`flex-1 border-white/10 ${amount < 0 ? "text-red-400" : ""}`}
                        onClick={() => setCreditsAmount(amount.toString())}
                      >
                        {amount > 0 ? "+" : ""}{amount}
                      </Button>
                    ))}
                  </div>
                  <Button onClick={handleAddCredits} className="w-full bg-gradient-to-r from-primary to-accent text-white">
                    Confirmar Ajuste
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">Gerencie todos os usuarios da plataforma</p>
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
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <div className="flex gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-black/40 border-white/10">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="traveler">Viajante</SelectItem>
              <SelectItem value="agency">Agencia</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-black/40 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="suspended">Suspensos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Usuario</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Tipo</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Viagens</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Creditos</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Ultima Atividade</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setShowDetailsModal(user.id)}
                    className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                      highlightId === user.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                            {user.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-sm font-medium text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.type === "admin"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : user.type === "agency"
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-white/5 text-muted-foreground border border-white/10"
                      }`}>
                        {user.type === "admin" && <Shield className="h-3 w-3" />}
                        {user.type === "agency" && <Building2 className="h-3 w-3" />}
                        {user.type.charAt(0).toUpperCase() + user.type.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          user.status === "active" ? "bg-emerald-400" : "bg-red-400"
                        }`} />
                        {user.status === "active" ? "Ativo" : "Suspenso"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                        {user.tripsCount}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Coins className="h-3.5 w-3.5 text-primary" />
                        {user.creditsBalance.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(user.lastActive)}
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
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowDetailsModal(user.id)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Ver Perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs gap-2" onClick={() => setShowCreditsModal(user.id)}>
                            <Coins className="h-3.5 w-3.5" />
                            Ajustar Creditos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem 
                            className={`text-xs gap-2 ${user.status === "active" ? "text-red-400" : "text-emerald-400"}`}
                            onClick={() => user.status === "active" ? suspendUser(user.id) : activateUser(user.id)}
                          >
                            {user.status === "active" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {user.status === "active" ? "Suspender" : "Ativar"}
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
            <span className="text-xs text-muted-foreground">Mostrando {filteredUsers.length} de {users.length} usuarios</span>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default function MasterUsuariosPage() {
  return (
    <Suspense fallback={<div className="space-y-8"><div className="h-24 rounded-2xl border border-white/5 bg-black/20" /></div>}>
      <MasterUsuariosPageContent />
    </Suspense>
  )
}
