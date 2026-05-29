"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 lg:p-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 rounded-3xl blur-xl" />

          <div className="relative bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 p-8 lg:p-10">
            <Link href="/login" className="inline-flex items-center gap-2 text-white/50 hover:text-white/70 text-sm transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Voltar para login
            </Link>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-white mb-2">Recuperar acesso</h1>
              <p className="text-white/50">Informe seu email para continuar o fluxo de recuperacao.</p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-white/70 font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl focus:border-[#5de0e6]/50 focus:ring-[#5de0e6]/20 transition-all"
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-12 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white font-medium rounded-xl transition-all duration-300 shadow-lg shadow-[#5de0e6]/20"
              >
                Enviar link de recuperacao
              </Button>

              <p className="text-center text-xs text-white/45">
                Fluxo preparado no frontend. A integracao real de reset sera conectada ao Supabase na etapa de auth completa.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
