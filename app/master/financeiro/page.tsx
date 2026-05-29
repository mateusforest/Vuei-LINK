"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
  Users,
  Building2,
  ArrowUpRight,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
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
    label: "MRR Total",
    value: "R$ 847.2K",
    change: "+23.5%",
    trend: "up",
    icon: DollarSign,
  },
  {
    label: "Assinaturas Ativas",
    value: "127",
    change: "+12",
    trend: "up",
    icon: Users,
  },
  {
    label: "Créditos Vendidos",
    value: "R$ 248K",
    change: "+31%",
    trend: "up",
    icon: CreditCard,
  },
  {
    label: "Inadimplência",
    value: "1.2%",
    change: "-0.3%",
    trend: "down",
    icon: AlertTriangle,
  },
]

const revenueBreakdown = [
  { name: "Assinaturas Premium", value: 524000, percentage: 62 },
  { name: "Assinaturas Business", value: 187000, percentage: 22 },
  { name: "Créditos Avulsos", value: 98000, percentage: 12 },
  { name: "Upgrades", value: 38200, percentage: 4 },
]

const recentTransactions = [
  { type: "subscription", entity: "Viagens Premium SP", plan: "Premium", value: "R$ 997", status: "paid", date: "Hoje" },
  { type: "credits", entity: "Travel Masters", plan: "50K créditos", value: "R$ 399", status: "paid", date: "Hoje" },
  { type: "upgrade", entity: "Explore World", plan: "Business → Premium", value: "R$ 500", status: "paid", date: "Ontem" },
  { type: "subscription", entity: "Dream Destinations", plan: "Starter", value: "R$ 197", status: "pending", date: "Ontem" },
  { type: "subscription", entity: "Global Tours", plan: "Business", value: "R$ 497", status: "failed", date: "2 dias" },
]

const monthlyRevenue = [
  { month: "Jan", value: 620 },
  { month: "Fev", value: 680 },
  { month: "Mar", value: 720 },
  { month: "Abr", value: 750 },
  { month: "Mai", value: 790 },
  { month: "Jun", value: 820 },
  { month: "Jul", value: 847 },
]

export default function MasterFinanceiroPage() {
  const { transactions, agencies, credits } = useMaster()
  const [dateRange, setDateRange] = useState("30d")
  const [exporting, setExporting] = useState(false)

  const handleExport = () => {
    setExporting(true)
    setTimeout(() => setExporting(false), 2000)
  }

  const totalMRR = agencies.reduce((sum, a) => sum + a.creditsBalance * 0.08, 0)
  const totalCredits = credits.totalAvailable * 0.01

  const computedMetrics = [
    {
      label: "MRR Total",
      value: `R$ ${(totalMRR / 1000).toFixed(1)}K`,
      change: "+23.5%",
      trend: "up",
      icon: DollarSign,
    },
    {
      label: "Assinaturas Ativas",
      value: agencies.filter(a => a.status === "active").length.toString(),
      change: `+${Math.floor(agencies.length * 0.1)}`,
      trend: "up",
      icon: Users,
    },
    {
      label: "Creditos Vendidos",
      value: `R$ ${(totalCredits / 1000).toFixed(0)}K`,
      change: "+31%",
      trend: "up",
      icon: CreditCard,
    },
    {
      label: "Inadimplencia",
      value: "1.2%",
      change: "-0.3%",
      trend: "down",
      icon: AlertTriangle,
    },
  ]

  const recentTx = transactions.slice(0, 5)

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
            Financeiro
          </h1>
          <p className="text-sm text-muted-foreground">
            Central financeira da plataforma
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
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{metric.label}</span>
                <div className="text-2xl font-bold text-foreground">{metric.value}</div>
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
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <metric.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Receita Mensal</h2>
                <p className="text-xs text-muted-foreground">Evolução do MRR</p>
              </div>
            </div>
            
            {/* Simple Bar Chart */}
            <div className="h-48 flex items-end gap-3">
              {monthlyRevenue.map((data, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium text-foreground">R$ {data.value}K</span>
                  <div
                    className="w-full bg-gradient-to-t from-primary to-accent rounded-t-md transition-all duration-500 hover:opacity-80"
                    style={{ height: `${(data.value / 850) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{data.month}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Revenue Breakdown */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Composição da Receita</h2>
                <p className="text-xs text-muted-foreground">Distribuição por fonte</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {revenueBreakdown.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        R$ {(item.value / 1000).toFixed(0)}K
                      </span>
                      <span className="text-xs text-muted-foreground">({item.percentage}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Transactions Table */}
      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Transações Recentes</h2>
                <p className="text-xs text-muted-foreground">Últimas movimentações financeiras</p>
              </div>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Entidade</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Tipo</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Plano/Item</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Valor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx, index) => (
                  <tr
                    key={index}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{tx.entity}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        tx.type === "subscription"
                          ? "bg-primary/10 text-primary"
                          : tx.type === "credits"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {tx.type === "subscription" ? "Assinatura" : tx.type === "credits" ? "Créditos" : "Upgrade"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{tx.plan}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-foreground">{tx.value}</td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                        tx.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : tx.status === "pending"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
                        {tx.status === "paid" && <CheckCircle2 className="h-3 w-3" />}
                        {tx.status === "pending" && <Clock className="h-3 w-3" />}
                        {tx.status === "failed" && <AlertTriangle className="h-3 w-3" />}
                        {tx.status === "paid" ? "Pago" : tx.status === "pending" ? "Pendente" : "Falhou"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{tx.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
