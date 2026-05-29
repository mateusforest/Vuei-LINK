"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sparkles, 
  MapPin, 
  Calendar, 
  Users, 
  DollarSign,
  Clock,
  Plus,
  Wand2,
  FileText,
  Copy,
  Download,
  Edit3,
  Trash2,
  Star,
  Heart,
  Utensils,
  Camera,
  Globe,
  Sun,
  Hotel,
  Coffee,
  ShoppingBag,
  Music,
  Moon,
  Loader2,
  Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAgency } from "@/contexts/agency-context"

const ITINERARIES_STORAGE_KEY = "vuei_agencia_roteiros_ia"

const travelStyles = [
  { id: "romantic", label: "Romantico", icon: Heart },
  { id: "adventure", label: "Aventura", icon: Globe },
  { id: "cultural", label: "Cultural", icon: Camera },
  { id: "gastronomic", label: "Gastronomico", icon: Utensils },
  { id: "relaxation", label: "Relaxamento", icon: Sun },
  { id: "family", label: "Familia", icon: Users },
  { id: "luxury", label: "Luxo", icon: Star },
  { id: "budget", label: "Economico", icon: DollarSign }
]

export default function RoteirosIAPage() {
  const { credits, useCredits } = useAgency()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedItinerary, setGeneratedItinerary] = useState<any>(null)
  const [selectedStyles, setSelectedStyles] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [savedItineraries, setSavedItineraries] = useState<any[]>([])
  const [formData, setFormData] = useState({
    destination: "",
    duration: "",
    travelers: "",
    budget: "",
    preferences: ""
  })
  const safeItineraries = savedItineraries ?? []

  useEffect(() => {
    if (typeof window === "undefined") return

    const stored = window.localStorage.getItem(ITINERARIES_STORAGE_KEY)
    if (!stored) return

    try {
      const parsed = JSON.parse(stored)
      setSavedItineraries(Array.isArray(parsed) ? parsed : [])
    } catch {
      setSavedItineraries([])
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(ITINERARIES_STORAGE_KEY, JSON.stringify(safeItineraries))
  }, [safeItineraries])

  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    )
  }

  const handleGenerate = async () => {
    if (credits.balance < 5) {
      alert("Creditos insuficientes. Compre mais creditos para continuar.")
      return
    }
    
    setIsGenerating(true)
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    const newItinerary = {
      title: `${formData.destination} - ${formData.duration} dias`,
      destination: formData.destination,
      duration: formData.duration,
      travelers: formData.travelers,
      style: selectedStyles.map(s => travelStyles.find(t => t.id === s)?.label).join(", ") || "Misto",
      days: [
        {
          day: 1,
          title: "Chegada e Primeiro Contato",
          activities: [
            { time: "14:00", title: "Check-in no hotel", icon: "Hotel", description: "Acomodacao no centro historico" },
            { time: "16:00", title: "Passeio de reconhecimento", icon: "MapPin", description: "Caminhada pelo bairro" },
            { time: "19:00", title: "Jantar de boas-vindas", icon: "Utensils", description: "Restaurante tipico local" }
          ]
        },
        {
          day: 2,
          title: "Exploracao Cultural",
          activities: [
            { time: "09:00", title: "Cafe da manha local", icon: "Coffee", description: "Experiencia gastronomica" },
            { time: "10:30", title: "Visita ao museu principal", icon: "Camera", description: "Tour guiado de 2h" },
            { time: "13:00", title: "Almoco em praca historica", icon: "Utensils", description: "Culinaria regional" },
            { time: "15:00", title: "Tour a pe pelo centro", icon: "MapPin", description: "Principais pontos turisticos" },
            { time: "20:00", title: "Show cultural", icon: "Music", description: "Apresentacao tipica" }
          ]
        },
        {
          day: 3,
          title: "Aventura e Natureza",
          activities: [
            { time: "07:00", title: "Nascer do sol especial", icon: "Sun", description: "Mirante panoramico" },
            { time: "09:00", title: "Trilha ecologica", icon: "Globe", description: "Caminhada de 3h" },
            { time: "13:00", title: "Piquenique na natureza", icon: "Utensils", description: "Almoco ao ar livre" },
            { time: "16:00", title: "Compras de artesanato", icon: "ShoppingBag", description: "Mercado local" },
            { time: "19:00", title: "Jantar de despedida", icon: "Moon", description: "Restaurante com vista" }
          ]
        }
      ]
    }
    
    setGeneratedItinerary(newItinerary)
    useCredits(5, "Roteiro IA", `Roteiro para ${formData.destination}`)
    setIsGenerating(false)
  }

  const handleSaveItinerary = () => {
    if (generatedItinerary) {
      setSavedItineraries((prev) => [
        {
          id: `itinerary-${Date.now()}`,
        title: generatedItinerary.title,
        destination: generatedItinerary.destination,
        duration: generatedItinerary.duration,
        style: generatedItinerary.style,
          days: generatedItinerary.days,
          usedCount: 0,
        },
        ...(prev ?? []),
      ])
      alert("Roteiro salvo com sucesso!")
    }
  }

  const handleCopy = () => {
    if (generatedItinerary) {
      navigator.clipboard.writeText(JSON.stringify(generatedItinerary, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const iconMap: Record<string, any> = { Hotel, MapPin, Utensils, Coffee, Camera, Music, Sun, Globe, ShoppingBag, Moon }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roteiros IA</h1>
          <p className="text-muted-foreground">Gere roteiros personalizados com inteligencia artificial</p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30 w-fit">
          <Sparkles className="w-3 h-3 mr-1" />
          {credits.balance} creditos disponiveis
        </Badge>
      </div>

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="generate" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wand2 className="w-4 h-4 mr-2" />
            Gerar Novo
          </TabsTrigger>
          <TabsTrigger value="saved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" />
            Salvos ({safeItineraries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Formulario */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Configurar Roteiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Destino</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Ex: Paris, Franca" 
                      className="pl-10 bg-background border-border"
                      value={formData.destination}
                      onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duracao</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ex: 7 dias" 
                        className="pl-10 bg-background border-border"
                        value={formData.duration}
                        onChange={(e) => setFormData({...formData, duration: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Viajantes</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ex: 2 adultos" 
                        className="pl-10 bg-background border-border"
                        value={formData.travelers}
                        onChange={(e) => setFormData({...formData, travelers: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Orcamento Estimado</Label>
                  <Select onValueChange={(value) => setFormData({...formData, budget: value})}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione o orcamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="economy">Economico (ate R$ 5.000/pessoa)</SelectItem>
                      <SelectItem value="moderate">Moderado (R$ 5.000 - R$ 15.000/pessoa)</SelectItem>
                      <SelectItem value="comfort">Confortavel (R$ 15.000 - R$ 30.000/pessoa)</SelectItem>
                      <SelectItem value="luxury">Luxo (acima de R$ 30.000/pessoa)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label>Estilo de Viagem</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {travelStyles.map((style) => {
                      const Icon = style.icon
                      const isSelected = selectedStyles.includes(style.id)
                      return (
                        <button
                          key={style.id}
                          onClick={() => toggleStyle(style.id)}
                          className={`p-3 rounded-lg border transition-all text-center ${
                            isSelected 
                              ? "bg-primary/20 border-primary text-primary" 
                              : "bg-background border-border text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          <Icon className="w-4 h-4 mx-auto mb-1" />
                          <span className="text-xs">{style.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferencias Adicionais</Label>
                  <Textarea 
                    placeholder="Ex: Preferimos restaurantes com opcoes vegetarianas..."
                    className="bg-background border-border min-h-[100px]"
                    value={formData.preferences}
                    onChange={(e) => setFormData({...formData, preferences: e.target.value})}
                  />
                </div>

                <Button 
                  className="w-full bg-gradient-to-r from-primary to-cyan-400 hover:opacity-90 text-white"
                  onClick={handleGenerate}
                  disabled={isGenerating || !formData.destination || !formData.duration || credits.balance < 5}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando roteiro...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Gerar Roteiro (5 creditos)
                    </>
                  )}
                </Button>
                {credits.balance < 5 && (
                  <p className="text-xs text-red-400 text-center">Creditos insuficientes</p>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Preview do Roteiro</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-muted-foreground mt-4">Criando roteiro personalizado...</p>
                    </motion.div>
                  ) : generatedItinerary ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">{generatedItinerary.title}</h3>
                          <p className="text-sm text-muted-foreground">{generatedItinerary.days.length} dias de atividades</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-border" onClick={handleCopy}>
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="outline" className="border-border">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {generatedItinerary.days.map((day: any, index: number) => (
                          <div key={index} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-medium flex items-center justify-center">
                                {day.day}
                              </span>
                              <span className="font-medium text-foreground">{day.title}</span>
                            </div>
                            <div className="ml-4 pl-4 border-l border-border/50 space-y-2">
                              {day.activities.map((activity: any, actIndex: number) => {
                                const Icon = iconMap[activity.icon] || MapPin
                                return (
                                  <div key={actIndex} className="flex gap-3 py-2">
                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                      <Icon className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-primary font-medium">{activity.time}</span>
                                        <span className="text-sm font-medium text-foreground">{activity.title}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-border">
                        <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSaveItinerary}>
                          <Plus className="w-4 h-4 mr-2" />
                          Salvar Roteiro
                        </Button>
                        <Button variant="outline" className="flex-1 border-border">
                          <Edit3 className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Wand2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Preencha os dados e clique em gerar</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {safeItineraries.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum roteiro salvo ainda</p>
                <p className="text-sm text-muted-foreground/60">Gere seu primeiro roteiro com IA</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {safeItineraries.map((itinerary) => (
                <Card key={itinerary.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{itinerary.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {itinerary.destination}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {itinerary.duration}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {itinerary.style}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          Usado {itinerary.usedCount}x
                        </p>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
