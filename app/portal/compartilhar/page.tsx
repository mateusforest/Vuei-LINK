"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Share2, 
  Copy, 
  Check, 
  Users,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Shield,
  QrCode,
  MessageCircle,
  Mail,
  ChevronRight,
  Plane,
  Plus
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useTrips } from "@/contexts/trips-context"
import { ensureTripIsPublic } from "@/lib/repositories/trips-repository"
import { CreateTripButton } from "@/components/portal/create-trip-button"

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

export default function CompartilharPage() {
  const { activeTrip, trips } = useTrips()
  const [adminCopied, setAdminCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [shareFeedback, setShareFeedback] = useState("")
  const [shareSettings, setShareSettings] = useState({
    roteiro: true,
    hospedagem: true,
    passagens: false,
    documentosPublicos: true,
    concierge: false
  })

  const copyToClipboard = (text: string, type: 'admin' | 'share') => {
    navigator.clipboard.writeText(text)
    if (type === 'admin') {
      setAdminCopied(true)
      setShareFeedback("Link da viagem copiado.")
      setTimeout(() => setAdminCopied(false), 2000)
    } else {
      setShareCopied(true)
      setShareFeedback("Link da viagem copiado.")
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const ensureActiveTripIsPublic = async () => {
    const result = await ensureTripIsPublic(trip.id)
    if (result.error) {
      console.error("[TRIP] publish before share error", result.error)
      setShareFeedback("Não foi possível publicar a viagem para compartilhamento.")
      return false
    }
    return true
  }

  // Se n?o tem viagem, mostra tela para criar
  if (!activeTrip && trips.length === 0) {
    return (
      <motion.div
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        className="space-y-6 max-w-4xl mx-auto"
      >
        <motion.div variants={fadeInUp}>
          <h1 className="text-2xl font-bold">Compartilhamento</h1>
          <p className="text-sm text-muted-foreground">Compartilhe sua viagem com família e amigos</p>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="p-12 bg-card/50 border-border/50 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Plane size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Crie uma viagem primeiro</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Para compartilhar, você precisa criar uma viagem.
            </p>
            <CreateTripButton 
              className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
            >
              <Plus size={18} className="mr-2" />
              Nova Viagem
            </CreateTripButton>
          </Card>
        </motion.div>
      </motion.div>
    )
  }

  const trip = activeTrip || trips[0]
  const shareUrl = trip.shareLink

  const handleShareAction = (channel: "qr" | "whatsapp" | "email") => {
    void (async () => {
      const isPublished = await ensureActiveTripIsPublic()
      if (!isPublished) return

      const encodedUrl = encodeURIComponent(shareUrl)
      const encodedText = encodeURIComponent(`Acompanhe a viagem ${trip.name}: ${shareUrl}`)

      if (channel === "qr") {
        copyToClipboard(trip.shareLink, "share")
        setShareFeedback("Link copiado para gerar QR Code.")
        return
      }

      if (channel === "whatsapp") {
        window.open(`https://wa.me/?text=${encodedText}`, "_blank", "noopener,noreferrer")
        setShareFeedback("Compartilhamento via WhatsApp iniciado.")
        return
      }

      window.location.href = `mailto:?subject=${encodeURIComponent(`Viagem ${trip.name}`)}&body=${encodedText}`
      setShareFeedback("Compartilhamento por e-mail iniciado.")
    })()
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={staggerContainer}
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeInUp}>
        <h1 className="text-2xl font-bold">Compartilhamento</h1>
        <p className="text-sm text-muted-foreground">Compartilhe {trip.name} com familia e amigos</p>
      </motion.div>

      {false && (
      <motion.div variants={fadeInUp}>
        <Card className="p-5 bg-card/50 border-border/50 vuei-glass">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center shrink-0">
              <Shield size={24} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Link da Viagem</h3>
                <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">
                  Privado
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Acesso completo para editar a viagem. Não compartilhe este link.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Lock size={16} className="text-amber-400 shrink-0" />
            <code className="flex-1 text-sm truncate">{trip.adminLink}</code>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => copyToClipboard(trip.adminLink, 'admin')}
              className="shrink-0"
            >
              {adminCopied ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </div>
        </Card>
      </motion.div>
      )}

      <motion.div variants={fadeInUp}>
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 vuei-glass">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
              <Share2 size={24} className="text-primary-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">Link da Viagem</h3>
                <Badge className="bg-primary/20 text-primary border-0 text-xs">
                  Único
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Compartilhe este único link para que outros acompanhem sua viagem.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 rounded-xl bg-background/50 border border-primary/20 mb-4">
            <Globe size={16} className="text-primary shrink-0" />
            <code className="flex-1 text-sm truncate">{trip.shareLink}</code>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                void (async () => {
                  const isPublished = await ensureActiveTripIsPublic()
                  if (!isPublished) return
                  copyToClipboard(trip.shareLink, 'share')
                })()
              }}
              className="shrink-0"
            >
              {shareCopied ? (
                <Check size={16} className="text-green-400" />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </div>

          {/* Share Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => handleShareAction("qr")}>
              <QrCode size={16} className="mr-2" />
              QR Code
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => handleShareAction("whatsapp")}>
              <MessageCircle size={16} className="mr-2" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl border-border/50" onClick={() => handleShareAction("email")}>
              <Mail size={16} className="mr-2" />
              Email
            </Button>
          </div>
          {shareFeedback && (
            <p className="mt-3 text-xs text-muted-foreground">{shareFeedback}</p>
          )}
        </Card>
      </motion.div>

      {/* Viewers */}
      <motion.div variants={fadeInUp}>
        <Card className="p-5 bg-card/50 border-border/50 vuei-glass">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Users size={18} className="text-secondary" />
              </div>
              <div>
                <h3 className="font-semibold">Link ativo</h3>
                <p className="text-sm text-muted-foreground">Pronto para compartilhar</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-muted-foreground" />
          </div>
        </Card>
      </motion.div>

      {/* Share Settings */}
      <motion.div variants={fadeInUp}>
        <h2 className="font-semibold mb-4">O que compartilhar</h2>
        <Card className="bg-card/50 border-border/50 vuei-glass divide-y divide-border/50">
          {[
            { key: 'roteiro', label: 'Roteiro', desc: 'Atividades e horários', icon: Eye },
            { key: 'hospedagem', label: 'Hospedagem', desc: 'Nome e localização do hotel', icon: Eye },
            { key: 'passagens', label: 'Passagens', desc: 'Detalhes dos voos', icon: EyeOff },
            { key: 'documentosPublicos', label: 'Documentos públicos', desc: 'Vouchers e seguros', icon: Eye },
            { key: 'concierge', label: 'Acesso ao Concierge', desc: 'Permitir perguntas', icon: EyeOff },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  shareSettings[item.key as keyof typeof shareSettings] 
                    ? 'bg-primary/20' 
                    : 'bg-muted/50'
                }`}>
                  <item.icon size={18} className={
                    shareSettings[item.key as keyof typeof shareSettings] 
                      ? 'text-primary' 
                      : 'text-muted-foreground'
                  } />
                </div>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <Switch
                checked={shareSettings[item.key as keyof typeof shareSettings]}
                onCheckedChange={(checked) => 
                  setShareSettings(prev => ({ ...prev, [item.key]: checked }))
                }
              />
            </div>
          ))}
        </Card>
      </motion.div>

      {/* Privacy Notice */}
      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-sm">Documentos privados protegidos</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Passaporte, RG, CNH e outros documentos privados nunca serão visíveis no link compartilhável, mesmo com todas as opções ativadas.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
