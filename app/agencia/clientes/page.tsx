"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  Plus,
  MoreHorizontal,
  MapPin,
  MessageSquare,
  Plane,
  Mail,
  Phone,
  ChevronRight,
  X,
  User,
  Edit,
  Trash2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAgency, type Client } from "@/contexts/agency-context"

const ACTIVE_CLIENT_TRIP_STATUSES = new Set(["draft", "upcoming", "ongoing"])

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/24 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="agency-modal w-full max-w-md rounded-2xl border p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-slate-100">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// New Client Modal
function NewClientModal({ open, onClose, onSave, editClient }: { 
  open: boolean
  onClose: () => void
  onSave: (client: Omit<Client, "id" | "createdAt">) => Promise<boolean>
  editClient?: Client | null
}) {
  const [formData, setFormData] = useState({
    name: editClient?.name || "",
    email: editClient?.email || "",
    phone: editClient?.phone || "",
    document: editClient?.document || "",
    notes: editClient?.notes || "",
    status: editClient?.status || ("active" as const)
  })

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) return
    const saved = await onSave(formData)
    if (!saved) return
    setFormData({ name: "", email: "", phone: "", document: "", notes: "", status: "active" })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editClient ? "Editar Cliente" : "Novo Cliente"}>
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Nome *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nome completo"
            className="mt-1 w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">E-mail *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
            className="mt-1 w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
            className="mt-1 w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Documento (CPF/RG)</label>
          <input
            type="text"
            value={formData.document}
            onChange={(e) => setFormData({ ...formData, document: e.target.value })}
            placeholder="000.000.000-00"
            className="mt-1 w-full rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Observações</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notas sobre o cliente..."
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-border/70 bg-white px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
          />
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={!formData.name || !formData.email}
          className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50"
        >
          {editClient ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </div>
    </Modal>
  )
}

