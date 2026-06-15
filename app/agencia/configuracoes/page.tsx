"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import {
  Building2,
  Palette,
  Shield,
  Bell,
  CreditCard,
  LogOut,
  ChevronRight,
  Camera,
  Save,
  Lock,
  Trash2,
  AlertTriangle,
  Check,
  Upload,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAgency } from "@/contexts/agency-context"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { updateAgency as updateAgencyRepository } from "@/lib/repositories/agencies-repository"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { mapCommercialPlanToLegacyAgencyPlan } from "@/lib/billing/agency-plans"
import type { AgencyCommercialPlanCode } from "@/types"

const settingsSections = [
  { id: "agency", label: "Dados da Agencia", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "security", label: "Seguranca", icon: Shield },
  { id: "notifications", label: "Notificacoes", icon: Bell },
  { id: "plan", label: "Plano", icon: CreditCard },
]

const mockPlans = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    benefits: ["40 creditos por mes", "1 usuario", "1 viagem ativa"],
  },
  {
    id: "start",
    name: "Start",
    price: "R$ 69,90/mes",
    benefits: ["350 creditos por mes", "3 usuarios", "20 viagens ativas"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 109,90/mes",
    benefits: ["600 creditos por mes", "5 usuarios", "100 viagens ativas"],
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 249,90/mes",
    benefits: ["1.500 creditos por mes", "15 usuarios", "220 viagens ativas"],
  },
]

const STORAGE_KEY = "vuei_agencia_configuracoes_frontend"

