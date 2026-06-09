"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Check,
  FileText,
  MessageSquare,
  Plane,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useMaster } from "@/contexts/master-context"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

export default function MasterIAPage() {
  const { aiPrompts, aiUsageLogs, aiOverview, dataErrors, togglePrompt, updatePrompt } = useMaster()
  const [selectedModule, setSelectedModule] = useState<string>("concierge")
  const [draftPrompt, setDraftPrompt] = useState("")
  const [saved, setSaved] = useState(false)

  const moduleCards = useMemo(() => {
    const promptGroups = aiPrompts.reduce<Record<string, number>>((accumulator, prompt) => {
      accumulator[prompt.module] = (accumulator[prompt.module] ?? 0) + 1
      return accumulator
    }, {})

    const usageGroups = aiUsageLogs.reduce<Record<string, number>>((accumulator, log) => {
      accumulator[log.feature] = (accumulator[log.feature] ?? 0) + 1
      return accumulator
    }, {})

    return [
      {
        id: "concierge",
        name: "Concierge IA",
        description: "Concierge do viajante e da agencia",
        icon: MessageSquare,
        usage: usageGroups.concierge ?? 0,
        prompts: promptGroups.concierge ?? 0,
      },
      {
        id: "flight_extraction",
        name: "Extracao de Passagens",
        description: "Leitura operacional de voos",
        icon: Plane,
        usage: usageGroups.flight_extraction ?? 0,
        prompts: 0,
      },
      {
        id: "itinerary",
        name: "Roteiros IA",
        description: "Geracao de itinerarios",
        icon: Sparkles,
        usage: usageGroups.itinerary_generation ?? 0,
        prompts: promptGroups.itinerary ?? 0,
      },
      {
        id: "documents",
        name: "Leitura de Documentos",
        description: "Extracao operacional de dados",
        icon: FileText,
        usage: usageGroups.document_extraction ?? 0,
        prompts: promptGroups.documents ?? 0,
      },
      {
        id: "support_assistant",
        name: "Assistente Interno",
        description: "Suporte operacional do ecossistema",
        icon: Bot,
        usage: usageGroups.support_assistant ?? 0,
        prompts: promptGroups.support_assistant ?? 0,
      },
    ]
  }, [aiPrompts, aiUsageLogs])

  const selectedPrompt = useMemo(() => {
    return aiPrompts.find((prompt) => prompt.module === selectedModule) ?? aiPrompts[0] ?? null
  }, [aiPrompts, selectedModule])

  const recentLogs = useMemo(() => aiUsageLogs.slice(0, 8), [aiUsageLogs])

  const mostUsedModel = useMemo(() => {
    const counts = aiUsageLogs.reduce<Record<string, number>>((accumulator, log) => {
      const model = log.model || "Nao informado"
      accumulator[model] = (accumulator[model] ?? 0) + 1
      return accumulator
    }, {})

    return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "Nao informado"
  }, [aiUsageLogs])

  useEffect(() => {
    setDraftPrompt(selectedPrompt?.systemPrompt ?? "")
  }, [selectedPrompt?.id, selectedPrompt?.systemPrompt])

  const stats = [
    { label: "Conversas", value: aiOverview.totalConversations.toString(), icon: Brain },
    { label: "Mensagens", value: aiOverview.totalMessages.toString(), icon: Activity },
    { label: "Creditos cobrados", value: aiOverview.totalCreditsCharged.toString(), icon: Zap },
    { label: "Custo estimado", value: aiOverview.totalEstimatedCost > 0 ? `$${aiOverview.totalEstimatedCost.toFixed(4)}` : "Nao informado", icon: Shield },
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-8">
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Central IA</h1>
            <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              Operacional
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Leitura real de prompts, consumo, erros e uso da camada operacional de IA.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2"
            disabled={!selectedPrompt}
            onClick={async () => {
              if (!selectedPrompt) return
              await updatePrompt(selectedPrompt.id, { systemPrompt: draftPrompt })
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2000)
            }}
          >
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? "Salvo!" : "Salvar Prompt"}
          </Button>
        </div>
      </motion.div>

      {(dataErrors.aiPrompts || dataErrors.aiUsageLogs) ? (
        <motion.div variants={fadeInUp}>
          <Card className="border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5" />
              <div className="space-y-1 text-sm text-amber-100">
                {dataErrors.aiPrompts ? <p>Prompts: {dataErrors.aiPrompts}</p> : null}
                {dataErrors.aiUsageLogs ? <p>Usage logs: {dataErrors.aiUsageLogs}</p> : null}
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-white/5 bg-black/40 backdrop-blur-xl p-5 hover:border-primary/20 transition-all duration-300">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={fadeInUp} className="lg:col-span-1">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-4 px-2">Modulos IA</h2>
            <div className="space-y-2">
              {moduleCards.map((module) => (
                <button
                  key={module.id}
                  onClick={() => setSelectedModule(module.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-300 text-left ${
                    selectedModule === module.id
                      ? "bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedModule === module.id ? "bg-primary/20" : "bg-white/5"}`}>
                    <module.icon className={`h-4 w-4 ${selectedModule === module.id ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{module.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {module.usage} chamadas • {module.prompts} prompts
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="lg:col-span-2 space-y-6">
          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">System Prompt</h2>
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedPrompt ? `${selectedPrompt.code} • v${selectedPrompt.version}` : "Nenhum prompt real"}
              </div>
            </div>

            {selectedPrompt ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{selectedPrompt.name}</div>
                    <div className="text-xs text-muted-foreground">Ultima atualizacao: {new Date(selectedPrompt.updatedAt).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={selectedPrompt.isActive ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-muted-foreground"}>
                      {selectedPrompt.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Switch checked={selectedPrompt.isActive} onCheckedChange={() => togglePrompt(selectedPrompt.id)} />
                  </div>
                </div>
                <Textarea
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  className="min-h-[260px] bg-black/40 border-white/10 focus:border-primary/50 font-mono text-sm resize-none"
                  placeholder="Nenhum prompt real encontrado."
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
                Nenhum prompt real encontrado para este modulo ainda.
              </div>
            )}
          </Card>

          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Sliders className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Resumo Operacional</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xs text-muted-foreground mb-2">Modelo mais usado</div>
                <div className="text-sm font-medium text-foreground">{mostUsedModel}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xs text-muted-foreground mb-2">Erros recentes</div>
                <div className="text-sm font-medium text-foreground">{aiOverview.recentErrors}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xs text-muted-foreground mb-2">Tokens totais</div>
                <div className="text-sm font-medium text-foreground">{aiOverview.totalTokens}</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="text-xs text-muted-foreground mb-2">Prompts ativos</div>
                <div className="text-sm font-medium text-foreground">{aiPrompts.filter((prompt) => prompt.isActive).length}</div>
              </div>
            </div>
          </Card>

          <Card className="border-white/5 bg-black/40 backdrop-blur-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Ultimos Usage Logs</h2>
            </div>

            {recentLogs.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-6 text-sm text-muted-foreground">
                Nenhum usage log real disponivel ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{log.feature}</span>
                          <Badge variant="outline" className={log.status === "completed" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}>
                            {log.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.model || "Modelo nao informado"} • {log.totalTokens} tokens • {log.creditAmount} credito(s)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        Sem custo estimado
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
