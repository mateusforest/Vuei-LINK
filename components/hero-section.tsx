"use client"

import Image from "next/image"
import { motion } from "framer-motion"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pt-24 pb-12 sm:px-6 sm:pt-28 sm:pb-16 lg:px-8 lg:pt-32 lg:pb-20">
      <div className="absolute inset-0 vuei-grid opacity-40" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#004aad]/12 via-[#5de0e6]/6 to-transparent blur-3xl" />
      <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-[#5de0e6]/8 blur-[140px]" />

      <div className="relative z-10 mx-auto w-full max-w-[1950px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden rounded-[28px] border border-white/10 bg-[#040b16] shadow-[0_24px_100px_rgba(0,74,173,0.25)]"
        >
          <div className="relative aspect-[1950/850] w-full">
            <Image
              src="/images/vuei-hero-banner.png"
              alt="Vuei: toda a sua viagem em um único link"
              fill
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1536px) calc(100vw - 48px), 1950px"
              className="object-contain object-center"
            />
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent animate-pulse-line" />
    </section>
  )
}
