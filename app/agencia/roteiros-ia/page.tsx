"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Wand2,
  FileText,
  ExternalLink,
  Eye,
  Loader2,
  Check,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAgency } from "@/contexts/agency-context"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Document, TripItineraryRecord } from "@/types"
import { deleteTripItinerary, listTripItineraries, requestAiItineraryGeneration } from "@/lib/repositories/trip-itineraries-repository"
import { getSignedDocumentUrl, listDocumentsByTrip } from "@/lib/repositories/documents-repository"
import { listTripTravelersByTrip } from "@/lib/repositories/trip-travelers-repository"
import { getAiCreditCost } from "@/lib/ai/credit-costs"
import { getAgencyBillingStatusFromApi } from "@/lib/repositories/agency-billing-repository"
import { dispatchCreditBalanceChanged } from "@/lib/credits/credit-events"

type PreviewState = {
  itinerary: TripItineraryRecord
  tripName: string
}

function differenceInDaysInclusive(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const diff = end.getTime() - start.getTime()
  return Math.max(Math.floor(diff / 86400000) + 1, 1)
}

function formatTripDuration(startDate?: string, endDate?: string) {
  const totalDays = differenceInDaysInclusive(startDate, endDate)
  if (!totalDays) return "Não informado"
  return `${totalDays} ${totalDays === 1 ? "dia" : "dias"}`
}

function formatTravelersLabel(count?: number) {
  if (!count || count <= 0) return "Não informado"
  return `${count} ${count === 1 ? "viajante" : "viajantes"}`
}

function formatItineraryStatus(status: TripItineraryRecord["status"]) {
  switch (status) {
    case "completed":
      return "Concluída"
    case "generating":
      return "Gerando"
    case "failed":
      return "Falhou"
    case "uploaded":
      return "Anexado"
    default:
      return "Rascunho"
  }
}

function formatItineraryMode(mode: TripItineraryRecord["mode"]) {
  switch (mode) {
    case "complete_pdf":
      return "Completo em PDF"
    case "uploaded":
      return "Arquivo anexado"
    default:
      return "Roteiro simples"
  }
}

