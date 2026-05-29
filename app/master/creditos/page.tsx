"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Coins,
  Plus,
  TrendingUp,
  Gift,
  CreditCard,
  Users,
  Building2,
  ArrowUpRight,
  Sparkles,
  Zap,
  X,
  Check
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const stats = [
  { label: "Créditos Vendidos", value: "12.4M", change: "+2.1M", icon: Coins },
  { label: "Receita Créditos", value: "R$ 248K", change: "+31%", icon: CreditCard },
  { label: "Bônus Distribuídos", value: "1.2M", change: "+180K", icon: Gift },
  { label: "Consumo Médio", value: "847/viagem", change: "+12%", icon: TrendingUp },
]

const creditPackages = [
  { name: "Starter", credits: 5000, price: 49, popular: false },
  { name: "Growth", credits: 15000, price: 129, popular: true },
  { name: "Pro", credits: 50000, price: 399, popular: false },
  { name: "Enterprise", credits: 200000, price: 1499, popular: false },
]

const recentTransactions = [
  { type: "purchase", entity: "Viagens Premium SP", amount: 50000, value: "R$ 399", time: "2 min" },
  { type: "bonus", entity: "Travel Masters", amount: 5000, value: "Bônus", time: "15 min" },
  { type: "purchase", entity: "Ana Silva", amount: 5000, value: "R$ 49", time: "1h" },
  { type: "consumption", entity: "Explore World", amount: -1200, value: "Consumo", time: "2h" },
  { type: "purchase", entity: "Dream Destinations", amount: 15000, value: "R$ 129", time: "3h" },
]

const topConsumers = [
  { name: "Viagens Premium SP", type: "agency", consumed: 124500, total: 200000 },
  { name: "Travel Masters", type: "agency", consumed: 89200, total: 150000 },
  { name: "Ana Silva", type: "user", consumed: 4200, total: 5000 },
  { name: "Explore World", type: "agency", consumed: 67800, total: 100000 },
]

