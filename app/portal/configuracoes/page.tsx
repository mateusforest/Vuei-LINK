"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import Image from "next/image"
import {
  User,
  Lock,
  Bell,
  Fingerprint,
  Shield,
  Crown,
  ChevronRight,
  LogOut,
  Moon,
  Globe,
  HelpCircle,
  FileText,
  Trash2,
  Camera,
  Check,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { shouldUseSupabase } from "@/lib/data-source"
import { updateProfile as updateProfileRepository } from "@/lib/repositories/profiles-repository"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import { resolveTravelerPlan } from "@/lib/billing/traveler-plans"
import {
  disableQuickAccessBiometric,
  disableQuickAccessPin,
  getLegacyQuickAccessPin,
  getQuickAccessMethods,
  isBiometricQuickAccessSupported,
  registerQuickAccessBiometric,
  saveQuickAccessPin,
} from "@/lib/auth/quick-access"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const STORAGE_KEY = "vuei_portal_settings"

const defaultProfile = {
  name: "Conta",
  email: "",
  phone: "",
  plan: "Free",
  avatar: "",
  createdAt: "Nao informado",
}

const defaultSettings = {
  faceId: false,
  pinEnabled: false,
  notifications: true,
  darkMode: true,
  language: "pt-BR",
}

function SettingsToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-400"
    >
      <Check size={16} />
      {message}
    </motion.div>
  )
}

