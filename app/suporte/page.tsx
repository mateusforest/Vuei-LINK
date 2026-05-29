"use client"

import { LifeBuoy, Mail, MessageCircle } from "lucide-react"

export default function SuportePage() {
  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5de0e6]/15">
              <LifeBuoy className="h-6 w-6 text-[#5de0e6]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Suporte</h1>
              <p className="text-sm text-white/50">Canal mockado para orientar o viajante dentro do link da viagem.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <MessageCircle className="mb-3 h-5 w-5 text-[#5de0e6]" />
              <p className="text-sm font-medium">Atendimento pelo link</p>
              <p className="mt-2 text-sm text-white/50">Use o concierge e o compartilhamento da viagem para centralizar a comunicacao com o passageiro.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <Mail className="mb-3 h-5 w-5 text-[#5de0e6]" />
              <p className="text-sm font-medium">Contato operacional</p>
              <p className="mt-2 text-sm text-white/50">Fluxo mockado pronto para receber canais reais na etapa de backend e suporte integrado.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
