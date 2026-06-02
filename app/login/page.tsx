"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"
import { getRedirectByRole } from "@/lib/auth/role-redirect"

type AppRole = "traveler" | "agency_owner" | "agency_member" | "master"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, user, profile, loading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string; auth?: string }>({})
  const [safeRedirect, setSafeRedirect] = useState<string | null>(null)
  const canSubmit = email.trim().length > 0 && password.length >= 6

  useEffect(() => {
    if (typeof window === "undefined") return
    const requestedRedirect = new URLSearchParams(window.location.search).get("redirect")
    setSafeRedirect(requestedRedirect && requestedRedirect.startsWith("/") ? requestedRedirect : null)
  }, [])

  useEffect(() => {
    const resolvedRole = (profile?.role ?? user?.user_metadata?.role) as AppRole | undefined
    if (!loading && user && resolvedRole) {
      router.replace(safeRedirect || getRedirectByRole(resolvedRole))
    }
  }, [loading, profile?.role, router, safeRedirect, user])

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {}
    if (!email) newErrors.email = "Email obrigatório"
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = "Email inválido"
    if (!password) newErrors.password = "Senha obrigatória"
    else if (password.length < 6) newErrors.password = "Mínimo 6 caracteres"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsLoading(true)
    setErrors({})
    console.log("[AUTH] login started")

    try {
      const result = await signIn({ email: email.trim(), password })
      if (result.error) {
        console.error("[AUTH ERROR]", result.error)
        const authMessage = result.error.includes("429")
          ? "Muitas tentativas. Aguarde um momento e tente novamente."
          : result.error
        setErrors((prev) => ({ ...prev, auth: authMessage }))
        return
      }

      const detectedRole = (result.profile?.role ?? profile?.role ?? result.user?.user_metadata?.role) as AppRole | undefined
      const redirectPath = safeRedirect || getRedirectByRole(detectedRole)
      console.log("[AUTH] role detected", detectedRole ?? null)
      console.log("[AUTH] redirect target", redirectPath)
      router.replace(redirectPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel entrar agora."
      console.error("[AUTH ERROR]", message)
      setErrors((prev) => ({ ...prev, auth: message }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Lado Esquerdo - Visual Emocional */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background com gradiente */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#004aad]/20 via-background to-[#5de0e6]/10" />
        
        {/* Grid discreto */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(93, 224, 230, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(93, 224, 230, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        {/* Glow elements */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#5de0e6]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#004aad]/20 rounded-full blur-[100px]" />

        {/* Linhas luminosas */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <motion.line
            x1="0%" y1="30%" x2="100%" y2="70%"
            stroke="url(#lineGradient)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 3, ease: "easeInOut" }}
          />
          <motion.line
            x1="20%" y1="0%" x2="80%" y2="100%"
            stroke="url(#lineGradient)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 3, delay: 0.5, ease: "easeInOut" }}
          />
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5de0e6" stopOpacity="0" />
              <stop offset="50%" stopColor="#5de0e6" stopOpacity="1" />
              <stop offset="100%" stopColor="#004aad" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          {/* Logo */}
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
          </motion.div>

          {/* Mockup Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mb-12"
          >
            <div className="relative w-[320px] h-[200px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                  <span className="text-white text-sm font-medium">P</span>
                </div>
                <div>
                  <p className="text-white/90 text-sm font-medium">Paris 2024</p>
                  <p className="text-white/50 text-xs">15 - 22 Dezembro</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5de0e6]" />
                  <span className="text-white/60 text-xs">Roteiro completo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5de0e6]" />
                  <span className="text-white/60 text-xs">12 documentos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#5de0e6]" />
                  <span className="text-white/60 text-xs">Concierge IA ativo</span>
                </div>
              </div>
              {/* Glow do card */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#5de0e6]/20 to-[#004aad]/20 rounded-2xl blur-xl -z-10" />
            </div>
          </motion.div>

          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1 className="text-4xl xl:text-5xl font-semibold text-white leading-tight mb-6 text-balance">
              Sua viagem inteira.{" "}
              <span className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] bg-clip-text text-transparent">
                Em um único lugar.
              </span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Roteiros, documentos, concierge IA e tudo da sua viagem organizado em um único link inteligente.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Card de Login */}
          <div className="relative">
            {/* Glow background */}
            <div className="absolute -inset-1 bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 rounded-3xl blur-xl" />
            
            <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10">
              {/* Logo mobile */}
              <div className="lg:hidden flex justify-center mb-8">
                <Image
                  src="/vuei-logo.png"
                  alt="Vuei"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Bem-vindo de volta
                </h2>
                <p className="text-white/50">
                  Entre para acessar suas viagens
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.email ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.email && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-xs"
                    >
                      {errors.email}
                    </motion.p>
                  )}
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-white/70 font-medium">Senha</label>
                    <Link 
                      href="/forgot-password"
                      className="text-xs text-[#5de0e6] hover:text-[#5de0e6]/80 transition-colors"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.password ? 'border-red-500/50' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-xs"
                    >
                      {errors.password}
                    </motion.p>
                  )}
                </div>

                {/* Botão Entrar */}
                <Button
                  type="submit"
                  disabled={isLoading || !canSubmit}
                  className="w-full h-12 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#5de0e6]/20"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Entrar
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

              {/* Social Login */}
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
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  Continuar com Apple
                </Button>
              </div>

              {/* Links */}
              <div className="mt-8 text-center space-y-3">
                <p className="text-white/50 text-sm">
                  Não tem uma conta?{" "}
                  <Link href="/signup" className="text-[#5de0e6] hover:underline font-medium">
                    Criar conta
                  </Link>
                </p>
                <Link 
                  href="/agency/signup"
                  className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors"
                >
                  Sou uma agência
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