export default function ConfiguracoesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signOut, profile: authProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState(defaultProfile)
  const [settings, setSettings] = useState(defaultSettings)
  const [toastMessage, setToastMessage] = useState("")
  const [actionError, setActionError] = useState("")
  const [isSavingPhoto, setIsSavingPhoto] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showBiometricModal, setShowBiometricModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [profileForm, setProfileForm] = useState(defaultProfile)
  const [photoPreview, setPhotoPreview] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [pinForm, setPinForm] = useState({ pin: "", confirmPin: "" })
  const biometricSupported = isBiometricQuickAccessSupported()
  const [deviceQuickAccess, setDeviceQuickAccess] = useState({ configured: false, pinEnabled: false, biometricEnabled: false })
  const setupQuickAccess = searchParams.get("quickAccess") === "1"
  const returnTo = searchParams.get("returnTo")

  useEffect(() => {
    if (typeof window === "undefined") return

    if (shouldUseSupabase()) {
      if (!authProfile) {
        setProfile(defaultProfile)
        setProfileForm(defaultProfile)
        setPhotoPreview("")
        return
      }

      const travelerPlan = resolveTravelerPlan(authProfile)
      const nextProfile = {
        name: authProfile.name || defaultProfile.name,
        email: authProfile.email || defaultProfile.email,
        phone: authProfile.phone || defaultProfile.phone,
        plan: authProfile.role === "agency_owner" || authProfile.role === "agency_member" ? "Agency" : travelerPlan.definition.name,
        avatar: authProfile.avatarUrl || "",
        createdAt: authProfile.createdAt
          ? new Date(authProfile.createdAt).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          : defaultProfile.createdAt,
      }

      setProfile(nextProfile)
      setProfileForm(nextProfile)
      setPhotoPreview(authProfile.avatarUrl || "")
      const localQuickAccess = getQuickAccessMethods(authProfile.id, authProfile.settings)
      setDeviceQuickAccess({
        configured: localQuickAccess.configured,
        pinEnabled: localQuickAccess.pinEnabled,
        biometricEnabled: localQuickAccess.biometricEnabled,
      })
      setSettings((prev) => ({
        ...prev,
        faceId: authProfile.settings?.biometricEnabled ?? prev.faceId,
        pinEnabled: authProfile.settings?.quickAccess?.enabled ?? authProfile.settings?.pinEnabled ?? prev.pinEnabled,
        notifications: authProfile.settings?.notificationsEnabled ?? prev.notifications,
        darkMode: authProfile.settings?.darkMode ?? prev.darkMode,
        language: authProfile.settings?.language ?? prev.language,
      }))
      return
    }

    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      if (parsed.profile) {
        setProfile({ ...defaultProfile, ...parsed.profile })
        setProfileForm({ ...defaultProfile, ...parsed.profile })
        setPhotoPreview(parsed.profile.avatar ?? "")
      }
      if (parsed.settings) {
        setSettings({ ...defaultSettings, ...parsed.settings })
      }
    } catch {
      // fallback silencioso
    }
  }, [authProfile])

  useEffect(() => {
    if (!shouldUseSupabase() || !authProfile?.id) return
    if (authProfile.settings?.quickAccess?.enabled) return

    const legacyPin = getLegacyQuickAccessPin(authProfile.id)
    if (!legacyPin) return

    void updateProfileRepository(authProfile.id, {
      settings: {
        ...authProfile.settings,
        pinEnabled: true,
        quickAccess: legacyPin,
      },
    }).then(async (result) => {
      if (result.data) {
        await refreshProfile()
      }
    })
  }, [authProfile, refreshProfile])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (shouldUseSupabase() && authProfile) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, settings }))
  }, [authProfile, profile, settings])

  const showToast = (message: string) => {
    setToastMessage(message)
    window.setTimeout(() => setToastMessage(""), 2200)
  }

  const handlePhotoSelected = (file?: File) => {
    if (!file) return
    setPhotoFile(file)

    const reader = new FileReader()
    reader.onload = () => {
      const preview = typeof reader.result === "string" ? reader.result : ""
      setPhotoPreview(preview)
    }
    reader.readAsDataURL(file)
  }

  const handleSavePhoto = async () => {
    console.log("[PROFILE] save started")
    console.log("[UPLOAD] started")
    setIsSavingPhoto(true)
    setActionError("")

    try {
      let nextAvatar = photoPreview

      if (shouldUseSupabase() && authProfile) {
        const client = createSupabaseBrowserClient()
        if (!client) {
          throw new Error("Cliente Supabase indisponivel para upload da foto.")
        }

        const file = photoFile

        if (file) {
          const extension = file.name.split(".").pop()?.toLowerCase() || "png"
          const filePath = `${authProfile.id}/avatar-${Date.now()}.${extension}`
          const uploadResult = await client.storage.from("vuei-avatars").upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
          })

          if (uploadResult.error) {
            console.error("[UPLOAD] error", uploadResult.error.message)
            throw new Error(
              uploadResult.error.message.includes("Bucket not found")
                ? "Bucket 'vuei-avatars' nao existe. Rode o SQL de configuracao do bucket antes de salvar a foto."
                : uploadResult.error.message
            )
          }

          const publicUrl = client.storage.from("vuei-avatars").getPublicUrl(filePath).data.publicUrl
          nextAvatar = publicUrl
          setPhotoPreview(publicUrl)
        }
      }

      const nextProfile = { ...profile, avatar: nextAvatar }
      setProfile(nextProfile)

      if (shouldUseSupabase() && authProfile) {
        const result = await updateProfileRepository(authProfile.id, { avatarUrl: nextAvatar })
        if (!result.data) {
          throw new Error("Nao foi possivel salvar a foto no perfil.")
        }
        await refreshProfile()
      }

      setShowPhotoModal(false)
      setPhotoFile(null)
      showToast("Foto atualizada com sucesso.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar a foto."
      console.error("[PROFILE] save error", message)
      setActionError(message)
    } finally {
      setIsSavingPhoto(false)
    }
  }

  const handleSaveProfile = async () => {
    console.log("[PROFILE] save started")
    setIsSavingProfile(true)
    setActionError("")

    try {
      setProfile(profileForm)

      if (shouldUseSupabase() && authProfile) {
        const result = await updateProfileRepository(authProfile.id, {
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone,
        })

        if (!result.data) {
          throw new Error("Nao foi possivel salvar o perfil.")
        }

        await refreshProfile()
      }

      setShowProfileModal(false)
      showToast("Perfil atualizado com sucesso.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel salvar o perfil."
      console.error("[PROFILE] save error", message)
      setActionError(message)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePin = async () => {
    if (pinForm.pin.length !== 4 || pinForm.pin !== pinForm.confirmPin) return

    if (!authProfile?.id) {
      setActionError("Faca login novamente para configurar o PIN desta conta.")
      return
    }

    console.log("[SETTINGS] save started")
    setIsSavingSettings(true)
    setActionError("")

    try {
      const quickAccess = await saveQuickAccessPin(authProfile.id, pinForm.pin)

      if (shouldUseSupabase() && authProfile) {
        const result = await updateProfileRepository(authProfile.id, {
          settings: {
            ...authProfile.settings,
            language: authProfile.settings?.language ?? settings.language,
            darkMode: authProfile.settings?.darkMode ?? settings.darkMode,
            notificationsEnabled: settings.notifications,
            biometricEnabled: settings.faceId,
            pinEnabled: true,
            quickAccess,
          },
        })

        if (!result.data) {
          throw new Error("Nao foi possivel salvar a configuracao de PIN.")
        }

        await refreshProfile()
      }

      setSettings((prev) => ({ ...prev, pinEnabled: true }))
      setDeviceQuickAccess((prev) => ({ ...prev, configured: true, pinEnabled: true }))
      setPinForm({ pin: "", confirmPin: "" })
      setShowPinModal(false)
      showToast("PIN salvo com sucesso.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel configurar o PIN."
      console.error("[PROFILE] save error", message)
      setActionError(message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSignOut = async () => {
    void signOut()
    router.replace("/login")
  }

  const handleSaveBiometricPreference = async () => {
    console.log("[SETTINGS] save started")
    setIsSavingSettings(true)
    setActionError("")

    try {
      if (!authProfile?.id) {
        throw new Error("Faca login novamente para configurar a biometria.")
      }

      if (settings.faceId) {
        if (!biometricSupported) {
          throw new Error("Biometria indisponivel neste dispositivo ou navegador.")
        }

        await registerQuickAccessBiometric(authProfile.id, authProfile.name || authProfile.email)
      } else {
        disableQuickAccessBiometric(authProfile.id)
      }

      if (shouldUseSupabase() && authProfile) {
        const result = await updateProfileRepository(authProfile.id, {
          settings: {
            ...authProfile.settings,
            language: authProfile.settings?.language ?? "pt-BR",
            darkMode: authProfile.settings?.darkMode ?? true,
            notificationsEnabled: settings.notifications,
            biometricEnabled: settings.faceId,
            pinEnabled: settings.pinEnabled,
          },
        })

        if (!result.data) {
          throw new Error("Nao foi possivel salvar a preferencia de biometria.")
        }

        await refreshProfile()
      }

      setShowBiometricModal(false)
      setDeviceQuickAccess((prev) => ({
        configured: settings.faceId || prev.pinEnabled,
        pinEnabled: prev.pinEnabled,
        biometricEnabled: settings.faceId,
      }))
      showToast(settings.faceId ? "Biometria ativada." : "Biometria desativada.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel salvar a configuracao."
      console.error("[PROFILE] save error", message)
      setSettings((prev) => ({ ...prev, faceId: authProfile?.settings?.biometricEnabled ?? false }))
      setActionError(message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleTogglePinPreference = async () => {
    if (!authProfile?.id) {
      setActionError("Faca login novamente para atualizar a protecao por PIN.")
      return
    }

    if (!settings.pinEnabled) {
      showToast("Defina um novo PIN para ativar o acesso rapido desta conta.")
      return
    }

    console.log("[SETTINGS] save started")
    setIsSavingSettings(true)
    setActionError("")

    try {
      disableQuickAccessPin(authProfile.id)

      if (shouldUseSupabase()) {
        const result = await updateProfileRepository(authProfile.id, {
          settings: {
            ...authProfile.settings,
            language: authProfile.settings?.language ?? settings.language,
            darkMode: authProfile.settings?.darkMode ?? settings.darkMode,
            notificationsEnabled: settings.notifications,
            biometricEnabled: settings.faceId,
            pinEnabled: false,
            quickAccess: {
              enabled: false,
            },
          },
        })

        if (!result.data) {
          throw new Error("Nao foi possivel desativar a protecao por PIN.")
        }

        await refreshProfile()
      }

      setSettings((prev) => ({ ...prev, pinEnabled: false }))
      setDeviceQuickAccess((prev) => ({
        configured: prev.biometricEnabled,
        pinEnabled: false,
        biometricEnabled: prev.biometricEnabled,
      }))
      setPinForm({ pin: "", confirmPin: "" })
      showToast("PIN desativado nesta conta.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel atualizar a protecao por PIN."
      console.error("[PROFILE] save error", message)
      setActionError(message)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const sections = useMemo(() => [
    {
      title: "Conta",
      items: [
        {
          icon: Camera,
          label: "Alterar foto",
          description: "Atualize sua imagem de perfil",
          action: () => setShowPhotoModal(true),
        },
        {
          icon: User,
          label: "Editar perfil",
          description: "Nome, email e telefone",
          action: () => setShowProfileModal(true),
        },
        {
          icon: Crown,
          label: "Plano atual",
          description: profile.plan,
          badgeText: profile.plan,
          badgeClass: "bg-amber-500/20 text-amber-400",
        },
      ],
    },
    {
      title: "Seguranca",
      items: [
        {
          icon: Fingerprint,
          label: "Face ID / Biometria",
          description: settings.faceId ? "Protecao ativa" : "Protecao desativada",
          action: () => setShowBiometricModal(true),
        },
        {
          icon: Lock,
          label: "PIN de seguranca",
          description: settings.pinEnabled ? "PIN da conta configurado" : "Defina um PIN de 4 digitos",
          action: () => setShowPinModal(true),
        },
        {
          icon: Shield,
          label: "Sessoes ativas",
          description: "2 dispositivos conectados",
        },
      ],
    },
    {
      title: "Preferencias",
      items: [
        { icon: Bell, label: "Notificacoes", description: "Alertas e lembretes", switchKey: "notifications" as const },
        { icon: Moon, label: "Tema escuro", description: "Ativado por padrao", switchKey: "darkMode" as const },
        { icon: Globe, label: "Idioma", description: "Portugues (Brasil)" },
      ],
    },
    {
      title: "Suporte",
      items: [
        { icon: HelpCircle, label: "Central de ajuda", description: "Duvidas frequentes" },
        { icon: FileText, label: "Termos e privacidade", description: "Politicas do Vuei" },
      ],
    },
  ], [profile.plan, settings.darkMode, settings.faceId, settings.notifications, settings.pinEnabled])

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="mx-auto max-w-4xl space-y-6"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferencias</p>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="vuei-glass border-border/50 bg-card/50 p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary">
                {profile.avatar ? (
                  <Image src={profile.avatar} alt="Avatar" fill className="object-cover" />
                ) : (
                  <User size={28} className="text-primary-foreground" />
                )}
              </div>
              <button
                onClick={() => setShowPhotoModal(true)}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted transition-colors hover:bg-muted/80"
              >
                <Camera size={12} />
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Membro desde {profile.createdAt}</p>
            </div>
            <Badge className="border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-600/20 text-amber-400">
              <Crown size={12} className="mr-1" />
              {profile.plan}
            </Badge>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-secondary/10 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Shield size={18} className="text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold">Acesso rapido</h2>
              <p className="text-sm text-muted-foreground">
                O PIN fica salvo com seguranca na sua conta e funciona em outros dispositivos depois do login. A biometria continua sendo configurada separadamente em cada dispositivo.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="border-border/50 bg-background/50">
                  {deviceQuickAccess.pinEnabled ? "PIN da conta ativo" : "PIN da conta nao configurado"}
                </Badge>
                <Badge variant="secondary" className="border-border/50 bg-background/50">
                  {deviceQuickAccess.biometricEnabled ? "Biometria ativa neste dispositivo" : biometricSupported ? "Biometria disponivel" : "Biometria indisponivel"}
                </Badge>
              </div>
              {setupQuickAccess && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">
                  Este dispositivo ainda nao tinha acesso rapido configurado. O PIN da conta pode ser usado aqui depois do login, e a biometria pode ser ativada localmente neste aparelho.
                </div>
              )}
              {returnTo && (
                <Button variant="outline" className="border-border/50" onClick={() => router.push(returnTo)}>
                  Voltar para a viagem
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {sections.map((section) => (
        <motion.div key={section.title} variants={fadeInUp}>
          <h2 className="mb-3 px-1 text-sm font-medium text-muted-foreground">{section.title}</h2>
          <Card className="vuei-glass divide-y divide-border/50 border-border/50 bg-card/50">
            {section.items.map((item) => (
              <div
                key={item.label}
                className={`flex items-center justify-between p-4 ${item.action ? "cursor-pointer transition-colors hover:bg-muted/20" : ""}`}
                onClick={item.action}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50">
                    <item.icon size={18} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>

                {"switchKey" in item && item.switchKey ? (
                  <Switch
                    checked={settings[item.switchKey]}
                    onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, [item.switchKey]: checked }))}
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : item.badgeText ? (
                  <Badge className={item.badgeClass}>{item.badgeText}</Badge>
                ) : (
                  <ChevronRight size={18} className="text-muted-foreground" />
                )}
              </div>
            ))}
          </Card>
        </motion.div>
      ))}

      {actionError && (
        <motion.div variants={fadeInUp}>
          <Card className="border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{actionError}</Card>
        </motion.div>
      )}

      <motion.div variants={fadeInUp}>
        <h2 className="mb-3 px-1 text-sm font-medium text-muted-foreground">Zona de perigo</h2>
        <Card className="divide-y divide-border/50 border-destructive/20 bg-card/50">
          <div
            className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-destructive/5"
            onClick={() => setShowDeleteModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div>
                <p className="font-medium text-destructive">Excluir conta</p>
                <p className="text-sm text-muted-foreground">Remover permanentemente sua conta</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-muted-foreground" />
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Button variant="outline" className="w-full rounded-xl border-border/50 text-muted-foreground hover:text-foreground" onClick={() => void handleSignOut()}>
          <LogOut size={18} className="mr-2" />
          Sair da conta
        </Button>
      </motion.div>

      <motion.div variants={fadeInUp} className="py-4 text-center">
        <p className="text-xs text-muted-foreground">Vuei v1.0.0</p>
      </motion.div>

      <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
        <DialogContent className="vuei-glass max-w-md border-border/50">
          <DialogHeader>
            <DialogTitle>Alterar foto</DialogTitle>
            <DialogDescription>Escolha uma nova imagem para o seu perfil.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary">
                {photoPreview || profile.avatar ? (
                  <Image src={photoPreview || profile.avatar} alt="Preview" fill className="object-cover" />
                ) : (
                  <Camera className="text-primary-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Selecionar imagem</Label>
              <Input type="file" accept="image/*" onChange={(e) => handlePhotoSelected(e.target.files?.[0])} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPhotoModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground" onClick={handleSavePhoto} disabled={isSavingPhoto}>
                {isSavingPhoto ? "Salvando..." : "Salvar foto"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="vuei-glass max-w-md border-border/50">
          <DialogHeader>
            <DialogTitle>Editar perfil</DialogTitle>
            <DialogDescription>Atualize seus dados principais do portal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowProfileModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground" onClick={handleSaveProfile} disabled={isSavingProfile}>
                {isSavingProfile ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBiometricModal} onOpenChange={setShowBiometricModal}>
        <DialogContent className="vuei-glass max-w-md border-border/50">
          <DialogHeader>
            <DialogTitle>Biometria / Face ID</DialogTitle>
            <DialogDescription>
              A autenticacao biometrica sera usada pelo dispositivo quando houver suporte a WebAuthn/passkey.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Quando ativado, o Vuei salva sua preferencia e pode solicitar biometria do dispositivo em fluxos suportados.
              </p>
            </div>
            {!biometricSupported && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
                Este navegador ou dispositivo ainda nao oferece suporte confiavel a WebAuthn/passkey para o Vuei. Voce pode usar o PIN da conta ou entrar com login.
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-4">
              <div>
                <p className="font-medium">Protecao biometrica</p>
                <p className="text-sm text-muted-foreground">{settings.faceId ? "Ativa agora" : "Desativada agora"}</p>
              </div>
              <Switch checked={settings.faceId} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, faceId: checked }))} />
            </div>
            <Button
              className="w-full bg-gradient-to-r from-primary to-secondary text-primary-foreground"
              onClick={() => void handleSaveBiometricPreference()}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? "Salvando..." : "Configurar biometria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="vuei-glass max-w-sm border-border/50">
          <DialogHeader>
            <DialogTitle>Configurar PIN</DialogTitle>
            <DialogDescription>Crie ou altere um PIN de 4 digitos para areas privadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Novo PIN</Label>
              <Input
                type="password"
                maxLength={4}
                placeholder="0000"
                value={pinForm.pin}
                onChange={(e) => setPinForm((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar PIN</Label>
              <Input
                type="password"
                maxLength={4}
                placeholder="0000"
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm((prev) => ({ ...prev, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void handleTogglePinPreference()}
              disabled={isSavingSettings}
            >
              {settings.pinEnabled ? "Desativar PIN atual" : "Ativar protecao por PIN"}
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPinModal(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-secondary text-primary-foreground"
                onClick={() => void handleSavePin()}
                disabled={isSavingSettings || pinForm.pin.length !== 4 || pinForm.pin !== pinForm.confirmPin}
              >
                {isSavingSettings ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="vuei-glass max-w-sm border-border/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir conta</DialogTitle>
            <DialogDescription>
              Esta acao e irreversivel. Todos os seus dados, viagens e documentos serao permanentemente excluidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Digite "EXCLUIR" para confirmar</Label>
              <Input placeholder="EXCLUIR" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1">
                Excluir conta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toastMessage && <SettingsToast message={toastMessage} />}
    </motion.div>
  )
}
