"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, BriefcaseBusiness, UserRound } from "lucide-react"

const options = [
  {
    href: "/signup",
    icon: UserRound,
    title: "Sou viajante",
    description: "Quero organizar minha própria viagem em um único link.",
    cta: "Criar conta de viajante",
  },
  {
    href: "/agency/signup",
    icon: BriefcaseBusiness,
    title: "Sou agência",
    description: "Quero criar viagens e links para meus clientes.",
    cta: "Criar conta de agência",
  },
]

export default function SignupEntryPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#101828] sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="rounded-[32px] border border-black/6 bg-white/88 p-8 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:p-10"
          >
            <Link href="/" className="inline-flex">
              <Image src="/vuei-logo.png" alt="Vuei" width={130} height={44} className="h-11 w-auto" priority />
            </Link>

            <div className="mt-10">
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#0b56d8]/72">Começar</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.05em] text-[#101828]">
                Como você quer usar o Vuei?
              </h1>
              <p className="mt-4 max-w-md text-base leading-relaxed text-[#667085]">
                Escolha o tipo de conta para seguir para o cadastro certo desde o início.
              </p>
            </div>
          </motion.div>

          <div className="grid gap-5">
            {options.map((option, index) => {
              const Icon = option.icon

              return (
                <motion.div
                  key={option.href}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08 * (index + 1) }}
                  className="rounded-[32px] border border-black/6 bg-white/92 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.16)]">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold text-[#101828]">{option.title}</h2>
                      <p className="mt-2 text-sm leading-relaxed text-[#667085]">{option.description}</p>
                    </div>
                  </div>

                  <Link
                    href={option.href}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#37beff] to-[#0b56d8] px-5 py-3.5 text-sm font-medium text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)] transition-opacity hover:opacity-95 sm:w-auto"
                  >
                    {option.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
