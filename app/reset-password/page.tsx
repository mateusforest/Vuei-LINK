"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, CheckCircle2, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/auth-context"

export default function ResetPasswordPage() {
  const router = useRouter()
  const { initialized, loading, session, signOut, updatePassword } = useAuth()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(() => password.length >= 6 && password === confirmPassword, [confirmPassword, password])

  useEffect(() => {
    if (!initialized || loading || session) return
    setError("Este link de recuperação é inválido ou expirou. Solicite um novo email para continuar.")
  }, [initialized, loading, session])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!session) {
      setError("Abra novamente o link enviado por email para redefinir sua senha.")
      return
    }

    if (!password || !confirmPassword) {
      setError("Preencha e confirme sua nova senha.")
      return
    }

    if (password.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (password !== confirmPassword) {
      setError("A confirmação da senha precisa ser igual à nova senha.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await updatePassword(password)
      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess("Senha atualizada com sucesso. Você será redirecionado para o login.")
      await signOut()
      window.setTimeout(() => {
        router.replace("/login")
      }, 1400)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#101828]">
      <div className="flex min-h-screen items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="relative">
            <div className="absolute -inset-2 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(93,224,230,0.18),transparent_38%),radial-gradient(circle_at_bottom,rgba(0,74,173,0.08),transparent_34%)] blur-2xl" />

            <div className="relative rounded-[32px] border border-black/6 bg-white/92 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-10">
              <Link href="/login" className="mb-6 inline-flex items-center gap-2 text-sm text-[#667085] transition-colors hover:text-[#475467]">
                <ArrowLeft className="h-4 w-4" />
                Voltar para login
              </Link>

              <div className="mb-8 text-center">
                <h1 className="mb-2 text-2xl font-semibold text-[#101828]">Definir nova senha</h1>
                <p className="text-[#667085]">Escolha uma nova senha para recuperar o acesso à sua conta.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#344054]">Nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#344054]">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b3]" />
                    <Input
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-12 rounded-2xl border border-black/8 bg-[#fbfbfc] pl-12 text-[#101828] placeholder:text-[#98a2b3] transition-all focus:border-[#8ed8ff] focus:bg-white focus:ring-[#8ed8ff]/20"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !canSubmit || !session}
                  className="h-12 w-full rounded-2xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] transition-all duration-300 hover:opacity-95"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </Button>

                {error ? <p className="text-center text-sm text-red-500">{error}</p> : null}
                {success ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{success}</p>
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
