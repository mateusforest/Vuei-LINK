"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Building2, Calendar, Search, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45 },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function MasterClientesPage() {
  const { clients, dataErrors } = useMaster()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredClients = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    if (!normalized) return clients

    return clients.filter((client) =>
      client.name.toLowerCase().includes(normalized) ||
      (client.email ?? "").toLowerCase().includes(normalized) ||
      (client.agencyName ?? "").toLowerCase().includes(normalized)
    )
  }, [clients, searchQuery])

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.div {...fadeInUp} className="space-y-1">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Leitura real dos clientes vinculados na plataforma.</p>
      </motion.div>

      {dataErrors.clients ? (
        <motion.div {...fadeInUp}>
          <Card className="border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm font-medium text-foreground">Falha ao carregar clientes reais</p>
            <p className="mt-1 text-xs text-muted-foreground">{dataErrors.clients}</p>
          </Card>
        </motion.div>
      ) : null}

      <motion.div {...fadeInUp} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">Total de clientes</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.length}</p>
        </Card>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">Com agência</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.filter((client) => client.agencyId).length}</p>
        </Card>
        <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
          <p className="text-xs font-medium text-muted-foreground">Sem agência</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{clients.filter((client) => !client.agencyId).length}</p>
        </Card>
      </motion.div>

      <motion.div {...fadeInUp} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10 bg-black/40 border-white/10 focus:border-primary/50"
        />
      </motion.div>

      <motion.div {...fadeInUp}>
        {filteredClients.length === 0 ? (
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-10 text-center">
            <p className="text-base font-medium text-foreground">Nenhum cliente encontrado</p>
            <p className="mt-2 text-sm text-muted-foreground">Ajuste sua busca ou aguarde novos clientes sincronizados.</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredClients.map((client) => (
              <Card key={client.id} className="border-white/5 bg-black/40 backdrop-blur-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">{client.name}</h2>
                    <p className="text-sm text-muted-foreground">{client.email || "Sem e-mail informado"}</p>
                  </div>
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    {client.creditsBalance} créditos
                  </Badge>
                </div>

                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{client.agencyName || "Cliente sem agência"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{client.tripsCount} {client.tripsCount === 1 ? "viagem" : "viagens"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Criado em {formatDate(client.createdAt)}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
