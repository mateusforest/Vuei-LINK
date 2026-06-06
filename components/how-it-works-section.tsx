"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight, CloudUpload, Link2, PlusCircle, Share2 } from "lucide-react"

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
          <div className="block md:hidden">
            <div className="bg-[radial-gradient(circle_at_top,#ffffff_0%,#f2f4f7_40%,#dfe3e8_100%)] px-5 pb-6 pt-6 text-[#111319]">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#d5dae2] bg-white/70 px-3 py-2 text-sm font-medium text-[#256fe8]">
                <Link2 className="h-4 w-4" />
                Como funciona
              </div>

              <h2 className="text-[2rem] font-semibold leading-[1.04] tracking-tight">
                Simples para <span className="bg-gradient-to-r from-[#49c6f0] to-[#2f7df6] bg-clip-text text-transparent">criar</span>.
                <span className="mt-1 block">Completo para <span className="bg-gradient-to-r from-[#49c6f0] to-[#2f7df6] bg-clip-text text-transparent">viajar</span>.</span>
              </h2>

              <p className="mt-4 max-w-[21rem] text-[1rem] leading-7 text-[#3f4651]">
                Em poucos passos, voce cria seu link inteligente e centraliza tudo da sua viagem em um so lugar.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  {
                    step: "01",
                    icon: PlusCircle,
                    title: "Crie sua viagem",
                    text: "Informe destino, periodo e detalhes principais.",
                  },
                  {
                    step: "02",
                    icon: CloudUpload,
                    title: "Adicione tudo",
                    text: "Envie passagens, reservas e documentos.",
                  },
                  {
                    step: "03",
                    icon: Share2,
                    title: "Compartilhe e viaje",
                    text: "Envie o link e acompanhe tudo com praticidade.",
                  },
                ].map((item) => (
                  <div key={item.step} className="rounded-2xl border border-[#dbe0e6] bg-white/75 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#eaf6ff] to-white text-[#2f7df6]">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#2f7df6]">{item.step}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-[#9da7b3]" />
                        </div>
                        <h3 className="text-base font-semibold text-[#111319]">{item.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#4c5561]">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative hidden aspect-[1950/850] w-full md:block">
            <Image
              src="/images/vuei-how-it-works-banner.png"
              alt="Como funciona o Vuei"
              fill
              sizes="(max-width: 1536px) calc(100vw - 48px), 1950px"
              className="object-contain object-center"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
