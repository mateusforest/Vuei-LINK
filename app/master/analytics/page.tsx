"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Plane,
  Brain,
  ArrowUpRight,
  Calendar,
  Download,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const metrics = [
  {
    label: "MRR",
    value: "R$ 847.2K",
    change: "+23.5%",
    trend: "up",
    description: "Receita recorrente mensal",
  },
  {
    label: "Crescimento",
    value: "+47%",
    change: "+12%",
    trend: "up",
    description: "vs. mês anterior",
  },
  {
    label: "Churn",
    value: "2.1%",
    change: "-0.4%",
    trend: "down",
    description: "Taxa de cancelamento",
  },
  {
    label: "LTV",
    value: "R$ 4,847",
    change: "+18%",
    trend: "up",
    description: "Valor vitalício médio",
  },
]

const topDestinations = [
  { name: "Japão", trips: 1247, percentage: 18 },
  { name: "Estados Unidos", trips: 1089, percentage: 16 },
  { name: "Europa", trips: 987, percentage: 14 },
  { name: "Caribe", trips: 756, percentage: 11 },
  { name: "Maldivas", trips: 534, percentage: 8 },
]

const monthlyData = [
  { month: "Jan", value: 65 },
  { month: "Fev", value: 72 },
  { month: "Mar", value: 78 },
  { month: "Abr", value: 85 },
  { month: "Mai", value: 82 },
  { month: "Jun", value: 90 },
  { month: "Jul", value: 95 },
  { month: "Ago", value: 100 },
]

export default function MasterAnalyticsPage() {
  const { agencies, users, trips, conciergeRequests } = useMaster()
  const [dateRange, setDateRange] = useState("30d")
  const [exporting, setExporting] = useState(false)
  const safeAgencies = agencies ?? []
  const safeUsers = users ?? []
  const safeTrips = trips ?? []
  const safeConciergeRequests = conciergeRequests ?? []

  const handleExport = () => {
    setExporting(true)
    setTimeout(() => setExporting(false), 2000)
  }

  const computedMetrics = [
    {
      label: "MRR",
      value: `R$ ${(safeAgencies.reduce((sum, a) => sum + a.creditsBalance * 0.08, 0) / 1000).toFixed(1)}K`,
      change: "+23.5%",
      trend: "up",
      description: "Receita recorrente mensal",
    },
    {
      label: "Crescimento",
      value: `+${Math.round((safeAgencies.length / 100) * 47)}%`,
      change: "+12%",
      trend: "up",
      description: "vs. mes anterior",
    },
    {
      label: "Churn",
      value: "2.1%",
      change: "-0.4%",
      trend: "down",
      description: "Taxa de cancelamento",
    },
    {
      label: "LTV",
      value: `R$ ${Math.round((safeAgencies.reduce((sum, a) => sum + a.creditsBalance, 0) / Math.max(safeAgencies.length, 1)) * 0.5).toLocaleString()}`,
      change: "+18%",
      trend: "up",
      description: "Valor vitalicio medio",
    },
  ]

  const quickStats = [
    { label: "Usuarios Online", value: safeUsers.filter(u => u.status === "active").length.toLocaleString() },
    { label: "Viagens Hoje", value: `+${safeTrips.filter(t => t.status === "ongoing").length}` },
    { label: "Chats Ativos", value: safeConciergeRequests.filter(c => c.status === "pending").length.toString() },
    { label: "Roteiros Gerados", value: Math.floor(safeTrips.length * 1.2).toString() },
    { label: "Creditos Vendidos", value: `${(safeAgencies.reduce((sum, a) => sum + a.creditsBalance, 0) / 1000).toFixed(0)}K` },
    { label: "Tokens Consumidos", value: `${(safeConciergeRequests.length * 2400 / 1000000).toFixed(1)}M` },
  ]

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Métricas e insights da plataforma
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px] bg-black/40 border-white/10">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="7d">Ultimos 7 dias</SelectItem>
              <SelectItem value="30d">Ultimos 30 dias</SelectItem>
              <SelectItem value="90d">Ultimos 90 dias</SelectItem>
              <SelectItem value="1y">Ultimo ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="border-white/10 hover:bg-white/5 gap-2" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {computedMetrics.map((metric, index) => (
          <Card
            key={index}
            className="border-white/5 bg-black/40 backdrop-blur-xl p-6 hover:border-primary/20 transition-all duration-300"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  metric.trend === "up" ? "text-emerald-400" : "text-emerald-400"
                }`}>
                  {metric.trend === "up" ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {metric.change}
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.description}</div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Growth Chart */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Crescimento</h2>
                <p className="text-xs text-muted-foreground">Evolução mensal da plataforma</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Detalhes <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            
            {/* Simple Bar Chart */}
            <div className="h-48 flex items-end gap-2">
              {monthlyData.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-gradient-to-t from-primary to-accent rounded-t-sm transition-all duration-500 hover:opacity-80"
                    style={{ height: `${data.value}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{data.month}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Usage Distribution */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Uso da Plataforma</h2>
                <p className="text-xs text-muted-foreground">Distribuição de funcionalidades</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {[
                { name: "Concierge IA", value: 42, icon: Brain },
                { name: "Roteiros", value: 28, icon: Plane },
                { name: "Documentos", value: 18, icon: Building2 },
                { name: "Compartilhamento", value: 12, icon: Users },
              ].map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{item.value}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Destinations */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Destinos Populares</h2>
                <p className="text-xs text-muted-foreground">Top 5 destinos do mês</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            
            <div className="space-y-4">
              {topDestinations.map((dest, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">#{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{dest.name}</span>
                      <span className="text-xs text-muted-foreground">{dest.trips.toLocaleString()} viagens</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                        style={{ width: `${dest.percentage * 5}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Resumo Rápido</h2>
                <p className="text-xs text-muted-foreground">Métricas em tempo real</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {quickStats.map((stat, index) => (
                <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                  <div className="text-xl font-bold text-foreground">{stat.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
