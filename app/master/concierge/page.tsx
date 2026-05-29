"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  MessageSquare,
  Search,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Clock,
  Bot,
  ArrowUpRight,
  Building2,
  Plane,
  CheckCircle2,
  RefreshCw
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  in_progress: { label: "Em andamento", color: "bg-primary/10 text-primary", dot: "bg-primary" },
  resolved: { label: "Resolvido", color: "bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-400" },
}

const priorityConfig = {
  low: { label: "Baixa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-yellow-400" },
  high: { label: "Alta", color: "text-red-400" },
}

export default function MasterConciergePage() {
  const { conciergeRequests, updateConciergeStatus, trips } = useMaster()
  
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedRequest, setSelectedRequest] = useState(conciergeRequests[0] || null)

  const filteredRequests = conciergeRequests.filter(req => {
    const matchesSearch = req.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.tripName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || req.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const pageStats = [
    { label: "Pendentes", value: conciergeRequests.filter(r => r.status === "pending").length.toString(), change: "aguardando", icon: AlertTriangle },
    { label: "Em andamento", value: conciergeRequests.filter(r => r.status === "in_progress").length.toString(), change: "ativos", icon: MessageSquare },
    { label: "Resolvidos", value: conciergeRequests.filter(r => r.status === "resolved").length.toString(), change: "este mes", icon: CheckCircle2 },
    { label: "Tempo Medio", value: "1.2s", change: "resposta IA", icon: Clock },
  ]

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  const handleStatusChange = (requestId: string, newStatus: "pending" | "in_progress" | "resolved") => {
    updateConciergeStatus(requestId, newStatus)
    if (selectedRequest?.id === requestId) {
      setSelectedRequest({ ...selectedRequest, status: newStatus })
    }
  }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Concierge</h1>
          <p className="text-sm text-muted-foreground">Central de monitoramento do concierge IA</p>
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
                <div className="text-xs text-muted-foreground">{stat.change}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requests List */}
        <motion.div variants={fadeInUp} className="lg:col-span-1">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden h-[600px] flex flex-col">
            <div className="p-4 border-b border-white/5 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar solicitacoes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-black/40 border-white/10">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/10">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="resolved">Resolvidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredRequests.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Nenhuma solicitacao encontrada</p>
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const status = statusConfig[request.status]
                  const priority = priorityConfig[request.priority]
                  return (
                    <button
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={`w-full p-4 border-b border-white/5 text-left transition-all duration-300 ${
                        selectedRequest?.id === request.id
                          ? "bg-gradient-to-r from-primary/10 to-transparent"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                            {request.userName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{request.userName}</span>
                            <span className="text-xs text-muted-foreground">{formatTimeAgo(request.createdAt)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-1">{request.tripName}</div>
                          <div className="text-xs text-muted-foreground truncate">{request.message}</div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}`}>
                              {status.label}
                            </div>
                            <span className={`text-[10px] font-medium ${priority.color}`}>
                              {priority.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </Card>
        </motion.div>

        {/* Request Detail */}
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl h-[600px] flex flex-col">
            {selectedRequest ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                        {selectedRequest.userName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-foreground">{selectedRequest.userName}</div>
                      <div className="text-xs text-muted-foreground">{selectedRequest.tripName}</div>
                    </div>
                  </div>
                  <Link href={`/master/viagens?id=${selectedRequest.tripId}`}>
                    <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Abrir Viagem
                    </Button>
                  </Link>
                </div>

                {/* Info */}
                <div className="p-4 border-b border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Status</div>
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[selectedRequest.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[selectedRequest.status].dot}`} />
                      {statusConfig[selectedRequest.status].label}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Prioridade</div>
                    <span className={`text-sm font-medium ${priorityConfig[selectedRequest.priority].color}`}>
                      {priorityConfig[selectedRequest.priority].label}
                    </span>
                  </div>
                  {selectedRequest.agencyName && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Agencia</div>
                      <div className="flex items-center gap-1 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        {selectedRequest.agencyName}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Criado em</div>
                    <span className="text-sm">
                      {new Date(selectedRequest.createdAt).toLocaleDateString("pt-BR", { 
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" 
                      })}
                    </span>
                  </div>
                </div>

                {/* Message */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary/20 border border-primary/20 rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-sm text-foreground">{selectedRequest.message}</p>
                      <span className="text-[10px] text-muted-foreground mt-1 block text-right">
                        {new Date(selectedRequest.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-sm text-foreground">
                          Ola! Estou analisando sua solicitacao e ja vou te ajudar com isso. Por favor, aguarde um momento enquanto processo as informacoes.
                        </p>
                        <span className="text-[10px] text-muted-foreground mt-2 block">Resposta automatica</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    {selectedRequest.status === "pending" && (
                      <Button 
                        onClick={() => handleStatusChange(selectedRequest.id, "in_progress")}
                        className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Iniciar Atendimento
                      </Button>
                    )}
                    {selectedRequest.status === "in_progress" && (
                      <Button 
                        onClick={() => handleStatusChange(selectedRequest.id, "resolved")}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Marcar como Resolvido
                      </Button>
                    )}
                    {selectedRequest.status === "resolved" && (
                      <Button 
                        onClick={() => handleStatusChange(selectedRequest.id, "pending")}
                        variant="outline"
                        className="flex-1 border-white/10"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reabrir Solicitacao
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma solicitacao para ver os detalhes</p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
