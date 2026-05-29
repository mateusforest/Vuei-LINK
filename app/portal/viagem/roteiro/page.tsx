"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { 
  ChevronLeft, 
  MapPin, 
  Clock, 
  Utensils,
  Camera,
  Coffee,
  Building,
  Plane,
  ChevronDown,
  ChevronUp,
  Star,
  Navigation
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

// Mock itinerary data
const itinerary = [
  {
    day: 1,
    date: "15 Jun",
    title: "Chegada em Lisboa",
    activities: [
      { time: "14:00", title: "Chegada no Aeroporto", icon: Plane, type: "transport", notes: "Voo TAP TP1234" },
      { time: "16:00", title: "Check-in Hotel Lisboa Central", icon: Building, type: "hotel", notes: "Quarto 502, Vista cidade" },
      { time: "20:00", title: "Jantar no Bairro Alto", icon: Utensils, type: "food", notes: "Restaurante tradicional", highlight: true },
    ]
  },
  {
    day: 2,
    date: "16 Jun",
    title: "Centro Histórico",
    activities: [
      { time: "09:00", title: "Café da manhã no hotel", icon: Coffee, type: "food" },
      { time: "10:30", title: "Torre de Belém", icon: Camera, type: "visit", notes: "Ingressos reservados", highlight: true },
      { time: "13:00", title: "Pastéis de Belém", icon: Utensils, type: "food", notes: "A famosa pastelaria!" },
      { time: "15:00", title: "Mosteiro dos Jerónimos", icon: Camera, type: "visit", highlight: true },
      { time: "19:00", title: "Jantar em Alfama", icon: Utensils, type: "food" },
    ]
  },
  {
    day: 3,
    date: "17 Jun",
    title: "Sintra",
    activities: [
      { time: "08:00", title: "Saída para Sintra", icon: Navigation, type: "transport", notes: "40 min de carro" },
      { time: "10:00", title: "Palácio da Pena", icon: Camera, type: "visit", notes: "UNESCO", highlight: true },
      { time: "14:00", title: "Almoço em Sintra", icon: Utensils, type: "food" },
      { time: "16:00", title: "Quinta da Regaleira", icon: Camera, type: "visit", highlight: true },
      { time: "19:00", title: "Retorno a Lisboa", icon: Navigation, type: "transport" },
    ]
  },
  {
    day: 4,
    date: "18 Jun",
    title: "Cascais e Estoril",
    activities: [
      { time: "09:00", title: "Trem para Cascais", icon: Navigation, type: "transport" },
      { time: "10:30", title: "Praia de Cascais", icon: Camera, type: "visit" },
      { time: "13:00", title: "Almoço frutos do mar", icon: Utensils, type: "food", highlight: true },
      { time: "15:00", title: "Casino Estoril", icon: Building, type: "visit" },
      { time: "18:00", title: "Retorno a Lisboa", icon: Navigation, type: "transport" },
    ]
  },
  {
    day: 5,
    date: "19 Jun",
    title: "Museus e Cultura",
    activities: [
      { time: "10:00", title: "Museu do Azulejo", icon: Camera, type: "visit", highlight: true },
      { time: "13:00", title: "Almoço típico", icon: Utensils, type: "food" },
      { time: "15:00", title: "Oceanário", icon: Camera, type: "visit" },
      { time: "20:00", title: "Show de Fado", icon: Star, type: "experience", notes: "Reserva confirmada", highlight: true },
    ]
  },
]

const typeColors = {
  transport: "from-secondary/20 to-secondary/5",
  hotel: "from-amber-500/20 to-amber-500/5",
  food: "from-orange-500/20 to-orange-500/5",
  visit: "from-primary/20 to-primary/5",
  experience: "from-purple-500/20 to-purple-500/5",
}

export default function RoteiroPage() {
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2])

  const toggleDay = (day: number) => {
    setExpandedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    )
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex items-center gap-4">
        <Link href="/portal/viagem">
          <Button variant="ghost" size="icon" className="rounded-xl">
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Roteiro</h1>
          <p className="text-sm text-muted-foreground">Lisboa, Portugal • 10 dias</p>
        </div>
      </motion.div>

      {/* Timeline */}
      <div className="space-y-4">
        {itinerary.map((dayData, dayIndex) => {
          const isExpanded = expandedDays.includes(dayData.day)
          
          return (
            <motion.div
              key={dayData.day}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: dayIndex * 0.05 }}
            >
              <Card className="bg-card/50 border-border/50 vuei-glass overflow-hidden">
                {/* Day Header */}
                <button
                  onClick={() => toggleDay(dayData.day)}
                  className="w-full p-4 md:p-5 flex items-center justify-between hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground">Dia</span>
                      <span className="text-xl font-bold vuei-gradient-text">{dayData.day}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-muted-foreground">{dayData.date}</p>
                      <h3 className="font-semibold">{dayData.title}</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-muted/50 hidden md:flex">
                      {dayData.activities.length} atividades
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-muted-foreground" />
                    ) : (
                      <ChevronDown size={20} className="text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Activities */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 md:px-5 pb-4 md:pb-5 space-y-3">
                        <div className="h-px bg-border/50" />
                        {dayData.activities.map((activity, actIndex) => {
                          const colorClass = typeColors[activity.type as keyof typeof typeColors] || typeColors.visit
                          
                          return (
                            <div
                              key={actIndex}
                              className={`flex gap-4 p-3 rounded-xl bg-gradient-to-r ${colorClass} border border-border/30 ${activity.highlight ? 'ring-1 ring-primary/30' : ''}`}
                            >
                              {/* Time */}
                              <div className="shrink-0 w-14 text-center">
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Clock size={12} />
                                  <span className="text-sm font-medium">{activity.time}</span>
                                </div>
                              </div>

                              {/* Icon */}
                              <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center shrink-0">
                                <activity.icon size={18} className="text-primary" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium truncate">{activity.title}</h4>
                                  {activity.highlight && (
                                    <Star size={14} className="text-amber-400 shrink-0" />
                                  )}
                                </div>
                                {activity.notes && (
                                  <p className="text-sm text-muted-foreground truncate">
                                    {activity.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Load More */}
      <motion.div variants={fadeInUp} className="text-center py-4">
        <Button variant="outline" className="rounded-xl border-border/50">
          Ver mais 5 dias
        </Button>
      </motion.div>
    </motion.div>
  )
}
