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
import { AGENCY_PLAN_DEFINITIONS, mapCommercialPlanToLegacyAgencyPlan } from "@/lib/billing/agency-plans"
import { createAgencyCustomerPortal, getAgencyBillingStatusFromApi } from "@/lib/repositories/agency-billing-repository"
import type { AgencyBillingApiStatus, AgencyCommercialPlanCode } from "@/types"

const settingsSections = [
  { id: "agency", label: "Dados da Agência", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "security", label: "Segurança", icon: Shield },
  { id: "notifications", label: "Notificações", icon: Bell },
  { id: "plan", label: "Assinatura", icon: CreditCard },
]

const availablePlans = Object.values(AGENCY_PLAN_DEFINITIONS).map((plan) => ({
  id: plan.code,
  name: plan.name,
  price: plan.priceLabel,
  benefits: [
    `${plan.monthlyCredits} créditos por mês`,
    `${plan.maxUsers} ${plan.maxUsers === 1 ? "usuário" : "usuários"}`,
    `${plan.maxActiveTrips} ${plan.maxActiveTrips === 1 ? "viagem ativa" : "viagens ativas"}`,
  ],
}))

const STORAGE_KEY = "vuei_agencia_configuracoes_frontend"

function hasActiveAgencyPaidSubscription(status: AgencyBillingApiStatus | null) {
  if (!status) return false
  if (status.planCode === "free") return false
  return status.status === "active" || status.status === "trialing" || status.status === "past_due"
}

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
  const [billingStatus, setBillingStatus] = useState<AgencyBillingApiStatus | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [agencyLogoFile, setAgencyLogoFile] = useState<File | null>(null)
  const [brandingLogoFile, setBrandingLogoFile] = useState<File | null>(null)
  const hasPaidSubscriptionActive = hasActiveAgencyPaidSubscription(billingStatus)

  const [agencyData, setAgencyData] = useState({
    name: "Agência Viaje+",
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
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState("")

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

  useEffect(() => {
    if (!shouldUseSupabase() || !user?.id) {
      setBillingStatus(null)
      return
    }

    let active = true
    setBillingLoading(true)

    const loadBilling = async () => {
      const result = await getAgencyBillingStatusFromApi()
      if (!active) return
      setBillingStatus(result.data ?? null)
      if (result.error) {
        showToast(result.error)
      }
      setBillingLoading(false)
    }

    void loadBilling()

    return () => {
      active = false
    }
  }, [user?.id])

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(""), 2200)
  }

  const handleSave = async (message = "Configurações salvas com sucesso.") => {
    setSaving(true)

    if (shouldUseSupabase() && user?.id) {
      if (!agency) {
        setSaving(false)
        showToast("Agência não encontrada.")
        return
      }

      let nextLogo = agencyData.logo

      if (agencyLogoFile) {
        const client = createSupabaseBrowserClient()
        if (!client) {
          setSaving(false)
          showToast("Cliente Supabase indisponível para upload da logo.")
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
              ? "Bucket 'vuei-avatars' não existe. Rode o SQL de configuração antes de salvar a logo."
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
        showToast(updateResult.error || "Não foi possível salvar a agência no Supabase.")
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
        showToast("Agência não encontrada.")
        return
      }

      let nextLinkLogo = brandingData.linkLogo

      if (brandingLogoFile) {
        const client = createSupabaseBrowserClient()
        if (!client) {
          setSaving(false)
          showToast("Cliente Supabase indisponível para upload da logo.")
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
              ? "Bucket 'vuei-avatars' não existe. Rode o SQL de configuração antes de salvar a logo."
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
        showToast(updateResult.error || "Não foi possível salvar a agência no Supabase.")
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
    showToast("Logo da agência salva com sucesso.")
    setTimeout(() => setSaved(false), 1500)
  }

  const handleSavePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim()
    const newPassword = passwordForm.newPassword.trim()
    const confirmPassword = passwordForm.confirmPassword.trim()

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Preencha todos os campos para continuar.")
      return
    }

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da nova senha precisa ser igual.")
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError("A nova senha precisa ser diferente da senha atual.")
      return
    }

    if (!user?.email) {
      setPasswordError("Não foi possível validar o usuário autenticado.")
      return
    }

    const client = createSupabaseBrowserClient()
    if (!client) {
      setPasswordError("Cliente Supabase indisponível neste ambiente.")
      return
    }

    setPasswordSaving(true)
    setPasswordError("")

    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })

      if (signInError) {
        setPasswordError("A senha atual está incorreta.")
        return
      }

      const { error: updatePasswordError } = await client.auth.updateUser({
        password: newPassword,
      })

      if (updatePasswordError) {
        setPasswordError(updatePasswordError.message)
        return
      }

      setShowPasswordModal(false)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setPasswordError("")
      showToast("Senha atualizada com sucesso.")
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  const handleOpenAgencyCustomerPortal = async () => {
    setBillingActionLoading(true)
    const result = await createAgencyCustomerPortal()
    setBillingActionLoading(false)

    if (result.error || !result.data?.url) {
      showToast(result.error || "Não foi possível abrir o portal de assinatura.")
      return
    }

    window.location.href = result.data.url
  }

  const handleArchiveAgency = async () => {
    if (hasPaidSubscriptionActive) {
      showToast("Cancele a assinatura ativa antes de arquivar a agência.")
      return
    }

    if (archiveConfirmation.trim().toUpperCase() !== "ARQUIVAR") {
      showToast('Digite "ARQUIVAR" para confirmar.')
      return
    }

    if (!agency) {
      showToast("Agência não encontrada para arquivamento.")
      return
    }

    setIsArchivingAgency(true)

    try {
      const result = await updateAgencyRepository(agency.id, { status: "archived" })

      if (!result.data) {
        showToast(result.error || "Não foi possível arquivar a agência.")
        return
      }

      setShowArchiveModal(false)
      setArchiveConfirmation("")
      await refreshAgencyWorkspace()
      showToast("Agência arquivada com segurança.")
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
            Sua conta de agência existe, mas a agência ainda não foi persistida corretamente no Supabase.
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
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Gerencie sua agência</p>
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
                <Card className="border-border/60 bg-white/88">
                <CardHeader>
                  <CardTitle className="text-base">Dados da Agência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar className="h-20 w-20 border-2 border-border/60">
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
                      <p className="font-medium text-foreground">Branding da Agência</p>
                      <p className="text-xs text-muted-foreground">Este logo aparece nos links da viagem. O avatar do usuário continua separado no perfil.</p>
                    </div>
                    <Button variant="outline" className="border-border/70 bg-white" onClick={() => setShowPhotoModal(true)}>
                      Gerenciar logo
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Nome da Agência</Label>
                      <Input value={agencyData.name} onChange={(e) => setAgencyData({ ...agencyData, name: e.target.value })} className="mt-1.5 border-border/70 bg-white" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">CNPJ</Label>
                      <Input value={agencyData.cnpj} onChange={(e) => setAgencyData({ ...agencyData, cnpj: e.target.value })} className="mt-1.5 border-border/70 bg-white" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <Input value={agencyData.email} onChange={(e) => setAgencyData({ ...agencyData, email: e.target.value })} className="mt-1.5 border-border/70 bg-white" />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Telefone</Label>
                      <Input value={agencyData.phone} onChange={(e) => setAgencyData({ ...agencyData, phone: e.target.value })} className="mt-1.5 border-border/70 bg-white" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-muted-foreground">Endereço</Label>
                    <Input value={agencyData.address} onChange={(e) => setAgencyData({ ...agencyData, address: e.target.value })} className="mt-1.5 border-border/70 bg-white" />
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
                        Salvar alterações
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "branding" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border/60 bg-white/88">
                <CardHeader>
                  <CardTitle className="text-base">Branding do Link</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Personalize o logo exibido nos links compartilháveis sem alterar a foto de perfil do usuário.
                  </p>
                  <div className="rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                        {brandingData.linkLogo ? (
                          <img src={brandingData.linkLogo} alt="Logo da agência" className="h-full w-full object-cover" />
                        ) : (
                          <Upload className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Label className="text-muted-foreground">Logo da agência</Label>
                        <Input type="file" accept="image/*" onChange={(e) => handleBrandingLogoSelected(e.target.files?.[0])} className="mt-1.5 border-border/70 bg-white" />
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
              <Card className="border-border/60 bg-white/88">
                <CardHeader>
                  <CardTitle className="text-base">Segurança</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
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
                      <Button variant="outline" className="border-border/70 bg-white" onClick={() => setShowPasswordModal(true)}>
                        Alterar senha
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
                    <div>
                      <p className="font-medium text-foreground">Autenticação 2FA</p>
                      <p className="text-xs text-muted-foreground">Adicione uma camada extra de segurança</p>
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
                  <p className="mb-4 text-sm text-muted-foreground">
                    {hasPaidSubscriptionActive
                      ? "Se existe uma assinatura ativa, cancele-a antes de arquivar a agência."
                      : "Arquive a agência com segurança sem apagar clientes, viagens, documentos ou histórico."}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => setShowArchiveModal(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir agência
                    </Button>
                    {hasPaidSubscriptionActive ? (
                      <Button
                        variant="outline"
                        className="border-border/70 bg-white"
                        onClick={() => void handleOpenAgencyCustomerPortal()}
                        disabled={billingActionLoading}
                      >
                        {billingActionLoading ? "Abrindo..." : "Gerenciar assinatura"}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeSection === "notifications" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-border/60 bg-white/88">
                <CardHeader>
                  <CardTitle className="text-base">Notificações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { key: "concierge", label: "Novas mensagens concierge", desc: "Receba alertas de mensagens" },
                    { key: "trips", label: "Viagens próximas", desc: "Lembretes de embarques" },
                    { key: "credits", label: "Créditos baixos", desc: "Aviso quando os créditos acabarem" },
                    { key: "newClients", label: "Novos clientes", desc: "Notificar cadastros" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border/60 bg-[#fbfbfc] p-4">
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
                      <Badge className="bg-primary text-white">Plano {billingStatus?.planName || subscription.definition.name}</Badge>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {billingStatus?.currentPlan === "free" ? "Plano Free" : subscription.definition.priceLabel}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {billingLoading
                          ? "Carregando assinatura..."
                          : billingStatus?.currentPlan === "free"
                            ? "Você está utilizando o plano Free."
                            : agency
                              ? "Assinatura vinculada ao billing da agência."
                              : "Plano ainda não vinculado a uma agência real"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button asChild variant="outline" className="border-border/70 bg-white">
                        <Link href="/agencia/planos">Ver planos</Link>
                      </Button>
                      {billingStatus?.currentPlan !== "free" ? (
                        <Button
                          variant="outline"
                          className="border-border/70 bg-white"
                          onClick={() => void handleOpenAgencyCustomerPortal()}
                          disabled={billingActionLoading}
                        >
                          {billingActionLoading ? "Abrindo..." : "Gerenciar assinatura"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <hr className="my-4 border-border/60" />
                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                      <p className="mt-1 font-medium text-foreground">
                        {billingLoading
                          ? "Carregando..."
                          : billingStatus?.currentPlan === "free"
                            ? "Você está utilizando o plano Free."
                            : billingStatus?.status || "Não informado"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Próxima renovação</p>
                      <p className="mt-1 font-medium text-foreground">
                        {billingStatus?.currentPeriodEnd
                          ? new Date(billingStatus.currentPeriodEnd).toLocaleDateString("pt-BR")
                          : "Não se aplica"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Créditos mensais do plano</p>
                      <p className="mt-1 font-medium text-foreground">{subscription.definition.monthlyCredits}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-white/80 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo atual</p>
                      <p className="mt-1 font-medium text-foreground">{credits.balance}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {subscription.definition.monthlyCredits} créditos IA inclusos por mês (Saldo atual: {credits.balance})
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Até {subscription.definition.maxUsers} usuários ativos na equipe
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Até {subscription.definition.maxActiveTrips} viagens ativas
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Em uso agora: {teamSeatsUsed} usuários e {activeTripsCount} viagens ativas
                    </div>
                  </div>
                  {billingStatus?.cancelAtPeriodEnd ? (
                    <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Esta assinatura esta programada para cancelamento ao final do ciclo atual.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
        <DialogContent className="agency-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atualizar branding</DialogTitle>
            <DialogDescription>Envie o logo da agência que será exibido no link da viagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
                {agencyData.logo ? (
                  <img src={agencyData.logo} alt="Preview da agência" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </div>
            <Input type="file" accept="image/*" onChange={(e) => handleAgencyLogoSelected(e.target.files?.[0])} className="border-border/70 bg-white" />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border/70 bg-white" onClick={() => setShowPhotoModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                onClick={() => {
                  setShowPhotoModal(false)
                  if (shouldUseSupabase() && !agency) {
                    showToast("Agência não encontrada para salvar o branding.")
                    return
                  }
                  void handleSave("Logo da agência atualizado.")
                }}
              >
                Salvar logo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPasswordModal}
        onOpenChange={(open) => {
          setShowPasswordModal(open)
          if (!open) {
            setPasswordError("")
            setPasswordSaving(false)
            setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
          }
        }}
      >
        <DialogContent className="agency-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>Atualize sua senha de acesso da agência.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Senha atual</Label>
              <Input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} className="mt-1.5 border-border/70 bg-white" disabled={passwordSaving} />
            </div>
            <div>
              <Label className="text-muted-foreground">Nova senha</Label>
              <Input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="mt-1.5 border-border/70 bg-white" disabled={passwordSaving} />
            </div>
            <div>
              <Label className="text-muted-foreground">Confirmar nova senha</Label>
              <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="mt-1.5 border-border/70 bg-white" disabled={passwordSaving} />
            </div>
            {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-border/70 bg-white" onClick={() => setShowPasswordModal(false)} disabled={passwordSaving}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                onClick={() => void handleSavePassword()}
                disabled={passwordSaving || !passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirmPassword}
              >
                {passwordSaving ? "Salvando..." : "Salvar senha"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="agency-dialog sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Alterar plano</DialogTitle>
            <DialogDescription>Escolha um plano para a sua operação sem integrar pagamento nesta etapa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <p className="text-lg font-semibold text-foreground">{subscription.definition.name}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {availablePlans.map((plan) => (
                <div key={plan.id} className={`rounded-2xl border p-4 ${subscription.code === plan.id ? "border-primary/30 bg-primary/5" : "border-border/60 bg-[#fbfbfc]"}`}>
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
                        showToast(result.error || "Não foi possível atualizar o plano.")
                        return
                      }

                      setAgencyData((prev) => ({ ...prev, plan: plan.name }))
                      setShowPlanModal(false)
                      showToast(`Plano ${plan.name} selecionado sem cobrança real nesta etapa.`)
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
        <DialogContent className="agency-dialog border-red-500/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Arquivar agência</DialogTitle>
            <DialogDescription>
              {hasPaidSubscriptionActive
                ? "Existe uma assinatura ativa nesta agência. Cancele-a antes de arquivar a conta."
                : "A agência será desativada e arquivada com segurança, sem excluir dados reais nem remover histórico operacional."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {hasPaidSubscriptionActive ? (
              <>
                <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900">
                  Se você possui uma assinatura ativa, cancele-a antes de excluir ou arquivar a agência.
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-border/70 bg-white" onClick={() => setShowArchiveModal(false)}>
                    Fechar
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
                    onClick={() => void handleOpenAgencyCustomerPortal()}
                    disabled={billingActionLoading}
                  >
                    {billingActionLoading ? "Abrindo..." : "Gerenciar assinatura"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-muted-foreground">
                  Digite <span className="font-medium text-foreground">ARQUIVAR</span> para confirmar a desativação da agência.
                </div>
                <div>
                  <Label className="text-muted-foreground">Confirmação</Label>
                  <Input
                    value={archiveConfirmation}
                    onChange={(e) => setArchiveConfirmation(e.target.value)}
                    placeholder="ARQUIVAR"
                    className="mt-1.5 border-red-500/20 bg-white"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-border/70 bg-white" onClick={() => setShowArchiveModal(false)} disabled={isArchivingAgency}>
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 bg-red-500 text-white hover:bg-red-500/90"
                    onClick={() => void handleArchiveAgency()}
                    disabled={isArchivingAgency || archiveConfirmation.trim().toUpperCase() !== "ARQUIVAR"}
                  >
                    {isArchivingAgency ? "Arquivando..." : "Arquivar agência"}
                  </Button>
                </div>
              </>
            )}
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
