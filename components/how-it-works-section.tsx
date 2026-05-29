"use client"

import { motion } from "framer-motion"
import { useInView } from "framer-motion"
import { useRef } from "react"
import { Link2, Eye, EyeOff, Plane, MapPin, Users, Lock } from "lucide-react"

export function HowItWorksSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="como-funciona" className="relative py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 vuei-grid opacity-30" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-6">
            <span className="vuei-gradient-text">Como funciona</span>
          </h2>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">
            Três passos para organizar sua viagem de forma inteligente
          </p>
        </motion.div>

        {/* Steps */}
        <div className="space-y-24">
          {/* Step 1 - Create Trip */}
          <FeatureBlock
            index={0}
            isInView={isInView}
            icon={<Plane className="w-6 h-6 text-[#5de0e6]" />}
            title="Crie sua viagem"
            description="Em poucos cliques, você organiza destinos, datas, roteiros e documentos em um único portal inteligente."
            visual={
              <div className="relative p-6 rounded-2xl vuei-glass">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                      <Plane className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Nova viagem</p>
                      <p className="text-white/40 text-sm">Paris, França</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <MapPin className="w-4 h-4 text-[#5de0e6]" />
                      <span className="text-sm text-white/70">Torre Eiffel, Louvre, Montmartre...</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <MapPin className="w-4 h-4 text-[#5de0e6]" />
                      <span className="text-sm text-white/70">Hotel, voos, reservas...</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Step 2 - Generate Link */}
          <FeatureBlock
            index={1}
            isInView={isInView}
            icon={<Link2 className="w-6 h-6 text-[#5de0e6]" />}
            title="Gere um link único"
            description="Seu portal de viagem vira um link. Acesse de qualquer dispositivo, compartilhe com quem quiser."
            visual={
              <div className="relative p-6 rounded-2xl vuei-glass">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20">
                    <Link2 className="w-5 h-5 text-[#5de0e6]" />
                    <code className="text-sm text-white/80 font-mono">vuei.app/paris-2024</code>
                    <div className="ml-auto px-3 py-1 rounded-lg bg-[#5de0e6]/20 text-[#5de0e6] text-xs font-medium">
                      Copiar
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-white/40" />
                    <span className="text-sm text-white/50">Compartilhe com família e amigos</span>
                  </div>
                </div>
              </div>
            }
            reversed
          />

          {/* Step 3 - Privacy */}
          <FeatureBlock
            index={2}
            isInView={isInView}
            icon={<Lock className="w-6 h-6 text-[#5de0e6]" />}
            title="Documentos protegidos"
            description="Documentos privados nunca aparecem no link compartilhável. Você controla o que cada pessoa vê."
            visual={
              <div className="relative p-6 rounded-2xl vuei-glass">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <Eye className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Roteiro público</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">Visível</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <Eye className="w-4 h-4 text-[#5de0e6]" />
                    <span className="text-sm text-white/70">Fotos da viagem</span>
                    <span className="ml-auto text-xs text-[#5de0e6]">Visível</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-[#004aad]/30">
                    <EyeOff className="w-4 h-4 text-[#004aad]" />
                    <span className="text-sm text-white/70">Passaportes</span>
                    <span className="ml-auto text-xs text-[#004aad]">Privado</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-[#004aad]/30">
                    <EyeOff className="w-4 h-4 text-[#004aad]" />
                    <span className="text-sm text-white/70">Cartões e senhas</span>
                    <span className="ml-auto text-xs text-[#004aad]">Privado</span>
                  </div>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* Decorative Line */}
      <div className="absolute left-1/2 top-1/4 bottom-1/4 w-px bg-gradient-to-b from-transparent via-[#5de0e6]/20 to-transparent" />
    </section>
  )
}

function FeatureBlock({
  index,
  isInView,
  icon,
  title,
  description,
  visual,
  reversed = false,
}: {
  index: number
  isInView: boolean
  icon: React.ReactNode
  title: string
  description: string
  visual: React.ReactNode
  reversed?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: index * 0.15 }}
      className={`grid md:grid-cols-2 gap-12 items-center ${reversed ? "md:grid-flow-dense" : ""}`}
    >
      <div className={`space-y-6 ${reversed ? "md:col-start-2" : ""}`}>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10">
          {icon}
        </div>
        <h3 className="text-2xl sm:text-3xl font-semibold text-white">{title}</h3>
        <p className="text-white/50 text-lg leading-relaxed">{description}</p>
      </div>
      <div className={reversed ? "md:col-start-1 md:row-start-1" : ""}>
        {visual}
      </div>
    </motion.div>
  )
}
