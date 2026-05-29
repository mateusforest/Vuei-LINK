"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useState } from "react"
import { Mail, Lock, ArrowRight, Chrome } from "lucide-react"

export function LoginSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })
  const [isLogin, setIsLogin] = useState(true)

  return (
    <section id="login" className="relative py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 vuei-grid opacity-30" />
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-[#004aad]/5 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
              <span className="text-white">Continue sua</span>
              <br />
              <span className="vuei-gradient-text">experiência de viagem.</span>
            </h2>
            <p className="text-white/50 text-lg leading-relaxed max-w-md">
              Acesse sua conta e gerencie viagens, links e concierge em um único lugar.
            </p>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="p-8 rounded-3xl vuei-glass">
              {/* Tab Switcher */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-8">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                    isLogin
                      ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Entrar
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 ${
                    !isLogin
                      ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-black"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Criar conta
                </button>
              </div>

              <form className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none focus:border-[#5de0e6]/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm text-white/60">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none focus:border-[#5de0e6]/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 text-base font-medium text-black bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-xl vuei-button-glow group"
                >
                  <span>{isLogin ? "Entrar" : "Criar conta"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/30">ou continue com</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <Chrome className="w-5 h-5 text-white/70" />
                  <span className="text-sm text-white/70">Google</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <svg className="w-5 h-5 text-white/70" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                  <span className="text-sm text-white/70">Apple</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient Line */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent" />
    </section>
  )
}
