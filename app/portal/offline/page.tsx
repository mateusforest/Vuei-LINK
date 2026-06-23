"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  HardDrive,
  Hotel,
  Info,
  Map,
  Plane,
  RefreshCw,
  Route,
  WifiOff,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { listOfflinePackages } from "@/lib/offline/offline-package-manager"
import { getOfflineWarningMessage, listOfflineTripPackages, type OfflineTripPackageItem } from "@/lib/offline/trip-offline"
import type { OfflineStoredTripPackage, OfflineTripPackageStatus } from "@/lib/offline/types"

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemIconMap: Record<OfflineTripPackageItem["type"], typeof FileText> = {
  summary: Info,
  flight: Plane,
  hotel: Hotel,
  document: FileText,
  itinerary: Route,
  quick_info: Map,
}

function formatSavedAt(dateString: string) {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getTotalSize(items: OfflineTripPackageItem[]) {
  const totalKb = items.reduce((total, item) => {
    const size = Number.parseFloat(item.sizeLabel)
    if (item.sizeLabel.endsWith("MB")) return total + size * 1024
    if (item.sizeLabel.endsWith("KB")) return total + size
    return total
  }, 0)

  return totalKb >= 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${Math.round(totalKb)} KB`
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "0 KB"
  const sizeMb = bytes / (1024 * 1024)
  if (sizeMb >= 0.1) return `${sizeMb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function getOfflinePackageStatusMeta(status?: OfflineTripPackageStatus) {
  switch (status) {
    case "ready":
      return { label: "Disponivel offline", badgeClass: "bg-green-500/20 text-green-400 border-0" }
    case "partial":
      return { label: "Parcial", badgeClass: "bg-amber-500/20 text-amber-300 border-0" }
    case "legacy_snapshot":
      return { label: "Snapshot salvo", badgeClass: "bg-sky-500/20 text-sky-300 border-0" }
    default:
      return { label: "Pendente", badgeClass: "bg-amber-500/20 text-amber-300 border-0" }
  }
}

function computeBytes(value: unknown) {
  return new Blob([JSON.stringify(value ?? null)]).size
}

function formatSizeLabel(value: unknown) {
  const bytes = computeBytes(value)
  const sizeMb = bytes / (1024 * 1024)
  if (sizeMb >= 0.1) return `${sizeMb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function mapStoredPackageItems(pkg: OfflineStoredTripPackage): OfflineTripPackageItem[] {
  const payload = pkg.payload ?? {
    trip: {},
    travelers: [],
    hotels: [],
    flights: [],
    itineraries: [],
    documents: [],
    quickInfo: null,
    offlineMeta: null,
  }
  const savedDocumentIds = Array.isArray(payload.offlineMeta?.savedDocumentIds) ? payload.offlineMeta.savedDocumentIds : []

  return [
    { id: "summary", name: "Resumo da viagem", type: "summary", sizeLabel: formatSizeLabel(payload.trip), saved: true },
    { id: "flight", name: "Passagens extraídas", type: "flight", sizeLabel: formatSizeLabel(payload.flights), saved: Array.isArray(payload.flights) && payload.flights.length > 0 },
    { id: "hotel", name: "Hospedagem", type: "hotel", sizeLabel: formatSizeLabel(payload.hotels), saved: Array.isArray(payload.hotels) && payload.hotels.length > 0 },
    { id: "itinerary", name: "Roteiro", type: "itinerary", sizeLabel: formatSizeLabel(payload.itineraries), saved: Array.isArray(payload.itineraries) && payload.itineraries.length > 0 },
    { id: "quick_info", name: "Informacoes rapidas", type: "quick_info", sizeLabel: formatSizeLabel(payload.quickInfo), saved: Boolean(payload.quickInfo) },
    { id: "document", name: "Documentos offline", type: "document", sizeLabel: formatSizeLabel(savedDocumentIds), saved: savedDocumentIds.length > 0 },
  ]
}

function mapStoredPackageWarning(pkg: OfflineStoredTripPackage) {
  if (pkg.status === "legacy_snapshot") {
    return getOfflineWarningMessage()
  }

  const failures = Array.isArray(pkg.payload?.offlineMeta?.failures) ? pkg.payload.offlineMeta.failures : []
  if (failures.length > 0) {
    return "Pacote offline salvo parcialmente. Alguns arquivos podem não estar disponíveis offline."
  }

  return getOfflineWarningMessage()
}

function mapStoredPackageToView(pkg: OfflineStoredTripPackage) {
  const trip = pkg.payload?.trip ?? {}

  return {
    tripId: pkg.tripId,
    tripSlug: pkg.slug,
    tripName:
      (typeof trip.title === "string" && trip.title) ||
      (typeof trip.destination === "string" && trip.destination) ||
      pkg.destination ||
      "Viagem",
    savedAt: pkg.savedAt,
    warning: mapStoredPackageWarning(pkg),
    audience: pkg.audience,
    status: pkg.status,
    totalSizeBytes: pkg.totalSizeBytes,
    documentCount: pkg.documentCount,
    imageCount: pkg.imageCount,
    snapshot: {},
    items: mapStoredPackageItems(pkg),
  }
}

export default function OfflinePage() {
  const [packages, setPackages] = useState<any[]>([])

  useEffect(() => {
    let active = true

    const loadPackages = async () => {
      try {
        const indexedDbPackages = await listOfflinePackages()
        if (!active) return

        if (indexedDbPackages.length > 0) {
          setPackages(indexedDbPackages.map(mapStoredPackageToView))
          return
        }
      } catch (error) {
        console.error("[OFFLINE] portal package list error", error)
      }

      if (!active) return
      setPackages(listOfflineTripPackages())
    }

    void loadPackages()

    return () => {
      active = false
    }
  }, [])

  const latestPackage = packages[0] ?? null
  const savedItems = latestPackage?.items.filter((item) => item.saved) ?? []
  const statusMeta = getOfflinePackageStatusMeta(latestPackage ? latestPackage.status ?? "legacy_snapshot" : undefined)
  const totalSize = latestPackage?.totalSizeBytes ? formatBytes(latestPackage.totalSizeBytes) : getTotalSize(savedItems)
  const storageUsage = latestPackage?.totalSizeBytes ? Math.min((latestPackage.totalSizeBytes / (50 * 1024 * 1024)) * 100, 100) : 0

  return (
    <motion.div initial="initial" animate="animate" variants={staggerContainer} className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modo Offline</h1>
          <p className="text-sm text-muted-foreground">Acesse o último pacote salvo da sua viagem sem internet</p>
        </div>
        <Badge className={statusMeta.badgeClass}>
          {latestPackage ? <CheckCircle2 size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
          {statusMeta.label}
        </Badge>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-card/50 to-secondary/10 border-primary/20 vuei-glass">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <WifiOff size={28} className="text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{latestPackage ? latestPackage.tripName : "Nenhuma viagem salva offline"}</h3>
                <p className="text-sm text-muted-foreground">
                  {latestPackage ? `${savedItems.length} blocos salvos • ${totalSize}` : "Use o botão Salvar offline dentro do link da viagem."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>Última sincronização</span>
                </div>
                <p className="text-sm font-medium">{latestPackage ? formatSavedAt(latestPackage.savedAt) : "Ainda não sincronizado"}</p>
              </div>
              <Button variant="outline" size="icon" className="rounded-xl border-border/50" disabled>
                <RefreshCw size={18} />
              </Button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
            {latestPackage?.warning || getOfflineWarningMessage()}
          </div>
          {(latestPackage ? latestPackage.status ?? "legacy_snapshot" : null) === "legacy_snapshot" ? (
            <div className="mt-3 text-xs text-muted-foreground">
              Este pacote local não garante que todos os documentos tenham sido baixados para uso offline.
            </div>
          ) : null}
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Conteudo Offline</h2>
          <Button variant="ghost" size="sm" className="text-primary text-xs" disabled>
            <Download size={14} className="mr-1" />
            Gerado no link da viagem
          </Button>
        </div>

        <Card className="bg-card/50 border-border/50 vuei-glass divide-y divide-border/50">
          {(latestPackage?.items ?? []).length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhum pacote offline foi salvo ainda. Abra uma viagem e use o botão `Salvar offline` para gerar a versão local.
            </div>
          ) : (
            latestPackage!.items.map((item) => {
              const Icon = itemIconMap[item.type] || FileText
              return (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.saved ? "bg-primary/20" : "bg-muted/50"}`}>
                      <Icon size={18} className={item.saved ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sizeLabel}</p>
                    </div>
                  </div>

                  {item.saved ? (
                    <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                      <Check size={12} className="mr-1" />
                      Salvo
                    </Badge>
                  ) : (
                    <Badge className="bg-muted/40 text-muted-foreground border-0 text-xs">Não disponível</Badge>
                  )}
                </div>
              )
            })
          )}
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="p-5 bg-card/50 border-border/50 vuei-glass">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive size={20} className="text-muted-foreground" />
            <h3 className="font-semibold">Armazenamento</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Uso estimado</span>
              <span>{latestPackage ? `${totalSize} de 50 MB` : "0 KB de 50 MB"}</span>
            </div>
            <Progress value={storageUsage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              O pacote offline inclui resumo da viagem, passagens extraídas, hospedagem, roteiro, documentos já abertos e informações rápidas.
            </p>
          </div>
        </Card>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Card className="p-4 bg-muted/20 border-border/50">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>{getOfflineWarningMessage()}</p>
              <p className="mt-1">O pacote offline não promete concierge online, clima atualizado ou novos anexos sem internet.</p>
            </div>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
