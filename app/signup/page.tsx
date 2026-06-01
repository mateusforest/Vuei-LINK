"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock, User, Phone, ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/auth-context"
import { getRedirectByRole } from "@/lib/auth/role-redirect"

export default function SignupPage() {
  const router = useRouter()
  const { signUp, user, profile, loading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!loading && user) {
      router.replace(getRedirectByRole(profile?.role))
    }
  }, [loading, profile?.role, router, user])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.name) newErrors.name = "Nome obrigatório"
    if (!formData.email) newErrors.email = "Email obrigatório"
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email inválido"
    if (!formData.phone) newErrors.phone = "Telefone obrigatório"
    if (!formData.password) newErrors.password = "Senha obrigatória"
    else if (formData.password.length < 6) newErrors.password = "Mínimo 6 caracteres"
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Senhas não conferem"
    if (!acceptTerms) newErrors.terms = "Aceite os termos"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsLoading(true)
    setErrors({})
    try {
      const result = await signUp({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        role: "traveler",
        metadata: {
          full_name: formData.name,
        },
      })
      if (result.error) {
        console.error("Cadastro Vuei - erro recebido da camada auth:", result.error)
        setErrors((prev) => ({ ...prev, auth: result.error || "Nao foi possivel criar a conta com esses dados." }))
        return
      }

      const redirectPath = getRedirectByRole(result.profile?.role ?? profile?.role)
      console.log("[AUTH] role detectada", result.profile?.role ?? profile?.role ?? null)
      console.log("[AUTH] redirect destino", redirectPath)
      router.replace(redirectPath)
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = () => {
    const { password } = formData
    if (!password) return 0
    let strength = 0
    if (password.length >= 6) strength++
    if (password.length >= 8) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++
    return strength
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Lado Esquerdo - Visual Emocional */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5de0e6]/10 via-background to-[#004aad]/20" />
        
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(93, 224, 230, 0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(93, 224, 230, 0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />

        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-[#5de0e6]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-[#004aad]/20 rounded-full blur-[100px]" />

        {/* Floating Elements */}
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 right-20 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 backdrop-blur-xl border border-white/10"
        />
        <motion.div
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/3 right-32 w-12 h-12 rounded-xl bg-gradient-to-br from-[#004aad]/20 to-[#5de0e6]/20 backdrop-blur-xl border border-white/10"
        />

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
          </motion.div>

          {/* Ilustração de viagem */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mb-12"
          >
            <div className="relative w-[300px] h-[240px]">
              {/* Card de destino */}
              <div className="absolute top-0 left-0 w-[200px] rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
                <div className="h-24 bg-gradient-to-br from-[#5de0e6]/30 to-[#004aad]/30 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl">🗼</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-white/90 font-medium">Paris</p>
                  <p className="text-white/40 text-sm">França</p>
                </div>
              </div>
              
              {/* Card flutuante */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-0 right-0 w-[160px] rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 p-4 shadow-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/70 text-sm">Concierge</span>
                </div>
                <p className="text-white/50 text-xs">Pronto para ajudar</p>
              </motion.div>

              <div className="absolute -inset-4 bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 rounded-3xl blur-2xl -z-10" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h1 className="text-4xl xl:text-5xl font-semibold text-white leading-tight mb-6 text-balance">
              Sua próxima viagem{" "}
              <span className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] bg-clip-text text-transparent">
                começa aqui.
              </span>
            </h1>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Organize roteiros, documentos e concierge em um único link inteligente.
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
            <div className="absolute -inset-1 bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 rounded-3xl blur-xl" />
            
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
                  Criar sua conta
                </h2>
                <p className="text-white/50">
                  Comece a organizar suas viagens
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Nome completo</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="text"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.name ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.email ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs">{errors.email}</p>}
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.phone ? 'border-red-500/50' : ''}`}
                    />
                  </div>
                  {errors.phone && <p className="text-red-400 text-xs">{errors.phone}</p>}
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  {/* Password strength */}
                  {formData.password && (
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            passwordStrength() >= level 
                              ? level <= 2 ? 'bg-red-400' : level <= 3 ? 'bg-yellow-400' : 'bg-[#5de0e6]'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {errors.password && <p className="text-red-400 text-xs">{errors.password}</p>}
                </div>

                {/* Confirmar Senha */}
                <div className="space-y-2">
                  <label className="text-sm text-white/70 font-medium">Confirmar senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={`pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all ${errors.confirmPassword ? 'border-red-500/50' : ''}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs">{errors.confirmPassword}</p>}
                </div>

                {/* Termos */}
                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    className="mt-0.5 border-white/20 data-[state=checked]:bg-[#5de0e6] data-[state=checked]:border-[#5de0e6]"
                  />
                  <label htmlFor="terms" className="text-sm text-white/50 leading-relaxed cursor-pointer">
                    Aceito os{" "}
                    <Link href="/terms" className="text-[#5de0e6] hover:underline">termos de uso</Link>
                    {" "}e{" "}
                    <Link href="/privacy" className="text-[#5de0e6] hover:underline">política de privacidade</Link>
                  </label>
                </div>
                {errors.terms && <p className="text-red-400 text-xs">{errors.terms}</p>}

                {/* Botão */}
                <Button
                  type="submit"
                  disabled={isLoading || loading}
                  className="w-full h-12 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#5de0e6]/20 mt-6"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Criar minha conta
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                {errors.auth && <p className="text-center text-xs text-red-400">{errors.auth}</p>}
              </form>

              {/* Divisor */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/30 text-sm">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Social */}
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
