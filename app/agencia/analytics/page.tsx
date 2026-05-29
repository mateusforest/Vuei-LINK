"use client"

import { motion } from "framer-motion"
import {
  BarChart3,
  Plane,
  Users,
  MessageSquare,
  Sparkles,
  Link2,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAgency } from "@/contexts/agency-context"

const monthlyData = [
  { month: "Jan", trips: 12 },
  { month: "Fev", trips: 15 },
  { month: "Mar", trips: 18 },
  { month: "Abr", trips: 22 },
  { month: "Mai", trips: 28 },
  { month: "Jun", trips: 24 },
]

export default function AnalyticsPage() {
  const { clients, trips, documents, credits, conciergeRequests } = useAgency()
  const safeClients = clients ?? []
  const safeTrips = trips ?? []
  const safeDocuments = documents ?? []
  const safeHistory = credits?.history ?? []
  const safeConciergeRequests = conciergeRequests ?? []
  
  const activeClients = safeClients.filter(c => c.status === "active").length
  const totalTrips = safeTrips.length
  const creditsUsed = safeHistory.filter(h => h.amount < 0).reduce((sum, h) => sum + Math.abs(h.amount), 0)
  const totalLinkViews = safeTrips.reduce((sum, trip) => sum + (trip.passengersCount * 12), 0)
  const conciergeMessages = safeConciergeRequests.length

  const stats = [
    {
      label: "Viagens Criadas",
      value: totalTrips.toString(),
      change: "+12%",
      trend: "up" as const,
      icon: Plane,
      period: "Total",
    },
    {
      label: "Uso Concierge",
      value: conciergeMessages.toString(),
      change: "+23%",
      trend: "up" as const,
      icon: MessageSquare,
      period: "Mensagens",
    },
    {
      label: "Creditos IA",
      value: creditsUsed.toLocaleString(),
      change: "-8%",
      trend: "down" as const,
      icon: Sparkles,
      period: "Consumidos",
    },
    {
      label: "Clientes Ativos",
      value: activeClients.toString(),
      change: "+5%",
      trend: "up" as const,
      icon: Users,
      period: "Total",
    },
    {
      label: "Links Acessados",
      value: totalLinkViews >= 1000 ? `${(totalLinkViews / 1000).toFixed(1)}k` : totalLinkViews.toString(),
      change: "+45%",
      trend: "up" as const,
      icon: Link2,
      period: "Visualizacoes",
    },
  ]

  // Get top destinations from trips
  const destinationCounts: Record<string, number> = {}
  safeTrips.forEach(trip => {
    destinationCounts[trip.destination] = (destinationCounts[trip.destination] || 0) + 1
  })
  const topDestinations = Object.entries(destinationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      trips: count,
      percentage: Math.round((count / totalTrips) * 100) || 0
    }))

  const maxTrips = Math.max(...monthlyData.map((d) => d.trips))

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Visao geral do desempenho</p>
        </div>
        <div className="flex gap-2">
          {["7D", "30D", "90D", "12M"].map((period) => (
            <Button
              key={period}
              variant="outline"
              size="sm"
              className={`border-white/10 ${
                period === "30D"
                  ? "bg-primary/20 text-primary"
                  : "bg-transparent text-muted-foreground hover:bg-white/5"
              }`}
            >
              {period}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-white/5 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <stat.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs ${
                      stat.trend === "up" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {stat.change}
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{stat.period}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <Card className="border-white/5 bg-card/50 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-primary" />
              Viagens por Mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-end gap-2">
              {monthlyData.map((data, index) => (
                <motion.div
                  key={data.month}
                  className="flex flex-1 flex-col items-center gap-2"
                  initial={{ opacity: 0, scaleY: 0 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  style={{ transformOrigin: "bottom" }}
                >
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-primary to-accent transition-all hover:opacity-80"
                    style={{ height: `${(data.trips / maxTrips) * 180}px` }}
                  />
                  <span className="text-xs text-muted-foreground">{data.month}</span>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Destinations */}
        <Card className="border-white/5 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Plane className="h-4 w-4 text-primary" />
              Destinos Populares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topDestinations.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma viagem ainda
              </p>
            ) : (
              topDestinations.map((dest, index) => (
                <motion.div
                  key={dest.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{dest.name}</span>
                    <span className="text-muted-foreground">{dest.trips} viagens</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(dest.percentage * 2, 100)}%` }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Tempo medio resposta", value: "2.5 min", icon: MessageSquare },
          { label: "Satisfacao concierge", value: "94%", icon: Users },
          { label: "Roteiros gerados", value: safeHistory.filter(h => h.action.includes("Roteiro")).length.toString(), icon: Sparkles },
          { label: "Docs enviados", value: safeDocuments.length.toString(), icon: Calendar },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
          >
            <Card className="border-white/5 bg-card/50">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
