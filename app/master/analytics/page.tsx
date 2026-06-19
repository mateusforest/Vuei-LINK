"use client"

import { motion } from "framer-motion"
import { BarChart3, Building2, FileText, Plane, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

export default function MasterAnalyticsPage() {
  const { stats } = useMaster()

  const cards = [
    { label: "Usuarios", value: stats.totalUsers, icon: Users },
    { label: "Agências", value: stats.totalAgencies, icon: Building2 },
    { label: "Viagens", value: stats.totalTrips, icon: Plane },
    { label: "Documentos", value: stats.totalDocuments, icon: FileText },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Leitura resumida dos dados reais disponiveis hoje no Supabase</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <card.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Status desta area</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            O portal master agora exibe contagens reais de usuarios, agencias, viagens e documentos. Analiticos avancados,
            receitas, churn e projeções ainda nao foram conectados a uma fonte operacional confiavel e por isso nao sao
            exibidos aqui.
          </p>
        </Card>
      </motion.div>
    </motion.div>
  )
}
