"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  Crown,
  User,
  Trash2,
  Edit2,
  Send,
  X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAgency } from "@/contexts/agency-context"
import { AGENCY_TEAM_LIMIT_ERROR } from "@/lib/billing/agency-plans"

const roles = [
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
  { value: "viewer", label: "Gerente", desc: "Acompanha equipe e clientes" },
  { value: "agent", label: "Agente", desc: "Atende clientes e cria viagens" },
]

export default function TeamPage() {
  const { teamMembers, addTeamMember, updateTeamMember, removeTeamMember, workspaceError, teamSeatsUsed, subscription } = useAgency()
  const [searchQuery, setSearchQuery] = useState("")
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState("agent")
  const safeTeam = teamMembers ?? []

  const filteredMembers = safeTeam.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return Crown
      case "admin":
        return Shield
      case "viewer":
        return Shield
      default:
        return User
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Owner"
      case "admin":
        return "Admin"
      case "viewer":
        return "Gerente"
      default:
        return "Agente"
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) return

    const result = await addTeamMember({
      name: inviteName,
      email: inviteEmail,
      role: inviteRole as "admin" | "agent" | "viewer",
      status: "active"
    })

    if (!result.success) {
      if (result.error === AGENCY_TEAM_LIMIT_ERROR) {
        return
      }
      window.alert(result.error || "Não foi possível vincular o membro à agência.")
      return
    }

    setInviteEmail("")
    setInviteName("")
    setInviteRole("agent")
    setInviteModalOpen(false)
  }

  const handleResendInvite = async (id: string) => {
    const result = await updateTeamMember(id, { status: "active" })
    if (!result.success) {
      window.alert(result.error || "Não foi possível atualizar o membro.")
    }
  }

  const handleCancelInvite = async (id: string) => {
    const result = await removeTeamMember(id)
    if (!result.success) {
      window.alert(result.error || "Não foi possível desativar o membro.")
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
          <p className="mt-1 text-muted-foreground">{teamSeatsUsed} de {subscription.definition.maxUsers} usuarios ativos no plano</p>
        </div>
        <Button
          onClick={() => setInviteModalOpen(true)}
          className="gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Convidar
        </Button>
      </div>

      {workspaceError ? (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">{workspaceError}</CardContent>
        </Card>
      ) : null}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar membros..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
      </div>

      {/* Team Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredMembers.map((member, index) => {
          const RoleIcon = getRoleIcon(member.role)
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-white/5 bg-card/50 transition-all hover:border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-white/10">
                          <AvatarImage src={member.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {member.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                            member.status === "active" ? "bg-green-500" : "bg-yellow-500"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-white/10 bg-card">
                        <DropdownMenuItem disabled={member.role === "owner"} onClick={() => void updateTeamMember(member.id, { role: "admin" })}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Tornar admin
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={member.role === "owner"} onClick={() => void updateTeamMember(member.id, { role: "agent" })}>
                          <Shield className="mr-2 h-4 w-4" />
                          Tornar agente
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={member.role === "owner"} onClick={() => void updateTeamMember(member.id, { role: "viewer" })}>
                          <Shield className="mr-2 h-4 w-4" />
                          Tornar gerente
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={member.role === "owner"} onClick={() => void updateTeamMember(member.id, { status: member.status === "inactive" ? "active" : "inactive" })}>
                          <Shield className="mr-2 h-4 w-4" />
                          {member.status === "inactive" ? "Reativar membro" : "Desativar membro"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem className="text-red-400" disabled={member.role === "owner"} onClick={() => void removeTeamMember(member.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Desativar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`gap-1 ${
                        member.role === "admin"
                          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                          : member.role === "viewer"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-white/10 bg-white/5 text-muted-foreground"
                      }`}
                    >
                      <RoleIcon className="h-3 w-3" />
                      {getRoleLabel(member.role)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {member.status === "pending" ? "Convite pendente" : member.status === "inactive" ? "Inativo" : "Ativo agora"}
                    </span>
                  </div>

                  {member.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 gap-1 border-white/10 text-xs"
                        onClick={() => handleResendInvite(member.id)}
                      >
                        <Send className="h-3 w-3" />
                        Reenviar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="border-white/10 text-xs text-red-400"
                        onClick={() => handleCancelInvite(member.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Roles Info */}
      <Card className="border-white/5 bg-card/50">
        <CardContent className="p-4">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Funcoes e Permissoes</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {roles.map((role) => {
              const RoleIcon = getRoleIcon(role.value)
              return (
                <div
                  key={role.value}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2">
                    <RoleIcon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{role.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{role.desc}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Nome</Label>
              <Input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome completo"
                className="mt-1.5 border-white/10 bg-white/5"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="mt-1.5 border-white/10 bg-white/5"
              />
            </div>
            <div>
              <Label className="text-muted-foreground">Funcao</Label>
              <div className="mt-2 space-y-2">
                {roles.map((role) => {
                  const RoleIcon = getRoleIcon(role.value)
                  return (
                    <div
                      key={role.value}
                      onClick={() => setInviteRole(role.value)}
                      className={`cursor-pointer rounded-lg border p-3 transition-all ${
                        inviteRole === role.value
                          ? "border-primary bg-primary/10"
                          : "border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RoleIcon className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">{role.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{role.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O convite de novo usuário ainda depende do fluxo de convite. Por enquanto, só é possível vincular e-mails que já existem em perfis.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                className="flex-1 border-white/10"
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent text-white"
                onClick={handleInvite}
                disabled={!inviteEmail || !inviteName}
              >
                <Mail className="h-4 w-4" />
                Enviar Convite
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
