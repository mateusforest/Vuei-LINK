"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, PlayCircle } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#f5f5f7] px-4 pb-20 pt-28 sm:px-6 sm:pb-24 sm:pt-32 lg:px-8 lg:pb-28 lg:pt-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(93,224,230,0.08),transparent_24%),radial-gradient(circle_at_84%_14%,rgba(0,74,173,0.05),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0))]" />

      <div className="relative z-10 mx-auto grid w-full max-w-[1280px] items-center gap-14 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-[42rem] pt-6 lg:pt-10"
        >
          <div className="space-y-8 sm:space-y-9">
            <h1 className="max-w-[10ch] text-[3.4rem] font-semibold leading-[0.93] tracking-[-0.07em] text-[#101828] sm:text-[4.6rem] lg:text-[6rem]">
              <span className="block">Toda a sua viagem.</span>
              <span className="block">
                Em{" "}
                <span className="bg-gradient-to-r from-[#38c8ff] via-[#2c90ff] to-[#0b56d8] bg-clip-text text-transparent">
                  um único link.
                </span>
              </span>
            </h1>

            <p className="max-w-[27rem] text-[1.14rem] leading-[1.58] text-[#606775] sm:text-[1.28rem]">
              Passagens, hospedagem, documentos,
              <br />
              roteiros e concierge organizados em
              <br />
              um único lugar.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4 sm:pt-4">
              <a
                href="/criar-viagem"
                className="inline-flex items-center justify-center gap-2 rounded-[1.15rem] bg-gradient-to-r from-[#37beff] to-[#0b56d8] px-7 py-4 text-base font-medium text-white shadow-[0_18px_40px_rgba(11,86,216,0.18)] transition-transform duration-300 hover:-translate-y-0.5"
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
          className="relative flex items-center justify-center lg:justify-end"
        >
          <div className="pointer-events-none absolute bottom-[6%] h-12 w-[62%] rounded-full bg-[rgba(15,23,42,0.12)] blur-[28px] sm:h-14 sm:w-[56%]" />

          <div className="relative w-full max-w-[31rem] sm:max-w-[34rem] lg:max-w-[38rem]">
            <div className="relative aspect-[0.9] overflow-hidden rounded-[2.5rem]">
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[2.5rem] shadow-[0_34px_80px_rgba(15,23,42,0.14)]" />
              <div className="relative h-full w-full">
                <Image
                  src="/images/vuei-hero-approved-reference.png"
                  alt="Mockup principal do Vuei"
                  fill
                  priority
                  sizes="(max-width: 1024px) 92vw, 620px"
                  className="object-contain object-right"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
