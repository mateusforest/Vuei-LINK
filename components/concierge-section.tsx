"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { Check, FileText, Hotel, Map, MessageCircle, Plane, Send, WifiOff } from "lucide-react"

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
          <div className="block md:hidden">
            <div className="bg-[linear-gradient(180deg,#1d1d20_0%,#111317_54%,#07090d_100%)] px-5 pb-6 pt-6 text-white">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90">
                <MessageCircle className="h-4 w-4 text-[#5de0e6]" />
                Concierge IA
              </div>

              <h2 className="text-[2rem] font-semibold leading-[1.04] tracking-tight">
                Seu concierge de viagem.
                <span className="mt-1 block bg-gradient-to-r from-[#5de0e6] via-[#34b6ff] to-[#2f7df6] bg-clip-text text-transparent">
                  Mesmo sem internet.
                </span>
              </h2>

              <p className="mt-4 max-w-[20rem] text-[1rem] leading-7 text-white/72">
                O Vuei entende seus documentos, roteiro e viajantes para ajudar voce antes, durante e depois do embarque.
              </p>

              <div className="mt-6 grid gap-4">
                <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,#1b1d22_0%,#0f1116_100%)] shadow-[0_20px_45px_rgba(0,0,0,0.35)]">
                  <div className="border-b border-white/8 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5de0e6] to-[#2f7df6]">
                        <MessageCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Concierge IA</p>
                        <p className="text-xs text-white/55">Assistente de viagem</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 px-4 py-4">
                    <div className="max-w-[85%] rounded-2xl bg-white/8 px-4 py-3 text-sm leading-6 text-white/90">
                      Vi que sua reserva no hotel comeca as 14h. Quer que eu sugira um local para almoco proximo?
                    </div>
                    <div className="ml-auto max-w-[75%] rounded-2xl bg-gradient-to-r from-[#1d8fff] to-[#2f7df6] px-4 py-3 text-sm font-medium text-white">
                      Sim, por favor!
                    </div>
                    <div className="max-w-[85%] rounded-2xl bg-white/8 px-4 py-3 text-sm leading-6 text-white/90">
                      Encontrei 3 opcoes a menos de 10 minutos do hotel.
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/45">
                      <span className="flex-1">Pergunte ao concierge...</span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[#5de0e6] to-[#2f7df6]">
                        <Send className="h-4 w-4 text-white" />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#5de0e6]/10">
                      <WifiOff className="h-5 w-5 text-[#5de0e6]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Sem conexao</h3>
                      <p className="mt-1 text-sm leading-6 text-white/65">Todos os dados ficam salvos no dispositivo.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: "Passagens", icon: Plane },
                      { label: "Hospedagem", icon: Hotel },
                      { label: "Documentos", icon: FileText },
                      { label: "Roteiro", icon: Map },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/10 px-4 py-3">
                        <item.icon className="h-4 w-4 text-[#5de0e6]" />
                        <span className="flex-1 text-sm text-white/90">{item.label}</span>
                        <Check className="h-4 w-4 text-[#2f7df6]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative hidden aspect-[1950/850] w-full md:block">
            <Image
              src="/images/vuei-concierge-banner.png"
              alt="Concierge IA e acesso offline do Vuei"
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
