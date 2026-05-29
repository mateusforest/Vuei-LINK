"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ArrowLeft, Check, Upload, Palette, Users, Plane, MessageSquare, Building2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const steps = [
  { id: 1, title: "Logo", description: "Identidade da sua agência" },
  { id: 2, title: "Branding", description: "Cores e personalização" },
  { id: 3, title: "Equipe", description: "Convide seus agentes" },
  { id: 4, title: "Viagem", description: "Crie sua primeira viagem" },
  { id: 5, title: "Concierge", description: "Configure a IA" },
]

const brandColors = [
  { id: "vuei", primary: "#5de0e6", secondary: "#004aad", label: "Vuei (Padrão)" },
  { id: "ocean", primary: "#0ea5e9", secondary: "#0369a1", label: "Ocean Blue" },
  { id: "emerald", primary: "#10b981", secondary: "#065f46", label: "Emerald" },
  { id: "sunset", primary: "#f59e0b", secondary: "#b45309", label: "Sunset" },
  { id: "rose", primary: "#f43f5e", secondary: "#be123c", label: "Rose" },
  { id: "custom", primary: "", secondary: "", label: "Personalizado" },
]

const conciergePersonalities = [
  { id: "professional", label: "Profissional", description: "Formal e objetivo" },
  { id: "friendly", label: "Amigável", description: "Caloroso e acolhedor" },
  { id: "enthusiastic", label: "Entusiasmado", description: "Animado e inspirador" },
  { id: "concise", label: "Conciso", description: "Direto ao ponto" },
]

