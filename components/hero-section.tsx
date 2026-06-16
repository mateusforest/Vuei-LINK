"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, PlayCircle } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-36">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_18%_22%,rgba(93,224,230,0.12),transparent_24%),radial-gradient(circle_at_82%_24%,rgba(0,74,173,0.08),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(148,163,184,0.08),transparent_28%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[42rem] pt-8 lg:pt-12"
        >
          <div className="mb-8">
            <Image
              src="/vuei-logo.png"
              alt="Vuei"
              width={144}
              height={54}
              priority
              className="h-12 w-auto sm:h-[3.35rem]"
            />
          </div>

          <div className="space-y-7 sm:space-y-8">
            <h1 className="max-w-[11ch] text-[3.35rem] font-semibold leading-[0.95] tracking-[-0.06em] text-[#0f172a] sm:text-[4.4rem] lg:text-[5.7rem]">
              <span className="block">Toda a sua viagem.</span>
              <span className="block">
                Em{" "}
                <span className="bg-gradient-to-r from-[#38c8ff] via-[#2c90ff] to-[#0b56d8] bg-clip-text text-transparent">
                  um único link.
                </span>
              </span>
            </h1>

            <p className="max-w-[26rem] text-[1.125rem] leading-[1.55] text-[#5f6472] sm:text-[1.28rem]">
              Passagens, hospedagem, documentos,
              <br />
              roteiros e concierge organizados em
              <br />
              um único lugar.
            </p>

            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:gap-4 sm:pt-5">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center gap-2 rounded-[1.15rem] bg-gradient-to-r from-[#37beff] to-[#0b56d8] px-7 py-4 text-base font-medium text-white shadow-[0_18px_42px_rgba(11,86,216,0.2)] transition-transform duration-300 hover:-translate-y-0.5"
              >
                Criar viagem
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex items-center justify-center gap-2 rounded-[1.15rem] border border-black/10 bg-white/72 px-7 py-4 text-base font-medium text-[#161b26] shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-colors duration-300 hover:bg-white"
              >
                <PlayCircle className="h-4 w-4 text-[#0b56d8]" />
                Ver demonstração
              </a>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex justify-center lg:justify-end"
        >
          <div className="pointer-events-none absolute bottom-[7%] h-12 w-[68%] rounded-full bg-[rgba(15,23,42,0.16)] blur-[30px] sm:h-14 sm:w-[62%]" />
          <div className="pointer-events-none absolute right-[12%] top-[9%] h-24 w-24 rounded-full bg-white/55 blur-[42px]" />

          <div className="relative w-full max-w-[28rem] sm:max-w-[32rem] lg:max-w-[38rem]">
            <div className="absolute inset-[7%_14%_9%_18%] rounded-[3rem] bg-white/18 blur-2xl" />
            <div className="absolute inset-[4%_10%_5%_14%] rounded-[3rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.58),rgba(255,255,255,0.02))] opacity-60" />

            <div className="relative overflow-hidden rounded-[2.75rem]">
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[2.75rem] bg-[linear-gradient(135deg,rgba(255,255,255,0.42),transparent_30%,transparent_72%,rgba(255,255,255,0.12))]" />
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[2.75rem] shadow-[0_50px_90px_rgba(15,23,42,0.16)]" />

              <div className="relative aspect-[0.95] overflow-hidden">
                <Image
                  src="/images/vuei-hero-banner.png"
                  alt="Mockup principal do Vuei"
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 620px"
                  className="scale-[1.26] object-cover object-[76%_46%] sm:scale-[1.22] lg:scale-[1.18]"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
