"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock, Building2, User, Phone, Users, ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/contexts/auth-context"
import { getRedirectByRole } from "@/lib/auth/role-redirect"
import { getSafeRedirectFromWindow } from "@/lib/auth/safe-redirect"
import { createAgency, getAgencyByOwner } from "@/lib/repositories/agencies-repository"

const AGENCY_BOOTSTRAP_ATTEMPTS = 6
const AGENCY_BOOTSTRAP_DELAY_MS = 450

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function AgencySignupPage() {
  const router = useRouter()
  const { signUp, user, profile, loading, initialized, refreshProfile } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptNews, setAcceptNews] = useState(false)
  const [safeRedirect, setSafeRedirect] = useState<string | null | undefined>(undefined)
  const [formData, setFormData] = useState({
    agencyName: "",
    responsibleName: "",
    email: "",
    whatsapp: "",
    agentCount: "",
    password: "",
    confirmPassword: "",
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
    setSafeRedirect(getSafeRedirectFromWindow())
  }, [])

  useEffect(() => {
    if (safeRedirect === undefined || !initialized) return
    const detectedRole = (profile?.role ?? user?.user_metadata?.role) as "traveler" | "agency_owner" | "agency_member" | "master" | undefined
    const hasRealAgency = Boolean(profile?.agencyId)
    if (!loading && user && detectedRole && (detectedRole !== "agency_owner" || hasRealAgency)) {
      router.replace(safeRedirect || getRedirectByRole(detectedRole))
    }
  }, [initialized, loading, profile?.agencyId, profile?.role, router, safeRedirect, user])

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

  const ensureAgencyBootstrap = async (ownerUserId: string) => {
    for (let attempt = 0; attempt < AGENCY_BOOTSTRAP_ATTEMPTS; attempt += 1) {
      await refreshProfile()
      const agencyResult = await getAgencyByOwner(ownerUserId)
      if (agencyResult.data) {
        return agencyResult.data
      }

      await wait(AGENCY_BOOTSTRAP_DELAY_MS)
    }

    return null
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
        setErrors((prev) => ({ ...prev, auth: result.error }))
        return
      }

      if (!result.user) {
        setErrors((prev) => ({ ...prev, auth: "Não foi possível iniciar a sessão após o cadastro." }))
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
        setErrors((prev) => ({ ...prev, auth: agencyResult.error ?? "Não foi possível criar a agência." }))
        return
      }

      const bootstrappedAgency = await ensureAgencyBootstrap(result.user.id)
      if (!bootstrappedAgency) {
        setErrors((prev) => ({
          ...prev,
          auth: "Sua conta foi criada, mas o portal ainda não ficou pronto. Tente entrar novamente em instantes.",
        }))
        return
      }

      router.replace(safeRedirect || "/agencia")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao criar conta."
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
              <span className="mt-3 inline-block text-xs font-medium uppercase tracking-[0.24em] text-[#0b56d8]/72">Agências</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-10 max-w-[430px] rounded-[32px] border border-black/6 bg-white/88 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff] to-[#0b56d8] text-white shadow-[0_12px_24px_rgba(11,86,216,0.18)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0f172a]">Seu portal profissional começa aqui</p>
                  <p className="text-xs text-[#667085]">Crie viagens, links e acompanhamento centralizado para cada cliente.</p>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  "Organize clientes, viagens e documentos em um só fluxo",
                  "Compartilhe links com identidade da sua agência",
                  "Use concierge e recursos operacionais sem perder contexto",
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
                Uma operação mais clara.
                <span className="block bg-gradient-to-r from-[#38c8ff] to-[#0b56d8] bg-clip-text text-transparent">
                  Do primeiro cliente ao embarque.
                </span>
              </h1>
              <p className="text-lg leading-relaxed text-[#667085]">
                Cadastre sua agência no fluxo certo desde o início e entre no portal sem telas intermediárias travadas.
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
                  <h2 className="mb-2 text-2xl font-semibold text-[#101828]">Criar conta de agência</h2>
                  <p className="text-[#667085]">Configure o portal da sua operação e comece a atender seus clientes.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Nome da agência</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="text"
                        placeholder="Sua agência"
                        value={formData.agencyName}
                        onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.agencyName ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.agencyName ? <p className="text-xs text-red-500">{errors.agencyName}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Nome do responsável</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="text"
                        placeholder="Seu nome"
                        value={formData.responsibleName}
                        onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.responsibleName ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.responsibleName ? <p className="text-xs text-red-500">{errors.responsibleName}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#344054]">Email corporativo</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                      <Input
                        type="email"
                        placeholder="contato@agencia.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.email ? "border-red-400/70" : ""}`}
                      />
                    </div>
                    {errors.email ? <p className="text-xs text-red-500">{errors.email}</p> : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                        <Input
                          type="tel"
                          placeholder="(11) 99999-9999"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20 ${errors.whatsapp ? "border-red-400/70" : ""}`}
                        />
                      </div>
                      {errors.whatsapp ? <p className="text-xs text-red-500">{errors.whatsapp}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#344054]">Tamanho da equipe</label>
                      <Select value={formData.agentCount} onValueChange={(value) => setFormData({ ...formData, agentCount: value })}>
                        <SelectTrigger className={`h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] text-[#101828] focus:border-[#8ed8ff] focus:ring-[#8ed8ff]/20 ${errors.agentCount ? "border-red-400/70" : ""}`}>
                          <Users className="mr-2 h-5 w-5 text-[#98a2b3]" />
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="border-black/8 bg-white text-[#101828]">
                          <SelectItem value="1-5">1-5 pessoas</SelectItem>
                          <SelectItem value="6-20">6-20 pessoas</SelectItem>
                          <SelectItem value="21-50">21-50 pessoas</SelectItem>
                          <SelectItem value="50+">Mais de 50</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.agentCount ? <p className="text-xs text-red-500">{errors.agentCount}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
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
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={acceptTerms}
                        onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                        className="mt-0.5 border-black/12 data-[state=checked]:border-[#37beff] data-[state=checked]:bg-[#37beff]"
                      />
                      <label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed text-[#667085]">
                        Aceito os{" "}
                        <Link href="/terms" className="text-[#0b56d8] hover:underline">
                          termos
                        </Link>
                        {" "}e{" "}
                        <Link href="/privacy" className="text-[#0b56d8] hover:underline">
                          privacidade
                        </Link>
                      </label>
                    </div>
                    {errors.terms ? <p className="text-xs text-red-500">{errors.terms}</p> : null}

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="news"
                        checked={acceptNews}
                        onCheckedChange={(checked) => setAcceptNews(checked as boolean)}
                        className="mt-0.5 border-black/12 data-[state=checked]:border-[#37beff] data-[state=checked]:bg-[#37beff]"
                      />
                      <label htmlFor="news" className="cursor-pointer text-sm text-[#667085]">
                        Quero receber novidades e dicas para minha operação.
                      </label>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !canSubmit}
                    className="mt-4 h-12 w-full rounded-2xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] transition-all duration-300 hover:opacity-95"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Criar conta de agência
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

                <div className="mt-8 rounded-2xl border border-black/6 bg-[#f8fafc] px-4 py-3 text-sm text-[#475467]">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0b56d8]" />
                    <p>Depois do cadastro, você entra direto no portal da agência sem precisar recarregar a página.</p>
                  </div>
                </div>

                <p className="mt-8 text-center text-sm text-[#667085]">
                  Já possui uma conta?{" "}
                  <Link href="/login" className="font-medium text-[#0b56d8] hover:underline">
                    Entrar
                  </Link>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