// Client Profile Modal
function ClientProfileModal({ open, onClose, client, trips, onEdit, onNewTrip }: { 
  open: boolean
  onClose: () => void
  client: Client | null
  trips: { name: string; destination: string; status: string }[]
  onEdit: () => void
  onNewTrip: () => void
}) {
  if (!client) return null

  return (
    <Modal open={open} onClose={onClose} title="Perfil do Cliente">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/10">
            <AvatarFallback className="bg-primary/20 text-xl text-primary">
              {client.name.split(" ").map(n => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{client.name}</h3>
            <p className="text-sm text-muted-foreground">{client.email}</p>
            {client.phone && <p className="text-sm text-muted-foreground">{client.phone}</p>}
          </div>
        </div>

        {client.notes && (
          <div className="rounded-xl border border-border/60 bg-[#fbfbfc] p-3">
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Observações</p>
            <p className="text-sm text-foreground/80">{client.notes}</p>
          </div>
        )}

        <div>
          <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Viagens ({trips.length})</p>
          {trips.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-[#fbfbfc] p-4 text-center">
              <Plane className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma viagem ainda</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {trips.map((trip, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 bg-[#fbfbfc] p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{trip.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {trip.destination}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    trip.status === "upcoming" ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-white/10"
                  }`}>
                    {trip.status === "upcoming" ? "Próximo" : trip.status === "ongoing" ? "Em andamento" : "Concluído"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={onEdit} variant="outline" className="flex-1 border-white/10">
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button onClick={onNewTrip} className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90">
            <Plane className="w-4 h-4 mr-2" />
            Nova Viagem
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const { clients, trips, addClient, updateClient, deleteClient, getTripsByClient, setupIncomplete, workspaceError, canCreateMoreClients, canCreateMoreTrips, showPlanLimitDialog } = useAgency()
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all")
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [profileClient, setProfileClient] = useState<Client | null>(null)

  const visibleClients = clients.filter((client) => client.status !== "archived")
  const filteredClients = clients.filter((client) => {
    if (client.status === "archived") return false
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         client.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filter === "all" || client.status === filter
    return matchesSearch && matchesFilter
  })

  const getActiveTripsByClient = (clientId: string) =>
    getTripsByClient(clientId).filter((trip) => ACTIVE_CLIENT_TRIP_STATUSES.has(trip.status))

  const getClientStatus = (clientId: string) => {
    const clientTrips = getActiveTripsByClient(clientId)
    const upcomingTrip = clientTrips.find(t => t.status === "upcoming")
    const ongoingTrip = clientTrips.find(t => t.status === "ongoing")
    
    if (ongoingTrip) return { status: "traveling", trip: ongoingTrip }
    if (upcomingTrip) return { status: "preparation", trip: upcomingTrip }
    return { status: "idle", trip: null }
  }

  const handleSaveClient = async (data: Omit<Client, "id" | "createdAt">) => {
    if (editClient) {
      const updated = await updateClient(editClient.id, data)
      if (!updated) {
        if (workspaceError) window.alert(workspaceError)
        return false
      }
      setEditClient(null)
      return true
    } else {
      const created = await addClient(data)
      if (!created) {
        if (workspaceError) window.alert(workspaceError)
        return false
      }
      return true
    }
  }

  const handleDeleteClient = async (id: string) => {
    const linkedTrips = getActiveTripsByClient(id)
    if (linkedTrips.length > 0) {
      window.alert("Este cliente possui viagens vinculadas e não pode ser excluído agora.")
      return
    }

    if (confirm("Tem certeza que deseja remover este cliente?")) {
      const removed = await deleteClient(id)
      if (!removed && workspaceError) {
        window.alert(workspaceError)
      }
    }
  }

  const handleOpenNewClient = () => {
    if (!canCreateMoreClients) {
      showPlanLimitDialog("client_limit")
      return
    }

    setNewClientOpen(true)
  }

  const handleOpenNewTrip = (clientId?: string | null) => {
    if (!canCreateMoreTrips) {
      showPlanLimitDialog("trip_limit")
      return
    }

    router.push(clientId ? `/agencia/viagens/criar?clientId=${clientId}` : "/agencia/viagens/criar")
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {setupIncomplete && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-200">
            Sua agência ainda não foi persistida corretamente no Supabase. Finalize o cadastro antes de operar clientes reais.
          </CardContent>
        </Card>
      )}

      {!setupIncomplete && workspaceError && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">
            {workspaceError}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="mt-1 text-muted-foreground">{visibleClients.length} clientes cadastrados</p>
        </div>
        <Button 
          onClick={handleOpenNewClient}
          className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar clientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/70 bg-white pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "Todos" },
            { value: "active", label: "Ativos" },
            { value: "inactive", label: "Inativos" },
          ].map((item) => (
            <Button
              key={item.value}
              variant="outline"
              size="sm"
              onClick={() => setFilter(item.value as typeof filter)}
              className={`border-border/70 bg-white ${
                filter === item.value
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:bg-slate-50"
              }`}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <User className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Tente buscar com outros termos" : "Cadastre seu primeiro cliente"}
          </p>
          {!searchQuery && (
            <Button onClick={handleOpenNewClient} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Cliente
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredClients.map((client) => {
            const { status, trip } = getClientStatus(client.id)
            const clientTrips = getActiveTripsByClient(client.id)
            
            return (
              <motion.div key={client.id} variants={itemVariants}>
                <Card className="group overflow-hidden border-border/60 bg-white/88 transition-all hover:border-primary/20 hover:bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-border/60">
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {client.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-foreground">{client.name}</h3>
                          <p className="text-xs text-muted-foreground">{clientTrips.length} viagens</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="agency-dropdown">
                          <DropdownMenuItem onClick={() => setProfileClient(client)}>
                            <User className="w-4 h-4 mr-2" />
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditClient(client)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenNewTrip(client.id)}>
                            <Plane className="w-4 h-4 mr-2" />
                            Nova viagem
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-4 space-y-2">
                      {trip && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="text-foreground">{trip.destination}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            status === "traveling"
                              ? "border-green-500/30 bg-green-500/10 text-green-400"
                              : status === "preparation"
                                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                                : "border-border/60 bg-white text-muted-foreground"
                          }`}
                        >
                          {status === "traveling"
                            ? "Em viagem"
                            : status === "preparation"
                              ? "Preparacao"
                              : "Sem viagem"}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfileClient(client)}
                        className="gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      >
                        Ver
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Modals */}
      <NewClientModal 
        open={newClientOpen || !!editClient} 
        onClose={() => { setNewClientOpen(false); setEditClient(null) }} 
        onSave={handleSaveClient}
        editClient={editClient}
      />
      <ClientProfileModal 
        open={!!profileClient} 
        onClose={() => setProfileClient(null)} 
        client={profileClient}
        trips={profileClient ? getTripsByClient(profileClient.id) : []}
        onEdit={() => { setEditClient(profileClient); setProfileClient(null) }}
        onNewTrip={() => {
          const clientId = profileClient?.id
          setProfileClient(null)
          handleOpenNewTrip(clientId)
        }}
      />
    </div>
  )
}
