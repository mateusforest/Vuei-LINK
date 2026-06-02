"use client"

import { Suspense, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"
import { Activity, Building2, Mail, Search, Shield, Users, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function getRoleLabel(type: "traveler" | "agency" | "admin") {
  if (type === "admin") return "Master"
  if (type === "agency") return "Agencia"
  return "Viajante"
}

function MasterUsuariosPageContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  const { users, stats } = useMaster()
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [showDetailsModal, setShowDetailsModal] = useState<string | null>(highlightId)

  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        const normalizedQuery = searchQuery.toLowerCase()
        const matchesSearch =
          user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery)
        const matchesType = typeFilter === "all" || user.type === typeFilter
        return matchesSearch && matchesType
      }),
    [users, searchQuery, typeFilter]
  )

  const selectedUser = showDetailsModal ? users.find((user) => user.id === showDetailsModal) ?? null : null

  const pageStats = [
    { label: "Total Usuarios", value: stats.totalUsers.toString(), icon: Users },
    { label: "Usuarios Ativos", value: stats.activeUsers.toString(), icon: Activity },
    { label: "Usuarios Agencia", value: users.filter((user) => user.type === "agency").length.toString(), icon: Building2 },
    { label: "Masters", value: users.filter((user) => user.type === "admin").length.toString(), icon: Shield },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <AnimatePresence>
        {showDetailsModal && selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl z-50"
            >
              <Card className="bg-card/95 backdrop-blur-xl border-white/10 p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-white/10">
                      <AvatarImage src={selectedUser.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-lg font-semibold text-primary">
                        {selectedUser.name
                          .split(" ")
                          .map((name) => name[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-semibold">{selectedUser.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDetailsModal(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Role</p>
                    <p className="text-sm font-medium">{getRoleLabel(selectedUser.type)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                    <p className="text-sm font-medium">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Viagens</p>
                    <p className="text-sm font-medium">{selectedUser.tripsCount}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Ultima Atualizacao</p>
                    <p className="text-sm font-medium">{formatDate(selectedUser.lastActive)}</p>
                  </div>
                </div>

                {selectedUser.agencyName ? (
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Agencia vinculada</p>
                    <p className="text-sm font-medium">{selectedUser.agencyName}</p>
                  </div>
                ) : null}
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Leitura real de profiles e roles do Supabase</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {pageStats.map((stat) => (
          <Card key={stat.label} className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] bg-black/40 border-white/10">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="bg-card border-white/10">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="traveler">Viajantes</SelectItem>
            <SelectItem value="agency">Agencia</SelectItem>
            <SelectItem value="admin">Master</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Usuario</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Role</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Agencia</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-6 py-4">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-sm text-center text-muted-foreground">
                      Nenhum usuario real encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => setShowDetailsModal(user.id)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                        highlightId === user.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-white/10">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-xs font-semibold text-primary">
                              {user.name
                                .split(" ")
                                .map((name) => name[0])
                                .join("")
                                .slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-sm font-medium text-foreground">{user.name}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-foreground">{getRoleLabel(user.type)}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{user.agencyName || "Sem agencia"}</td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

export default function MasterUsuariosPage() {
  return (
    <Suspense fallback={<div className="space-y-8"><div className="h-24 rounded-2xl border border-white/5 bg-black/20" /></div>}>
      <MasterUsuariosPageContent />
    </Suspense>
  )
}
