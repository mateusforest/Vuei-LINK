"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Settings,
  Building2,
  Palette,
  Shield,
  Bell,
  CreditCard,
  Plug,
  Mail,
  Globe,
  Users,
  Brain,
  Save,
  Upload,
  ChevronRight,
  Check,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"
import { getAppUrl } from "@/lib/app-url"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const settingsSections = [
  { id: "plataforma", label: "Plataforma", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "planos", label: "Planos", icon: CreditCard },
  { id: "ia", label: "IA Global", icon: Brain },
  { id: "seguranca", label: "Segurança", icon: Shield },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "integracoes", label: "Integrações", icon: Plug },
]

const integrations = [
  { name: "Stripe", status: "connected", description: "Processamento de pagamentos" },
  { name: "OpenAI", status: "connected", description: "Modelos de linguagem" },
  { name: "SendGrid", status: "connected", description: "Envio de emails" },
  { name: "Twilio", status: "disconnected", description: "SMS e WhatsApp" },
  { name: "Google Analytics", status: "connected", description: "Analytics" },
  { name: "Sentry", status: "connected", description: "Monitoramento de erros" },
]

export default function MasterConfiguracoesPage() {
  const { addActivity } = useMaster()
  const [activeSection, setActiveSection] = useState("plataforma")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      addActivity({
        type: "system",
        description: "Configuracoes da plataforma atualizadas",
        entityName: "Sistema"
      })
      setTimeout(() => setSaved(false), 2000)
    }, 1000)
  }

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">
            Configurações globais da plataforma Vuei
          </p>
        </div>
        <Button 
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2 w-fit"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Alteracoes"}
        </Button>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div variants={fadeInUp} className="lg:col-span-1">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-3">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-300 ${
                    activeSection === section.id
                      ? "bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <section.icon className={`h-4 w-4 ${
                    activeSection === section.id ? "text-primary" : ""
                  }`} />
                  <span className="text-sm font-medium">{section.label}</span>
                  {activeSection === section.id && (
                    <ChevronRight className="h-4 w-4 ml-auto text-primary" />
                  )}
                </button>
              ))}
            </nav>
          </Card>
        </motion.div>

        {/* Content */}
        <motion.div variants={fadeInUp} className="lg:col-span-3 space-y-6">
          {/* Platform Settings */}
          {activeSection === "plataforma" && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Configurações da Plataforma</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Nome da Plataforma</label>
                    <Input
                      defaultValue="Vuei"
                      className="bg-black/40 border-white/10 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Domínio</label>
                    <Input
                      defaultValue={getAppUrl()}
                      className="bg-black/40 border-white/10 focus:border-primary/50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Descrição</label>
                  <Textarea
                    defaultValue="Plataforma inteligente de planejamento de viagens com IA"
                    className="bg-black/40 border-white/10 focus:border-primary/50 min-h-[100px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Idioma Padrão</label>
                    <Select defaultValue="pt-BR">
                      <SelectTrigger className="bg-black/40 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-white/10">
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Fuso Horário</label>
                    <Select defaultValue="America/Sao_Paulo">
                      <SelectTrigger className="bg-black/40 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-white/10">
                        <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                        <SelectItem value="America/New_York">New York (GMT-5)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">Modo Manutenção</div>
                      <div className="text-xs text-muted-foreground">Desativa acesso para usuários</div>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">Registro de Novos Usuários</div>
                      <div className="text-xs text-muted-foreground">Permitir novos cadastros</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">Registro de Novas Agências</div>
                      <div className="text-xs text-muted-foreground">Permitir novos cadastros de agências</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Branding Settings */}
          {activeSection === "branding" && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Branding Global</h2>
              
              <div className="space-y-6">
                {/* Logo Upload */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Logo Principal</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-primary" />
                    </div>
                    <Button variant="outline" className="border-white/10 hover:bg-white/5 gap-2">
                      <Upload className="h-4 w-4" />
                      Alterar Logo
                    </Button>
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Cor Primária</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#5de0e6] border border-white/10" />
                      <Input
                        defaultValue="#5de0e6"
                        className="bg-black/40 border-white/10 focus:border-primary/50 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Cor Secundária</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#004aad] border border-white/10" />
                      <Input
                        defaultValue="#004aad"
                        className="bg-black/40 border-white/10 focus:border-primary/50 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Integrations */}
          {activeSection === "integracoes" && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Integrações Globais</h2>
              
              <div className="space-y-4">
                {integrations.map((integration, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                        <Plug className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{integration.name}</div>
                        <div className="text-xs text-muted-foreground">{integration.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        integration.status === "connected"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-white/5 text-muted-foreground"
                      }`}>
                        {integration.status === "connected" ? (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Conectado
                          </span>
                        ) : (
                          "Desconectado"
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5">
                        {integration.status === "connected" ? "Configurar" : "Conectar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Security Settings */}
          {activeSection === "seguranca" && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Segurança</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-sm font-medium text-foreground">Autenticação 2FA</div>
                    <div className="text-xs text-muted-foreground">Exigir 2FA para administradores</div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-sm font-medium text-foreground">Login por IP</div>
                    <div className="text-xs text-muted-foreground">Restringir acesso por IP</div>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                  <div>
                    <div className="text-sm font-medium text-foreground">Sessão Única</div>
                    <div className="text-xs text-muted-foreground">Permitir apenas uma sessão ativa</div>
                  </div>
                  <Switch />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Tempo de Sessão (minutos)</label>
                  <Input
                    type="number"
                    defaultValue="60"
                    className="bg-black/40 border-white/10 focus:border-primary/50 w-32"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Notifications */}
          {activeSection === "notificacoes" && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-6">Notificações</h2>
              
              <div className="space-y-4">
                {[
                  { label: "Nova agência cadastrada", description: "Receber alerta de novos cadastros" },
                  { label: "Upgrade de plano", description: "Notificar sobre upgrades" },
                  { label: "Pagamento falhou", description: "Alerta de falhas de pagamento" },
                  { label: "Alto consumo de créditos", description: "Alerta quando consumo ultrapassa limite" },
                  { label: "Erros críticos", description: "Notificar erros do sistema" },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div>
                      <div className="text-sm font-medium text-foreground">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Default content for other sections */}
          {!["plataforma", "branding", "integracoes", "seguranca", "notificacoes"].includes(activeSection) && (
            <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                {settingsSections.find(s => s.id === activeSection)?.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                Configurações de {settingsSections.find(s => s.id === activeSection)?.label.toLowerCase()} em desenvolvimento.
              </p>
            </Card>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
