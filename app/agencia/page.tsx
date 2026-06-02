"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plane,
  Users,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Clock,
  FileText,
  Link2,
  Calendar,
  MapPin,
  ChevronRight,
  TrendingUp,
  X,
  Upload,
  Check,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAgency, type Client, type AgencyTrip } from "@/contexts/agency-context"
import { useAuth } from "@/contexts/auth-context"
import { getAgencyByOwner } from "@/lib/repositories/agencies-repository"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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

// New Client Modal
function NewClientModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (client: Omit<Client, "id" | "createdAt">) => Promise<void> }) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    notes: "",
    status: "active" as const
  })

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) return
    await onSave(formData)
    setFormData({ name: "", email: "", phone: "", document: "", notes: "", status: "active" })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo Cliente">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Nome *</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Nome completo"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">E-mail *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Telefone</label>
          <input
            type="text"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Observacoes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Notas sobre o cliente..."
            rows={2}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50 resize-none"
          />
        </div>
        <Button 
          onClick={handleSubmit} 
          disabled={!formData.name || !formData.email}
          className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50"
        >
          Cadastrar Cliente
        </Button>
      </div>
    </Modal>
  )
}

// Upload Document Modal
function UploadDocModal({ open, onClose, clients, trips, onSave }: { 
  open: boolean
  onClose: () => void
  clients: Client[]
  trips: AgencyTrip[]
  onSave: (data: { name: string; type: string; clientId?: string; tripId?: string; isPrivate: boolean }) => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    type: "voucher",
    clientId: "",
    tripId: "",
    isPrivate: false
  })

  const handleUpload = async () => {
    setUploading(true)
    await onSave(formData)
    setUploading(false)
    setFormData({ name: "", type: "voucher", clientId: "", tripId: "", isPrivate: false })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Enviar Documento">
      <div className="space-y-4">
        <div 
          className="p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-[#5de0e6]/30 transition-colors text-center cursor-pointer"
          onClick={() => setFormData({ ...formData, name: "documento-upload.pdf" })}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-2" />
              <p className="text-sm text-white/60">Clique para selecionar</p>
              <p className="text-xs text-white/30 mt-1">PDF, PNG, JPG ate 10MB</p>
            </>
          )}
        </div>

        {formData.name && (
          <div className="p-3 rounded-xl bg-[#5de0e6]/10 border border-[#5de0e6]/30 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#5de0e6]" />
            <span className="text-sm text-white">{formData.name}</span>
          </div>
        )}

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Tipo</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="voucher" className="bg-[#0a0a0a]">Voucher</option>
            <option value="ticket" className="bg-[#0a0a0a]">Ingresso</option>
            <option value="passport" className="bg-[#0a0a0a]">Passaporte</option>
            <option value="visa" className="bg-[#0a0a0a]">Visto</option>
            <option value="insurance" className="bg-[#0a0a0a]">Seguro</option>
            <option value="other" className="bg-[#0a0a0a]">Outro</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Cliente</label>
          <select
            value={formData.clientId}
            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="" className="bg-[#0a0a0a]">Selecionar cliente</option>
            {clients.map(c => (
              <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Viagem</label>
          <select
            value={formData.tripId}
            onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="" className="bg-[#0a0a0a]">Selecionar viagem</option>
            {trips.map(t => (
              <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name} - {t.clientName}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isPrivate}
            onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#5de0e6] focus:ring-[#5de0e6]/50"
          />
          <span className="text-sm text-white/70">Documento privado (nao aparece no link compartilhavel)</span>
        </label>

        <Button 
          onClick={handleUpload} 
          disabled={!formData.name}
          className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50"
        >
          Enviar Documento
        </Button>
      </div>
    </Modal>
  )
}

// Generate Itinerary Modal
function GenerateItineraryModal({ open, onClose, clients, trips, onGenerate }: { 
  open: boolean
  onClose: () => void
  clients: Client[]
  trips: AgencyTrip[]
  onGenerate: () => void
}) {
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [formData, setFormData] = useState({
    clientId: "",
    tripId: "",
    destination: "",
    days: "5",
    style: "equilibrado",
    budget: "medio",
    preferences: ""
  })

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
      onGenerate()
    }, 3000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Gerar Roteiro com IA">
      <div className="space-y-4">
        {!generated ? (
          <>
            <div className="p-3 rounded-xl bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5de0e6]" />
              <p className="text-sm text-white/80">A IA criara um roteiro personalizado</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider">Cliente</label>
                <select
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                >
                  <option value="" className="bg-[#0a0a0a]">Selecionar</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider">Viagem</label>
                <select
                  value={formData.tripId}
                  onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                >
                  <option value="" className="bg-[#0a0a0a]">Selecionar</option>
                  {trips.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#0a0a0a]">{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider">Destino</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                placeholder="Ex: Paris, Franca"
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider">Dias</label>
                <select
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                >
                  {[1,2,3,4,5,6,7,10,14].map(d => (
                    <option key={d} value={d} className="bg-[#0a0a0a]">{d} dias</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider">Estilo</label>
                <select
                  value={formData.style}
                  onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                >
                  <option value="relaxado" className="bg-[#0a0a0a]">Relaxado</option>
                  <option value="equilibrado" className="bg-[#0a0a0a]">Equilibrado</option>
                  <option value="intenso" className="bg-[#0a0a0a]">Intenso</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/50 uppercase tracking-wider">Orcamento</label>
                <select
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none text-sm"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                >
                  <option value="baixo" className="bg-[#0a0a0a]">Economico</option>
                  <option value="medio" className="bg-[#0a0a0a]">Moderado</option>
                  <option value="alto" className="bg-[#0a0a0a]">Premium</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={generating || !formData.destination}
              className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50"
            >
              {generating ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Gerando roteiro...
                </div>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Roteiro Gerado!</h3>
            <p className="text-sm text-white/60 mb-4">O roteiro foi salvo na viagem selecionada</p>
            <Button onClick={onClose} variant="outline" className="border-white/10">
              Fechar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function AgencyDashboard() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const { clients, trips, credits, activities, conciergeRequests, addClient, addDocument, useCredits, isUsingRealData } = useAgency()
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [uploadDocOpen, setUploadDocOpen] = useState(false)
  const [generateItineraryOpen, setGenerateItineraryOpen] = useState(false)
  const [agencyName, setAgencyName] = useState(profile?.name || "Agencia")

  useEffect(() => {
    if (!user?.id) return

    let active = true

    const loadAgency = async () => {
      const result = await getAgencyByOwner(user.id)
      if (active && result.data?.name) {
        setAgencyName(result.data.name)
      }
    }

    void loadAgency()

    return () => {
      active = false
    }
  }, [user?.id])

  // Calculate stats from real data
  const upcomingTrips = trips.filter(t => t.status === "upcoming")
  const activeClients = clients.filter(c => c.status === "active")
  const pendingRequests = conciergeRequests.filter(r => r.status === "pending")

  const stats = [
    { label: "Viagens Ativas", value: trips.length.toString(), icon: Plane, trend: `${upcomingTrips.length} proximas`, color: "from-primary to-accent" },
    { label: "Clientes Ativos", value: activeClients.length.toString(), icon: Users, trend: "Todos ativos", color: "from-accent to-primary" },
    { label: "Concierge Ativos", value: pendingRequests.length.toString(), icon: MessageSquare, trend: "Aguardando", color: "from-primary/80 to-accent/80" },
    { label: "Creditos IA", value: credits.balance.toString(), icon: Sparkles, trend: `${credits.plan}`, color: "from-accent/80 to-primary/80" },
  ]

  const handleNewClient = async (data: Omit<Client, "id" | "createdAt">) => {
    await addClient(data)
  }

  const handleUploadDoc = async (data: { name: string; type: string; clientId?: string; tripId?: string; isPrivate: boolean }) => {
    const created = await addDocument({
      name: data.name,
      type: data.type as any,
      clientId: data.clientId,
      tripId: data.tripId,
      isPrivate: data.isPrivate
    })

    if (!created && isUsingRealData) {
      window.alert("Nenhum dado real ainda foi salvo nesta acao. Verifique o upload de arquivo da area de documentos da agencia.")
    }
  }

  const handleGenerateItinerary = () => {
    useCredits(10, "Roteiros IA", "Roteiro gerado com IA")
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  const formatActivityTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}d`
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "trip": return Plane
      case "client": return Users
      case "document": return FileText
      case "concierge": return MessageSquare
      case "credits": return Sparkles
      default: return Clock
    }
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-20 lg:pb-0"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Bom dia, {agencyName}</h1>
          <p className="mt-1 text-muted-foreground">
            Voce tem {upcomingTrips.length} viagens com embarque proximo
          </p>
        </div>
        <Link href="/agencia/viagens/criar">
          <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90">
            <Plane className="h-4 w-4" />
            Nova Viagem
          </Button>
        </Link>
      </motion.div>

      {/* Hero Stats Card */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-white/5 bg-gradient-to-br from-card via-card to-primary/5">
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-px bg-white/5 lg:grid-cols-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="relative bg-card p-4 lg:p-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.3 }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground lg:text-sm">{stat.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground lg:text-3xl">{stat.value}</p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-primary">
                        <TrendingUp className="h-3 w-3" />
                        {stat.trend}
                      </div>
                    </div>
                    <div className={`rounded-xl bg-gradient-to-br ${stat.color} p-2.5 opacity-80`}>
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${stat.color} opacity-5 blur-3xl`} />
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Proximos Embarques */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-white/5 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-primary" />
                Proximos Embarques
              </CardTitle>
              <Link href="/agencia/viagens">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Ver todos
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTrips.length === 0 ? (
                <div className="text-center py-8">
                  <Plane className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma viagem proxima</p>
                  <Link href="/agencia/viagens/criar">
                    <Button size="sm" variant="outline" className="mt-3 border-white/10">
                      Criar viagem
                    </Button>
                  </Link>
                </div>
              ) : (
                upcomingTrips.slice(0, 3).map((trip, index) => (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.5 }}
                    className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-primary/20 hover:bg-white/5 cursor-pointer"
                    onClick={() => window.open(`/viagem/${trip.slug}/admin`, "_blank")}
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={trip.coverImage} />
                        <AvatarFallback className="bg-primary/20 text-xs text-primary">
                          {trip.clientName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{trip.clientName}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {trip.destination}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDate(trip.startDate)}
                        </div>
                        <Badge
                          variant="outline"
                          className="mt-1 text-[10px] border-green-500/30 bg-green-500/10 text-green-400"
                        >
                          Proximo
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Atividade Recente */}
        <motion.div variants={itemVariants}>
          <Card className="border-white/5 bg-card/50">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activities.slice(0, 5).map((activity, index) => {
                const Icon = getActivityIcon(activity.type)
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 + 0.6 }}
                    className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                  >
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{activity.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatActivityTime(activity.timestamp)} atras</p>
                    </div>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants}>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Acoes Rapidas</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { icon: Plane, label: "Nova Viagem", action: () => router.push("/agencia/viagens/criar"), gradient: "from-primary to-accent" },
            { icon: Users, label: "Novo Cliente", action: () => setNewClientOpen(true), gradient: "from-accent to-primary" },
            { icon: FileText, label: "Upload Doc", action: () => setUploadDocOpen(true), gradient: "from-primary/80 to-accent/80" },
            { icon: Sparkles, label: "Gerar Roteiro", action: () => setGenerateItineraryOpen(true), gradient: "from-accent/80 to-primary/80" },
            { icon: MessageSquare, label: "Concierge", action: () => router.push("/agencia/concierge"), gradient: "from-primary to-accent" },
          ].map((action, index) => (
            <motion.div
              key={action.label}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-card/50 p-4 text-center transition-all hover:border-primary/20 hover:bg-white/5 cursor-pointer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 + 0.7 }}
              onClick={action.action}
            >
              <div className={`rounded-xl bg-gradient-to-br ${action.gradient} p-3 transition-transform group-hover:scale-110`}>
                <action.icon className="h-5 w-5 text-white" />
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                {action.label}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Concierge Preview */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden border-white/5 bg-gradient-to-br from-card via-card to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="rounded-2xl bg-gradient-to-br from-primary to-accent p-3">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  {pendingRequests.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white">
                      {pendingRequests.length}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Central Concierge</h3>
                  <p className="text-sm text-muted-foreground">
                    {pendingRequests.length > 0 
                      ? `${pendingRequests.length} solicitacoes aguardando resposta`
                      : "Nenhuma solicitacao pendente"
                    }
                  </p>
                </div>
              </div>
              <Link href="/agencia/concierge">
                <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
                  Abrir Central
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            {pendingRequests.length > 0 && (
              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2">
                {pendingRequests.slice(0, 3).map((req) => (
                  <div
                    key={req.id}
                    className="flex-shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-muted-foreground"
                  >
                    {req.question.slice(0, 30)}...
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Modals */}
      <NewClientModal 
        open={newClientOpen} 
        onClose={() => setNewClientOpen(false)} 
        onSave={handleNewClient} 
      />
      <UploadDocModal 
        open={uploadDocOpen} 
        onClose={() => setUploadDocOpen(false)} 
        clients={clients}
        trips={trips}
        onSave={handleUploadDoc} 
      />
      <GenerateItineraryModal 
        open={generateItineraryOpen} 
        onClose={() => setGenerateItineraryOpen(false)} 
        clients={clients}
        trips={trips}
        onGenerate={handleGenerateItinerary} 
      />
    </motion.div>
  )
}
