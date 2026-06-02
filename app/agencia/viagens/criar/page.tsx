"use client"

import { Suspense, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  Link2,
  Copy,
  MessageSquare,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAgency, type AgencyTrip } from "@/contexts/agency-context"

const steps = [
  { id: 1, title: "Cliente", icon: User },
  { id: 2, title: "Destino", icon: MapPin },
  { id: 3, title: "Datas", icon: Calendar },
  { id: 4, title: "Passageiros", icon: Users },
  { id: 5, title: "Estilo", icon: Sparkles },
]

const travelStyles = [
  { id: "luxo", label: "Luxo", desc: "Hoteis 5 estrelas, experiencias exclusivas" },
  { id: "aventura", label: "Aventura", desc: "Trilhas, esportes, natureza" },
  { id: "cultural", label: "Cultural", desc: "Museus, historia, gastronomia local" },
  { id: "relaxamento", label: "Relaxamento", desc: "Spas, praias, descanso" },
  { id: "lua-de-mel", label: "Romantica", desc: "Lua de mel, aniversarios" },
  { id: "familia", label: "Familia", desc: "Atividades para todas idades" },
]

function CreateTripPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientIdParam = searchParams.get("clientId")
  
  const { clients, addTrip, getClientById } = useAgency()
  const [currentStep, setCurrentStep] = useState(1)
  const [completed, setCompleted] = useState(false)
  const [createdTrip, setCreatedTrip] = useState<AgencyTrip | null>(null)
  const [copiedAdmin, setCopiedAdmin] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  
  const [formData, setFormData] = useState({
    clientId: clientIdParam || "",
    clientName: "",
    clientEmail: "",
    destination: "",
    startDate: "",
    endDate: "",
    passengersCount: 2,
    travelStyle: "",
  })

  // Load client data if clientId is provided
  useEffect(() => {
    if (clientIdParam) {
      const client = getClientById(clientIdParam)
      if (client) {
        setFormData(prev => ({
          ...prev,
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email
        }))
      }
    }
  }, [clientIdParam, getClientById])

  const handleNext = async () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    } else {
      const newTrip = await addTrip({
        clientId: formData.clientId || `temp-${Date.now()}`,
        clientName: formData.clientName,
        name: `Viagem para ${formData.destination}`,
        destination: formData.destination,
        country: formData.destination.split(",").pop()?.trim() || "",
        city: formData.destination.split(",")[0]?.trim() || formData.destination,
        startDate: formData.startDate,
        endDate: formData.endDate,
        style: formData.travelStyle,
        passengersCount: formData.passengersCount,
        status: "upcoming"
      })
      if (newTrip) {
        setCreatedTrip(newTrip)
        setCompleted(true)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const copyToClipboard = (text: string, isAdmin: boolean) => {
    navigator.clipboard.writeText(text)
    if (isAdmin) {
      setCopiedAdmin(true)
      setTimeout(() => setCopiedAdmin(false), 2000)
    } else {
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.clientName.length > 0
      case 2: return formData.destination.length > 0
      case 3: return formData.startDate && formData.endDate
      case 4: return formData.passengersCount > 0
      case 5: return formData.travelStyle.length > 0
      default: return true
    }
  }

  if (completed && createdTrip) {
    return (
      <div className="mx-auto max-w-2xl pb-20 lg:pb-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
            <Check className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Viagem Criada!</h1>
          <p className="mt-2 text-muted-foreground">
            A viagem para {createdTrip.destination} foi criada com sucesso
          </p>

          <div className="mt-8 space-y-4 text-left">
            {/* Trip Summary */}
            <Card className="border-white/5 bg-card/50 overflow-hidden">
              <div 
                className="h-32 bg-cover bg-center relative"
                style={{ backgroundImage: `url(${createdTrip.coverImage})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <h3 className="text-lg font-semibold text-white">{createdTrip.clientName}</h3>
                  <div className="flex items-center gap-1 text-sm text-white/70">
                    <MapPin className="h-3 w-3" />
                    {createdTrip.destination}
                  </div>
                </div>
              </div>
            </Card>

            {/* Admin Link */}
            <Card className="border-white/5 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Link2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Link Admin</p>
                      <p className="text-sm text-muted-foreground">Acesso completo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-white/5 px-2 py-1 text-xs text-muted-foreground max-w-[150px] truncate">
                      {createdTrip.adminLink}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(createdTrip.adminLink, true)}
                    >
                      {copiedAdmin ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Share Link */}
            <Card className="border-white/5 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accent/10 p-2">
                      <Link2 className="h-5 w-5 text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-foreground">Link Compartilhavel</p>
                      <p className="text-sm text-muted-foreground">Para cliente/familia</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-white/5 px-2 py-1 text-xs text-muted-foreground max-w-[150px] truncate">
                      {createdTrip.shareLink}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(createdTrip.shareLink, false)}
                    >
                      {copiedShare ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3 pt-4">
              <Link href="/agencia/concierge">
                <Button variant="outline" className="h-auto w-full flex-col gap-2 border-white/10 py-4 hover:bg-white/5">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <span className="text-xs">Concierge</span>
                </Button>
              </Link>
              <Link href="/agencia/roteiros-ia">
                <Button variant="outline" className="h-auto w-full flex-col gap-2 border-white/10 py-4 hover:bg-white/5">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <span className="text-xs">Gerar Roteiro</span>
                </Button>
              </Link>
              <Button 
                variant="outline" 
                className="h-auto flex-col gap-2 border-white/10 py-4 hover:bg-white/5"
                onClick={() => window.open(`/viagem/${createdTrip.slug}/admin`, "_blank")}
              >
                <ExternalLink className="h-5 w-5 text-primary" />
                <span className="text-xs">Ver Viagem</span>
              </Button>
            </div>

            <div className="flex gap-3 pt-4">
              <Link href="/agencia/viagens" className="flex-1">
                <Button variant="outline" className="w-full border-white/10">
                  Ver todas viagens
                </Button>
              </Link>
              <Link href="/agencia" className="flex-1">
                <Button className="w-full bg-gradient-to-r from-primary to-accent text-white">
                  Ir para Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl pb-20 lg:pb-0">
      {/* Header */}
      <div className="mb-8">
        <Link href="/agencia/viagens">
          <Button variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Nova Viagem</h1>
        <p className="mt-1 text-muted-foreground">Crie uma nova viagem para seu cliente</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    currentStep >= step.id
                      ? "border-primary bg-primary text-white"
                      : "border-white/10 bg-transparent text-muted-foreground"
                  }`}
                  animate={{ scale: currentStep === step.id ? 1.1 : 1 }}
                >
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </motion.div>
                <span
                  className={`mt-2 text-xs ${
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition-colors ${
                    currentStep > step.id ? "bg-primary" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="border-white/5 bg-card/50">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">Dados do Cliente</h2>
                
                {clients.length > 0 && !formData.clientId && (
                  <div>
                    <Label className="text-muted-foreground">Selecionar cliente existente</Label>
                    <select
                      value={formData.clientId}
                      onChange={(e) => {
                        const client = clients.find(c => c.id === e.target.value)
                        if (client) {
                          setFormData({
                            ...formData,
                            clientId: client.id,
                            clientName: client.name,
                            clientEmail: client.email
                          })
                        }
                      }}
                      className="w-full mt-1.5 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] text-white focus:outline-none focus:border-primary/50 appearance-none"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
                    >
                      <option value="" className="bg-[#0a0a0a]">Novo cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Nome completo</Label>
                    <Input
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      placeholder="Ex: Maria Silva"
                      className="mt-1.5 border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      placeholder="Ex: maria@email.com"
                      className="mt-1.5 border-white/10 bg-white/5"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">Destino da Viagem</h2>
                <div>
                  <Label className="text-muted-foreground">Cidade e pais</Label>
                  <Input
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="Ex: Paris, Franca"
                    className="mt-1.5 border-white/10 bg-white/5"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {["Paris, Franca", "Tokyo, Japao", "Nova York, EUA", "Maldivas", "Dubai, Emirados", "Lisboa, Portugal", "Roma, Italia"].map((dest) => (
                    <Badge
                      key={dest}
                      variant="outline"
                      className={`cursor-pointer border-white/10 hover:border-primary/50 hover:bg-primary/10 ${
                        formData.destination === dest ? "border-primary bg-primary/10 text-primary" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, destination: dest })}
                    >
                      {dest}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">Datas da Viagem</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Data de ida</Label>
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="mt-1.5 border-white/10 bg-white/5"
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data de volta</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="mt-1.5 border-white/10 bg-white/5"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">Passageiros</h2>
                <div>
                  <Label className="text-muted-foreground">Quantidade de passageiros</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 border-white/10"
                      onClick={() => setFormData({ ...formData, passengersCount: Math.max(1, formData.passengersCount - 1) })}
                    >
                      -
                    </Button>
                    <span className="text-2xl font-bold text-foreground w-12 text-center">
                      {formData.passengersCount}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 border-white/10"
                      onClick={() => setFormData({ ...formData, passengersCount: formData.passengersCount + 1 })}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-4">
                  {[
                    { count: 1, label: "Sozinho" },
                    { count: 2, label: "Casal" },
                    { count: 4, label: "Familia" },
                    { count: 6, label: "Grupo" },
                  ].map((option) => (
                    <Badge
                      key={option.count}
                      variant="outline"
                      className={`cursor-pointer border-white/10 hover:border-primary/50 hover:bg-primary/10 ${
                        formData.passengersCount === option.count ? "border-primary bg-primary/10 text-primary" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, passengersCount: option.count })}
                    >
                      {option.label} ({option.count})
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}

            {currentStep === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h2 className="text-lg font-semibold text-foreground">Estilo da Viagem</h2>
                <div className="grid grid-cols-2 gap-3">
                  {travelStyles.map((style) => (
                    <motion.div
                      key={style.id}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        formData.travelStyle === style.id
                          ? "border-primary bg-primary/10"
                          : "border-white/10 bg-white/[0.02] hover:border-white/20"
                      }`}
                      onClick={() => setFormData({ ...formData, travelStyle: style.id })}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <p className="font-medium text-foreground">{style.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{style.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2 border-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 disabled:opacity-50"
            >
              {currentStep === steps.length ? "Criar Viagem" : "Proximo"}
              {currentStep === steps.length ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CreateTripPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl"><Card className="border-white/5 bg-card/50"><CardContent className="p-6">Carregando criacao da viagem...</CardContent></Card></div>}>
      <CreateTripPageContent />
    </Suspense>
  )
}
