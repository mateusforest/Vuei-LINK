"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Brain,
  MessageSquare,
  Sparkles,
  Bot,
  Save,
  RotateCcw,
  Zap,
  Sliders,
  FileText,
  Users,
  Volume2,
  Shield,
  Activity,
  Check,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const aiModules = [
  {
    id: "concierge",
    name: "Concierge IA",
    description: "Assistente de viagem para viajantes",
    icon: MessageSquare,
    status: "active",
    usage: "847K tokens/mês",
  },
  {
    id: "roteiros",
    name: "Gerador de Roteiros",
    description: "Criação automática de itinerários",
    icon: Sparkles,
    status: "active",
    usage: "324K tokens/mês",
  },
  {
    id: "agencia",
    name: "Assistente Agência",
    description: "Suporte para agentes de viagem",
    icon: Bot,
    status: "active",
    usage: "156K tokens/mês",
  },
  {
    id: "atendimento",
    name: "IA de Atendimento",
    description: "Suporte automatizado",
    icon: Users,
    status: "inactive",
    usage: "0 tokens/mês",
  },
]

const stats = [
  { label: "Tokens Consumidos", value: "2.4M", change: "+18%", icon: Brain },
  { label: "Requisições", value: "847K", change: "+24%", icon: Activity },
  { label: "Módulos Ativos", value: "3/4", change: "", icon: Zap },
  { label: "Custo Estimado", value: "$1,247", change: "+12%", icon: Shield },
]

export default function MasterIAPage() {
  const { aiPrompts, togglePrompt, updatePrompt } = useMaster()
  
  const [selectedModule, setSelectedModule] = useState("concierge")
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([2048])
  const [saved, setSaved] = useState(false)
  const [selectedTone, setSelectedTone] = useState("Amigavel")

  const [conciergePrompt, setConciergePrompt] = useState(
    `Voce e o Concierge Vuei, um assistente de viagem premium, sofisticado e extremamente util.

Seu papel e ajudar viajantes com:
- Informacoes sobre destinos
- Sugestoes de atividades
- Dicas locais e recomendacoes
- Resolucao de problemas durante a viagem
- Informacoes sobre documentos e reservas

Sempre seja:
- Cordial e prestativo
- Preciso nas informacoes
- Proativo em sugestoes
- Respeitoso com preferencias do viajante

Contexto da viagem sera fornecido automaticamente.`
  )

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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
              Central IA
            </h1>
            <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              GPT-4o
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure e monitore toda a inteligência artificial da plataforma
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2 border-white/10 hover:bg-white/5" onClick={() => {
            setTemperature([0.7])
            setMaxTokens([2048])
            setConciergePrompt(`Voce e o Concierge Vuei, um assistente de viagem premium, sofisticado e extremamente util.

Seu papel e ajudar viajantes com:
- Informacoes sobre destinos
- Sugestoes de atividades
- Dicas locais e recomendacoes
- Resolucao de problemas durante a viagem
- Informacoes sobre documentos e reservas

Sempre seja:
- Cordial e prestativo
- Preciso nas informacoes
- Proativo em sugestoes
- Respeitoso com preferencias do viajante

Contexto da viagem sera fornecido automaticamente.`)
          }}>
            <RotateCcw className="h-4 w-4" />
            Resetar
          </Button>
          <Button 
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2"
            onClick={() => {
              setSaved(true)
              setTimeout(() => setSaved(false), 2000)
            }}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Salvo!" : "Salvar Alteracoes"}
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                {stat.change && <div className="text-xs text-emerald-400">{stat.change}</div>}
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Modules List */}
        <motion.div variants={fadeInUp} className="lg:col-span-1">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 px-2">Módulos IA</h2>
            <div className="space-y-2">
              {aiModules.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setSelectedModule(module.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left ${
                    selectedModule === module.id
                      ? "bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    selectedModule === module.id
                      ? "bg-primary/20"
                      : "bg-white/5"
                  }`}>
                    <module.icon className={`h-4 w-4 ${
                      selectedModule === module.id ? "text-primary" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{module.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{module.usage}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    module.status === "active" ? "bg-emerald-400" : "bg-muted-foreground"
                  }`} />
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Module Configuration */}
        <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-6">
          {/* Prompt Editor */}
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">System Prompt</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {conciergePrompt.length} caracteres
              </div>
            </div>
            <Textarea
              value={conciergePrompt}
              onChange={(e) => setConciergePrompt(e.target.value)}
              className="min-h-[280px] bg-black/40 border-white/10 focus:border-primary/50 font-mono text-sm resize-none"
              placeholder="Digite o prompt do sistema..."
            />
          </Card>

          {/* Model Settings */}
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sliders className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Configurações do Modelo</h2>
            </div>

            <div className="space-y-6">
              {/* Model Selection */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">Modelo</div>
                  <div className="text-xs text-muted-foreground">Selecione o modelo de IA</div>
                </div>
                <Select defaultValue="gpt-4o">
                  <SelectTrigger className="w-[180px] bg-black/40 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-3">Claude 3 Opus</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Temperature</div>
                    <div className="text-xs text-muted-foreground">Criatividade das respostas</div>
                  </div>
                  <span className="text-sm font-medium text-primary">{temperature[0]}</span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={setTemperature}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>

              {/* Max Tokens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Max Tokens</div>
                    <div className="text-xs text-muted-foreground">Tamanho máximo da resposta</div>
                  </div>
                  <span className="text-sm font-medium text-primary">{maxTokens[0]}</span>
                </div>
                <Slider
                  value={maxTokens}
                  onValueChange={setMaxTokens}
                  max={4096}
                  step={128}
                  className="w-full"
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Streaming</div>
                    <div className="text-xs text-muted-foreground">Respostas em tempo real</div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Contexto da Viagem</div>
                    <div className="text-xs text-muted-foreground">Incluir dados da viagem</div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-foreground">Histórico</div>
                    <div className="text-xs text-muted-foreground">Manter contexto da conversa</div>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </Card>

          {/* Tone Settings */}
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Volume2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Tom e Personalidade</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {["Profissional", "Amigavel", "Casual", "Formal", "Entusiasta", "Conciso"].map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all duration-300 ${
                    tone === selectedTone
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-white/10 text-muted-foreground hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {tone}
                    {tone === selectedTone && <Check className="h-4 w-4" />}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
