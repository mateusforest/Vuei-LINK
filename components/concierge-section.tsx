"use client"

import Image from "next/image"
import { motion } from "framer-motion"

export function ConciergeSection() {
  return (
    <section id="concierge" className="relative overflow-hidden px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
      <div className="absolute inset-0 vuei-grid opacity-15" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 via-white/[0.02] to-transparent blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1950px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,#f1f1f4_0%,#c8c8cd_55%,#3f3f45_100%)] shadow-[0_24px_90px_rgba(255,255,255,0.06)]"
        >
          <div className="relative aspect-[1950/850] w-full">
            <Image
              src="/images/vuei-concierge-banner.png"
              alt="Concierge IA e acesso offline do Vuei"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1536px) calc(100vw - 48px), 1950px"
              className="object-contain object-center"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