export default function AgencyOnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    logo: null as File | null,
    logoPreview: "",
    brandColor: "vuei",
    customPrimary: "#5de0e6",
    customSecondary: "#004aad",
    teamEmails: [""],
    tripName: "",
    tripDestination: "",
    conciergePersonality: "friendly",
    conciergeName: "Assistente Vuei",
  })

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
    else handleComplete()
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const handleComplete = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    router.push("/agencia")
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({
        ...formData,
        logo: file,
        logoPreview: URL.createObjectURL(file)
      })
    }
  }

  const addTeamEmail = () => {
    setFormData({
      ...formData,
      teamEmails: [...formData.teamEmails, ""]
    })
  }

  const updateTeamEmail = (index: number, value: string) => {
    const emails = [...formData.teamEmails]
    emails[index] = value
    setFormData({ ...formData, teamEmails: emails })
  }

  const removeTeamEmail = (index: number) => {
    const emails = formData.teamEmails.filter((_, i) => i !== index)
    setFormData({ ...formData, teamEmails: emails.length ? emails : [""] })
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return true // Logo é opcional
      case 2: return formData.brandColor !== ""
      case 3: return true // Equipe é opcional
      case 4: return formData.tripName !== "" && formData.tripDestination !== ""
      case 5: return formData.conciergePersonality !== ""
      default: return false
    }
  }

  const selectedColor = brandColors.find(c => c.id === formData.brandColor)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-[#004aad]/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-[#5de0e6]/5 rounded-full blur-[120px]" />
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
          <div className="flex items-center gap-3">
            <Image
              src="/vuei-logo.png"
              alt="Vuei"
              width={100}
              height={36}
              className="h-8 w-auto"
            />
            <span className="text-xs text-white/40 font-medium tracking-wider uppercase">Agências</span>
          </div>
          <button
            onClick={() => router.push("/agencia")}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Pular
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative z-10 px-6 lg:px-8">
        <div className="max-w-xl mx-auto">
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
                  <div className={`w-8 lg:w-16 h-0.5 mx-1.5 transition-colors duration-500 ${
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
            {/* Step 1 - Logo */}
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
                  <Building2 className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Identidade da sua agência
                </h1>
                <p className="text-white/50 mb-10">
                  Faça upload do logo da sua agência
                </p>

                <label className="relative block w-40 h-40 mx-auto cursor-pointer group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="sr-only"
                  />
                  <div className={`w-full h-full rounded-2xl border-2 border-dashed transition-all duration-300 flex items-center justify-center overflow-hidden ${
                    formData.logoPreview 
                      ? "border-[#5de0e6]/50 bg-white/5" 
                      : "border-white/20 hover:border-[#5de0e6]/50 bg-white/[0.02]"
                  }`}>
                    {formData.logoPreview ? (
                      <Image
                        src={formData.logoPreview}
                        alt="Logo"
                        fill
                        className="object-contain p-4"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-white/30 mx-auto mb-2 group-hover:text-[#5de0e6] transition-colors" />
                        <p className="text-white/40 text-sm">Clique para upload</p>
                      </div>
                    )}
                  </div>
                </label>

                <p className="text-white/30 text-sm mt-4">
                  PNG, JPG ou SVG. Máximo 2MB.
                </p>
              </motion.div>
            )}

            {/* Step 2 - Branding */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
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
                  <Palette className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Cores da sua marca
                </h1>
                <p className="text-white/50 mb-10">
                  Escolha as cores que representam sua agência
                </p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {brandColors.map((color, index) => (
                    <motion.button
                      key={color.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setFormData({ ...formData, brandColor: color.id })}
                      className={`relative p-4 rounded-xl border transition-all duration-300 ${
                        formData.brandColor === color.id
                          ? "bg-white/10 border-[#5de0e6]/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      {color.id !== "custom" ? (
                        <div className="flex gap-1 mb-2 justify-center">
                          <div 
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: color.primary }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full"
                            style={{ backgroundColor: color.secondary }}
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-gradient-to-r from-pink-500 via-yellow-500 to-cyan-500" />
                      )}
                      <p className="text-white/70 text-xs">{color.label}</p>
                    </motion.button>
                  ))}
                </div>

                {formData.brandColor === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Cor primária</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.customPrimary}
                          onChange={(e) => setFormData({ ...formData, customPrimary: e.target.value })}
                          className="w-12 h-12 rounded-lg cursor-pointer border-0"
                        />
                        <Input
                          value={formData.customPrimary}
                          onChange={(e) => setFormData({ ...formData, customPrimary: e.target.value })}
                          className="h-12 bg-white/5 border-white/10 text-white rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-white/50">Cor secundária</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.customSecondary}
                          onChange={(e) => setFormData({ ...formData, customSecondary: e.target.value })}
                          className="w-12 h-12 rounded-lg cursor-pointer border-0"
                        />
                        <Input
                          value={formData.customSecondary}
                          onChange={(e) => setFormData({ ...formData, customSecondary: e.target.value })}
                          className="h-12 bg-white/5 border-white/10 text-white rounded-xl"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Preview */}
                <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-white/40 text-xs mb-3">Preview</p>
                  <div 
                    className="h-2 rounded-full"
                    style={{
                      background: `linear-gradient(to right, ${
                        selectedColor?.id === "custom" ? formData.customPrimary : selectedColor?.primary
                      }, ${
                        selectedColor?.id === "custom" ? formData.customSecondary : selectedColor?.secondary
                      })`
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3 - Equipe */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
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
                  <Users className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Convide sua equipe
                </h1>
                <p className="text-white/50 mb-10">
                  Adicione os emails dos seus agentes
                </p>

                <div className="space-y-3">
                  {formData.teamEmails.map((email, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-2"
                    >
                      <Input
                        type="email"
                        placeholder="email@agencia.com"
                        value={email}
                        onChange={(e) => updateTeamEmail(index, e.target.value)}
                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50"
                      />
                      {formData.teamEmails.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTeamEmail(index)}
                          className="h-12 w-12 text-white/30 hover:text-red-400 hover:bg-red-400/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  onClick={addTeamEmail}
                  className="mt-4 text-[#5de0e6] hover:text-[#5de0e6] hover:bg-[#5de0e6]/10"
                >
                  + Adicionar outro email
                </Button>

                <p className="text-white/30 text-sm mt-6">
                  Os convites serão enviados após a conclusão do onboarding
                </p>
              </motion.div>
            )}

            {/* Step 4 - Primeira Viagem */}
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
                  <Plane className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Sua primeira viagem
                </h1>
                <p className="text-white/50 mb-10">
                  Crie uma viagem de exemplo para começar
                </p>

                <div className="space-y-4 text-left">
                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Nome da viagem</label>
                    <Input
                      type="text"
                      placeholder="Ex: Paris Premium 2024"
                      value={formData.tripName}
                      onChange={(e) => setFormData({ ...formData, tripName: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Destino</label>
                    <Input
                      type="text"
                      placeholder="Ex: Paris, França"
                      value={formData.tripDestination}
                      onChange={(e) => setFormData({ ...formData, tripDestination: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50"
                    />
                  </div>
                </div>

                {/* Preview Card */}
                {formData.tripName && formData.tripDestination && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 text-left"
                  >
                    <p className="text-white/40 text-xs mb-3">Preview do link</p>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center">
                        <span className="text-xl">🗼</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{formData.tripName}</p>
                        <p className="text-white/40 text-sm">{formData.tripDestination}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Step 5 - Concierge */}
            {currentStep === 5 && (
              <motion.div
                key="step5"
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
                  <MessageSquare className="w-10 h-10 text-[#5de0e6]" />
                </motion.div>

                <h1 className="text-3xl lg:text-4xl font-semibold text-white mb-3">
                  Configure o Concierge IA
                </h1>
                <p className="text-white/50 mb-10">
                  Escolha a personalidade do assistente
                </p>

                <div className="space-y-4 text-left mb-8">
                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Nome do assistente</label>
                    <Input
                      type="text"
                      placeholder="Ex: Assistente Vuei"
                      value={formData.conciergeName}
                      onChange={(e) => setFormData({ ...formData, conciergeName: e.target.value })}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {conciergePersonalities.map((personality, index) => (
                    <motion.button
                      key={personality.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={() => setFormData({ ...formData, conciergePersonality: personality.id })}
                      className={`relative p-4 rounded-xl border transition-all duration-300 text-left ${
                        formData.conciergePersonality === personality.id
                          ? "bg-[#5de0e6]/10 border-[#5de0e6]/50"
                          : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05]"
                      }`}
                    >
                      {formData.conciergePersonality === personality.id && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <p className="text-white font-medium">{personality.label}</p>
                      <p className="text-white/40 text-sm">{personality.description}</p>
                    </motion.button>
                  ))}
                </div>

                {/* Chat Preview */}
                <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 text-left">
                  <p className="text-white/40 text-xs mb-3">Preview</p>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-white/5 rounded-xl rounded-tl-none p-3">
                      <p className="text-white/80 text-sm">
                        {formData.conciergePersonality === "professional" && "Olá. Como posso ajudá-lo com sua viagem hoje?"}
                        {formData.conciergePersonality === "friendly" && "Oi! Que bom ter você aqui! Como posso ajudar com sua viagem?"}
                        {formData.conciergePersonality === "enthusiastic" && "Olá! Que emoção ajudar na sua viagem! O que posso fazer por você?"}
                        {formData.conciergePersonality === "concise" && "Olá. Em que posso ajudar?"}
                      </p>
                    </div>
                  </div>
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
            ) : currentStep === 5 ? (
              <>
                Acessar portal
                <ArrowRight className="w-4 h-4 ml-2" />
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