export default function MasterCreditosPage() {
  const { credits, agencies, users, addCreditsPackage, updateCreditsPackage } = useMaster()
  
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false)
  const [showNewPackageModal, setShowNewPackageModal] = useState(false)
  const [newPackage, setNewPackage] = useState({ name: "", credits: "", price: "" })

  const topConsumers = [...agencies, ...users.filter(u => u.type === "traveler")]
    .sort((a, b) => b.creditsBalance - a.creditsBalance)
    .slice(0, 4)
    .map(item => ({
      name: item.name,
      type: "creditsBalance" in item && "tripsCount" in item && !("agencyId" in item) ? "agency" : "user",
      consumed: Math.floor(Math.random() * item.creditsBalance),
      total: item.creditsBalance
    }))

  const pageStats = [
    { label: "Creditos Disponiveis", value: `${(credits.totalAvailable / 1000).toFixed(0)}K`, change: "total", icon: Coins },
    { label: "Creditos Consumidos", value: `${(credits.totalConsumed / 1000).toFixed(0)}K`, change: "acumulado", icon: TrendingUp },
    { label: "Uso Mensal", value: `${(credits.monthlyUsage / 1000).toFixed(1)}K`, change: "este mes", icon: Zap },
    { label: "Pacotes Ativos", value: credits.packages.filter(p => p.isActive).length.toString(), change: "disponiveis", icon: CreditCard },
  ]

  const handleCreatePackage = () => {
    if (!newPackage.name || !newPackage.credits || !newPackage.price) return
    addCreditsPackage({
      name: newPackage.name,
      credits: parseInt(newPackage.credits),
      price: parseFloat(newPackage.price),
      isActive: true
    })
    setNewPackage({ name: "", credits: "", price: "" })
    setShowNewPackageModal(false)
  }
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
            Créditos
          </h1>
          <p className="text-sm text-muted-foreground">
            Central do motor de créditos da plataforma
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5" onClick={() => setShowAddCreditsModal(true)}>
            <Gift className="h-4 w-4" />
            Nova Campanha
          </Button>
          <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2" onClick={() => setShowNewPackageModal(true)}>
            <Plus className="h-4 w-4" />
            Novo Pacote
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat, index) => (
          <Card
            key={index}
            className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-emerald-400">{stat.change}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Credit Packages */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pacotes de Creditos</h2>
          <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors" onClick={() => setShowNewPackageModal(true)}>
            Novo pacote <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {credits.packages.filter(p => p.isActive).map((pkg, index) => (
            <Card
              key={pkg.id}
              className={`relative border-white/5 bg-black/40 backdrop-blur-xl p-6 hover:border-primary/20 transition-all duration-300 ${
                index === 1 ? "border-primary/30 ring-1 ring-primary/20" : ""
              }`}
            >
              {index === 1 && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary to-accent rounded-full text-xs font-medium text-white">
                  Popular
                </div>
              )}
              <div className="text-center space-y-4">
                <div className="text-sm font-medium text-muted-foreground">{pkg.name}</div>
                <div className="text-3xl font-bold text-foreground">
                  {pkg.credits.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">creditos</span>
                </div>
                <div className="text-2xl font-bold text-primary">R$ {pkg.price}</div>
                <div className="text-xs text-muted-foreground">
                  R$ {(pkg.price / pkg.credits * 1000).toFixed(2)} / 1K creditos
                </div>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Transações Recentes</h2>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentTransactions.map((tx, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === "purchase"
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : tx.type === "bonus"
                      ? "bg-yellow-500/10 border border-yellow-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}>
                    {tx.type === "purchase" && <CreditCard className="h-4 w-4 text-emerald-400" />}
                    {tx.type === "bonus" && <Gift className="h-4 w-4 text-yellow-400" />}
                    {tx.type === "consumption" && <Zap className="h-4 w-4 text-red-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{tx.entity}</div>
                    <div className="text-xs text-muted-foreground">{tx.value}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${
                      tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{tx.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Top Consumers */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Maior Consumo</h2>
              <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-4">
              {topConsumers.map((consumer, index) => {
                const percentage = Math.round((consumer.consumed / consumer.total) * 100)
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                          {consumer.type === "agency" ? (
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Users className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground">{consumer.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {consumer.consumed.toLocaleString()} / {consumer.total.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Bonus Campaign Card */}
      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden border-white/5 bg-gradient-to-br from-primary/10 to-accent/5 backdrop-blur-xl p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(93,224,230,0.1)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">Campanha de Bônus Ativa</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Lançamento de Verão - 20% de bônus em todas as compras
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Válido até: 31 Mar 2024</span>
                  <span>1.2M créditos distribuídos</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/10 hover:bg-white/5">
                Editar
              </Button>
              <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                Encerrar
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* New Package Modal */}
      <AnimatePresence>
        {showNewPackageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowNewPackageModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Novo Pacote de Creditos</h3>
                <button onClick={() => setShowNewPackageModal(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-white/50 uppercase tracking-wider">Nome do Pacote</Label>
                  <Input
                    value={newPackage.name}
                    onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                    placeholder="Ex: Pro, Enterprise..."
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/50 uppercase tracking-wider">Quantidade de Creditos</Label>
                  <Input
                    type="number"
                    value={newPackage.credits}
                    onChange={(e) => setNewPackage({ ...newPackage, credits: e.target.value })}
                    placeholder="Ex: 50000"
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>
                <div>
                  <Label className="text-xs text-white/50 uppercase tracking-wider">Preco (R$)</Label>
                  <Input
                    type="number"
                    value={newPackage.price}
                    onChange={(e) => setNewPackage({ ...newPackage, price: e.target.value })}
                    placeholder="Ex: 399"
                    className="mt-1 bg-white/5 border-white/10"
                  />
                </div>
                <Button
                  onClick={handleCreatePackage}
                  disabled={!newPackage.name || !newPackage.credits || !newPackage.price}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Criar Pacote
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
