"use client"

import { Shield } from "lucide-react"

export default function PrivacidadePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-white/10 bg-card/60 p-8 backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Privacidade</h1>
              <p className="text-sm text-muted-foreground">Resumo visual da política de privacidade do Vuei.</p>
            </div>
          </div>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Informações da viagem, documentos e preferências permanecem protegidos na interface e só aparecem conforme o nível de acesso do portal ou do link.</p>
            <p>Os dados exibidos para cada usuário dependem das permissões ativas, das regras do produto e da disponibilidade real de cada recurso.</p>
            <p>Esta página funciona como referência pública de transparência enquanto a versão jurídica completa é consolidada.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
