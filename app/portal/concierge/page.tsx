"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Send, 
  Sparkles, 
  User,
  FileText,
  MapPin,
  Calendar,
  Building,
  Plane,
  Mic,
  Image as ImageIcon,
  MoreHorizontal
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Mock messages
const initialMessages = [
  {
    id: "1",
    role: "assistant" as const,
    content: "Olá! Sou seu concierge de viagem. Tenho acesso a todas as informações da sua viagem para Lisboa. Como posso ajudar?",
    timestamp: new Date(Date.now() - 60000 * 5)
  },
]

const quickSuggestions = [
  "Qual o endereço do meu hotel?",
  "Me mostra meu passaporte",
  "Qual o horário do meu voo?",
  "O que fazer no dia 3?",
]

// Simulated AI responses based on keywords
const getAIResponse = (message: string): { content: string; attachment?: { type: string; title: string; description: string } } => {
  const lowerMessage = message.toLowerCase()
  
  if (lowerMessage.includes("hotel") || lowerMessage.includes("hospedagem")) {
    return {
      content: "Você está hospedado no **Hotel Lisboa Central**, localizado em uma área privilegiada da cidade.",
      attachment: {
        type: "hotel",
        title: "Hotel Lisboa Central",
        description: "Rua Augusta 123, Baixa • Check-in: 15 Jun 16h • Check-out: 25 Jun 12h"
      }
    }
  }
  
  if (lowerMessage.includes("passaporte") || lowerMessage.includes("documento")) {
    return {
      content: "Aqui está seu passaporte. Ele está válido até 2028 e você pode acessá-lo offline a qualquer momento.",
      attachment: {
        type: "document",
        title: "Passaporte",
        description: "Válido até 15/05/2028 • Documento privado protegido"
      }
    }
  }
  
  if (lowerMessage.includes("voo") || lowerMessage.includes("passagem")) {
    return {
      content: "Seu voo de ida está confirmado! Aqui estão os detalhes:",
      attachment: {
        type: "flight",
        title: "TAP Portugal TP1234",
        description: "15 Jun • GRU → LIS • Decolagem 22:30 • Chegada 11:45+1"
      }
    }
  }
  
  if (lowerMessage.includes("dia 3") || lowerMessage.includes("sintra")) {
    return {
      content: "No dia 3 (17 de junho) você visitará Sintra! O dia está planejado assim:\n\n• 08:00 - Saída para Sintra\n• 10:00 - Palácio da Pena\n• 14:00 - Almoço\n• 16:00 - Quinta da Regaleira\n• 19:00 - Retorno a Lisboa",
      attachment: {
        type: "itinerary",
        title: "Dia 3 - Sintra",
        description: "4 atividades planejadas • Principais atrações: Palácio da Pena, Quinta da Regaleira"
      }
    }
  }
  
  return {
    content: "Entendi sua pergunta. Deixe-me verificar as informações da sua viagem para Lisboa e te responder da melhor forma possível."
  }
}

const attachmentIcons = {
  hotel: Building,
  document: FileText,
  flight: Plane,
  itinerary: Calendar,
  location: MapPin
}

export default function ConciergePage() {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (text?: string) => {
    const messageText = text || input
    if (!messageText.trim()) return

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: messageText,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate AI response delay
    setTimeout(() => {
      const response = getAIResponse(messageText)
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant" as const,
        content: response.content,
        attachment: response.attachment,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiMessage])
      setIsTyping(false)
    }, 1200)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] max-w-3xl mx-auto">
      {/* Header */}
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
          <p className="text-sm text-muted-foreground">Seu assistente de viagem pessoal</p>
        </div>
        <Badge className="bg-green-500/20 text-green-400 border-0">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          Online
        </Badge>
      </motion.div>

      {/* Messages Container */}
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
              {/* Avatar */}
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

              {/* Message Content */}
              <div className={`max-w-[80%] space-y-2 ${message.role === "user" ? "items-end" : ""}`}>
                <div className={`p-4 rounded-2xl ${
                  message.role === "assistant"
                    ? "bg-muted/30 border border-border/50 rounded-tl-none"
                    : "bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-tr-none"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Attachment Card */}
                {"attachment" in message && message.attachment && (
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

                {/* Timestamp */}
                <p className={`text-[10px] text-muted-foreground ${message.role === "user" ? "text-right" : ""}`}>
                  {message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing Indicator */}
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

      {/* Quick Suggestions */}
      {messages.length <= 2 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-wrap gap-2 py-4"
        >
          {quickSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="rounded-full border-border/50 text-xs hover:border-primary/50 hover:bg-primary/5"
              onClick={() => handleSend(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </motion.div>
      )}

      {/* Input Area */}
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
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Pergunte sobre sua viagem..."
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="icon" className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground">
            <Mic size={20} />
          </Button>
          <Button
            size="icon"
            className="shrink-0 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-foreground"
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
          >
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Cada pergunta consome 1 crédito • 150 créditos restantes
        </p>
      </motion.div>
    </div>
  )
}
