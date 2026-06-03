"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  Sparkles,
  User,
  FileText,
  Calendar,
  Building,
  Plane,
  Mic,
  Image as ImageIcon,
  MessageSquare,
  MapPin,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTrips } from "@/contexts/trips-context"
import { useAuth } from "@/contexts/auth-context"
import { createConversation, addMessage, listConversationsByTrip, listMessages } from "@/lib/repositories/ai-repository"
import { shouldUseSupabase } from "@/lib/data-source"

type UiMessage = {
  id: string
  role: "assistant" | "user"
  content: string
  timestamp: Date
  attachment?: { type: string; title: string; description: string }
}

const quickSuggestions = [
  "Qual o endereco da minha hospedagem?",
  "Me mostra meus documentos",
  "Qual o horario da minha passagem?",
  "O que tenho planejado no roteiro?",
]

const attachmentIcons = {
  hotel: Building,
  document: FileText,
  flight: Plane,
  itinerary: Calendar,
  location: MapPin,
}

function buildInitialAssistantMessage(destination: string): UiMessage {
  return {
    id: "assistant-initial",
    role: "assistant",
    content: `Ola! Sou seu concierge da viagem para ${destination}. Posso responder com base nos dados reais ja adicionados no Vuei.`,
    timestamp: new Date(),
  }
}

function buildTripAwareResponse(
  userMessage: string,
  trip: ReturnType<typeof useTrips>["activeTrip"],
) {
  const normalizedMessage = userMessage.toLowerCase()
  const destination = trip?.destination || "sua viagem"

  if (normalizedMessage.includes("hosped") || normalizedMessage.includes("hotel")) {
    return {
      content: "As hospedagens reais ficam disponiveis no link da viagem. Se ainda nao aparecer nada, nenhuma hospedagem real foi adicionada.",
      attachment: {
        type: "hotel",
        title: `Hospedagem em ${destination}`,
        description: "Consulte a secao de hospedagem da viagem para ver os dados reais.",
      },
    }
  }

  if (normalizedMessage.includes("document")) {
    return {
      content: "Se houver documentos reais anexados a esta viagem, eles aparecem nas secoes protegidas do link e no portal.",
      attachment: {
        type: "document",
        title: "Documentos da viagem",
        description: "Nenhum documento fake e exibido. So aparecem anexos reais.",
      },
    }
  }

  if (normalizedMessage.includes("passag") || normalizedMessage.includes("voo")) {
    return {
      content: "As passagens reais anexadas ficam disponiveis no link da viagem. Se a secao estiver vazia, ainda nao ha passagem real cadastrada.",
      attachment: {
        type: "flight",
        title: "Passagens da viagem",
        description: "Arquivos anexados reais ficam disponiveis no historico da viagem.",
      },
    }
  }

  if (normalizedMessage.includes("roteiro") || normalizedMessage.includes("itiner")) {
    return {
      content: "Seu roteiro real continua disponivel no link inteligente da viagem. Se estiver vazio, ainda nao foi criado nenhum roteiro.",
      attachment: {
        type: "itinerary",
        title: "Roteiro da viagem",
        description: "O concierge nao inventa atividades quando nao ha roteiro real salvo.",
      },
    }
  }

  return {
    content: `Entendi. Vou considerar apenas os dados reais disponiveis hoje para ${destination} ao continuar te ajudando por aqui.`,
  }
}

