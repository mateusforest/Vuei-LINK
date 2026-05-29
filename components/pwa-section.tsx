"use client"

import { motion, useInView } from "framer-motion"
import { useRef } from "react"
import { Smartphone, Monitor, Download } from "lucide-react"

export function PWASection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: "-100px" })

  return (
    <section id="pwa" className="relative py-32 overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 vuei-grid opacity-30" />

      <div className="relative z-10 max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center space-y-8"
        >
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 border border-white/10">
            <Download className="w-10 h-10 text-[#5de0e6]" />
          </div>

          {/* Text */}
          <div className="space-y-4">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
              <span className="text-white">Instale como um</span>
              <br />
              <span className="vuei-gradient-text">aplicativo nativo</span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Vuei funciona como app no seu celular, tablet ou computador. Sem App Store, sem downloads pesados.
            </p>
          </div>

          {/* Platforms */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 pt-4"
          >
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10">
              <Smartphone className="w-5 h-5 text-[#5de0e6]" />
              <span className="text-white/70">Android</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10">
              <Smartphone className="w-5 h-5 text-[#5de0e6]" />
              <span className="text-white/70">iPhone</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white/5 border border-white/10">
              <Monitor className="w-5 h-5 text-[#5de0e6]" />
              <span className="text-white/70">Desktop</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
