"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  Check,
  Plane,
  Mountain,
  Palmtree,
  Building2,
  Heart,
  Briefcase,
  User,
  UserPlus,
  Link2,
  Copy,
  Share2,
  Shield,
  ExternalLink
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useTrips, type Trip } from "@/contexts/trips-context"
import { useAuth } from "@/contexts/auth-context"
import { createTrip as createTripInRepository } from "@/lib/repositories/trips-repository"
import { shouldUseSupabase } from "@/lib/data-source"
import { writePendingTrip } from "@/lib/pending-trip"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.3 }
}

const tripStyles = [
  { id: "aventura", label: "Aventura", icon: Mountain, description: "Trilhas e natureza" },
  { id: "praia", label: "Praia", icon: Palmtree, description: "Relaxar no sol" },
  { id: "cidade", label: "Cidade", icon: Building2, description: "Cultura e gastronomia" },
  { id: "romantica", label: "Romantica", icon: Heart, description: "A dois" },
  { id: "negocios", label: "Negocios", icon: Briefcase, description: "Trabalho e lazer" },
]

const companionTypes = [
  { id: "sozinho", label: "Sozinho", icon: User, count: 1 },
  { id: "casal", label: "Casal", icon: Heart, count: 2 },
  { id: "familia", label: "Familia", icon: Users, count: 4 },
  { id: "amigos", label: "Amigos", icon: UserPlus, count: 6 },
]

const TRIP_CREATE_TIMEOUT_MS = 15000

function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2"
    >
      <Check size={16} />
      {message}
    </motion.div>
  )
}