export default function ConciergePage() {
  const { trips, activeTrip } = useTrips()
  const { user, profile } = useAuth()
  const selectedTrip = activeTrip ?? trips[0] ?? null
  const [messages, setMessages] = useState<UiMessage[]>(() =>
    selectedTrip ? [buildInitialAssistantMessage(selectedTrip.destination)] : []
  )
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const tripLabel = useMemo(() => selectedTrip?.destination || "sua viagem", [selectedTrip?.destination])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!selectedTrip) {
      setMessages([])
      setConversationId(null)
      return
    }

    setMessages([buildInitialAssistantMessage(selectedTrip.destination)])
    setConversationId(null)
    setError(null)
  }, [selectedTrip?.id, selectedTrip?.destination])

  useEffect(() => {
    if (!selectedTrip?.id || !shouldUseSupabase()) return

    let active = true

    const loadConversation = async () => {
      const conversationsResult = await listConversationsByTrip(selectedTrip.id)
      if (!active) return

      const conciergeConversation =
        (conversationsResult.data ?? []).find((conversation) => conversation.channel === "concierge") ?? null

      if (!conciergeConversation) return

      const messagesResult = await listMessages(conciergeConversation.id)
      if (!active) return

      if (conversationsResult.error) {
        setError(conversationsResult.error)
      } else if (messagesResult.error) {
        setError(messagesResult.error)
      } else {
        setError(null)
      }

      setConversationId(conciergeConversation.id)

      if ((messagesResult.data ?? []).length === 0) return

      setMessages(
        messagesResult.data.map((message) => ({
          id: message.id,
          role: message.role === "user" ? "user" : "assistant",
          content: message.content,
          timestamp: new Date(message.createdAt),
        }))
      )
    }

    void loadConversation()

    return () => {
      active = false
    }
  }, [selectedTrip?.id])

  const handleSend = async (text?: string) => {
    if (!selectedTrip || !user?.id) return

    const messageText = text || input
    if (!messageText.trim()) return

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)
    setError(null)

    const response = buildTripAwareResponse(messageText, selectedTrip)

    let nextConversationId = conversationId

    if (shouldUseSupabase()) {
      if (!nextConversationId) {
        const conversationResult = await createConversation({
          tripId: selectedTrip.id,
          userId: user.id,
          agencyId: profile?.agencyId ?? null,
          clientId: null,
          channel: "concierge",
          metadata: {
            origin: "traveler-portal",
          },
        })

        if (!conversationResult.data) {
          setError(conversationResult.error ?? "Nao foi possivel iniciar a conversa real do concierge.")
          setIsTyping(false)
          return
        }

        nextConversationId = conversationResult.data.id
        setConversationId(conversationResult.data.id)
      }

      const [userMessageResult, assistantMessageResult] = await Promise.all([
        addMessage({
          conversationId: nextConversationId,
          tripId: selectedTrip.id,
          userId: user.id,
          agencyId: profile?.agencyId ?? null,
          clientId: null,
          role: "user",
          content: messageText,
          metadata: {
            origin: "traveler-portal",
          },
        }),
        addMessage({
          conversationId: nextConversationId,
          tripId: selectedTrip.id,
          userId: user.id,
          agencyId: profile?.agencyId ?? null,
          clientId: null,
          role: "assistant",
          content: response.content,
          metadata: {
            origin: "traveler-portal",
          },
        }),
      ])

      if (!userMessageResult.data || !assistantMessageResult.data) {
        console.error("[CONCIERGE] sync error", userMessageResult.error || assistantMessageResult.error)
        setError(userMessageResult.error || assistantMessageResult.error || "Nao foi possivel sincronizar o concierge real.")
        setIsTyping(false)
        return
      }
    }

    window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.content,
          attachment: response.attachment,
          timestamp: new Date(),
        },
      ])
      setIsTyping(false)
    }, 600)
  }

  if (!selectedTrip) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Concierge da viagem</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Crie uma viagem real primeiro para iniciar um historico real do concierge.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 pb-4 border-b border-border/50 mb-4"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles size={24} className="text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Concierge IA</h1>
          <p className="text-sm text-muted-foreground">Historico real da viagem para {tripLabel}</p>
        </div>
        <Badge className="bg-green-500/20 text-green-400 border-0">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          Online
        </Badge>
      </motion.div>

      {error ? (
        <Card className="mb-4 border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : null}

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${
                message.role === "assistant"
                  ? "bg-gradient-to-br from-primary to-secondary"
                  : "bg-muted"
              }`}>
                {message.role === "assistant"
                  ? <Sparkles size={16} className="text-primary-foreground" />
                  : <User size={16} className="text-muted-foreground" />
                }
              </div>

              <div className={`max-w-[80%] space-y-2 ${message.role === "user" ? "items-end" : ""}`}>
                <div className={`p-4 rounded-2xl ${
                  message.role === "assistant"
                    ? "bg-muted/30 border border-border/50 rounded-tl-none"
                    : "bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-tr-none"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {message.attachment && (
                  <Card className="p-3 bg-card/50 border-border/50 vuei-glass">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        {(() => {
                          const IconComponent = attachmentIcons[message.attachment.type as keyof typeof attachmentIcons] || FileText
                          return <IconComponent size={18} className="text-primary" />
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{message.attachment.title}</h4>
                        <p className="text-xs text-muted-foreground">{message.attachment.description}</p>
                      </div>
                    </div>
                  </Card>
                )}

                <p className={`text-[10px] text-muted-foreground ${message.role === "user" ? "text-right" : ""}`}>
                  {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles size={16} className="text-primary-foreground" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-muted/30 border border-border/50">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 py-4">
          {quickSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="rounded-full border-border/50 text-xs hover:border-primary/50 hover:bg-primary/5"
              onClick={() => void handleSend(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-4 border-t border-border/50 mt-auto"
      >
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/30 border border-border/50 vuei-glass">
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground">
            <ImageIcon size={20} />
          </Button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder="Pergunte sobre sua viagem..."
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground">
            <Mic size={20} />
          </Button>
          <Button
            size="icon"
            className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isTyping}
          >
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          O historico fica vinculado a viagem real selecionada no seu portal.
        </p>
      </motion.div>
    </div>
  )
}