export default function RoteirosIAPage() {
  const { trips, credits } = useAgency()
  const isRealMode = shouldUseSupabase()
  const [tripTravelersCountByTrip, setTripTravelersCountByTrip] = useState<Record<string, number | null>>({})
  const [selectedTripId, setSelectedTripId] = useState("")
  const [activeTab, setActiveTab] = useState("generate")
  const [isGenerating, setIsGenerating] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [savedItineraries, setSavedItineraries] = useState<Array<TripItineraryRecord & { tripName: string }>>([])
  const [tripDocuments, setTripDocuments] = useState<Record<string, Document[]>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null)
  const [insufficientCreditsNotice, setInsufficientCreditsNotice] = useState(false)
  const [availableCredits, setAvailableCredits] = useState(credits.balance)
  const [formData, setFormData] = useState({
    destination: "",
    duration: "",
    travelers: "",
    budget: "",
    style: "",
    preferences: "",
  })

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [selectedTripId, trips],
  )
  const simpleCreditCost = getAiCreditCost("itinerary_generation_simple")
  const completeCreditCost = getAiCreditCost("itinerary_generation_complete")
  const hasCreditsForSimple = availableCredits >= simpleCreditCost

  const refreshAvailableCredits = useCallback(async () => {
    if (!isRealMode) {
      setAvailableCredits(credits.balance)
      return
    }

    const result = await getAgencyBillingStatusFromApi()
    if (result.data) {
      setAvailableCredits(result.data.totalAvailable)
      return
    }

    setAvailableCredits(credits.balance)
  }, [credits.balance, isRealMode])

  const loadTripTravelersCount = useCallback(async (tripId: string) => {
    if (!isRealMode || !tripId || tripTravelersCountByTrip[tripId] !== undefined) {
      return
    }

    const result = await listTripTravelersByTrip(tripId)
    setTripTravelersCountByTrip((current) => ({
      ...current,
      [tripId]: result.data.length > 0 ? result.data.length : null,
    }))
  }, [isRealMode, tripTravelersCountByTrip])

  const getResolvedTravelersCount = useCallback((tripId: string, fallbackCount?: number) => {
    const persistedCount = tripTravelersCountByTrip[tripId]
    if (typeof persistedCount === "number" && persistedCount > 0) {
      return persistedCount
    }

    return fallbackCount
  }, [tripTravelersCountByTrip])

  const hydrateTripFields = useCallback((tripId: string) => {
    const trip = trips.find((entry) => entry.id === tripId)
    if (!trip) {
      setFormData({
        destination: "",
        duration: "",
        travelers: "",
        budget: "",
        style: "",
        preferences: "",
      })
      return
    }

    setFormData((current) => ({
      ...current,
      destination: trip.destination || [trip.city, trip.country].filter(Boolean).join(", "),
      duration: formatTripDuration(trip.startDate, trip.endDate),
      travelers: formatTravelersLabel(getResolvedTravelersCount(trip.id, trip.passengersCount)),
      style: trip.style || "",
      preferences: current.preferences,
    }))
  }, [getResolvedTravelersCount, trips])

  const loadDocumentsForTrip = useCallback(async (tripId: string) => {
    const result = await listDocumentsByTrip(tripId)
    if (result.error) {
      return
    }

    setTripDocuments((current) => ({
      ...current,
      [tripId]: result.data ?? [],
    }))
  }, [])

  const loadSavedItineraries = useCallback(async () => {
    if (!isRealMode) {
      setSavedItineraries([])
      return
    }

    const results = await Promise.all(
      trips.map(async (trip) => {
        const [itinerariesResult, documentsResult] = await Promise.all([
          listTripItineraries(trip.id),
          listDocumentsByTrip(trip.id),
        ])

        return {
          trip,
          itineraries: itinerariesResult.data ?? [],
          itinerariesError: itinerariesResult.error,
          documents: documentsResult.data ?? [],
        }
      }),
    )

    const nextDocuments: Record<string, Document[]> = {}
    const nextSaved = results.flatMap(({ trip, itineraries, documents, itinerariesError }) => {
      if (itinerariesError) {
        setLoadError(itinerariesError)
        return []
      }

      nextDocuments[trip.id] = documents
      return itineraries.map((itinerary) => ({
        ...itinerary,
        tripName: trip.name,
      }))
    })

    setTripDocuments((current) => ({
      ...current,
      ...nextDocuments,
    }))
    setSavedItineraries(
      nextSaved.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
    )
  }, [isRealMode, trips])

  useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(trips[0].id)
      hydrateTripFields(trips[0].id)
      return
    }

    if (selectedTripId) {
      hydrateTripFields(selectedTripId)
    }
  }, [hydrateTripFields, selectedTripId, trips])

  useEffect(() => {
    if (!selectedTripId) {
      return
    }

    void loadTripTravelersCount(selectedTripId)
  }, [loadTripTravelersCount, selectedTripId])

  useEffect(() => {
    void loadSavedItineraries()
  }, [loadSavedItineraries])

  useEffect(() => {
    void refreshAvailableCredits()
  }, [refreshAvailableCredits])

  const showInsufficientCredits = useCallback(() => {
    setLoadError(null)
    setInsufficientCreditsNotice(true)
  }, [])

  const handleGenerate = async (mode: "simple" | "complete_pdf") => {
    if (!selectedTrip) {
      setLoadError("Selecione uma viagem antes de gerar o roteiro.")
      return
    }

    if (!isRealMode) {
      setLoadError("Ative o modo Supabase para gerar roteiros IA reais.")
      return
    }

    const creditCost = mode === "simple" ? simpleCreditCost : completeCreditCost

    if (availableCredits < creditCost) {
      showInsufficientCredits()
      return
    }

    setIsGenerating(true)
    setLoadError(null)
    setGeneratedMessage(null)
    setInsufficientCreditsNotice(false)

    try {
      const result = await requestAiItineraryGeneration({
        tripId: selectedTrip.id,
        mode,
      })

      if (!result.data?.itinerary) {
        const normalizedError = (result.error ?? "").toLowerCase()
        if (normalizedError.includes("saldo insuficiente") || normalizedError.includes("créditos insuficientes") || normalizedError.includes("cr?ditos insuficientes")) {
          showInsufficientCredits()
          return
        }

        setLoadError(result.error ?? "Não foi possível gerar o roteiro.")
        return
      }

      setPreview({
        itinerary: result.data.itinerary,
        tripName: selectedTrip.name,
      })
      setGeneratedMessage(
        mode === "complete_pdf"
          ? "Roteiro completo gerado e salvo na viagem."
          : "Roteiro simples gerado e salvo na viagem.",
      )
      await refreshAvailableCredits()
      dispatchCreditBalanceChanged({ ownerType: "agency", amount: creditCost, feature: "itinerary_generation" })
      setActiveTab("saved")

      if (result.data.document) {
        setTripDocuments((current) => ({
          ...current,
          [selectedTrip.id]: [result.data.document!, ...(current[selectedTrip.id] ?? [])],
        }))
      } else {
        await loadDocumentsForTrip(selectedTrip.id)
      }

      await loadSavedItineraries()
    } finally {
      setIsGenerating(false)
    }
  }

  const handleOpenSavedItinerary = async (itinerary: TripItineraryRecord & { tripName: string }) => {
    setLoadError(null)
    if (itinerary.mode === "simple" || !itinerary.documentId) {
      setPreview({ itinerary, tripName: itinerary.tripName })
      setActiveTab("generate")
      return
    }

    const documents = tripDocuments[itinerary.tripId] ?? []
    const matchingDocument = documents.find((document) => document.id === itinerary.documentId)

    if (!matchingDocument?.filePath) {
      setLoadError("Documento do roteiro não encontrado.")
      return
    }

    const signedUrlResult = await getSignedDocumentUrl(matchingDocument.filePath)
    if (!signedUrlResult.data) {
      setLoadError(signedUrlResult.error ?? "Não foi possível abrir o arquivo do roteiro.")
      return
    }

    window.open(signedUrlResult.data, "_blank", "noopener,noreferrer")
  }

  const handleDeleteSavedItinerary = async (itineraryId: string) => {
    if (!confirm("Deseja remover este roteiro salvo?")) {
      return
    }

    const result = await deleteTripItinerary(itineraryId)
    if (!result.success) {
      setLoadError(result.error ?? "Não foi possível remover o roteiro.")
      return
    }

    setSavedItineraries((current) => current.filter((item) => item.id !== itineraryId))
    if (preview?.itinerary.id === itineraryId) {
      setPreview(null)
    }
  }

  const previewDays = preview?.itinerary.content?.days ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roteiros IA</h1>
          <p className="text-muted-foreground">Selecione uma viagem e gere roteiros reais vinculados ao Supabase</p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30 w-fit">
          <Sparkles className="w-3 h-3 mr-1" />
          {availableCredits} créditos disponíveis
        </Badge>
      </div>

      {loadError ? (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-sm text-red-300">{loadError}</CardContent>
        </Card>
      ) : null}

      {insufficientCreditsNotice ? (
        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="flex flex-col gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-amber-200">Créditos insuficientes</p>
              <p className="mt-1 text-sm text-amber-100/80">
                Créditos insuficientes para gerar este roteiro. Recarregue créditos no portal da agência.
              </p>
            </div>
            <Button asChild className="w-full sm:w-fit bg-gradient-to-r from-primary to-accent text-white">
              <Link href="/agencia/creditos">Ver créditos</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className={hasCreditsForSimple ? "border-emerald-100 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        <CardContent className="p-4">
          <p className={hasCreditsForSimple ? "text-sm font-semibold text-emerald-700" : "text-sm font-semibold text-amber-800"}>
            {hasCreditsForSimple ? "Roteiros IA disponíveis" : "Créditos insuficientes para gerar roteiros"}
          </p>
          <p className={hasCreditsForSimple ? "mt-1 text-sm text-emerald-700/80" : "mt-1 text-sm text-amber-800/80"}>
            {hasCreditsForSimple
              ? `O consumo será descontado dos créditos da agência: ${simpleCreditCost} créditos no roteiro simples e ${completeCreditCost} no completo em PDF.`
              : `A agência precisa de pelo menos ${simpleCreditCost} créditos para o roteiro simples e ${completeCreditCost} para o completo em PDF.`}
          </p>
        </CardContent>
      </Card>

      {generatedMessage ? (
        <Card className="border-emerald-100 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">{generatedMessage}</CardContent>
        </Card>
      ) : null}

      {!isRealMode ? (
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Ative o Supabase neste ambiente para gerar e persistir roteiros reais da agência.
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="generate" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Wand2 className="w-4 h-4 mr-2" />
            Gerar Novo
          </TabsTrigger>
          <TabsTrigger value="saved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="w-4 h-4 mr-2" />
            Salvos ({savedItineraries.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Configurar Roteiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Viagem</Label>
                  <Select
                    value={selectedTripId}
                    onValueChange={(value) => {
                      setSelectedTripId(value)
                      hydrateTripFields(value)
                    }}
                  >
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Selecione uma viagem" />
                    </SelectTrigger>
                    <SelectContent>
                      {trips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id}>
                          {trip.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Destino</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={formData.destination} readOnly className="pl-10 bg-background border-border" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={formData.duration} readOnly className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Viajantes</Label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input value={formData.travelers} readOnly className="pl-10 bg-background border-border" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estilo</Label>
                    <Input value={formData.style || "Não informado"} readOnly className="bg-background border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label>Orcamento</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Ex: R$ 15.000"
                        value={formData.budget}
                        onChange={(event) => setFormData((current) => ({ ...current, budget: event.target.value }))}
                        className="pl-10 bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferencias</Label>
                  <Textarea
                    value={formData.preferences}
                    onChange={(event) => setFormData((current) => ({ ...current, preferences: event.target.value }))}
                    placeholder="Adicione preferências extras para a geração do roteiro."
                    className="bg-background border-border min-h-[100px]"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    className="bg-gradient-to-r from-primary to-cyan-400 hover:opacity-90 text-white"
                    onClick={() => void handleGenerate("simple")}
                    disabled={isGenerating || !selectedTripId || !isRealMode}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Gerar roteiro simples
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="border-border"
                    onClick={() => void handleGenerate("complete_pdf")}
                    disabled={isGenerating || !selectedTripId || !isRealMode}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Gerando PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Gerar completo em PDF
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Preview do Roteiro</CardTitle>
              </CardHeader>
              <CardContent>
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20"
                    >
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-muted-foreground mt-4">Gerando roteiro real da viagem...</p>
                    </motion.div>
                  ) : preview ? (
                    <motion.div
                      key={preview.itinerary.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div>
                          <h3 className="font-semibold text-foreground">{preview.itinerary.title}</h3>
                          <p className="text-sm text-muted-foreground">{preview.tripName}</p>
                        </div>
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          {formatItineraryMode(preview.itinerary.mode)}
                        </Badge>
                      </div>

                      {preview.itinerary.mode !== "simple" ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                          Este roteiro foi salvo como documento. Abra pela aba <strong>Salvos</strong>.
                        </div>
                      ) : previewDays.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground">
                          Este roteiro ainda não possui dias estruturados.
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                          {previewDays.map((day) => (
                            <div key={day.id} className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-medium flex items-center justify-center">
                                  {day.day}
                                </span>
                                <div>
                                  <p className="font-medium text-foreground">{day.title}</p>
                                  {day.summary ? <p className="text-xs text-muted-foreground">{day.summary}</p> : null}
                                </div>
                              </div>

                              <div className="ml-4 pl-4 border-l border-border/50 space-y-2">
                                {day.activities.map((activity) => (
                                  <div key={activity.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-xs text-primary font-medium">{activity.time || "Horário livre"}</span>
                                      <span className="text-sm font-medium text-foreground">{activity.title}</span>
                                    </div>
                                    {activity.location ? (
                                      <p className="mt-1 text-xs text-muted-foreground">{activity.location}</p>
                                    ) : null}
                                    {activity.description ? (
                                      <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p>
                                    ) : null}
                                  </div>
                                ))}
                                {day.tips ? <p className="text-xs text-muted-foreground">Dicas: {day.tips}</p> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-20 text-center"
                    >
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <Wand2 className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">Selecione uma viagem e gere um roteiro real</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          {savedItineraries.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-12 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum roteiro salvo ainda</p>
                <p className="text-sm text-muted-foreground/60">Selecione uma viagem e gere seu primeiro roteiro real</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {savedItineraries.map((itinerary) => (
                <Card key={itinerary.id} className="bg-card border-border hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-cyan-500/20 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{itinerary.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {itinerary.tripName}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatItineraryMode(itinerary.mode)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <Badge
                          variant="secondary"
                          className={itinerary.status === "completed" ? "bg-emerald-500/10 text-emerald-300" : "bg-muted text-muted-foreground"}
                        >
                          {formatItineraryStatus(itinerary.status)}
                        </Badge>
                        <Button size="sm" variant="outline" className="border-border" onClick={() => void handleOpenSavedItinerary(itinerary)}>
                          {itinerary.mode === "simple" ? (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Visualizar
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Abrir
                            </>
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-red-400"
                          onClick={() => void handleDeleteSavedItinerary(itinerary.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
