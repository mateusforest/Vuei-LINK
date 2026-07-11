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
import { getSafeRedirectFromWindow } from "@/lib/auth/safe-redirect"

type AppRole = "traveler" | "agency_owner" | "agency_member" | "master"

export default function LoginPage() {
  const router = useRouter()
  const { signIn, user, profile, loading, initialized } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string; auth?: string }>({})
  const [safeRedirect, setSafeRedirect] = useState<string | null | undefined>(undefined)
  const canSubmit = email.trim().length > 0 && password.length >= 6
  const signupHref = safeRedirect ? `/signup?redirect=${encodeURIComponent(safeRedirect)}` : "/criar-viagem"

  useEffect(() => {
    setSafeRedirect(getSafeRedirectFromWindow())
  }, [])

  useEffect(() => {
    if (safeRedirect === undefined || !initialized) return
    const resolvedRole = (profile?.role ?? user?.user_metadata?.role) as AppRole | undefined
    if (!loading && user && resolvedRole) {
      router.replace(safeRedirect || getRedirectByRole(resolvedRole))
    }
  }, [initialized, loading, profile?.role, router, safeRedirect, user])

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
      const message = error instanceof Error ? error.message : "Não foi possível entrar agora."
      console.error("[AUTH ERROR]", message)
      setErrors((prev) => ({ ...prev, auth: message }))
    } finally {
      setIsLoading(false)
    }
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-10 max-w-[420px] rounded-[32px] border border-black/6 bg-white/88 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff] to-[#0b56d8] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(11,86,216,0.18)]">
                  V
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Tudo pronto para a sua viagem</p>
                  <p className="text-xs text-[#667085]">Acesse roteiros, documentos e concierge em um único lugar.</p>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  "Passagens centralizadas com acesso rápido",
                  "Documentos organizados no mesmo link",
                  "Concierge IA pronto para ajudar você",
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
                Sua viagem inteira.
                <span className="block bg-gradient-to-r from-[#38c8ff] to-[#0b56d8] bg-clip-text text-transparent">
                  Em um único lugar.
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-[#667085]">
                Uma experiência clara, leve e premium para acompanhar cada etapa da viagem sem ruído visual.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
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
                  <h2 className="mb-2 text-2xl font-semibold text-[#101828]">Bem-vindo de volta</h2>
                  <p className="text-[#667085]">Entre para acessar suas viagens</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.email ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.email ? (
                      <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500">
                        {errors.email}
                      </motion.p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-[#344054]">Senha</label>
                      <Link href="/forgot-password" className="text-xs text-[#0b56d8] transition-colors hover:text-[#0a4fc8]">
                        Esqueci minha senha
                      </Link>
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="********"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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

                    {errors.password ? (
                      <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-red-500">
                        {errors.password}
                      </motion.p>
                    ) : null}
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] transition-all duration-300 hover:opacity-95"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Entrar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  {errors.auth ? (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-red-500">
                      {errors.auth}
                    </motion.p>
                  ) : null}
                </form>

                <div className="mt-8 text-center">
                  <p className="text-sm text-[#667085]">
                    Não tem uma conta?{" "}
                    <Link href={signupHref} className="font-medium text-[#0b56d8] hover:underline">
                      Criar conta
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
