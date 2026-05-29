"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { MapPin, Calendar, Clock, ChevronRight, Plane } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Trip {
  id: string
  destination: string
  startDate: string
  endDate: string
  status: "active" | "upcoming" | "completed"
  daysUntil?: number
  coverImage: string
}

const statusConfig = {
  active: {
    label: "Em andamento",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    dot: "bg-green-500"
  },
  upcoming: {
    label: "Em preparação",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    dot: "bg-amber-500"
  },
  completed: {
    label: "Finalizada",
    color: "bg-secondary/20 text-secondary border-secondary/30",
    dot: "bg-secondary"
  }
}

export function TripHeroCard({ trip }: { trip: Trip }) {
  const status = statusConfig[trip.status]
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'short'
    })
  }

  return (
    <Link href={`/portal/viagem`}>
      <Card className="relative overflow-hidden bg-card/30 border-border/50 group cursor-pointer vuei-glass">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={trip.coverImage}
            alt={trip.destination}
            fill
            className="object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
        </div>

        {/* Content */}
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {/* Left Content */}
            <div className="space-y-4">
              {/* Status Badge */}
              <Badge className={`${status.color} border`}>
                <span className={`w-2 h-2 rounded-full ${status.dot} mr-2 animate-pulse`} />
                {status.label}
              </Badge>

              {/* Destination */}
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin size={14} />
                  <span className="text-sm">Próximo destino</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold vuei-gradient-text">
                  {trip.destination}
                </h2>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary" />
                  <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                </div>
              </div>
            </div>

            {/* Right Content - Countdown */}
            <div className="flex items-center gap-4">
              {trip.daysUntil !== undefined && trip.status === "upcoming" && (
                <motion.div 
                  className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50"
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Plane size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold vuei-gradient-text">{trip.daysUntil}</p>
                      <p className="text-xs text-muted-foreground">dias restantes</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {trip.status === "active" && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                  <Clock size={20} className="text-green-400" />
                  <div>
                    <p className="text-sm font-medium text-green-400">Viajando agora</p>
                    <p className="text-xs text-muted-foreground">Aproveite!</p>
                  </div>
                </div>
              )}

              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <ChevronRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
