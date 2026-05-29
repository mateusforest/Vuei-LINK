"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { MessageCircle, Sparkles, WifiOff, FileCheck, Map, Send } from "lucide-react"

export function ConciergeSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="concierge" className="relative py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 vuei-grid opacity-30" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5de0e6]/3 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-6">
            <span className="text-white">Assistente inteligente.</span>
            <br />
            <span className="vuei-gradient-text">Sempre com você.</span>
          </h2>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Concierge IA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5de0e6]/10 border border-[#5de0e6]/20">
              <Sparkles className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-sm text-[#5de0e6]">Concierge IA</span>
            </div>

            <h3 className="text-2xl font-semibold text-white">
              Chat contextual durante toda a viagem
            </h3>

            <p className="text-white/50 leading-relaxed">
              O concierge entende seu roteiro, seus documentos e te ajuda com sugestões personalizadas em tempo real.
            </p>

            {/* Chat Mockup */}
            <div className="relative p-6 rounded-2xl vuei-glass animate-glow-pulse">
              <div className="space-y-4">
                {/* AI Message */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <p className="text-sm text-white/80 leading-relaxed">
                      Bom dia! Vi que você tem visita ao Louvre hoje às 14h. O tempo está bom, que tal almoçar no Café Marly antes? Fica dentro do museu.
                    </p>
                  </div>
                </div>

                {/* User Message */}
                <div className="flex items-start gap-3 justify-end">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#5de0e6]/20 to-[#004aad]/20 border border-[#5de0e6]/20">
                    <p className="text-sm text-white/90">
                      Ótima ideia! Tem reserva disponível?
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <p className="text-sm text-white/80 leading-relaxed">
                      Achei mesa para 12h30. Posso confirmar para vocês?
                    </p>
                  </div>
                </div>

                {/* Input */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <input
                    type="text"
                    placeholder="Pergunte ao concierge..."
                    className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
                    disabled
                  />
                  <button className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                    <Send className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Offline Mode */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#004aad]/20 border border-[#004aad]/30">
              <WifiOff className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-sm text-[#5de0e6]">Modo Offline</span>
            </div>

            <h3 className="text-2xl font-semibold text-white">
              Acesso sem internet
            </h3>

            <p className="text-white/50 leading-relaxed">
              Seus vouchers, documentos e roteiro ficam salvos no dispositivo. Acesse tudo mesmo sem conexão.
            </p>

            {/* Offline Mockup */}
            <div className="relative p-6 rounded-2xl vuei-glass">
              <div className="space-y-4">
                {/* Offline Status */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#004aad]/10 to-transparent border border-[#004aad]/20">
                  <WifiOff className="w-5 h-5 text-[#5de0e6]" />
                  <div>
                    <p className="text-sm text-white font-medium">Modo offline ativo</p>
                    <p className="text-xs text-white/40">Seus dados estão salvos localmente</p>
                  </div>
                </div>

                {/* Available Offline */}
                <div className="space-y-3">
                  <p className="text-xs text-white/40 uppercase tracking-wider">Disponível offline</p>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <FileCheck className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Voucher Hotel Marriott</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">✓</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <FileCheck className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Boarding Pass - AF1234</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">✓</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <Map className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Roteiro completo</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">✓</span>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <FileCheck className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Reserva restaurante</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
