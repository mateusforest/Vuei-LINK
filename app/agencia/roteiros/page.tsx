"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

export default function AgencyItinerariesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div {...fadeInUp} className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Roteiros</h1>
        <p className="text-sm text-muted-foreground">
          O fluxo operacional de roteiros da agência está centralizado em Roteiros IA, com geração real e leitura do saldo canônico.
        </p>
      </motion.div>

      <motion.div {...fadeInUp}>
        <Card className="border-border/50 bg-card/50 p-6 vuei-glass">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Área unificada de roteiros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0 pb-0">
            <p className="text-sm text-muted-foreground">
              Para evitar listas de demonstração e timelines estáticas, esta rota agora direciona para a experiência real de roteiros da agência.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  O que você encontra lá
                </div>
                <p className="text-sm text-muted-foreground">
                  Geração de roteiro simples, PDF completo, histórico salvo e bloqueio honesto por saldo quando necessário.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-background/40 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  O que removemos aqui
                </div>
                <p className="text-sm text-muted-foreground">
                  Templates fictícios, viagens de exemplo, custos estáticos e timelines demonstrativas que não refletiam o estado real da agência.
                </p>
              </div>
            </div>
            <Button asChild className="w-full rounded-xl sm:w-fit">
              <Link href="/agencia/roteiros-ia">
                Ir para Roteiros IA
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
