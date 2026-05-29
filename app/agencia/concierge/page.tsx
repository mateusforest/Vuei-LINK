"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Send,
  Paperclip,
  MoreHorizontal,
  MapPin,
  CheckCheck,
  FileText,
  Sparkles,
  Phone,
  Video,
  MessageSquare,
  Check,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAgency, type ConciergeRequest } from "@/contexts/agency-context"

interface Message {
  id: string
  type: "client" | "agent"
  text: string
  time: string
  attachment?: { type: string; name: string; size: string }
}

const quickReplies = [
  "Verificando...",
  "Segue o voucher",
  "Check-in as 15h",
  "Transferir iniciado",
]

export default function ConciergePage() {
  const { conciergeRequests, respondToRequest, resolveRequest, trips } = useAgency()
  const [selectedRequest, setSelectedRequest] = useState<ConciergeRequest | null>(
    conciergeRequests.length > 0 ? conciergeRequests[0] : null
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [localMessages, setLocalMessages] = useState<Record<string, Message[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [localMessages, selectedRequest])

  const filteredRequests = conciergeRequests.filter(
    (req) =>
      req.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.question.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getMessagesForRequest = (requestId: string): Message[] => {
    const request = conciergeRequests.find(r => r.id === requestId)
    if (!request) return []

    const baseMessages: Message[] = [
      {
        id: `${requestId}-1`,
        type: "client",
        text: request.question,
        time: new Date(request.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }
    ]

    if (request.response) {
      baseMessages.push({
        id: `${requestId}-2`,
        type: "agent",
        text: request.response,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      })
    }

    const additionalMessages = localMessages[requestId] || []
    return [...baseMessages, ...additionalMessages]
  }

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedRequest) return
    
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      type: "agent",
      text: messageInput,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    }
    
    setLocalMessages(prev => ({
      ...prev,
      [selectedRequest.id]: [...(prev[selectedRequest.id] || []), newMessage]
    }))

    // If first response, update the request status
    if (selectedRequest.status === "pending") {
      respondToRequest(selectedRequest.id, messageInput)
    }
    
    setMessageInput("")
  }

  const handleResolve = () => {
    if (selectedRequest) {
      resolveRequest(selectedRequest.id)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  if (conciergeRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Central Concierge</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Nenhuma solicitacao no momento. As perguntas dos seus clientes aparecerao aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 pb-20 lg:pb-0">
      {/* Conversations List */}
      <div className="hidden w-80 flex-shrink-0 flex-col lg:flex">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {filteredRequests.map((request) => (
            <motion.div
              key={request.id}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-all",
                selectedRequest?.id === request.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-white/5 bg-card/50 hover:border-white/10 hover:bg-card/80"
              )}
              onClick={() => setSelectedRequest(request)}
              whileHover={{ x: 2 }}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar className="h-10 w-10 border border-white/10">
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">
                      {request.clientName.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                      request.status === "pending"
                        ? "bg-yellow-500"
                        : request.status === "answered"
                          ? "bg-green-500"
                          : "bg-gray-500"
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{request.clientName}</p>
                    <span className="text-xs text-muted-foreground">{formatTime(request.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {request.destination}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{request.question}</p>
                </div>
                {request.status === "pending" && (
                  <Badge className="bg-yellow-500 text-[10px] text-white">Novo</Badge>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <Card className="flex flex-1 flex-col overflow-hidden border-white/5 bg-card/50">
        {selectedRequest ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {selectedRequest.clientName.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedRequest.clientName}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {selectedRequest.destination}
                    <Badge variant="outline" className={`text-[10px] ${
                      selectedRequest.status === "pending" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                      selectedRequest.status === "answered" ? "border-green-500/30 bg-green-500/10 text-green-400" :
                      "border-gray-500/30 bg-gray-500/10 text-gray-400"
                    }`}>
                      {selectedRequest.status === "pending" ? "Pendente" : selectedRequest.status === "answered" ? "Respondido" : "Resolvido"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedRequest.status === "answered" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleResolve}
                    className="border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Marcar Resolvido
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto max-w-2xl space-y-4">
                {getMessagesForRequest(selectedRequest.id).map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex",
                      message.type === "agent" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5",
                        message.type === "agent"
                          ? "bg-gradient-to-r from-primary to-accent text-white"
                          : "bg-white/10 text-foreground"
                      )}
                    >
                      <p className="text-sm">{message.text}</p>
                      {message.attachment && (
                        <div
                          className={cn(
                            "mt-2 flex items-center gap-2 rounded-lg p-2",
                            message.type === "agent" ? "bg-white/20" : "bg-white/5"
                          )}
                        >
                          <FileText className="h-4 w-4" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{message.attachment.name}</p>
                            <p className="text-[10px] opacity-70">{message.attachment.size}</p>
                          </div>
                        </div>
                      )}
                      <div
                        className={cn(
                          "mt-1 flex items-center justify-end gap-1 text-[10px]",
                          message.type === "agent" ? "text-white/70" : "text-muted-foreground"
                        )}
                      >
                        {message.time}
                        {message.type === "agent" && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Quick Replies */}
            <div className="flex gap-2 overflow-x-auto border-t border-white/5 px-4 py-2">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageInput(reply)}
                  className="flex-shrink-0 border-white/10 text-xs hover:bg-white/5"
                >
                  {reply}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 gap-1 border-primary/30 bg-primary/10 text-xs text-primary hover:bg-primary/20"
              >
                <Sparkles className="h-3 w-3" />
                Sugerir IA
              </Button>
            </div>

            {/* Input */}
            <div className="border-t border-white/5 p-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  className="h-10 flex-1 rounded-xl border border-white/5 bg-white/5 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="h-10 w-10 bg-gradient-to-r from-primary to-accent p-0 text-white hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">Selecione uma conversa</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
