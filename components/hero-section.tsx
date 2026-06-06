"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, Link2, PlayCircle, Plane } from "lucide-react"

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
          <div className="block md:hidden">
            <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#083b73_0%,#04101f_45%,#02060d_100%)] px-5 pb-6 pt-6">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                <Link2 className="h-4 w-4 text-[#5de0e6]" />
                Seu link de viagem inteligente
              </div>

              <div className="space-y-4">
                <h1 className="text-[2.1rem] font-semibold leading-[1.02] tracking-tight text-white">
                  Toda a sua viagem.
                  <span className="mt-1 block bg-gradient-to-r from-[#5de0e6] via-[#34b6ff] to-[#2f7df6] bg-clip-text text-transparent">
                    Em um único link.
                  </span>
                </h1>

                <p className="max-w-[20rem] text-[1rem] leading-7 text-white/72">
                  Organize passagens, hospedagens, roteiros, documentos e concierge IA em um só lugar.
                </p>

                <div className="flex flex-col gap-3 pt-1">
                  <a
                    href="/onboarding"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5de0e6] to-[#2f7df6] px-5 py-4 text-base font-medium text-white shadow-[0_12px_32px_rgba(47,125,246,0.35)]"
                  >
                    <Plane className="h-4 w-4" />
                    Criar viagem
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#como-funciona"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-5 py-4 text-base font-medium text-white/90"
                  >
                    <PlayCircle className="h-4 w-4 text-[#5de0e6]" />
                    Ver demonstracao
                  </a>
                </div>
              </div>

              <div className="relative mt-6 overflow-hidden rounded-[24px] border border-white/10 bg-[#06111f] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#5de0e6]/12 to-transparent" />
                <div className="relative aspect-[4/5]">
                  <Image
                    src="/images/vuei-hero-banner.png"
                    alt="Vuei no celular"
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover object-[67%_32%]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="relative hidden aspect-[1950/850] w-full md:block">
            <Image
              src="/images/vuei-hero-banner.png"
              alt="Vuei: toda a sua viagem em um unico link"
              fill
              priority
              sizes="(max-width: 1536px) calc(100vw - 48px), 1950px"
              className="object-contain object-center"
            />
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent animate-pulse-line" />
    </section>
  )
}
