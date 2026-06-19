"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowUpRight, Building2, FileText, Plane, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const activityIcons: Record<string, typeof Building2> = {
  agency_created: Building2,
  trip_created: Plane,
  user_registered: Users,
  credits_purchased: FileText,
  concierge_request: FileText,
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

export default function MasterOverviewPage() {
  const { stats, agencies, users, trips, activities, dataErrors } = useMaster()

  const overviewCards = [
    { label: "Usuarios", value: stats.totalUsers, icon: Users, href: "/master/usuarios" },
    { label: "Agências", value: stats.totalAgencies, icon: Building2, href: "/master/agencias" },
    { label: "Clientes", value: stats.totalClients, icon: Users, href: "/master/agencias" },
    { label: "Viagens", value: stats.totalTrips, icon: Plane, href: "/master/viagens" },
    { label: "Documentos", value: stats.totalDocuments, icon: FileText, href: "/master/viagens" },
  ]

  const recentUsers = users.slice(0, 5)
  const recentAgencies = agencies.slice(0, 5)
  const recentTrips = trips.slice(0, 5)

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Leitura operacional real do Vuei no Supabase</p>
      </motion.div>

      {dataErrors.profiles || dataErrors.agencies ? (
        <motion.div variants={fadeInUp}>
          <Card className="border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-foreground">Falha ao carregar dados do Master</p>
            {dataErrors.profiles ? <p className="mt-1 text-xs text-muted-foreground">Usuarios: {dataErrors.profiles}</p> : null}
            {dataErrors.agencies ? <p className="mt-1 text-xs text-muted-foreground">Agências: {dataErrors.agencies}</p> : null}
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {overviewCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <div className="text-2xl font-bold text-foreground">{card.value}</div>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                  <card.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Usuarios Recentes</h2>
              <Link href="/master/usuarios" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todos <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuario real ainda.</p>
              ) : (
                recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(user.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Agências recentes</h2>
              <Link href="/master/agencias" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentAgencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma agencia real ainda.</p>
              ) : (
                recentAgencies.map((agency) => (
                  <div key={agency.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{agency.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{agency.owner}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(agency.createdAt)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6 h-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Viagens Recentes</h2>
              <Link href="/master/viagens" className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {recentTrips.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma viagem real ainda.</p>
              ) : (
                recentTrips.map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{trip.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{trip.agencyName || trip.userName || trip.destination}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(trip.startDate)}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
          </div>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade real registrada ainda.</p>
            ) : (
              activities.map((activity) => {
                const Icon = activityIcons[activity.type] ?? FileText
                return (
                  <div key={activity.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground">{activity.description}</div>
                      <div className="text-xs text-muted-foreground truncate">{activity.entityName}</div>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(activity.createdAt)}</span>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
