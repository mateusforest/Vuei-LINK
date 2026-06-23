"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Search,
  Link2,
  Copy,
  QrCode,
  Eye,
  Settings,
  MoreHorizontal,
  Lock,
  Users,
  Calendar,
  ExternalLink,
  Check,
  Plane,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAgency, type AgencyTrip } from "@/contexts/agency-context"

export default function LinksPage() {
  const { trips, setupIncomplete, workspaceError } = useAgency()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLink, setSelectedLink] = useState<AgencyTrip | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [linkSettings, setLinkSettings] = useState<Record<string, { isActive: boolean; allowDocs: boolean; allowShare: boolean }>>({})

  const filteredLinks = trips.filter(
    (trip) =>
      trip.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const openSettings = (trip: AgencyTrip) => {
    setSelectedLink(trip)
    setSettingsModalOpen(true)
  }

  const getSettings = (tripId: string) => {
    return linkSettings[tripId] || { isActive: true, allowDocs: true, allowShare: true }
  }

  const updateSettings = (tripId: string, key: string, value: boolean) => {
    setLinkSettings(prev => ({
      ...prev,
      [tripId]: {
        ...getSettings(tripId),
        [key]: value
      }
    }))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {setupIncomplete && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-200">
            Os links só ficam disponíveis depois que a agência e as viagens forem persistidas corretamente no Supabase.
          </CardContent>
        </Card>
      )}

      {!setupIncomplete && workspaceError && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4 text-sm text-red-300">
            {workspaceError}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Links Compartilhaveis</h1>
        <p className="mt-1 text-muted-foreground">Gerencie os links de acesso as viagens</p>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Privacidade de Documentos</p>
            <p className="text-xs text-muted-foreground">
              Documentos marcados como privados (passaporte, RG, etc.) nunca aparecem nos links compartilhaveis, apenas no link admin.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar links..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
      </div>

      {/* Links Grid */}
      {filteredLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Nenhum link encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Tente buscar com outros termos" : "Crie uma viagem para gerar links"}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredLinks.map((trip, index) => {
            const settings = getSettings(trip.id)
            return (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-white/5 bg-card/50 transition-all hover:border-primary/20">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarImage src={trip.coverImage} />
                          <AvatarFallback className="bg-primary/20 text-xs text-primary">
                            {trip.clientName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{trip.clientName}</p>
                          <p className="text-xs text-muted-foreground">{trip.destination}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            settings.isActive
                              ? "border-green-500/30 bg-green-500/10 text-green-400"
                              : "border-red-500/30 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {settings.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/10 bg-card">
                            <DropdownMenuItem onClick={() => openSettings(trip)}>
                              <Settings className="mr-2 h-4 w-4" />
                              Configurações
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <QrCode className="mr-2 h-4 w-4" />
                              Gerar QR Code
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Links */}
                    <div className="mt-4 space-y-2">
                      {/* Admin Link */}
                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Lock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">Link Admin</p>
                            <code className="text-[10px] text-muted-foreground truncate block">{trip.adminLink}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopy(trip.adminLink, `admin-${trip.id}`)}
                          >
                            {copiedId === `admin-${trip.id}` ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(`/viagem/${trip.slug}/admin`, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Share Link */}
                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Users className="h-4 w-4 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">Link Compartilhavel</p>
                            <code className="text-[10px] text-muted-foreground truncate block">{trip.shareLink}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleCopy(trip.shareLink, `share-${trip.id}`)}
                          >
                            {copiedId === `share-${trip.id}` ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(trip.shareLink || `/v/${trip.slug}`, "_blank")}
                            >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(trip.startDate)}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${
                          trip.status === "upcoming" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
                          trip.status === "ongoing" ? "border-green-500/30 bg-green-500/10 text-green-400" :
                          "border-white/10"
                        }`}>
                          {trip.status === "upcoming" ? "Próximo" : trip.status === "ongoing" ? "Em andamento" : "Concluído"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Settings Modal */}
      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurações do link</DialogTitle>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedLink.coverImage} />
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {selectedLink.clientName.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedLink.clientName}</p>
                  <p className="text-xs text-muted-foreground">{selectedLink.destination}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Link ativo</p>
                    <p className="text-xs text-muted-foreground">Permitir acesso ao link</p>
                  </div>
                  <Switch 
                    checked={getSettings(selectedLink.id).isActive} 
                    onCheckedChange={(checked) => updateSettings(selectedLink.id, "isActive", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Exibir documentos</p>
                    <p className="text-xs text-muted-foreground">Mostrar docs compartilhaveis</p>
                  </div>
                  <Switch 
                    checked={getSettings(selectedLink.id).allowDocs} 
                    onCheckedChange={(checked) => updateSettings(selectedLink.id, "allowDocs", checked)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-white/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Permitir compartilhamento</p>
                    <p className="text-xs text-muted-foreground">Cliente pode recompartilhar</p>
                  </div>
                  <Switch 
                    checked={getSettings(selectedLink.id).allowShare} 
                    onCheckedChange={(checked) => updateSettings(selectedLink.id, "allowShare", checked)}
                  />
                </div>
              </div>

              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <CardContent className="flex items-start gap-2 p-3">
                  <Lock className="mt-0.5 h-4 w-4 text-yellow-500" />
                  <p className="text-xs text-muted-foreground">
                    Documentos privados (passaporte, RG, visto) nunca aparecem no link compartilhável,
                    independente desta configuracao.
                  </p>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSettingsModalOpen(false)}
                  className="flex-1 border-white/10"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => setSettingsModalOpen(false)}
                  className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                >
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
