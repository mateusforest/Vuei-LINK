"use client"

import Image from "next/image"
import { motion } from "framer-motion"

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative overflow-hidden px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
      <div className="absolute inset-0 vuei-grid opacity-20" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/5 via-white/[0.02] to-transparent blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1950px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-[28px] border border-white/12 bg-[#ebebee] shadow-[0_28px_90px_rgba(255,255,255,0.08)]"
        >
          <div className="relative aspect-[1950/850] w-full">
            <Image
              src="/images/vuei-how-it-works-banner.png"
              alt="Como funciona o Vuei"
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
