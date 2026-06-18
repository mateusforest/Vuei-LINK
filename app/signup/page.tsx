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
import { getSafeRedirectFromWindow } from "@/lib/auth/safe-redirect"

export default function SignupPage() {
  const router = useRouter()
  const { signUp, user, profile, loading, initialized } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [safeRedirect, setSafeRedirect] = useState<string | null | undefined>(undefined)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const canSubmit =
    formData.name.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(formData.email) &&
    formData.phone.trim().length > 0 &&
    formData.password.length >= 6 &&
    formData.password === formData.confirmPassword &&
    acceptTerms

  useEffect(() => {
    setSafeRedirect(getSafeRedirectFromWindow())
  }, [])

  useEffect(() => {
    if (safeRedirect === undefined || !initialized) return
    const resolvedRole = profile?.role ?? (user?.user_metadata?.role as any)
    if (!loading && user && resolvedRole) {
      router.replace(safeRedirect || getRedirectByRole(resolvedRole))
    }
  }, [initialized, loading, profile?.role, router, safeRedirect, user])

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
    console.log("[AUTH] signup started")
    try {
      const result = await signUp({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: "traveler",
        metadata: {
          full_name: formData.name.trim(),
          phone: formData.phone.trim(),
        },
      })
      if (result.error) {
        console.error("Cadastro Vuei - erro recebido da camada auth:", result.error)
        const authMessage = result.error.includes("429")
          ? "Muitas tentativas. Aguarde um momento e tente novamente."
          : result.error || "Não foi possível criar a conta com esses dados."
        setErrors((prev) => ({ ...prev, auth: authMessage }))
        return
      }

      const detectedRole = result.profile?.role ?? profile?.role ?? (result.user?.user_metadata?.role as any)
      const redirectPath = safeRedirect || getRedirectByRole(detectedRole)
      console.log("[AUTH] role detected", detectedRole ?? null)
      console.log("[AUTH] redirect target", redirectPath)
      router.replace(redirectPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir o cadastro."
      console.error("[AUTH ERROR]", message)
      setErrors((prev) => ({ ...prev, auth: message }))
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
    <div className="min-h-screen bg-[#f5f5f7] text-[#101828]">
      <div className="flex min-h-screen">
        <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(93,224,230,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,74,173,0.08),transparent_34%),linear-gradient(180deg,#fcfcfd_0%,#f5f5f7_100%)]" />

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

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-10 max-w-[430px] rounded-[32px] border border-black/6 bg-white/88 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff] to-[#0b56d8] text-white shadow-[0_12px_24px_rgba(11,86,216,0.18)]">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Sua conta Vuei começa aqui</p>
                  <p className="text-xs text-[#667085]">Cadastre-se para centralizar a viagem em uma experiencia leve.</p>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  "Organize roteiros, documentos e hospedagens",
                  "Compartilhe a viagem com quem importa",
                  "Tenha suporte do concierge em um único fluxo",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-black/6 bg-[#f8fafc] px-4 py-3 text-sm text-[#475467]">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="max-w-[32rem]"
            >
              <h1 className="mb-6 text-4xl font-semibold leading-tight tracking-[-0.05em] text-[#101828] xl:text-5xl">
                Sua próxima viagem
                <span className="block bg-gradient-to-r from-[#38c8ff] to-[#0b56d8] bg-clip-text text-transparent">
                  começa aqui.
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-[#667085]">
                Um cadastro mais leve, claro e alinhado a nova identidade visual do Vuei, sem mexer no fluxo real.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center overflow-y-auto p-6 lg:w-1/2 lg:p-12">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <div className="relative">
              <div className="absolute -inset-2 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(93,224,230,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(0,74,173,0.08),transparent_34%)] blur-2xl" />

              <div className="relative rounded-[32px] border border-black/6 bg-white/92 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-10">
                <div className="mb-8 flex justify-center lg:hidden">
                  <Image
                    src="/vuei-logo.png"
                    alt="Vuei"
                    width={120}
                    height={40}
                    className="h-10 w-auto"
                  />
                </div>

                <div className="mb-8 text-center">
                  <h2 className="mb-2 text-2xl font-semibold text-[#101828]">Criar sua conta</h2>
                  <p className="text-[#667085]">Comece a organizar suas viagens</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Nome completo</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="text"
                        placeholder="Seu nome"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.name ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.name ? <p className="text-xs text-red-500">{errors.name}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.email ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.email ? <p className="text-xs text-red-500">{errors.email}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.phone ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.phone ? <p className="text-xs text-red-500">{errors.phone}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="********"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 pr-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.password ? "border-red-400/70" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#98a2b3] transition-colors hover:text-[#475467]"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>

                    {formData.password ? (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              passwordStrength() >= level
                                ? level <= 2
                                  ? "bg-red-400"
                                  : level <= 3
                                    ? "bg-yellow-400"
                                    : "bg-[#37beff]"
                                : "bg-black/8"
                            }`}
                          />
                        ))}
                      </div>
                    ) : null}

                    {errors.password ? <p className="text-xs text-red-500">{errors.password}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Confirmar senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="********"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 pr-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.confirmPassword ? "border-red-400/70" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#98a2b3] transition-colors hover:text-[#475467]"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword ? <p className="text-xs text-red-500">{errors.confirmPassword}</p> : null}
                  </div>

                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                      className="mt-0.5 border-black/12 data-[state=checked]:border-[#37beff] data-[state=checked]:bg-[#37beff]"
                    />
                    <label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-[#667085]">
                      Aceito os{" "}
                      <Link href="/terms" className="text-[#0b56d8] hover:underline">
                        termos de uso
                      </Link>
                      {" "}e{" "}
                      <Link href="/privacy" className="text-[#0b56d8] hover:underline">
                        política de privacidade
                      </Link>
                    </label>
                  </div>
                  {errors.terms ? <p className="text-xs text-red-500">{errors.terms}</p> : null}

                  <Button
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] transition-all duration-300 hover:opacity-95"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Criar minha conta
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {errors.auth ? <p className="text-center text-xs text-red-500">{errors.auth}</p> : null}
                </form>

                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-black/8" />
                  <span className="text-sm text-[#98a2b3]">ou</span>
                  <div className="h-px flex-1 bg-black/8" />
                </div>

                <div className="space-y-3">
                  <Button
                    variant="outline"
                    type="button"
                    disabled
                    title="Cadastro social indisponível neste momento."
                    className="h-12 w-full rounded-2xl border border-black/8 bg-white text-[#344054] transition-all hover:bg-[#f8fafc] hover:text-[#101828]"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continuar com Google
                  </Button>

                  <Button
                    variant="outline"
                    type="button"
                    disabled
                    title="Cadastro social indisponível neste momento."
                    className="h-12 w-full rounded-2xl border border-black/8 bg-white text-[#344054] transition-all hover:bg-[#f8fafc] hover:text-[#101828]"
                  >
                    <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    Continuar com Apple
                  </Button>
                </div>

                <p className="mt-8 text-center text-sm text-[#667085]">
                  Já possui uma conta?{" "}
                  <Link href="/login" className="font-medium text-[#0b56d8] hover:underline">
                    Entrar
                  </Link>
                </p>
                <p className="text-center text-xs text-[#98a2b3]">Cadastro social indisponível neste momento.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
