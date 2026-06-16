"use client"

import { FileText } from "lucide-react"

export default function TermosPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-card/60 p-8 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Termos</h1>
              <p className="text-sm text-muted-foreground">Condições gerais de uso da experiência Vuei.</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Esta página reúne um resumo institucional do uso da plataforma Vuei enquanto a versão jurídica definitiva é consolidada.</p>
            <p>Os fluxos operacionais do produto continuam sujeitos às permissões, validações e regras ativas em cada portal e em cada link da viagem.</p>
            <p>Quando a versão jurídica final estiver pronta, este conteúdo será substituído sem afetar as rotas já publicadas.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
