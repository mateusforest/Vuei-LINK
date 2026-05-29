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
              <p className="text-sm text-muted-foreground">Condicoes mockadas de uso da experiencia Vuei.</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>O ambiente atual e uma camada de frontend validada para navegacao, consistencia visual e fluxo de produto.</p>
            <p>Recursos como autenticacao real, pagamentos, armazenamento externo e integracoes operacionais ainda nao foram ativados nesta fase.</p>
            <p>Os CTAs desta tela existem para fechar a jornada e evitar pontos mortos enquanto a plataforma evolui para a proxima etapa.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
