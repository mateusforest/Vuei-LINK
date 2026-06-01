"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ArrowLeft, Check, Plane, Briefcase, Heart, Compass, MapPin, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { getRedirectByRole } from "@/lib/auth/role-redirect"
import { writePendingTrip } from "@/lib/pending-trip"

const steps = [
  { id: 1, title: "Nome", description: "Como podemos te chamar?" },
  { id: 2, title: "Estilo", description: "Qual seu estilo de viagem?" },
  { id: 3, title: "Destino", description: "Seu próximo destino?" },
  { id: 4, title: "Preferências", description: "Personalize sua experiência" },
]

const travelStyles = [
  { id: "adventure", label: "Aventura", icon: Compass, description: "Trilhas, esportes e natureza" },
  { id: "cultural", label: "Cultural", icon: Briefcase, description: "Museus, história e arte" },
  { id: "romantic", label: "Romântica", icon: Heart, description: "Experiências a dois" },
  { id: "relax", label: "Relaxamento", icon: Sparkles, description: "Praias, spas e descanso" },
]

const popularDestinations = [
  { id: "paris", name: "Paris", country: "França", emoji: "🗼" },
  { id: "tokyo", name: "Tokyo", country: "Japão", emoji: "🗾" },
  { id: "new-york", name: "New York", country: "EUA", emoji: "🗽" },
  { id: "bali", name: "Bali", country: "Indonésia", emoji: "🏝️" },
  { id: "rome", name: "Roma", country: "Itália", emoji: "🏛️" },
  { id: "other", name: "Outro", country: "Qual?", emoji: "🌍" },
]

const preferences = [
  { id: "notifications", label: "Receber notificações da viagem" },
  { id: "tips", label: "Dicas e recomendações do concierge" },
  { id: "weather", label: "Alertas de clima do destino" },
  { id: "offline", label: "Salvar viagens offline automaticamente" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    travelStyle: "",
    destination: "",
    customDestination: "",
    preferences: ["notifications", "tips"] as string[],
  })

  useEffect(() => {
    if (!loading && user && profile) {
      router.replace(getRedirectByRole(profile.role))
    }
  }, [loading, profile, router, user])

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1)
    else handleComplete()
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleComplete = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))

    if (user) {
      router.push(getRedirectByRole(profile?.role))
      return
    }

    const selectedDestination = formData.destination === "other"
      ? formData.customDestination
      : popularDestinations.find((destination) => destination.id === formData.destination)?.name ?? ""

    if (selectedDestination) {
      writePendingTrip({
        title: selectedDestination,
        destination: selectedDestination,
        style: formData.travelStyle || undefined,
        travelersCount: 1,
      })
    }

    router.push("/signup")
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.name.length >= 2
      case 2: return formData.travelStyle !== ""
      case 3: return formData.destination !== "" && (formData.destination !== "other" || formData.customDestination !== "")
      case 4: return true
      default: return false
    }
  }

  const togglePreference = (id: string) => {
    setFormData(prev => ({
      ...prev,
      preferences: prev.preferences.includes(id)
        ? prev.preferences.filter(p => p !== id)
        : [...prev.preferences, id]
    }))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#5de0e6]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#004aad]/10 rounded-full blur-[120px]" />
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(93, 224, 230, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(93, 224, 230, 0.5) 1px, transparent 1px)`,
            backgroundSize: '80px 80px'
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 lg:p-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Image
            src="/vuei-logo.png"
            alt="Vuei"
            width={100}
            height={36}
            className="h-8 w-auto"
          />
          <button
            onClick={() => router.push("/portal")}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Pular
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative z-10 px-6 lg:px-8">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-500 ${
                    currentStep > step.id
                      ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                      : currentStep === step.id
                      ? "bg-[#5de0e6]/20 text-[#5de0e6] border border-[#5de0e6]/50"
                      : "bg-white/5 text-white/30 border border-white/10"
                  }`}
                >
                  {currentStep > step.id ? <Check className="w-4 h-4" /> : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 lg:w-20 h-0.5 mx-2 transition-colors duration-500 ${
                    currentStep > step.id ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad]" : "bg-white/10"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-lg">
          <AnimatePresence mode="wait">
            {/* Step 1 - Nome */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center"
                >
                  <Plane className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Vamos começar sua jornada
                </h1>
                <p className="text-white/50 mb-10">
                  Como podemos te chamar?
                </p>

                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-14 bg-white/5 border-white/10 text-white text-center text-lg placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 max-w-xs mx-auto"
                  autoFocus
                />
              </motion.div>
            )}

            {/* Step 2 - Estilo */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Olá, {formData.name}!
                </h1>
                <p className="text-white/50 mb-10">
                  Qual seu estilo de viagem favorito?
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {travelStyles.map((style, index) => (
                    <motion.button
                      key={style.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setFormData({ ...formData, travelStyle: style.id })}
                      className={`relative p-5 rounded-2xl border transition-all duration-300 text-left ${
                        formData.travelStyle === style.id
                          ? "bg-[#5de0e6]/10 border-[#5de0e6]/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      {formData.travelStyle === style.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <style.icon className={`w-8 h-8 mb-3 ${
                        formData.travelStyle === style.id ? "text-[#5de0e6]" : "text-white/50"
                      }`} />
                      <p className="text-white font-medium">{style.label}</p>
                      <p className="text-white/40 text-sm">{style.description}</p>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3 - Destino */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Para onde você vai?
                </h1>
                <p className="text-white/50 mb-10">
                  Escolha seu próximo destino
                </p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {popularDestinations.map((dest, index) => (
                    <motion.button
                      key={dest.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setFormData({ ...formData, destination: dest.id, customDestination: "" })}
                      className={`relative p-4 rounded-xl border transition-all duration-300 ${
                        formData.destination === dest.id
                          ? "bg-[#5de0e6]/10 border-[#5de0e6]/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-2xl mb-2 block">{dest.emoji}</span>
                      <p className="text-white text-sm font-medium">{dest.name}</p>
                      <p className="text-white/40 text-xs">{dest.country}</p>
                    </motion.button>
                  ))}
                </div>

                {formData.destination === "other" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                  >
                    <Input
                      type="text"
                      placeholder="Digite o destino"
                      value={formData.customDestination}
                      onChange={(e) => setFormData({ ...formData, customDestination: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20"
                      autoFocus
                    />
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 4 - Preferências */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center"
                >
                  <Sparkles className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Quase lá!
                </h1>
                <p className="text-white/50 mb-10">
                  Personalize sua experiência Vuei
                </p>

                <div className="space-y-3">
                  {preferences.map((pref, index) => (
                    <motion.button
                      key={pref.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => togglePreference(pref.id)}
                      className={`w-full p-4 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                        formData.preferences.includes(pref.id)
                          ? "bg-[#5de0e6]/10 border-[#5de0e6]/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="text-white/80">{pref.label}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        formData.preferences.includes(pref.id)
                          ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad] border-transparent"
                          : "border-white/20"
                      }`}>
                        {formData.preferences.includes(pref.id) && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="relative z-10 p-6 lg:p-8">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 1}
            className={`text-white/50 hover:text-white hover:bg-white/5 ${currentStep === 1 ? 'invisible' : ''}`}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Button
            onClick={nextStep}
            disabled={!canProceed() || isLoading}
            className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white font-medium rounded-xl px-8 shadow-lg shadow-[#5de0e6]/20"
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : currentStep === 4 ? (
              <>
                Começar
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}
