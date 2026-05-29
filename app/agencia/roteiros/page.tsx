"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Edit2,
  Trash2,
  Clock,
  MapPin,
  Calendar,
  ChevronRight,
  ChevronDown,
  Coffee,
  Utensils,
  Camera,
  Plane,
  Hotel,
  Car,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const itineraries = [
  {
    id: 1,
    destination: "Paris, Franca",
    client: "Maria Silva",
    avatar: "MS",
    days: 10,
    createdAt: "12 Jun",
    status: "active",
  },
  {
    id: 2,
    destination: "Toquio, Japao",
    client: "Joao Santos",
    avatar: "JS",
    days: 12,
    createdAt: "10 Jun",
    status: "active",
  },
  {
    id: 3,
    destination: "Nova York, EUA",
    client: "Ana Costa",
    avatar: "AC",
    days: 6,
    createdAt: "05 Jun",
    status: "draft",
  },
]

const templates = [
  { id: 1, name: "Lua de Mel Paris", days: 7, uses: 12 },
  { id: 2, name: "Familia Disney", days: 5, uses: 28 },
  { id: 3, name: "Aventura Japao", days: 14, uses: 8 },
  { id: 4, name: "Praias Maldivas", days: 7, uses: 15 },
]

const sampleDays = [
  {
    day: 1,
    date: "15 Jun",
    title: "Chegada em Paris",
    activities: [
      { time: "14:00", title: "Chegada no Aeroporto CDG", icon: Plane, type: "flight" },
      { time: "16:00", title: "Check-in Hotel Le Marais", icon: Hotel, type: "hotel" },
      { time: "19:00", title: "Jantar no Cafe de Flore", icon: Utensils, type: "food" },
    ],
  },
  {
    day: 2,
    date: "16 Jun",
    title: "Torre Eiffel e Museus",
    activities: [
      { time: "08:00", title: "Cafe da manha no hotel", icon: Coffee, type: "food" },
      { time: "10:00", title: "Visita a Torre Eiffel", icon: Camera, type: "activity" },
      { time: "14:00", title: "Almoco no Trocadero", icon: Utensils, type: "food" },
      { time: "16:00", title: "Museu do Louvre", icon: Camera, type: "activity" },
    ],
  },
  {
    day: 3,
    date: "17 Jun",
    title: "Versailles",
    activities: [
      { time: "09:00", title: "Transfer para Versailles", icon: Car, type: "transport" },
      { time: "10:30", title: "Palacio de Versailles", icon: Camera, type: "activity" },
      { time: "13:00", title: "Almoco nos jardins", icon: Utensils, type: "food" },
      { time: "17:00", title: "Retorno a Paris", icon: Car, type: "transport" },
    ],
  },
]

export default function ItinerariesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [selectedItinerary, setSelectedItinerary] = useState<number | null>(null)
  const [expandedDays, setExpandedDays] = useState<number[]>([1, 2])
  const [generating, setGenerating] = useState(false)

  const toggleDay = (day: number) => {
    setExpandedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleGenerate = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerateModalOpen(false)
    }, 3000)
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roteiros IA</h1>
          <p className="mt-1 text-muted-foreground">Gere e gerencie roteiros inteligentes</p>
        </div>
        <Button
          onClick={() => setGenerateModalOpen(true)}
          className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          Gerar Roteiro
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Itineraries List */}
        <div className="space-y-4 lg:col-span-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar roteiros..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
            />
          </div>

          {/* Itineraries */}
          <div className="space-y-2">
            {itineraries.map((itinerary) => (
              <Card
                key={itinerary.id}
                className={`cursor-pointer border-white/5 bg-card/50 transition-all hover:border-primary/20 ${
                  selectedItinerary === itinerary.id ? "border-primary/50 bg-primary/5" : ""
                }`}
                onClick={() => setSelectedItinerary(itinerary.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarFallback className="bg-primary/20 text-xs text-primary">
                          {itinerary.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">{itinerary.destination}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{itinerary.client}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        itinerary.status === "active"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {itinerary.status === "active" ? "Ativo" : "Rascunho"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {itinerary.days} dias
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {itinerary.createdAt}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Templates */}
          <div className="pt-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Templates Salvos</h3>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.days} dias - Usado {template.uses}x
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-primary">
                    Usar
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline View */}
        <Card className="border-white/5 bg-card/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Paris, Franca</CardTitle>
                <p className="text-xs text-muted-foreground">Maria Silva - 10 dias</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1 border-white/10">
                <Edit2 className="h-3 w-3" />
                Editar
              </Button>
              <Button variant="outline" size="sm" className="gap-1 border-white/10">
                <Copy className="h-3 w-3" />
                Duplicar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sampleDays.map((day) => (
              <div key={day.day} className="rounded-xl border border-white/5 bg-white/[0.02]">
                <button
                  onClick={() => toggleDay(day.day)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
                      {day.day}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{day.title}</p>
                      <p className="text-xs text-muted-foreground">{day.date}</p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      expandedDays.includes(day.day) ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence>
                  {expandedDays.includes(day.day) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 border-t border-white/5 p-4">
                        {day.activities.map((activity, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/5"
                          >
                            <div className="w-12 text-xs font-medium text-primary">{activity.time}</div>
                            <div className="rounded-lg bg-primary/10 p-1.5">
                              <activity.icon className="h-4 w-4 text-primary" />
                            </div>
                            <span className="text-sm text-foreground">{activity.title}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Gerar Roteiro com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Destino</Label>
              <Input placeholder="Ex: Paris, Franca" className="mt-1.5 border-white/10 bg-white/5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Duracao</Label>
                <Input placeholder="Ex: 7 dias" className="mt-1.5 border-white/10 bg-white/5" />
              </div>
              <div>
                <Label className="text-muted-foreground">Estilo</Label>
                <select className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground">
                  <option value="">Selecionar</option>
                  <option value="luxury">Luxo</option>
                  <option value="adventure">Aventura</option>
                  <option value="cultural">Cultural</option>
                  <option value="romantic">Romantico</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Cliente</Label>
              <select className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-foreground">
                <option value="">Selecionar cliente</option>
                <option value="1">Maria Silva</option>
                <option value="2">Joao Santos</option>
                <option value="3">Ana Costa</option>
              </select>
            </div>
            <div>
              <Label className="text-muted-foreground">Observacoes (opcional)</Label>
              <textarea
                placeholder="Ex: Incluir experiencias gastronomicas, evitar museus..."
                className="mt-1.5 min-h-[80px] w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm text-foreground">Custo estimado</span>
              </div>
              <span className="font-medium text-primary">15 creditos</span>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setGenerateModalOpen(false)}
                className="flex-1 border-white/10"
                disabled={generating}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Gerar Roteiro
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