export default function SettingsPage() {
  const router = useRouter()
  const { signOut, user, profile } = useAuth()
  const { credits, agency, setupIncomplete, workspaceError, refreshAgencyWorkspace, subscription, activeTripsCount, teamSeatsUsed, updateSubscriptionPlan } = useAgency()
  const [activeSection, setActiveSection] = useState("agency")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveConfirmation, setArchiveConfirmation] = useState("")
  const [isArchivingAgency, setIsArchivingAgency] = useState(false)
  const [agencyLogoFile, setAgencyLogoFile] = useState<File | null>(null)
  const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null)

  const [agencyData, setAgencyData] = useState({
    name: "Agencia Viaje+",
    cnpj: "12.345.678/0001-90",
    email: "contato@viajeplus.com",
    phone: "+55 11 99999-0000",
    address: "Av. Paulista, 1000 - Sao Paulo, SP",
    logo: "",
    plan: "Free",
  })
  const [brandingData, setBrandingData] = useState({
    linkLogo: "",
  })

  const [notifications, setNotifications] = useState({
    concierge: true,
    trips: true,
    credits: true,
    newClients: false,
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (typeof window === "undefined") return

    if (shouldUseSupabase()) {
      if (agency) {
        setAgencyData((prev) => ({
          ...prev,
          name: agency.name || prev.name,
          email: agency.settings?.email || profile?.email || prev.email,
          phone: agency.settings?.phone || profile?.phone || prev.phone,
          address: agency.settings?.address || prev.address,
          logo: agency.logo || prev.logo,
          plan: subscription.definition.name,
        }))
        setBrandingData({
          linkLogo: agency.branding?.linkLogoUrl || "",
        })
      }

      if (agency?.settings?.notifications) {
        setNotifications({
          concierge: agency.settings.notifications.concierge,
          trips: agency.settings.notifications.trips,
          credits: agency.settings.notifications.credits,
          newClients: agency.settings.notifications.newClients,
        })
      }

      return
    }

    const savedState = window.localStorage.getItem(STORAGE_KEY)
    if (!savedState) return

    try {
      const parsed = JSON.parse(savedState)
      if (parsed.agencyData) setAgencyData(parsed.agencyData)
      if (parsed.brandingData) setBrandingData(parsed.brandingData)
      if (parsed.notifications) setNotifications(parsed.notifications)
    } catch {
      // fallback silencioso
    }
  }, [agency, profile?.email, profile?.phone, subscription.definition.name])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (shouldUseSupabase() && user?.id) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ agencyData, brandingData, notifications }))
  }, [agencyData, brandingData, notifications, user?.id])

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(""), 2200)
  }

  const handleSave = async (message = "Configuracoes salvas com sucesso.") => {
    setSaving(true)

    if (shouldUseSupabase() && user?.id) {
      if (!agency) {
        setSaving(false)
        showToast("Agencia nao encontrada no Supabase.")
        return
      }

      let nextLogo = agencyData.logo

      if (agencyLogoFile) {
        const client = createSupabaseBrowserClient()
        if (!client) {
          setSaving(false)
          showToast("Cliente Supabase indisponivel para upload da logo.")
          return
        }

        const extension = agencyLogoFile.name.split(".").pop()?.toLowerCase() || "png"
        const filePath = `${user.id}/agency/${agency.id}/agency-logo-${Date.now()}.${extension}`
        const uploadResult = await client.storage.from("vuei-avatars").upload(filePath, agencyLogoFile, {
          cacheControl: "3600",
          upsert: true,
        })

        if (uploadResult.error) {
          setSaving(false)
          showToast(
            uploadResult.error.message.includes("Bucket not found")
              ? "Bucket 'vuei-avatars' nao existe. Rode o SQL de configuracao antes de salvar a logo."
              : uploadResult.error.message
          )
          return
        }

        nextLogo = client.storage.from("vuei-avatars").getPublicUrl(filePath).data.publicUrl
      }

      const updateResult = await updateAgencyRepository(agency.id, {
        name: agencyData.name,
        logo: nextLogo || null,
        plan: mapCommercialPlanToLegacyAgencyPlan(subscription.code),
        settings: {
          ...(agency.settings ?? {
            email: null,
            phone: null,
            cnpj: null,
            address: null,
            notifications,
            twoFactorEnabled: false,
          }),
          email: agencyData.email,
          phone: agencyData.phone,
          cnpj: agencyData.cnpj,
          address: agencyData.address,
          notifications,
        },
      })

      if (!updateResult.data) {
        setSaving(false)
        showToast(updateResult.error || "Nao foi possivel salvar a agencia no Supabase.")
        return
      }

      setAgencyData((prev) => ({ ...prev, logo: nextLogo }))
      setAgencyLogoFile(null)
      await refreshAgencyWorkspace()
    } else {
      await new Promise((resolve) => setTimeout(resolve, 700))
    }

    setSaving(false)
    setSaved(true)
    showToast(message)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleAgencyLogoSelected = (file?: File) => {
    if (!file) return
    setAgencyLogoFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      setAgencyData((prev) => ({
        ...prev,
        logo: typeof reader.result === "string" ? reader.result : prev.logo,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleBrandingLogoSelected = (file?: File) => {
    if (!file) return
    setBrandingLogoFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      setBrandingData((prev) => ({
        ...prev,
        linkLogo: typeof reader.result === "string" ? reader.result : prev.linkLogo,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveBranding = async () => {
    setSaving(true)

    if (shouldUseSupabase() && user?.id) {
      if (!agency) {
        setSaving(false)
        showToast("Agencia nao encontrada no Supabase.")
        return
      }

      let nextLinkLogo = brandingData.linkLogo

      if (brandingLogoFile) {
        const client = createSupabaseBrowserClient()
        if (!client) {
          setSaving(false)
          showToast("Cliente Supabase indisponivel para upload da logo.")
          return
        }

        const extension = brandingLogoFile.name.split(".").pop()?.toLowerCase() || "png"
        const filePath = `${user.id}/agency/${agency.id}/link-logo-${Date.now()}.${extension}`
        const uploadResult = await client.storage.from("vuei-avatars").upload(filePath, brandingLogoFile, {
          cacheControl: "3600",
          upsert: true,
        })

        if (uploadResult.error) {
          setSaving(false)
          showToast(
            uploadResult.error.message.includes("Bucket not found")
              ? "Bucket 'vuei-avatars' nao existe. Rode o SQL de configuracao antes de salvar a logo."
              : uploadResult.error.message
          )
          return
        }

        nextLinkLogo = client.storage.from("vuei-avatars").getPublicUrl(filePath).data.publicUrl
      }

      const updateResult = await updateAgencyRepository(agency.id, {
        branding: {
          ...(agency.branding ?? { logoUrl: null }),
          linkLogoUrl: nextLinkLogo || null,
        },
      })

      if (!updateResult.data) {
        setSaving(false)
        showToast(updateResult.error || "Nao foi possivel salvar a agencia no Supabase.")
        return
      }

      setBrandingData({ linkLogo: nextLinkLogo || "" })
      setBrandingLogoFile(null)
      await refreshAgencyWorkspace()
    } else {
      await new Promise((resolve) => setTimeout(resolve, 700))
    }

    setSaving(false)
    setSaved(true)
    showToast("Logo da agencia salva com sucesso.")
    setTimeout(() => setSaved(false), 1500)
  }

  const handleSavePassword = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword) {
      return
    }

    setShowPasswordModal(false)
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    showToast("Senha atualizada com sucesso.")
  }

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  const handleArchiveAgency = async () => {
    if (archiveConfirmation.trim().toUpperCase() !== "ARQUIVAR") {
      showToast('Digite "ARQUIVAR" para confirmar.')
      return
    }

    if (!agency) {
      showToast("Agencia nao encontrada para arquivamento.")
      return
    }

    setIsArchivingAgency(true)

    try {
      const result = await updateAgencyRepository(agency.id, { status: "archived" })

      if (!result.data) {
        showToast(result.error || "Nao foi possivel arquivar a agencia.")
        return
      }

      setShowArchiveModal(false)
      setArchiveConfirmation("")
      await refreshAgencyWorkspace()
      showToast("Agencia arquivada com seguranca.")
      void signOut()
      router.replace("/login")
    } finally {
      setIsArchivingAgency(false)
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {setupIncomplete && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-200">
            Sua conta de agencia existe, mas a agencia ainda nao foi persistida corretamente no Supabase.
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

      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
        <p className="mt-1 text-muted-foreground">Gerencie sua agencia</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-1 lg:col-span-1">
          {settingsSections.map((section) => (
            <motion.button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all ${
                activeSection === section.id
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
              whileHover={{ x: 2 }}
            >
              <section.icon className={`h-4 w-4 ${activeSection === section.id ? "text-primary" : ""}`} />
              {section.label}
              {activeSection === section.id && <ChevronRight className="ml-auto h-4 w-4 text-primary" />}
            </motion.button>
          ))}
          <hr className="my-4 border-white/5" />
          <Button variant="ghost" className="w-full justify-start gap-3 text-red-400 hover:bg-red-500/10 hover:text-red-400" onClick={() => void handleSignOut()}>
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>

        <div className="lg:col-span-3">
          {activeSection === "agency" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-white/5 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base">Dados da Agencia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-2 border-white/10">
                        <AvatarImage src={agencyData.logo || "/placeholder-logo.svg"} />
                        <AvatarFallback className="bg-primary/20 text-xl text-primary">V+</AvatarFallback>
                      </Avatar>
                      <Button
                        size="icon"
                        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary"
                        onClick={() => setShowPhotoModal(true)}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">Branding da Agencia</p>
                      <p className="text-xs text-muted-foreground">Este logo aparece nos links da viagem. O avatar do usuario continua separado no perfil.</p>
                    </div>
                    <Button variant="outline" className="border-white/10" onClick={() => setShowPhotoModal(true)}>
                      Gerenciar logo
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Nome da Agencia</Label>
                      <Input value={agencyData.name} onChange={(e) => setAgencyData({ ...agencyData, name: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CNPJ</Label>
                      <Input value={agencyData.cnpj} onChange={(e) => setAgencyData({ ...agencyData, cnpj: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <Input value={agencyData.email} onChange={(e) => setAgencyData({ ...agencyData, email: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <Input value={agencyData.phone} onChange={(e) => setAgencyData({ ...agencyData, phone: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Endereco</Label>
                    <Input value={agencyData.address} onChange={(e) => setAgencyData({ ...agencyData, address: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
                  </div>

                  <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => handleSave()} disabled={saving}>
                    {saving ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Salvando...
                      </>
                    ) : saved ? (
                      <>
                        <Check className="h-4 w-4" />
                        Salvo!
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Salvar Alteracoes
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "branding" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/5 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base">Branding do Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Personalize o logo exibido nos links compartilhaveis sem alterar a foto de perfil do usuario.
                  </p>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-muted/20">
                        {brandingData.linkLogo ? (
                          <img src={brandingData.linkLogo} alt="Logo da agencia" className="h-full w-full object-cover" />
                        ) : (
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Label className="text-muted-foreground">Logo da agencia</Label>
                        <Input type="file" accept="image/*" onChange={(e) => handleBrandingLogoSelected(e.target.files?.[0])} className="mt-1.5 border-white/10 bg-white/5" />
                      </div>
                    </div>
                  </div>
                  <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => void handleSaveBranding()} disabled={saving || (shouldUseSupabase() && !agency)}>
                    <Save className="h-4 w-4" />
                    Salvar Branding
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "security" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <Card className="border-white/5 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base">Seguranca</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Lock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Senha da conta</p>
                          <p className="text-xs text-muted-foreground">Atualize sua senha de acesso quando precisar.</p>
                        </div>
                      </div>
                      <Button variant="outline" className="border-white/10" onClick={() => setShowPasswordModal(true)}>
                        Alterar senha
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-white/5 p-4">
                    <div>
                      <p className="font-medium text-foreground">Autenticacao 2FA</p>
                      <p className="text-xs text-muted-foreground">Adicione uma camada extra de seguranca</p>
                    </div>
                    <Switch />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    Zona de Perigo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">Arquive a agencia com seguranca sem apagar clientes, viagens, documentos ou historico.</p>
                  <Button
                    variant="outline"
                    className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setShowArchiveModal(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir Agencia
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "notifications" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-white/5 bg-card/50">
                <CardHeader>
                  <CardTitle className="text-base">Notificacoes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "concierge", label: "Novas mensagens concierge", desc: "Receba alertas de mensagens" },
                    { key: "trips", label: "Viagens proximas", desc: "Lembretes de embarques" },
                    { key: "credits", label: "Creditos baixos", desc: "Aviso quando creditos acabarem" },
                    { key: "newClients", label: "Novos clientes", desc: "Notificar cadastros" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-white/5 p-4">
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Switch checked={notifications[item.key as keyof typeof notifications]} onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "plan" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Badge className="bg-primary text-white">Plano {subscription.definition.name}</Badge>
                      <p className="mt-2 text-2xl font-bold text-foreground">{subscription.definition.priceLabel}</p>
                      <p className="text-sm text-muted-foreground">
                        {agency ? "Plano salvo na camada comercial da agencia" : "Plano ainda nao vinculado a uma agencia real"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button asChild variant="outline" className="border-white/10">
                        <Link href="/agencia/planos">Conhecer planos</Link>
                      </Button>
                      <Button variant="outline" className="border-white/10" onClick={() => setShowPlanModal(true)}>
                        Ajustar plano interno
                      </Button>
                    </div>
                  </div>
                  <hr className="my-4 border-white/10" />
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {subscription.definition.monthlyCredits} creditos IA inclusos por mes (Saldo atual: {credits.balance})
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Ate {subscription.definition.maxUsers} usuarios ativos na equipe
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Ate {subscription.definition.maxActiveTrips} viagens ativas
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Em uso agora: {teamSeatsUsed} usuarios e {activeTripsCount} viagens ativas
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar branding</DialogTitle>
            <DialogDescription>Envie o logo da agencia que sera exibido no link da viagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-muted/20">
                {agencyData.logo ? (
                  <img src={agencyData.logo} alt="Preview da agencia" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </div>
            <Input type="file" accept="image/*" onChange={(e) => handleAgencyLogoSelected(e.target.files?.[0])} className="border-white/10 bg-white/5" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setShowPhotoModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                onClick={() => {
                  setShowPhotoModal(false)
                  if (shouldUseSupabase() && !agency) {
                    showToast("Agencia nao encontrada no Supabase para salvar o branding.")
                    return
                  }
                  void handleSave("Logo da agencia atualizado.")
                }}
              >
                Salvar logo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Atualize sua senha de acesso da agencia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Senha atual</Label>
              <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
            </div>
            <div>
              <Label className="text-muted-foreground">Nova senha</Label>
              <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
            </div>
            <div>
              <Label className="text-muted-foreground">Confirmar nova senha</Label>
              <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="mt-1.5 border-white/10 bg-white/5" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setShowPasswordModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                onClick={handleSavePassword}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
              >
                Salvar senha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>Escolha um plano para a sua operacao sem integrar pagamento nesta etapa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-lg font-semibold text-foreground">{subscription.definition.name}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {mockPlans.map((plan) => (
                <div key={plan.id} className={`rounded-xl border p-4 ${subscription.code === plan.id ? "border-primary/40 bg-primary/5" : "border-white/10 bg-white/[0.02]"}`}>
                  <p className="font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.price}</p>
                  <div className="mt-3 space-y-2">
                    {plan.benefits.map((benefit) => (
                      <p key={benefit} className="text-xs text-muted-foreground">{benefit}</p>
                    ))}
                  </div>
                  <Button
                    className="mt-4 w-full bg-gradient-to-r from-primary to-accent text-white"
                    onClick={async () => {
                      const result = await updateSubscriptionPlan(plan.id as AgencyCommercialPlanCode)
                      if (!result.success) {
                        showToast(result.error || "Nao foi possivel atualizar o plano.")
                        return
                      }

                      setAgencyData((prev) => ({ ...prev, plan: plan.name }))
                      setShowPlanModal(false)
                      showToast(`Plano ${plan.name} selecionado sem cobranca real nesta etapa.`)
                    }}
                  >
                    {subscription.code === plan.id ? "Plano atual" : "Selecionar plano"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showArchiveModal}
        onOpenChange={(open) => {
          setShowArchiveModal(open)
          if (!open) {
            setArchiveConfirmation("")
          }
        }}
      >
        <DialogContent className="border-red-500/20 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Arquivar agencia</DialogTitle>
            <DialogDescription>
              A agencia sera desativada e arquivada com seguranca, sem excluir dados reais nem remover historico operacional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-muted-foreground">
              Digite <span className="font-medium text-foreground">ARQUIVAR</span> para confirmar a desativacao da agencia.
            </div>
            <div>
              <Label className="text-muted-foreground">Confirmacao</Label>
              <Input
                value={archiveConfirmation}
                onChange={(e) => setArchiveConfirmation(e.target.value)}
                placeholder="ARQUIVAR"
                className="mt-1.5 border-red-500/20 bg-white/5"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setShowArchiveModal(false)} disabled={isArchivingAgency}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-red-500 text-white hover:bg-red-500/90"
                onClick={() => void handleArchiveAgency()}
                disabled={isArchivingAgency || archiveConfirmation.trim().toUpperCase() !== "ARQUIVAR"}
              >
                {isArchivingAgency ? "Arquivando..." : "Arquivar agencia"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
