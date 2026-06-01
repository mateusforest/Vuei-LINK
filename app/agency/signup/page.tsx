"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock, Building2, User, Phone, Users, ArrowRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { getRedirectByRole } from "@/lib/auth/role-redirect"
import { createAgency } from "@/lib/repositories/agencies-repository"

export default function AgencySignupPage() {
  const router = useRouter()
  const { signUp, user, profile, loading, refreshProfile } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptNews, setAcceptNews] = useState(false)
  const [formData, setFormData] = useState({
    agencyName: "",
    responsibleName: "",
    email: "",
    whatsapp: "",
    agentCount: "",
    password: "",
    confirmPassword: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const canSubmit =
    formData.agencyName.trim().length > 0 &&
    formData.responsibleName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    formData.whatsapp.trim().length > 0 &&
    formData.agentCount.trim().length > 0 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword &&
    acceptTerms

  useEffect(() => {
    if (!loading && user) {
      const detectedRole = (profile?.role ?? user.user_metadata?.role ?? "traveler") as "traveler" | "agency_owner" | "agency_member" | "master"
      router.replace(getRedirectByRole(detectedRole))
    }
  }, [loading, profile?.role, router, user])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.agencyName) newErrors.agencyName = "Nome da agência obrigatório"
    if (!formData.responsibleName) newErrors.responsibleName = "Nome do responsável obrigatório"
    if (!formData.email) newErrors.email = "Email obrigatório"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email inválido"
    if (!formData.whatsapp) newErrors.whatsapp = "WhatsApp obrigatório"
    if (!formData.agentCount) newErrors.agentCount = "Selecione uma opção"
    if (!formData.password) newErrors.password = "Senha obrigatória"
    else if (formData.password.length < 6) newErrors.password = "Mínimo 6 caracteres"
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Senhas não conferem"
    if (!acceptTerms) newErrors.terms = "Aceite os termos"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("[CADASTRO] botão clicado")

    if (!validateForm()) {
      console.error("[CADASTRO] signUp error", "Validacao do formulario falhou.")
      return
    }

    console.log("[CADASTRO] validações ok")
    setIsLoading(true)
    setErrors({})

    try {
      console.log("[CADASTRO] iniciando signUp")
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        name: formData.responsibleName,
        phone: formData.whatsapp,
        role: "agency_owner",
        metadata: {
          full_name: formData.responsibleName,
          agency_name: formData.agencyName,
          agents_count: formData.agentCount,
          accepted_news: acceptNews,
        },
      })

      if (result.error) {
        console.error("[CADASTRO] signUp error", result.error)
        setErrors((prev) => ({ ...prev, auth: result.error }))
        return
      }

      if (!result.user) {
        setErrors((prev) => ({ ...prev, auth: "Nao foi possivel iniciar a sessao apos o cadastro." }))
        return
      }

      const agencyResult = await createAgency({
        name: formData.agencyName,
        ownerUserId: result.user.id,
        email: formData.email,
        phone: formData.whatsapp,
        agentsCount: formData.agentCount,
      })

      if ("error" in agencyResult && agencyResult.error) {
        console.error("[AUTH ERROR]", agencyResult.error)
        setErrors((prev) => ({ ...prev, auth: agencyResult.error ?? "Nao foi possivel criar a agencia." }))
        return
      }

      console.log("[AGENCY] agency criada", agencyResult.data?.id ?? null)
      await refreshProfile()
      console.log("[AUTH] role detectada", "agency_owner")
      console.log("[AUTH] redirect destino", "/agency")
      console.log("[CADASTRO] signUp success")
      router.replace("/agency")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao criar conta."
      console.error("[CADASTRO] signUp error", message)
      setErrors((prev) => ({ ...prev, auth: message }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Lado Esquerdo - Visual Business */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#004aad]/20 via-background to-[#5de0e6]/10" />
        
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(93, 224, 230, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(93, 224, 230, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-[#004aad]/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-[#5de0e6]/10 rounded-full blur-[100px]" />

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12"
          >
            <Image
              src="/vuei-logo.png"
              alt="Vuei"
              width={140}
              height={50}
              className="h-12 w-auto"
            />
            <span className="ml-2 text-xs text-white/40 font-medium tracking-wider uppercase">Agências</span>
          </motion.div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mb-12"
          >
            <div className="relative w-[380px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Header do Dashboard */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5de0e6] to-[#004aad]" />
                  <span className="text-white/70 text-sm font-medium">Dashboard</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
              </div>
              
              {/* Stats */}
              <div className="p-5 grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[#5de0e6] text-lg font-semibold">128</p>
                  <p className="text-white/40 text-xs">Clientes</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[#5de0e6] text-lg font-semibold">47</p>
                  <p className="text-white/40 text-xs">Viagens</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-[#5de0e6] text-lg font-semibold">94%</p>
                  <p className="text-white/40 text-xs">Satisfação</p>
                </div>
              </div>

              {/* Lista de viagens */}
              <div className="px-5 pb-5 space-y-2">
                {[
                  { name: "Paris Premium", client: "Maria S.", status: "Ativa" },
                  { name: "Tokyo Experience", client: "João P.", status: "Planejando" },
                ].map((trip, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white/80 text-sm">{trip.name}</p>
                      <p className="text-white/40 text-xs">{trip.client}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      trip.status === "Ativa" 
                        ? "bg-[#5de0e6]/20 text-[#5de0e6]" 
                        : "bg-[#004aad]/20 text-[#5de0e6]/70"
                    }`}>
                      {trip.status}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="absolute -inset-2 bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 rounded-3xl blur-xl -z-10" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1 className="text-4xl xl:text-5xl font-semibold text-white leading-tight mb-6 text-balance">
              Transforme a experiência{" "}
              <span className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] bg-clip-text text-transparent">
                dos seus clientes.
              </span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Crie viagens inteligentes, compartilhe links e ofereça concierge IA para seus passageiros.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#004aad]/10 to-[#5de0e6]/10 rounded-3xl blur-xl" />
            
            <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10">
              <div className="lg:hidden flex justify-center mb-8">
                <Image
                  src="/vuei-logo.png"
                  alt="Vuei"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </div>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Criar portal da agência
                </h2>
                <p className="text-white/50">
                  Comece a transformar viagens
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome da Agência */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Nome da agência</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="text"
                      placeholder="Sua agência"
                      value={formData.agencyName}
                      onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.agencyName ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.agencyName && <p className="text-red-400 text-xs">{errors.agencyName}</p>}
                </div>

                {/* Nome Responsável */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Nome do responsável</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="text"
                      placeholder="Seu nome"
                      value={formData.responsibleName}
                      onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.responsibleName ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.responsibleName && <p className="text-red-400 text-xs">{errors.responsibleName}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Email corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="email"
                      placeholder="contato@agencia.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.email ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
                </div>

                {/* WhatsApp e Agentes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <Input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                        className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.whatsapp ? 'border-red-500/50' : ''}`}
                      />
                    </div>
                    {errors.whatsapp && <p className="text-red-400 text-xs">{errors.whatsapp}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Agentes</label>
                    <Select
                      value={formData.agentCount}
                      onValueChange={(value) => setFormData({ ...formData, agentCount: value })}
                    >
                      <SelectTrigger className={`h-12 bg-white/5 border-white/10 text-white rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 ${errors.agentCount ? 'border-red-500/50' : ''}`}>
                        <Users className="w-5 h-5 text-white/30 mr-2" />
                        <SelectValue placeholder="Qtd" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-white/10">
                        <SelectItem value="1-5">1-5</SelectItem>
                        <SelectItem value="6-20">6-20</SelectItem>
                        <SelectItem value="21-50">21-50</SelectItem>
                        <SelectItem value="50+">50+</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.agentCount && <p className="text-red-400 text-xs">{errors.agentCount}</p>}
                  </div>
                </div>

                {/* Senhas */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`pl-12 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.password ? 'border-red-500/50' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-red-400 text-xs">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70 font-medium">Confirmar</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`pl-12 pr-10 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-[#5de0e6] data-[state=checked]:border-[#5de0e6]"
                    />
                    <label htmlFor="terms" className="text-sm text-white/50 leading-relaxed cursor-pointer">
                      Aceito os{" "}
                      <Link href="/terms" className="text-[#5de0e6] hover:underline">termos</Link>
                      {" "}e{" "}
                      <Link href="/privacy" className="text-[#5de0e6] hover:underline">privacidade</Link>
                    </label>
                  </div>
                  {errors.terms && <p className="text-red-400 text-xs">{errors.terms}</p>}

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="news"
                      checked={acceptNews}
                      onCheckedChange={(checked) => setAcceptNews(checked as boolean)}
                      className="mt-0.5 border-white/20 data-[state=checked]:bg-[#5de0e6] data-[state=checked]:border-[#5de0e6]"
                    />
                    <label htmlFor="news" className="text-sm text-white/50 cursor-pointer">
                      Quero receber novidades e dicas
                    </label>
                  </div>
                </div>

                {/* Botão */}
                <Button
                  type="submit"
                  disabled={isLoading || loading || !canSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#5de0e6]/20 mt-4"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Criar portal da agência
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                {errors.auth && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-red-400">
                    {errors.auth}
                  </motion.p>
                )}
              </form>

              {/* Divisor */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-sm">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Secondary buttons */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl transition-all"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continuar com Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl transition-all"
                >
                  <Calendar className="w-5 h-5 mr-3" />
                  Agendar demonstração
                </Button>
              </div>

              {/* Link */}
              <p className="mt-8 text-center text-white/50 text-sm">
                Já possui uma conta?{" "}
                <Link href="/login" className="text-[#5de0e6] hover:underline font-medium">
                  Entrar
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
