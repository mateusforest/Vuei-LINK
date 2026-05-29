"use client"

import { motion } from "framer-motion"
import { Plane, Sparkles, Calendar, FileText, Users, MessageCircle, Wifi } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24 pb-20">
      {/* Background Grid */}
      <div className="absolute inset-0 vuei-grid opacity-50" />
      
      {/* Gradient Orbs */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#5de0e6]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#004aad]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
            >
              <Sparkles className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-sm text-white/80">IA para viagens</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-tight text-balance"
            >
              <span className="text-white">Tudo da sua viagem.</span>
              <br />
              <span className="vuei-gradient-text">Em um único lugar.</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="text-lg text-white/60 max-w-xl leading-relaxed"
            >
              Roteiros, documentos, concierge IA, compartilhamento e acesso offline em um único link.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-wrap gap-4"
            >
              <motion.a
                href="/onboarding"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative inline-flex items-center px-8 py-4 text-base font-medium text-black bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-xl overflow-hidden group vuei-button-glow"
              >
                <span className="relative z-10">Criar viagem</span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#004aad] to-[#5de0e6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </motion.a>
              
              <motion.a
                href="#como-funciona"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center px-8 py-4 text-base font-medium text-white bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all duration-300"
              >
                Ver demonstração
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Hero Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            className="relative"
          >
            <div className="relative animate-float">
              {/* Phone Mockup */}
              <div className="relative mx-auto w-[280px] sm:w-[320px]">
                <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] rounded-[40px] p-3 vuei-glow">
                  <div className="bg-black rounded-[32px] overflow-hidden">
                    {/* Phone Screen Content */}
                    <div className="relative aspect-[9/19] bg-gradient-to-b from-[#0a0a0a] to-[#050505]">
                      {/* Status Bar */}
                      <div className="flex items-center justify-between px-6 py-3">
                        <span className="text-xs text-white/60">9:41</span>
                        <div className="flex items-center gap-1">
                          <Wifi className="w-3 h-3 text-white/60" />
                          <div className="w-6 h-2.5 bg-white/60 rounded-sm" />
                        </div>
                      </div>
                      
                      {/* App Header */}
                      <div className="px-5 py-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                            <Plane className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">Viagem Paris 2024</p>
                            <p className="text-white/40 text-xs">15-22 Dezembro</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="grid grid-cols-3 gap-3 p-5">
                        <QuickAction icon={Calendar} label="Roteiro" />
                        <QuickAction icon={FileText} label="Docs" />
                        <QuickAction icon={Users} label="Grupo" />
                      </div>

                      {/* Chat Preview */}
                      <div className="mx-5 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                            <MessageCircle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs text-white/40 mb-1">Concierge IA</p>
                            <p className="text-sm text-white/80 leading-relaxed">
                              O Louvre está a 15min do seu hotel. Quer que eu sugira horários?
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Navigation */}
                      <div className="absolute bottom-0 inset-x-0 p-5">
                        <div className="flex items-center justify-center gap-8">
                          <div className="w-12 h-1 rounded-full bg-white/30" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card - Right */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
                className="absolute -right-4 sm:right-0 top-1/4 p-4 rounded-2xl vuei-glass"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#5de0e6]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#5de0e6]" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Link compartilhado</p>
                    <p className="text-xs text-white/40">3 pessoas acessaram</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating Card - Left */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1, duration: 0.6 }}
                className="absolute -left-4 sm:left-0 bottom-1/4 p-4 rounded-2xl vuei-glass"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#004aad]/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-[#5de0e6]" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Docs protegidos</p>
                    <p className="text-xs text-white/40">Acesso offline</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Gradient Line */}
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent animate-pulse-line" />
    </section>
  )
}

function QuickAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
      <Icon className="w-5 h-5 text-[#5de0e6]" />
      <span className="text-xs text-white/60">{label}</span>
    </div>
  )
}