export default function CriarViagemPage() {
  const router = useRouter()
  const { addTrip, syncTripFromBackend } = useTrips()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    name: "",
    destination: "",
    startDate: "",
    endDate: "",
    style: "",
    companions: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [createdTrip, setCreatedTrip] = useState<Trip | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const totalSteps = 5
  const progress = (step / totalSteps) * 100

  const canProceed = () => {
    switch (step) {
      case 1: return formData.name.length >= 3
      case 2: return formData.destination.length >= 3
      case 3: return formData.startDate && formData.endDate
      case 4: return formData.style !== ""
      case 5: return formData.companions !== ""
      default: return false
    }
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
    } else {
      createTrip()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    } else {
      router.push("/portal")
    }
  }

  const createTrip = async () => {
    setIsCreating(true)
    setErrorMessage("")

    try {
      let newTrip: Trip

      if (shouldUseSupabase() && user) {
        const result = await Promise.race([
          createTripInRepository({
            title: formData.name,
            destination: formData.destination,
            startDate: formData.startDate,
            endDate: formData.endDate,
            style: formData.style,
            status: "draft",
            visibility: "public",
            ownerType: "traveler",
            ownerUserId: user.id,
            travelersCount: companionTypes.find(c => c.id === formData.companions)?.count || 1,
            creditsSummary: { balance: null, used: null, total: null },
          }),
          new Promise<never>((_, reject) => {
            window.setTimeout(() => reject(new Error("Tempo limite excedido ao criar a viagem.")), TRIP_CREATE_TIMEOUT_MS)
          }),
        ])

        if (result.source === "supabase" && result.data) {
          newTrip = syncTripFromBackend(result.data)
        } else if (result.error) {
          console.error("[TRIP] insert error", result.error)
          setErrorMessage(result.error)
          return
        } else {
          setErrorMessage("Nao foi possivel criar a viagem no Supabase.")
          return
        }
      } else if (shouldUseSupabase() && !user) {
        writePendingTrip({
          title: formData.name,
          destination: formData.destination,
          startDate: formData.startDate,
          endDate: formData.endDate,
          style: formData.style,
          travelersCount: companionTypes.find(c => c.id === formData.companions)?.count || 1,
        })
        router.push("/signup")
        return
      } else {
        newTrip = addTrip({
          name: formData.name,
          destination: formData.destination,
          country: "",
          city: "",
          startDate: formData.startDate,
          endDate: formData.endDate,
          style: formData.style,
          companions: formData.companions,
          passengersCount: companionTypes.find(c => c.id === formData.companions)?.count || 1,
          status: "upcoming"
        })
      }
      
      setCreatedTrip(newTrip)
      setIsComplete(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao criar viagem."
      console.error("[TRIP] insert error", message)
      setErrorMessage(message)
    } finally {
      setIsCreating(false)
    }
  }

  const copyLink = (link: string, type: string) => {
    navigator.clipboard.writeText(link)
    setCopiedLink(type)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-xl"
          onClick={handleBack}
        >
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Nova Viagem</h1>
          {!isComplete && (
            <p className="text-sm text-muted-foreground">Passo {step} de {totalSteps}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {!isComplete && (
        <Progress value={progress} className="h-1 mb-8" />
      )}

      {/* Form Steps */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {/* Step 1: Trip Name */}
          {step === 1 && !isComplete && (
            <motion.div key="step1" {...fadeInUp} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Como voce quer chamar essa viagem?</h2>
                <p className="text-muted-foreground">
                  De um nome especial para sua aventura.
                </p>
              </div>
              
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Lua de mel em Portugal"
                className="h-14 text-lg rounded-xl bg-muted/30 border-border/50"
              />
              
              <div className="flex flex-wrap gap-2">
                {["Ferias de verao", "Viagem de trabalho", "Aventura europeia"].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border/50"
                    onClick={() => setFormData({ ...formData, name: suggestion })}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Destination */}
          {step === 2 && !isComplete && (
            <motion.div key="step2" {...fadeInUp} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Para onde voce vai?</h2>
                <p className="text-muted-foreground">
                  Digite o destino principal da sua viagem.
                </p>
              </div>
              
              <div className="relative">
                <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  placeholder="Cidade, pais ou regiao"
                  className="h-14 text-lg rounded-xl bg-muted/30 border-border/50 pl-12"
                />
              </div>
              
              <div className="flex flex-wrap gap-2">
                {["Lisboa, Portugal", "Paris, Franca", "Tokyo, Japao", "Nova York, EUA"].map((destination) => (
                  <Button
                    key={destination}
                    variant="outline"
                    size="sm"
                    className="rounded-full border-border/50"
                    onClick={() => setFormData({ ...formData, destination })}
                  >
                    <MapPin size={14} className="mr-1" />
                    {destination}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Dates */}
          {step === 3 && !isComplete && (
            <motion.div key="step3" {...fadeInUp} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Quando sera a viagem?</h2>
                <p className="text-muted-foreground">
                  Selecione as datas de ida e volta.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Plane size={14} className="text-primary" />
                    Ida
                  </label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Plane size={14} className="text-primary rotate-180" />
                    Volta
                  </label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-12 rounded-xl bg-muted/30 border-border/50"
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    <span className="text-sm">
                      {Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24))} dias de viagem
                    </span>
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {/* Step 4: Trip Style */}
          {step === 4 && !isComplete && (
            <motion.div key="step4" {...fadeInUp} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Qual o estilo da viagem?</h2>
                <p className="text-muted-foreground">
                  Isso ajuda a personalizar suas recomendacoes.
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {tripStyles.map((style) => (
                  <Card
                    key={style.id}
                    className={`p-4 cursor-pointer transition-all duration-300 ${
                      formData.style === style.id
                        ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                    onClick={() => setFormData({ ...formData, style: style.id })}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        formData.style === style.id
                          ? 'bg-primary/20'
                          : 'bg-muted/50'
                      }`}>
                        <style.icon size={24} className={
                          formData.style === style.id ? 'text-primary' : 'text-muted-foreground'
                        } />
                      </div>
                      <div>
                        <h3 className="font-medium">{style.label}</h3>
                        <p className="text-xs text-muted-foreground">{style.description}</p>
                      </div>
                      {formData.style === style.id && (
                        <Check size={16} className="text-primary" />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 5: Companions */}
          {step === 5 && !isComplete && (
            <motion.div key="step5" {...fadeInUp} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Quem vai viajar com voce?</h2>
                <p className="text-muted-foreground">
                  Selecione o tipo de grupo.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {companionTypes.map((type) => (
                  <Card
                    key={type.id}
                    className={`p-5 cursor-pointer transition-all duration-300 ${
                      formData.companions === type.id
                        ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30'
                        : 'bg-card/50 border-border/50 hover:border-primary/30'
                    }`}
                    onClick={() => setFormData({ ...formData, companions: type.id })}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        formData.companions === type.id
                          ? 'bg-primary/20'
                          : 'bg-muted/50'
                      }`}>
                        <type.icon size={24} className={
                          formData.companions === type.id ? 'text-primary' : 'text-muted-foreground'
                        } />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{type.label}</h3>
                        <p className="text-sm text-muted-foreground">
                          {type.count === 1 ? '1 pessoa' : `ate ${type.count} pessoas`}
                        </p>
                      </div>
                      {formData.companions === type.id && (
                        <Check size={18} className="text-primary" />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}

          {/* Creating State */}
          {isCreating && (
            <motion.div key="creating" {...fadeInUp} className="space-y-8 py-12 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center mx-auto animate-pulse">
                <Sparkles size={36} className="text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Criando sua viagem...</h2>
                <p className="text-muted-foreground">
                  Estamos preparando tudo para voce.
                </p>
              </div>
            </motion.div>
          )}

          {/* Complete State */}
          {isComplete && createdTrip && (
            <motion.div key="complete" {...fadeInUp} className="space-y-6">
              <div className="text-center space-y-4 py-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center mx-auto">
                  <Check size={36} className="text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">Viagem criada!</h2>
                  <p className="text-muted-foreground">
                    {createdTrip.name} para {createdTrip.destination}
                  </p>
                </div>
              </div>

              {/* Admin Link */}
              <Card className="p-5 bg-card/50 border-border/50">
                <div className="flex items-start gap-3 mb-3">
                  <Shield size={20} className="text-amber-400" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Link Administrador</h3>
                    <p className="text-xs text-muted-foreground">Guarde com seguranca - acesso completo</p>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">
                    Privado
                  </Badge>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <code className="flex-1 text-sm truncate">{createdTrip.adminLink}</code>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyLink(createdTrip.adminLink, "admin")}
                  >
                    {copiedLink === "admin" ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </Button>
                </div>
              </Card>

              {/* Share Link */}
              <Card className="p-5 bg-primary/5 border-primary/20">
                <div className="flex items-start gap-3 mb-3">
                  <Share2 size={20} className="text-primary" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Link Compartilhavel</h3>
                    <p className="text-xs text-muted-foreground">Compartilhe com familia e amigos</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-0 text-xs">
                    Publico
                  </Badge>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-background/50 border border-primary/20">
                  <Link2 size={16} className="text-primary shrink-0" />
                  <code className="flex-1 text-sm truncate">{createdTrip.shareLink}</code>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => copyLink(createdTrip.shareLink, "share")}
                  >
                    {copiedLink === "share" ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </Button>
                </div>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl border-border/50"
                  onClick={() => router.push("/portal")}
                >
                  Ir para Inicio
                </Button>
                <Button 
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
                  onClick={() => router.push(`/viagem/${createdTrip.slug}/admin`)}
                >
                  <ExternalLink size={16} className="mr-2" />
                  Ver Viagem
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      {!isComplete && !isCreating && (
        <div className="pt-8 mt-auto">
          {errorMessage && <p className="mb-3 text-center text-sm text-red-400">{errorMessage}</p>}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl border-border/50"
              onClick={handleBack}
            >
              Voltar
            </Button>
            <Button 
              className="flex-1 rounded-xl bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0 disabled:opacity-50"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {step === totalSteps ? 'Criar Viagem' : 'Continuar'}
              <ChevronRight size={18} className="ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Toast message={copiedLink === "admin" ? "Link admin copiado!" : "Link publico copiado!"} visible={!!copiedLink} />
    </div>
  )
}
