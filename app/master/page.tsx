"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Plane,
  MessageSquare,
  Brain,
  Coins,
  ArrowUpRight,
  Sparkles,
  Activity,
  Zap,
  Globe,
  CreditCard,
  FileText,
  Gift
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const activityIcons: Record<string, { icon: typeof Building2; color: string }> = {
  agency_created: { icon: Building2, color: "text-primary" },
  trip_created: { icon: Plane, color: "text-emerald-400" },
  user_registered: { icon: Users, color: "text-accent" },
  credits_purchased: { icon: Coins, color: "text-yellow-400" },
  concierge_request: { icon: MessageSquare, color: "text-primary" }
}

export default function MasterOverviewPage() {
  const { stats, agencies, trips, activities, conciergeRequests, credits } = useMaster()

  const topAgencies = [...agencies]
    .filter(a => a.status === "active")
    .sort((a, b) => b.monthlyRevenue - a.monthlyRevenue)
    .slice(0, 4)

  const heroMetrics = [
    {
      label: "Receita Mensal",
      value: `R$ ${(stats.monthlyRevenue / 1000).toFixed(1)}K`,
      change: "+23.5%",
      trend: "up",
      icon: CreditCard,
      href: "/master/financeiro"
    },
    {
      label: "Viagens Ativas",
      value: stats.activeTrips.toString(),
      change: "+12.3%",
      trend: "up",
      icon: Plane,
      href: "/master/viagens"
    },
    {
      label: "Uso IA",
      value: "94.7%",
      change: "+8.1%",
      trend: "up",
      icon: Brain,
      href: "/master/ia"
    },
    {
      label: "Creditos Consumidos",
      value: `${(credits.totalConsumed / 1000).toFixed(1)}K`,
      change: "+31.2%",
      trend: "up",
      icon: Coins,
      href: "/master/creditos"
    }
  ]

  const quickStats = [
    { label: "Agencias", value: stats.totalAgencies.toString(), icon: Building2, color: "from-primary to-accent", href: "/master/agencias" },
    { label: "Usuarios", value: stats.totalUsers.toString(), icon: Users, color: "from-accent to-primary", href: "/master/usuarios" },
    { label: "Concierge Ativo", value: conciergeRequests.filter(r => r.status !== "resolved").length.toString(), icon: MessageSquare, color: "from-primary to-accent", href: "/master/concierge" },
    { label: "Viagens Totais", value: stats.totalTrips.toString(), icon: Sparkles, color: "from-accent to-primary", href: "/master/viagens" }
  ]

  const insights = [
    {
      title: "Crescimento Acelerado",
      description: "Plataforma cresceu 47% nos ultimos 30 dias",
      icon: TrendingUp,
      value: "+47%",
      color: "text-emerald-400",
      href: "/master/analytics"
    },
    {
      title: "Uso do Concierge",
      description: "Media de 12 interacoes por viagem",
      icon: MessageSquare,
      value: "12/viagem",
      color: "text-primary",
      href: "/master/concierge"
    },
    {
      title: "Retencao Premium",
      description: "Taxa de retencao de agencias premium",
      icon: Activity,
      value: "96.8%",
      color: "text-primary",
      href: "/master/analytics"
    },
    {
      title: "Geracao IA",
      description: "Roteiros gerados automaticamente",
      icon: Brain,
      value: "89%",
      color: "text-accent",
      href: "/master/ia"
    }
  ]

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    return `${diffDays}d`
  }

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      {/* Page Header */}
      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Visao geral da plataforma Vuei</p>
      </motion.div>

      {/* Hero Card */}
      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden border-white/5 bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl p-6 lg:p-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[radial-gradient(circle,rgba(93,224,230,0.1)_0%,transparent_70%)] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[radial-gradient(circle,rgba(0,74,173,0.1)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Metricas Principais</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {heroMetrics.map((metric, index) => (
                <Link key={index} href={metric.href} className="group">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                      <metric.icon className="h-4 w-4" />
                      <span className="text-xs font-medium">{metric.label}</span>
                    </div>
                    <div className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {metric.value}
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${metric.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
                      {metric.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {metric.change}
                      <span className="text-muted-foreground ml-1">vs mes anterior</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <Link key={index} href={stat.href}>
            <Card className="group relative overflow-hidden border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex items-start justify-between">
                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{stat.value}</div>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-10`}>
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </motion.div>

      {/* Insights Grid */}
      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Insights</h2>
          <Link href="/master/analytics" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
            Ver todos <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {insights.map((insight, index) => (
            <Link key={index} href={insight.href}>
              <Card className="group border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300 h-full">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/10 transition-colors">
                    <insight.icon className={`h-4 w-4 ${insight.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xl font-bold ${insight.color} mb-1`}>{insight.value}</div>
                    <div className="text-sm font-medium text-foreground mb-0.5">{insight.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{insight.description}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
              <Link href="/master/analytics" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-4">
              {activities.slice(0, 5).map((activity) => {
                const iconData = activityIcons[activity.type] || { icon: Gift, color: "text-primary" }
                const Icon = iconData.icon
                return (
                  <div
                    key={activity.id}
                    className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                      <Icon className={`h-4 w-4 ${iconData.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{activity.description}</div>
                      <div className="text-xs text-muted-foreground">{activity.entityName}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(activity.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>

        {/* Top Agencies */}
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Top Agencias</h2>
              <Link href="/master/agencias" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {topAgencies.map((agency, index) => (
                <Link
                  key={agency.id}
                  href={`/master/agencias?id=${agency.id}`}
                  className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{agency.name}</div>
                    <div className="text-xs text-muted-foreground">{agency.tripsCount} viagens</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-foreground">R$ {(agency.monthlyRevenue / 1000).toFixed(1)}K</div>
                    <div className="text-xs text-emerald-400">+18%</div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Global Map Preview */}
      <motion.div variants={fadeInUp}>
        <Card className="relative overflow-hidden border-white/5 bg-black/40 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Viagens Globais</h2>
                <p className="text-xs text-muted-foreground">{stats.totalTrips} viagens em 47 paises</p>
              </div>
            </div>
            <Link href="/master/viagens" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
              Ver mapa <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="relative h-48 lg:h-64 rounded-xl overflow-hidden bg-gradient-to-br from-black/60 to-black/40 border border-white/5">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Globe className="h-12 w-12 text-primary/30 mx-auto" />
                <p className="text-sm text-muted-foreground">Mapa interativo de viagens</p>
              </div>
            </div>
            
            <div className="absolute top-4 left-4 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
              <div className="text-xs text-muted-foreground">Destino mais popular</div>
              <div className="text-sm font-semibold text-foreground">
                {trips.length > 0 ? trips[0].destination.split(",")[0] : "Japao"}
              </div>
            </div>
            
            <div className="absolute bottom-4 right-4 px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
              <div className="text-xs text-muted-foreground">Viagens ativas</div>
              <div className="text-sm font-semibold text-primary">{stats.activeTrips}</div>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
