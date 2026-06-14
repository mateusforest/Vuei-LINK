"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import Image from "next/image"
import { useParams, usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { extractAgencyStorageState } from "@/lib/mappers/agency-mappers"
import { extractTripsStoragePayload } from "@/lib/mappers/trip-mappers"
import { shouldUseSupabase } from "@/lib/data-source"
import { getAgencyById } from "@/lib/repositories/agencies-repository"
import { getTripByAdminToken, getTripByPublicToken, getTripBySlug } from "@/lib/repositories/trips-repository"
import { createDocumentMetadata, deleteDocument, deleteDocumentFile, getSignedDocumentUrl, listDocumentsByTrip, listPublicTripDocuments, uploadDocumentFile } from "@/lib/repositories/documents-repository"
import { deleteTripFlight, listPublicTripFlights, listTripFlights, requestTripFlightExtraction, upsertTripFlight } from "@/lib/repositories/trip-flights-repository"
import { createTripHotel, deleteTripHotel, listTripHotels, updateTripHotel } from "@/lib/repositories/trip-hotels-repository"
import { deleteTripItinerary, listTripItineraries, requestAiItineraryGeneration, upsertTripItinerary } from "@/lib/repositories/trip-itineraries-repository"
import { listConversationsByTrip, listMessages } from "@/lib/repositories/ai-repository"
import { validateDocumentFile } from "@/lib/files/file-validation"
import { getDestinationCoverImage, getDestinationMetadata } from "@/lib/trip-destination"
import { getOfflineWarningMessage, saveTripOfflinePackage } from "@/lib/offline/trip-offline"
import { getOfflineDocumentBlob, loadTripOfflinePackage } from "@/lib/offline/offline-package-manager"
import { isOfflineModeActive } from "@/lib/offline/offline-mode"
import { useAuth } from "@/contexts/auth-context"
import { buildAdminTripUrl, buildPublicTripUrl, isAdminLinkMode } from "@/lib/security/link-tokens"
import type { TripFlightRecord } from "@/types/flight"
import type { TripItineraryRecord, TripItineraryContent } from "@/types"
import type { OfflineStoredTripPackage, OfflineTripPackageAudience, OfflineTripPackageStatus } from "@/lib/offline/types"
import {
  authenticateTripLinkBiometric,
  disableTripLinkBiometric,
  disableTripLinkPin,
  getTripLinkQuickAccessMethods,
  registerTripLinkBiometric,
  saveTripLinkPin,
  verifyTripLinkPin,
} from "@/lib/auth/quick-access"
import {
  Plane, Hotel, MapPin, FileText, MessageCircle, Share2, WifiOff, 
  ChevronRight, Calendar, Clock, Users, Sun, Cloud, Thermometer,
  Shield, Lock, Fingerprint, Download, Copy, Check, Send, Sparkles,
  Globe, Phone, AlertCircle, CreditCard, QrCode, Navigation,
  ChevronDown, Play, Pause, Volume2, Star, Heart, ExternalLink,
  X, Edit3, Plus, Trash2, Upload, Eye, EyeOff, Settings, User,
  ArrowLeft, MoreVertical, CheckCircle2, XCircle, Camera, Pencil
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { devLog, startPerfMeasure } from "@/lib/dev/perf"

const TRIPS_STORAGE_KEY = "vuei_trips"
const AGENCY_STORAGE_KEY = "vuei_agency"

// Permission context
const PermissionContext = createContext<{
  isAdmin: boolean
  canWrite: boolean
  setIsAdmin: (v: boolean) => void
}>({ isAdmin: true, canWrite: true, setIsAdmin: () => {} })

// Toast context
const ToastContext = createContext<{
  showToast: (message: string, type?: "success" | "error" | "info") => void
}>({ showToast: () => {} })

function useToast() {
  return useContext(ToastContext)
}

// Toast component
function Toast({ message, type = "success", onClose }: { message: string; type?: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-2xl",
        type === "success" && "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
        type === "error" && "bg-red-500/20 border-red-500/30 text-red-300",
        type === "info" && "bg-[#5de0e6]/20 border-[#5de0e6]/30 text-[#5de0e6]"
      )}
    >
      {type === "success" && <CheckCircle2 className="w-5 h-5" />}
      {type === "error" && <XCircle className="w-5 h-5" />}
      {type === "info" && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}

// Modal wrapper
function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 sm:max-w-lg sm:w-full max-h-[90vh] overflow-auto rounded-3xl bg-[#0a0a0a] border border-white/10 shadow-2xl"
          >
            {title && (
              <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Bottom Sheet (mobile drawer)
function BottomSheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-auto rounded-t-3xl bg-[#0a0a0a] border-t border-white/10"
          >
            <div className="sticky top-0 z-10 bg-[#0a0a0a] pt-3 pb-4 px-5">
              <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-4" />
              {title && (
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{title}</h3>
                  <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5 text-white/60" />
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 pb-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const DEFAULT_HERO_IMAGE = getDestinationCoverImage()

const initialTripData = {
  id: "trip-default",
  destination: "Minha Viagem",
  startDate: null,
  endDate: null,
  country: "A definir",
  countryFlag: "🇫🇷",
  dates: { start: "A definir", end: "A definir" },
  daysUntil: 0,
  status: "upcoming",
  travelers: [
    { name: "Joao Silva", avatar: "/placeholder.svg?height=40&width=40", role: "principal" },
    { name: "Maria Silva", avatar: "/placeholder.svg?height=40&width=40", role: "acompanhante" },
  ],
  weather: { temp: null, condition: "A definir", icon: Cloud },
  heroImage: DEFAULT_HERO_IMAGE,
  flights: [],
  hotel: null,
  hotels: [],
  itinerary: [],
  documents: [],
  quickInfo: {
    currency: { name: "Euro", symbol: "€", rate: "R$ 5,40" },
    language: "Frances",
    timezone: "GMT+2 (4h a frente)",
    emergency: "112",
    embassy: "+33 1 45 61 63 00"
  },
  credits: { balance: 47, used: 3, total: 50 },
  adminLink: buildAdminTripUrl("minha-viagem"),
  shareLink: buildPublicTripUrl("minha-viagem")
}

function parseTripDestination(destination?: string) {
  const parts = (destination ?? "").split(",").map((part) => part.trim()).filter(Boolean)
  return {
    city: parts[0] || destination || "Minha Viagem",
    country: parts[1] || "",
  }
}

function getCountryFlag(country?: string) {
  const normalized = (country ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

  const countryFlags: Record<string, string> = {
    franca: "🇫🇷",
    france: "🇫🇷",
    italia: "🇮🇹",
    italy: "🇮🇹",
    portugal: "🇵🇹",
    japao: "🇯🇵",
    japan: "🇯🇵",
    eua: "🇺🇸",
    usa: "🇺🇸",
    "estados unidos": "🇺🇸",
    brasil: "🇧🇷",
    brazil: "🇧🇷",
    espanha: "🇪🇸",
    spain: "🇪🇸",
    mexico: "🇲🇽",
    emirados: "🇦🇪",
  }

  return countryFlags[normalized] || "🌍"
}

function formatTripDate(dateString?: string) {
  if (!dateString) return ""

  return new Date(`${dateString}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function calculateDaysUntil(dateString?: string) {
  if (!dateString) return 0

  const targetDate = new Date(`${dateString}T12:00:00`)
  const today = new Date()
  const diff = targetDate.getTime() - today.getTime()

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function buildTravelers(count?: number) {
  const total = Math.max(count ?? 1, 1)

  return Array.from({ length: total }, (_, index) => ({
    name: index === 0 ? "Viajante Principal" : `Acompanhante ${index}`,
    avatar: "/placeholder.svg?height=40&width=40",
    role: index === 0 ? "principal" : "acompanhante",
  }))
}

function buildQuickInfo(destination?: string, country?: string, city?: string) {
  return getDestinationMetadata(destination, country, city)
}

function normalizeQuickInfo(quickInfo?: any) {
  const currency = quickInfo?.currency ?? {}

  return {
    currency: {
      name: currency?.name || "Nao informado",
      symbol: currency?.symbol || "-",
      rate: currency?.rate || "Nao informado",
    },
    language: quickInfo?.language || "Nao informado",
    timezone: quickInfo?.timezone || "Nao informado",
    emergency: quickInfo?.emergency || "Nao informado",
    embassy: quickInfo?.embassy || "Nao informado",
  }
}

function normalizeTravelers(travelers?: any, fallbackCount?: number) {
  if (Array.isArray(travelers) && travelers.length > 0) {
    return travelers.map((traveler, index) => ({
      name: traveler?.name || (index === 0 ? "Viajante Principal" : `Acompanhante ${index}`),
      avatar: traveler?.avatar || "/placeholder.svg?height=40&width=40",
      role: traveler?.role || (index === 0 ? "principal" : "acompanhante"),
    }))
  }

  return buildTravelers(fallbackCount)
}

function formatFlightDateTime(dateString?: string | null) {
  if (!dateString) return { date: "Nao informado", time: "--:--" }

  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  }
}

function calculateFlightDuration(departureAt?: string | null, arrivalAt?: string | null) {
  if (!departureAt || !arrivalAt) return "Horario nao informado"

  const diff = new Date(arrivalAt).getTime() - new Date(departureAt).getTime()
  if (!Number.isFinite(diff) || diff <= 0) return "Horario nao informado"

  const totalMinutes = Math.round(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

function normalizeAirportCode(value?: string | null) {
  if (!value) return "---"
  const match = value.match(/\b[A-Z]{3}\b/)
  return match?.[0] ?? value.slice(0, 3).toUpperCase()
}

function getFlightExtractedValue(flight: TripFlightRecord, key: string) {
  const extractedData =
    flight.extractedData && typeof flight.extractedData === "object"
      ? (flight.extractedData as Record<string, unknown>)
      : {}
  const structuredResult =
    extractedData.structured_result && typeof extractedData.structured_result === "object"
      ? (extractedData.structured_result as Record<string, unknown>)
      : extractedData

  const value = structuredResult[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function mapFlightRecordToView(flight: TripFlightRecord, documents?: any[]) {
  const airline = flight.airline || getFlightExtractedValue(flight, "airline")
  const flightNumber = flight.flightNumber || getFlightExtractedValue(flight, "flight_number")
  const bookingReference = flight.bookingReference || getFlightExtractedValue(flight, "booking_reference")
  const originAirport = flight.originAirport || getFlightExtractedValue(flight, "origin_airport")
  const destinationAirport = flight.destinationAirport || getFlightExtractedValue(flight, "destination_airport")
  const departureAt = flight.departureAt || getFlightExtractedValue(flight, "departure_at")
  const arrivalAt = flight.arrivalAt || getFlightExtractedValue(flight, "arrival_at")
  const passengerName = flight.passengerName || getFlightExtractedValue(flight, "passenger_name")
  const baggageInfo = flight.baggageInfo || getFlightExtractedValue(flight, "baggage_info")
  const terminal = flight.terminal || getFlightExtractedValue(flight, "terminal")
  const gate = flight.gate || getFlightExtractedValue(flight, "gate")
  const seat = flight.seat || getFlightExtractedValue(flight, "seat")
  const qrCodePayload = flight.qrCodePayload || getFlightExtractedValue(flight, "qr_code_payload")
  const departure = formatFlightDateTime(departureAt)
  const arrival = formatFlightDateTime(arrivalAt)
  const linkedDocument = Array.isArray(documents) ? documents.find((document: any) => document.id === flight.documentId) ?? null : null

  return {
    id: flight.id,
    airline: airline || "Passagem anexada",
    flightNumber: flightNumber || "Voo nao identificado",
    bookingReference,
    extractionStatus: flight.extractionStatus,
    extractedData: flight.extractedData ?? {},
    passengerName,
    baggageInfo,
    terminal,
    gate,
    seat,
    qrCodePayload,
    date: departure.date,
    duration: calculateFlightDuration(departureAt, arrivalAt),
    origin: {
      code: normalizeAirportCode(originAirport),
      city: originAirport || "Origem nao informada",
      time: departure.time,
    },
    destination: {
      code: normalizeAirportCode(destinationAirport),
      city: destinationAirport || "Destino nao informado",
      time: arrival.time,
    },
    document: linkedDocument,
  }
}

function getFlightStatusCopy(flight: any) {
  if (flight.extractionStatus === "completed") {
    return {
      eyebrow: "Dados extraidos por IA",
      detail: "Passagem processada",
      tone: "success" as const,
    }
  }

  if (flight.extractionStatus === "manual") {
    return {
      eyebrow: "Dados preenchidos manualmente",
      detail: "Passagem revisada",
      tone: "success" as const,
    }
  }

  if (flight.extractionStatus === "processing") {
    return {
      eyebrow: "Passagem anexada",
      detail: "Analisando passagem...",
      tone: "pending" as const,
    }
  }

  if (flight.extractionStatus === "failed") {
    return {
      eyebrow: "Passagem anexada",
      detail: "Nao foi possivel identificar esta passagem",
      tone: "error" as const,
    }
  }

  return {
    eyebrow: "Passagem anexada",
    detail: "Extracao pendente",
    tone: "pending" as const,
  }
}

function mapItineraryContentToLegacyDays(content?: TripItineraryContent | null) {
  if (!content?.days?.length) return [] as any[]

  return content.days.map((day) => ({
    day: day.day,
    date: day.date || `Dia ${day.day}`,
    title: day.title,
    items: day.activities.map((activity) => ({
      id: activity.id,
      time: activity.time || "",
      title: activity.title,
      type: activity.type,
      highlight: activity.highlight,
      description: activity.description,
      location: activity.location,
      period: activity.period ?? "flexible",
      icon:
        activity.type === "food"
          ? "UtensilsCrossed"
          : activity.type === "transport"
            ? "Car"
            : activity.type === "hotel"
              ? "Hotel"
              : activity.type === "flight"
                ? "Plane"
                : "MapPin",
    })),
    summary: day.summary,
    tips: day.tips,
    important: day.important,
  }))
}

function mapLegacyDaysToItineraryContent(days: any[], previousContent?: TripItineraryContent | null): TripItineraryContent {
  return {
    summary: previousContent?.summary ?? null,
    travelStyle: previousContent?.travelStyle ?? null,
    usefulTips: previousContent?.usefulTips ?? [],
    observations: previousContent?.observations ?? [],
    contacts: previousContent?.contacts ?? [],
    days: (Array.isArray(days) ? days : []).map((day: any, dayIndex: number) => ({
      id: typeof day?.id === "string" ? day.id : `day-${dayIndex + 1}`,
      day: typeof day?.day === "number" ? day.day : dayIndex + 1,
      date: typeof day?.date === "string" ? day.date : null,
      title: typeof day?.title === "string" ? day.title : `Dia ${dayIndex + 1}`,
      summary: typeof day?.summary === "string" ? day.summary : null,
      tips: typeof day?.tips === "string" ? day.tips : null,
      important: typeof day?.important === "string" ? day.important : null,
      activities: (Array.isArray(day?.items) ? day.items : []).map((item: any, itemIndex: number) => ({
        id: typeof item?.id === "string" ? item.id : `activity-${dayIndex + 1}-${itemIndex + 1}`,
        time: typeof item?.time === "string" && item.time.trim() ? item.time : null,
        title: typeof item?.title === "string" ? item.title : "Atividade",
        location: typeof item?.location === "string" ? item.location : null,
        description: typeof item?.description === "string" ? item.description : null,
        period:
          item?.period === "morning" ||
          item?.period === "afternoon" ||
          item?.period === "evening" ||
          item?.period === "flexible"
            ? item.period
            : "flexible",
        type:
          item?.type === "attraction" ||
          item?.type === "food" ||
          item?.type === "transport" ||
          item?.type === "hotel" ||
          item?.type === "experience" ||
          item?.type === "flight" ||
          item?.type === "other"
            ? item.type
            : "other",
        highlight: item?.highlight === true,
      })),
    })),
  }
}

function resolveSimpleTripItinerary(itineraries: TripItineraryRecord[]) {
  return itineraries.find((record) => record.mode === "simple" && (record.status === "completed" || record.status === "draft" || record.status === "generating")) ?? null
}

function calculateTripDayCount(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return null

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null

  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

function getItineraryPeriodLabel(period?: string | null) {
  if (period === "morning") return "Manha"
  if (period === "afternoon") return "Tarde"
  if (period === "evening") return "Noite"
  return "Flexivel"
}

function normalizeTripViewData(tripData: any) {
  const travelers = normalizeTravelers(tripData?.travelers, tripData?.travelersCount)
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const hotels = Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []
  const documents = Array.isArray(tripData?.documents) ? tripData.documents : []
  const weatherIcon =
    typeof tripData?.weather?.icon === "function" || typeof tripData?.weather?.icon === "object"
      ? tripData.weather.icon
      : Cloud

  return {
    ...tripData,
    destination: tripData?.destination || "Minha Viagem",
    country: tripData?.country || "Nao informado",
    countryFlag: tripData?.countryFlag || "🌍",
    startDate: tripData?.startDate || null,
    endDate: tripData?.endDate || null,
    dates: {
      start: tripData?.dates?.start || "A definir",
      end: tripData?.dates?.end || "A definir",
    },
    travelers,
    flights,
    hotels,
    hotel: hotels[0] ?? tripData?.hotel ?? null,
    itinerary,
    documents,
    heroImage: tripData?.heroImage || DEFAULT_HERO_IMAGE,
    weather: {
      temp: typeof tripData?.weather?.temp === "number" ? tripData.weather.temp : null,
      condition: tripData?.weather?.condition || "A definir",
      icon: weatherIcon,
    },
    quickInfo: normalizeQuickInfo(tripData?.quickInfo),
  }
}

function buildTripDataFromStoredTrip(storedTrip: any) {
  const { city, country } = parseTripDestination(storedTrip.destination)
  const start = formatTripDate(storedTrip.startDate)
  const end = formatTripDate(storedTrip.endDate)
  const travelers = normalizeTravelers(storedTrip.travelers, storedTrip.passengersCount ?? storedTrip.travelersCount)
  const hotels = Array.isArray(storedTrip.hotels)
    ? storedTrip.hotels
    : storedTrip.hotel
      ? [storedTrip.hotel]
      : storedTrip.accommodation
        ? [storedTrip.accommodation]
        : []
  const hotel = hotels[0] ?? null
  const rawFlights = Array.isArray(storedTrip.flights) ? storedTrip.flights : []
  const itinerary = Array.isArray(storedTrip.itinerary) ? storedTrip.itinerary : []
  const documents = Array.isArray(storedTrip.documents) ? storedTrip.documents : []
  const flights = rawFlights.map((flight: any) => {
    if (flight?.origin && flight?.destination) return flight
    return mapFlightRecordToView(
      {
        id: flight.id || `flight-${Math.random()}`,
        tripId: storedTrip.id || "",
        documentId: flight.documentId ?? null,
        airline: flight.airline ?? null,
        flightNumber: flight.flightNumber ?? null,
        bookingReference: flight.bookingReference ?? null,
        originAirport: flight.originAirport ?? null,
        destinationAirport: flight.destinationAirport ?? null,
        departureAt: flight.departureAt ?? null,
        arrivalAt: flight.arrivalAt ?? null,
        passengerName: flight.passengerName ?? null,
        qrCodePayload: flight.qrCodePayload ?? null,
        baggageInfo: flight.baggageInfo ?? null,
        terminal: flight.terminal ?? null,
        gate: flight.gate ?? null,
        seat: flight.seat ?? null,
        extractedData: flight.extractedData ?? {},
        extractionStatus: flight.extractionStatus ?? "pending",
        createdAt: flight.createdAt ?? new Date().toISOString(),
        updatedAt: flight.updatedAt ?? new Date().toISOString(),
      },
      documents,
    )
  })
  const heroImage = storedTrip.coverImage || getDestinationCoverImage(storedTrip.destination, storedTrip.city || city, storedTrip.country || country)
  const quickInfo = buildQuickInfo(storedTrip.destination, storedTrip.country || country, storedTrip.city || city)

  console.log("[LINK] cover resolved", heroImage)
  console.log("[LINK] metadata resolved", quickInfo)

  return normalizeTripViewData({
    ...initialTripData,
    id: storedTrip.id || storedTrip.slug || initialTripData.id,
    destination: city || storedTrip.title || "Minha Viagem",
    startDate: storedTrip.startDate || null,
    endDate: storedTrip.endDate || null,
    country: storedTrip.country || country || initialTripData.country,
    countryFlag: getCountryFlag(storedTrip.country || country),
    dates: {
      start: start || initialTripData.dates.start,
      end: end || initialTripData.dates.end,
    },
    daysUntil: calculateDaysUntil(storedTrip.startDate),
    status: storedTrip.status || initialTripData.status,
    travelers,
    heroImage,
    hotel: hotel
      ? {
          name: hotel.name || `Hospedagem em ${city || storedTrip.destination || "sua viagem"}`,
          stars: hotel.stars || 0,
          address: hotel.address || storedTrip.destination || "A definir",
          checkIn: hotel.checkIn || (start ? `${start} - 15:00` : "A definir"),
          checkOut: hotel.checkOut || (end ? `${end} - 11:00` : "A definir"),
          nights: hotel.nights || 0,
          room: hotel.room || "",
          phone: hotel.phone || "",
          confirmationCode: hotel.confirmationCode || "",
          image: hotel.image || heroImage,
          amenities: Array.isArray(hotel.amenities) ? hotel.amenities : [],
        }
      : null,
    hotels,
    itinerary,
    documents: documents.map((document: any) => ({
      ...document,
      private: document.private ?? document.isPrivate ?? document.visibility === "private",
    })),
    flights,
    quickInfo,
    adminLink: storedTrip.adminLink || initialTripData.adminLink,
    shareLink: storedTrip.shareLink || initialTripData.shareLink,
  })
}

function isOfflineRecoverableError(error: unknown, options?: { status?: number | null }) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true
  }

  if (typeof options?.status === "number" && options.status >= 400) {
    return false
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase()
  const name = error instanceof Error ? error.name : ""
  const hasForbiddenMarker =
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("not found") ||
    message.includes("supabase admin config is missing") ||
    message.includes("env") ||
    message.includes("service role") ||
    message.includes("jwt")

  if (hasForbiddenMarker) {
    return false
  }

  if (error instanceof TypeError) {
    return (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("load failed") ||
      message.includes("network request failed")
    )
  }

  if (name === "AbortError") {
    return false
  }

  return message.includes("failed to fetch") || message.includes("network request failed") || message.includes("load failed")
}

function normalizeOfflinePackageStatus(status?: OfflineTripPackageStatus | null) {
  return status ?? "legacy_snapshot"
}

function getOfflineSaveAudience(params: { isAdmin: boolean; sensitiveAccessGranted: boolean }): OfflineTripPackageAudience {
  if (!params.isAdmin) return "public"
  if (params.sensitiveAccessGranted) return "admin"
  return "restricted_public"
}

function getOfflineReadAudience(isAdminRoute: boolean) {
  return isAdminRoute ? "admin" : "public"
}

function filterOfflineDocumentsForAudience(documents: any[], audience: "public" | "admin") {
  if (audience === "admin") return documents
  return documents.filter((document: any) => !(document?.private === true || document?.isPrivate === true || document?.visibility === "private" || document?.visibility === "agency_only"))
}

function buildTripDataFromOfflinePackage(pkg: OfflineStoredTripPackage, audience: "public" | "admin") {
  const payload = pkg.payload ?? {
    trip: {},
    travelers: [],
    hotels: [],
    flights: [],
    itineraries: [],
    documents: [],
    quickInfo: null,
  }
  const trip = (payload.trip ?? {}) as Record<string, any>
  const branding = trip.branding && typeof trip.branding === "object" ? trip.branding : null
  const documents = filterOfflineDocumentsForAudience(Array.isArray(payload.documents) ? payload.documents : [], audience)

  return {
    tripData: buildTripDataFromStoredTrip({
      id: trip.id ?? pkg.tripId,
      slug: trip.slug ?? pkg.slug ?? pkg.tripId,
      title: trip.title ?? trip.destination ?? "Viagem",
      destination: trip.destination ?? pkg.destination ?? "Viagem",
      country: trip.country ?? pkg.country ?? undefined,
      city: trip.city ?? undefined,
      startDate: trip.startDate ?? undefined,
      endDate: trip.endDate ?? undefined,
      status: trip.status ?? "upcoming",
      coverImage: trip.coverImage ?? undefined,
      travelers: Array.isArray(payload.travelers) ? payload.travelers : [],
      travelersCount: Array.isArray(payload.travelers) ? payload.travelers.length : 0,
      hotels: Array.isArray(payload.hotels) ? payload.hotels : [],
      hotel: Array.isArray(payload.hotels) ? payload.hotels[0] ?? null : null,
      flights: Array.isArray(payload.flights) ? payload.flights : [],
      itinerary: Array.isArray(payload.itineraries) ? payload.itineraries : [],
      documents,
      adminLink: buildAdminTripUrl(typeof trip.slug === "string" ? trip.slug : pkg.slug ?? pkg.tripId),
      shareLink: buildPublicTripUrl(typeof trip.slug === "string" ? trip.slug : pkg.slug ?? pkg.tripId),
    }),
    agencyBranding: {
      name: typeof branding?.name === "string" ? branding.name : null,
      logoUrl: typeof branding?.logoUrl === "string" ? branding.logoUrl : typeof branding?.linkLogoUrl === "string" ? branding.linkLogoUrl : null,
      isAgency: Boolean(branding?.isAgency),
    },
    status: normalizeOfflinePackageStatus(pkg.status),
  }
}

type OfflineDocumentContext = {
  tripId: string
  audience: "public" | "admin"
  packageKey: string | null
  packageStatus: OfflineTripPackageStatus
}

function registerOfflineObjectUrl(
  objectUrl: string,
  registerCleanup?: ((url: string | null) => void) | null,
) {
  if (registerCleanup) {
    registerCleanup(objectUrl)
    return
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl)
  }, 60_000)
}

async function openOfflineDocumentFromPackage(params: {
  document: any
  context: OfflineDocumentContext | null
  onUnavailable: (message: string) => void
  registerCleanup?: ((url: string | null) => void) | null
}) {
  const { document, context, onUnavailable, registerCleanup } = params

  if (!context || !document?.id) {
    onUnavailable("Este arquivo nao esta disponivel offline.")
    return false
  }

  if (context.packageStatus === "legacy_snapshot") {
    onUnavailable("Este arquivo nao esta disponivel offline.")
    return false
  }

  const blobRecord = await getOfflineDocumentBlob(document.id, {
    tripId: context.tripId,
    packageKey: context.packageKey,
    audience: context.audience,
  })

  if (!blobRecord?.blob) {
    onUnavailable("Este arquivo nao esta disponivel offline.")
    return false
  }

  const pendingWindow = typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null
  const objectUrl = URL.createObjectURL(blobRecord.blob)
  registerOfflineObjectUrl(objectUrl, registerCleanup)

  if (pendingWindow) {
    pendingWindow.location.href = objectUrl
    return true
  }

  window.open(objectUrl, "_blank", "noopener,noreferrer")
  return true
}

function resolveProtectedWriteError(error?: string | null) {
  const normalized = (error ?? "").toLowerCase()

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("jwt") ||
    normalized.includes("not authenticated") ||
    normalized.includes("auth") ||
    normalized.includes("unauthorized")
  ) {
    return "Nao foi possivel concluir esta acao administrativa neste dispositivo."
  }

  return error || "Nao foi possivel concluir esta acao."
}

function logTripDocumentsDev(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  console.log("[TRIP][DOCUMENTS]", stage, details ?? {})
}

function getSafeDocumentDebugRows(documents: any[]) {
  return documents.map((document) => ({
    id: document?.id ?? null,
    trip_id: document?.tripId ?? document?.trip_id ?? null,
    name: document?.name ?? document?.title ?? null,
    type: document?.type ?? null,
    category: document?.category ?? null,
    visibility: document?.visibility ?? null,
    is_private: document?.isPrivate ?? document?.is_private ?? document?.private ?? null,
    has_file_url: Boolean(document?.fileUrl ?? document?.file_url),
  }))
}

function getDocumentDebugCounts(documents: any[]) {
  const isPrivate = (document: any) =>
    document?.private === true || document?.isPrivate === true || document?.is_private === true || document?.visibility === "private"

  return {
    total: documents.length,
    public: documents.filter((document) => !isPrivate(document)).length,
    private: documents.filter((document) => isPrivate(document)).length,
    tickets: documents.filter((document) => document?.type === "ticket").length,
    itineraries: documents.filter((document) => document?.type === "itinerary").length,
    general: documents.filter((document) => !["ticket", "itinerary"].includes(document?.type ?? "")).length,
  }
}

const iconMap: Record<string, any> = {
  Plane, Hotel, MapPin, Navigation, Star, Heart
}

// Floating particles - using fixed positions to avoid hydration mismatch
function FloatingParticles() {
  const particles = [
    { x: 5, y: 10, scale: 0.7 }, { x: 15, y: 25, scale: 0.9 }, { x: 25, y: 5, scale: 0.6 },
    { x: 35, y: 45, scale: 0.8 }, { x: 45, y: 15, scale: 0.5 }, { x: 55, y: 55, scale: 0.9 },
    { x: 65, y: 30, scale: 0.7 }, { x: 75, y: 60, scale: 0.6 }, { x: 85, y: 20, scale: 0.8 },
    { x: 95, y: 70, scale: 0.5 }, { x: 10, y: 80, scale: 0.7 }, { x: 20, y: 65, scale: 0.9 },
    { x: 30, y: 90, scale: 0.6 }, { x: 40, y: 75, scale: 0.8 }, { x: 50, y: 85, scale: 0.5 },
    { x: 60, y: 95, scale: 0.9 }, { x: 70, y: 50, scale: 0.7 }, { x: 80, y: 40, scale: 0.6 },
    { x: 90, y: 35, scale: 0.8 }, { x: 8, y: 55, scale: 0.5 }
  ]
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-gradient-to-r from-[#5de0e6]/20 to-[#004aad]/20"
          style={{ left: `${p.x}%`, top: `${p.y}%`, scale: p.scale }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 4 + i * 0.3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

// Status badge
function StatusBadge({ status, daysUntil }: { status: string; daysUntil: number }) {
  const configs = {
    upcoming: { label: `Faltam ${daysUntil} dias`, icon: Plane, className: "bg-[#5de0e6]/10 text-[#5de0e6] border-[#5de0e6]/30" },
    ongoing: { label: "Viagem em andamento", icon: Play, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    completed: { label: "Viagem finalizada", icon: Check, className: "bg-[#004aad]/10 text-[#004aad] border-[#004aad]/30" }
  }
  const config = configs[status as keyof typeof configs] ?? configs.upcoming
  const Icon = config.icon

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm", config.className)}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{config.label}</span>
    </motion.div>
  )
}

// Header
function TripHeader({
  tripData,
  agencyBranding,
  onOpenShare,
  onOpenMenu,
}: {
  tripData: any
  agencyBranding: { name: string | null; logoUrl: string | null; isAgency: boolean }
  onOpenShare: () => void
  onOpenMenu: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  const { isAdmin } = useContext(PermissionContext)
  const travelers = Array.isArray(tripData?.travelers) ? tripData.travelers : []

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.header 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
        scrolled ? "bg-black/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {agencyBranding.isAgency ? (
            <div className="rounded-2xl border border-white/10 bg-white/92 px-3 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.2)] backdrop-blur">
              <div className="flex flex-col gap-0.5">
                <Image
                  src={agencyBranding.logoUrl || "/vuei-logo.png"}
                  alt={agencyBranding.name || "Vuei"}
                  width={144}
                  height={48}
                  className="h-7 w-auto max-w-[120px] object-contain sm:h-8 sm:max-w-[150px]"
                />
                <span className="text-[9px] uppercase tracking-[0.16em] text-black/40">
                  Powered by Vuei
                </span>
              </div>
            </div>
          ) : (
            <Image
              src="/vuei-logo.png"
              alt="Vuei"
              width={176}
              height={64}
              className="h-9 w-auto max-w-[148px] object-contain sm:h-10 sm:max-w-[176px]"
              priority
            />
          )}
          <div className={cn("hidden sm:flex items-center gap-2 transition-opacity duration-300", scrolled ? "opacity-100" : "opacity-0")}>
            <span className="text-white/40">|</span>
            <span className="text-white/80 font-medium">{tripData.destination}</span>
            <span className="text-lg">{tripData.countryFlag}</span>
          </div>
          {!isAdmin && (
            <span className="px-2 py-1 text-[10px] rounded-full bg-white/10 text-white/60 border border-white/10">
              Visualizacao
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onOpenShare} className="text-white/70 hover:text-white hover:bg-white/10">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-2">Compartilhar</span>
          </Button>
          
          <button onClick={onOpenMenu} className="flex -space-x-2">
            {travelers.slice(0, 2).map((t: any, i: number) => (
              <div 
                key={i}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5de0e6] to-[#004aad] border-2 border-black flex items-center justify-center text-xs font-bold text-white"
              >
                {t.name.charAt(0)}
              </div>
            ))}
          </button>
        </div>
      </div>
    </motion.header>
  )
}

// Hero
function TripHero({ tripData, onEditTrip }: { tripData: any; onEditTrip: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const { canWrite } = useContext(PermissionContext)
  const travelersCount = Array.isArray(tripData?.travelers) ? tripData.travelers.length : 0
  const WeatherIcon = tripData?.weather?.icon || Cloud

  return (
    <motion.section ref={ref} className="relative h-[85vh] min-h-[600px] overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0">
        <Image src={tripData.heroImage} alt={tripData.destination} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-[#5de0e6]/10 via-[#004aad]/5 to-transparent blur-3xl" />
      </motion.div>

      <motion.div style={{ opacity }} className="relative z-10 h-full flex flex-col justify-end pb-16 px-4">
        <div className="max-w-6xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
            <StatusBadge status={tripData.status} daysUntil={tripData.daysUntil} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4">
            <div className="flex items-start gap-4">
              <div>
                <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold text-white tracking-tight">{tripData.destination}</h1>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-3xl">{tripData.countryFlag}</span>
                  <span className="text-xl text-white/60">{tripData.country}</span>
                </div>
              </div>
              {canWrite && (
                <button 
                  onClick={onEditTrip}
                  className="mt-4 p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all"
                >
                  <Edit3 className="w-5 h-5 text-white/70" />
                </button>
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-wrap gap-3 mt-8">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
              <Calendar className="w-5 h-5 text-[#5de0e6]" />
              <div>
                <p className="text-xs text-white/50">Periodo</p>
                <p className="text-sm text-white font-medium">{tripData.dates.start} - {tripData.dates.end}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
              <Users className="w-5 h-5 text-[#5de0e6]" />
              <div>
                <p className="text-xs text-white/50">Viajantes</p>
                <p className="text-sm text-white font-medium">{travelersCount} pessoas</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
              <WeatherIcon className="w-5 h-5 text-[#5de0e6]" />
              <div>
                <p className="text-xs text-white/50">Clima</p>
                <p className="text-sm text-white font-medium">{typeof tripData.weather.temp === "number" ? `${tripData.weather.temp}°C` : "A definir"}</p>
              </div>
            </div>
          </motion.div>

          {tripData.status === "upcoming" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-8">
              <div className="inline-flex items-center gap-2 text-[#5de0e6]">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Sua aventura comeca em breve</span>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </motion.section>
  )
}

// Quick access cards
function QuickAccessCards({ tripData, onNavigate }: { tripData: any; onNavigate: (section: string) => void }) {
  const ticketDocuments = Array.isArray(tripData.documents)
    ? tripData.documents.filter((document: any) => document.type === "ticket")
    : []
  const flightsCount = Array.isArray(tripData?.flights) ? tripData.flights.length : 0
  const itineraryCount = Array.isArray(tripData?.itinerary) ? tripData.itinerary.length : 0
  const documentsCount = Array.isArray(tripData?.documents) ? tripData.documents.length : 0

  const cards = [
    { id: "flights", icon: Plane, label: "Passagens", color: "from-[#5de0e6] to-[#5de0e6]/50", count: flightsCount || ticketDocuments.length },
    { id: "hotel", icon: Hotel, label: "Hospedagem", color: "from-[#004aad] to-[#004aad]/50", count: Array.isArray(tripData.hotels) ? tripData.hotels.length : tripData.hotel ? 1 : 0 },
    { id: "itinerary", icon: MapPin, label: "Roteiro", color: "from-[#5de0e6] to-[#004aad]", count: itineraryCount },
    { id: "documents", icon: FileText, label: "Documentos", color: "from-[#004aad] to-[#5de0e6]", count: documentsCount },
    { id: "concierge", icon: MessageCircle, label: "Concierge", color: "from-[#5de0e6] to-[#5de0e6]/50", badge: "IA" },
    { id: "offline", icon: WifiOff, label: "Offline", color: "from-[#004aad] to-[#004aad]/50" },
  ]

  return (
    <section className="relative py-8 px-4 -mt-16 z-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {cards.map((card, i) => (
            <motion.button
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate(card.id)}
              className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-[#5de0e6]/30 transition-all duration-300"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5de0e6]/5 to-[#004aad]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className={cn("relative w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center", card.color)}>
                <card.icon className="w-5 h-5 text-white" />
                {card.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-white text-black rounded-full">{card.badge}</span>
                )}
              </div>
              <span className="text-xs text-white/70 group-hover:text-white transition-colors">{card.label}</span>
              {card.count && <span className="text-[10px] text-white/40">{card.count}</span>}
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}

// Edit Trip Modal
function EditTripModal({ open, onClose, tripData, onSave }: { open: boolean; onClose: () => void; tripData: any; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({
    destination: tripData.destination,
    country: tripData.country,
    startDate: tripData.dates.start,
    endDate: tripData.dates.end,
    status: tripData.status
  })

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar Viagem">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Destino</label>
          <input
            type="text"
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Pais</label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Data Inicio</label>
            <input
              type="text"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Data Fim</label>
            <input
              type="text"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Status</label>
  <select
  value={formData.status}
  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
  >
  <option value="upcoming" className="bg-[#0a0a0a] text-white">Proxima</option>
  <option value="ongoing" className="bg-[#0a0a0a] text-white">Em andamento</option>
  <option value="completed" className="bg-[#0a0a0a] text-white">Finalizada</option>
  </select>
        </div>
        <Button onClick={handleSave} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
          Salvar Alteracoes
        </Button>
      </div>
    </Modal>
  )
}

// Flight Card
function FlightCard({
  flight,
  index,
  onEdit,
  onViewQR,
  onOpenDetails,
  onOpenDocument,
  onDelete,
}: {
  flight: any
  index: number
  onEdit: () => void
  onViewQR: () => void
  onOpenDetails: () => void
  onOpenDocument: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const statusCopy = getFlightStatusCopy(flight)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <div 
        onClick={() => setExpanded(!expanded)}
        className="relative p-5 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] hover:border-[#5de0e6]/20 transition-all duration-300 cursor-pointer overflow-hidden"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center">
              <Plane className="w-5 h-5 text-[#5de0e6]" />
            </div>
            <div>
              <p className="text-sm text-white/50">{statusCopy.eyebrow}</p>
              <p className="text-white font-medium">{flight.airline}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40">{flight.date}</p>
            <p className="text-sm text-[#5de0e6] font-medium">{flight.flightNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-white">{flight.origin.time}</p>
            <p className="text-lg font-semibold text-[#5de0e6]">{flight.origin.code}</p>
            <p className="text-xs text-white/40">{flight.origin.city}</p>
          </div>
          
          <div className="flex-1 flex flex-col items-center">
            <p className="text-[10px] text-white/30 mb-2">{flight.duration}</p>
            <div className="w-full flex items-center gap-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5de0e6]/50 to-[#5de0e6]" />
              <Plane className="w-4 h-4 text-[#5de0e6] rotate-90" />
              <div className="h-px flex-1 bg-gradient-to-r from-[#5de0e6] via-[#5de0e6]/50 to-transparent" />
            </div>
            <p className="text-[10px] text-white/30 mt-2">Direto</p>
          </div>
          
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-white">{flight.destination.time}</p>
            <p className="text-lg font-semibold text-[#5de0e6]">{flight.destination.code}</p>
            <p className="text-xs text-white/40">{flight.destination.city}</p>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Terminal</p>
                  <p className="text-sm text-white font-medium">{flight.terminal || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Portao</p>
                  <p className="text-sm text-white font-medium">{flight.gate || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Assento</p>
                  <p className="text-sm text-white font-medium">{flight.seat || "-"}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      statusCopy.tone === "success" && "bg-emerald-500",
                      statusCopy.tone === "pending" && "bg-amber-400",
                      statusCopy.tone === "error" && "bg-red-400",
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      statusCopy.tone === "success" && "text-emerald-400",
                      statusCopy.tone === "pending" && "text-amber-300",
                      statusCopy.tone === "error" && "text-red-300",
                    )}
                  >
                    {statusCopy.detail}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenDetails() }} className="text-white/60 hover:bg-white/10">
                    <Eye className="w-4 h-4 mr-2" />
                    Detalhes
                  </Button>
                  {flight.document && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenDocument() }} className="text-white/60 hover:bg-white/10">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Original
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit() }} className="text-white/60 hover:bg-white/10">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void onDelete() }} className="text-red-300 hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </Button>
                  )}
                  {flight.qrCodePayload ? (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onViewQR() }} className="text-[#5de0e6] hover:bg-[#5de0e6]/10">
                      <QrCode className="w-4 h-4 mr-2" />
                      Ver QR Code
                    </Button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-center mt-3">
          <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform duration-300", expanded && "rotate-180")} />
        </div>
      </div>
    </motion.div>
  )
}

// Edit Flight Modal
function EditFlightModal({ open, onClose, flight, onSave }: { open: boolean; onClose: () => void; flight: any; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState(flight || {})

  useEffect(() => {
    if (flight) setFormData(flight)
  }, [flight])

  const handleSave = () => {
    onSave(formData)
    onClose()
  }

  if (!flight) return null

  return (
    <Modal open={open} onClose={onClose} title={`Editar passagem ${flight.flightNumber || ""}`.trim()}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Companhia</label>
            <input
              type="text"
              value={formData.airline || ""}
              onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Numero do Voo</label>
            <input
              type="text"
              value={formData.flightNumber || ""}
              onChange={(e) => setFormData({ ...formData, flightNumber: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Origem</label>
            <input
              type="text"
              value={formData.origin?.city || ""}
              onChange={(e) => setFormData({ ...formData, origin: { ...formData.origin, city: e.target.value, code: normalizeAirportCode(e.target.value) } })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Destino</label>
            <input
              type="text"
              value={formData.destination?.city || ""}
              onChange={(e) => setFormData({ ...formData, destination: { ...formData.destination, city: e.target.value, code: normalizeAirportCode(e.target.value) } })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Localizador</label>
            <input
              type="text"
              value={formData.bookingReference || ""}
              onChange={(e) => setFormData({ ...formData, bookingReference: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Passageiro</label>
            <input
              type="text"
              value={formData.passengerName || ""}
              onChange={(e) => setFormData({ ...formData, passengerName: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Terminal</label>
            <input
              type="text"
              value={formData.terminal || ""}
              onChange={(e) => setFormData({ ...formData, terminal: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Portao</label>
            <input
              type="text"
              value={formData.gate || ""}
              onChange={(e) => setFormData({ ...formData, gate: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Assento</label>
            <input
              type="text"
              value={formData.seat || ""}
              onChange={(e) => setFormData({ ...formData, seat: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Bagagem</label>
          <input
            type="text"
            value={formData.baggageInfo || ""}
            onChange={(e) => setFormData({ ...formData, baggageInfo: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <Button onClick={handleSave} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
          Salvar Alteracoes
        </Button>
      </div>
    </Modal>
  )
}

// QR Code Modal
function QRCodeModal({ open, onClose, flight }: { open: boolean; onClose: () => void; flight: any }) {
  if (!flight) return null

  return (
    <Modal open={open} onClose={onClose} title="QR Code da passagem">
      <div className="text-center">
        <div className="w-48 h-48 mx-auto mb-6 bg-white rounded-2xl p-4 flex items-center justify-center">
          {flight.qrCodePayload ? (
            <div className="w-full h-full flex items-center justify-center rounded-xl border border-black/10 bg-black/5 px-4 text-center text-xs text-black">
              {flight.qrCodePayload}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center rounded-xl border border-dashed border-black/20 px-4 text-center text-xs text-black/60">
              Nenhum QR code foi extraido desta passagem.
            </div>
          )}
        </div>
        <p className="text-white font-semibold text-lg">{flight.flightNumber}</p>
        <p className="text-white/60 text-sm mt-1">{flight.origin.code} → {flight.destination.code}</p>
        <p className="text-white/40 text-xs mt-4">{flight.qrCodePayload ? "Apresente este codigo no embarque" : "Quando o QR code estiver disponivel, ele aparecera aqui."}</p>
      </div>
    </Modal>
  )
}

function FlightDetailsModal({
  open,
  onClose,
  flight,
  onOpenDocument,
}: {
  open: boolean
  onClose: () => void
  flight: any
  onOpenDocument: (document: any) => Promise<void>
}) {
  if (!flight) return null

  const statusCopy = getFlightStatusCopy(flight)

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da passagem">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-wider text-white/40">Status</p>
          <p className="mt-2 text-sm text-white">{statusCopy.detail}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Companhia</p>
            <p className="mt-2 text-sm text-white">{flight.airline || "Nao informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Voo</p>
            <p className="mt-2 text-sm text-white">{flight.flightNumber || "Nao identificado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Localizador</p>
            <p className="mt-2 text-sm text-white">{flight.bookingReference || "Nao informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Passageiro</p>
            <p className="mt-2 text-sm text-white">{flight.passengerName || "Nao informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Origem</p>
            <p className="mt-2 text-sm text-white">{flight.origin.city}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Destino</p>
            <p className="mt-2 text-sm text-white">{flight.destination.city}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Saida</p>
            <p className="mt-2 text-sm text-white">{flight.date} • {flight.origin.time}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Chegada</p>
            <p className="mt-2 text-sm text-white">{flight.destination.time}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Terminal / Portao</p>
            <p className="mt-2 text-sm text-white">{flight.terminal || "-"} / {flight.gate || "-"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Assento / Bagagem</p>
            <p className="mt-2 text-sm text-white">{flight.seat || "-"} / {flight.baggageInfo || "-"}</p>
          </div>
        </div>

        {flight.document && (
          <Button variant="outline" className="w-full border-white/10 text-white/80" onClick={() => void onOpenDocument(flight.document)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Ver passagem original
          </Button>
        )}
      </div>
    </Modal>
  )
}

// Flights Section
function FlightsSection({
  tripData,
  loading,
  offlineReadOnly,
  offlineDocumentContext,
  onUpdateFlight,
  onAddFlight,
  onDeleteFlight,
  onDeleteDocument,
  tripId,
  ownerUserId,
  agencyId,
  routeSlug,
  tripAdminToken,
  adminLinkMutationMode,
  ensureSensitiveAccess,
}: {
  tripData: any
  loading: boolean
  offlineReadOnly: boolean
  offlineDocumentContext: OfflineDocumentContext | null
  onUpdateFlight: (id: string, data: any) => Promise<void>
  onAddFlight: (data: any) => void
  onDeleteFlight: (flightId: string) => Promise<void>
  onDeleteDocument: (documentId: string) => Promise<void>
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  routeSlug: string
  tripAdminToken: string | null
  adminLinkMutationMode: boolean
  ensureSensitiveAccess: () => boolean
}) {
  const [editingFlight, setEditingFlight] = useState<any>(null)
  const [viewingQR, setViewingQR] = useState<any>(null)
  const [selectedFlight, setSelectedFlight] = useState<any>(null)
  const [addingFlight, setAddingFlight] = useState(false)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()
  const flights = Array.isArray(tripData.flights) ? tripData.flights : []
  const ticketDocuments = Array.isArray(tripData.documents) ? tripData.documents.filter((document: any) => document.type === "ticket" && !flights.some((flight: any) => flight.document?.id === document.id)) : []

  const handleSaveFlight = async (data: any) => {
    await onUpdateFlight(data.id, data)
    showToast("Voo atualizado com sucesso!", "success")
  }

  const handleOpenTicketDocument = async (document: any) => {
    if (offlineReadOnly) {
      await openOfflineDocumentFromPackage({
        document,
        context: offlineDocumentContext,
        onUnavailable: (message) => showToast(message, "info"),
      })
      return
    }

    const resolvedUrl = document.fileUrl
      ? { data: document.fileUrl, error: null }
      : document.filePath
        ? await getSignedDocumentUrl(document.filePath)
        : { data: null, error: "Arquivo indisponivel para visualizacao." }

    if (resolvedUrl.error || !resolvedUrl.data) {
      showToast(resolvedUrl.error || "Nao foi possivel abrir o anexo.", "error")
      return
    }

    window.open(resolvedUrl.data, "_blank", "noopener,noreferrer")
  }

  return (
    <section id="flights" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Passagens</h2>
              <p className="text-sm text-white/40">{flights.length > 0 ? `${flights.length} voo(s) salvo(s)` : `${ticketDocuments.length} passagem(ns) anexada(s)`}</p>
            </div>
          </div>
          {canWrite && (
            <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingFlight(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Anexar
            </Button>
          )}
        </motion.div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse">
                <div className="h-4 w-28 rounded bg-white/10" />
                <div className="mt-3 h-3 w-40 rounded bg-white/5" />
                <div className="mt-6 h-10 rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : flights.length === 0 && ticketDocuments.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhuma passagem adicionada.
          </div>
        ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {flights.map((flight: any, i: number) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              index={i}
              onEdit={() => setEditingFlight(flight)}
              onViewQR={() => setViewingQR(flight)}
              onOpenDetails={() => setSelectedFlight(flight)}
              onOpenDocument={() => flight.document ? void handleOpenTicketDocument(flight.document) : undefined}
              onDelete={() => onDeleteFlight(flight.id)}
            />
          ))}
          {ticketDocuments.map((document: any) => (
            <div key={document.id} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-sm font-medium text-white">{document.name}</p>
              <p className="mt-2 text-xs text-white/40">Passagem anexada, extracao pendente</p>
              <p className="mt-1 text-xs text-white/30">{document.mimeType || "Nao informado"}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-white/10 text-white/70" onClick={() => void handleOpenTicketDocument(document)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver passagem original
                </Button>
                {canWrite ? (
                  <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => void onDeleteDocument(document.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <EditFlightModal open={!!editingFlight} onClose={() => setEditingFlight(null)} flight={editingFlight} onSave={(data) => void handleSaveFlight(data)} />
      <QRCodeModal open={!!viewingQR} onClose={() => setViewingQR(null)} flight={viewingQR} />
      <FlightDetailsModal open={!!selectedFlight} onClose={() => setSelectedFlight(null)} flight={selectedFlight} onOpenDocument={handleOpenTicketDocument} />
      <AddFlightModal
        open={addingFlight}
        onClose={() => setAddingFlight(false)}
        tripId={tripId}
        ownerUserId={ownerUserId}
        agencyId={agencyId}
        tripSlug={routeSlug}
        adminToken={tripAdminToken}
        adminProxyMode={adminLinkMutationMode}
        ensureSensitiveAccess={ensureSensitiveAccess}
        onSave={(data) => {
          onAddFlight(data)
          showToast("Passagem anexada. A analise automatica sera iniciada no backend.", "info")
          setAddingFlight(false)
        }}
      />
    </section>
  )
}

// Add Flight Modal
function AddFlightModal({ open, onClose, onSave, tripId, ownerUserId, agencyId, tripSlug, adminToken, adminProxyMode, ensureSensitiveAccess }: { open: boolean; onClose: () => void; onSave: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; tripSlug: string; adminToken: string | null; adminProxyMode: boolean; ensureSensitiveAccess: () => boolean }) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      return
    }

    setUploading(false)
    setError("")
    setFileName("")
  }, [open])

  const handleFileUpload = async (file?: File | null) => {
    if (!file) return
    if (!ensureSensitiveAccess()) {
      return
    }
    if (!ownerUserId && !adminProxyMode) {
      setError("Esta passagem exige autenticacao real para ser anexada no Supabase. Entre com login para continuar.")
      return
    }

    console.log("[TICKET] file selected", file.name)
    setError("")
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo invalido.")
      return
    }

    setUploading(true)

    const savedTicket = adminProxyMode
      ? await (async () => {
          const formData = new FormData()
          formData.set("action", "uploadTicket")
          formData.set("tripId", tripId)
          formData.set("tripSlug", tripSlug)
          if (adminToken) formData.set("adminToken", adminToken)
          formData.set("name", fileName.trim() || file.name.replace(/\.[^.]+$/, ""))
          formData.set("file", file)
          const response = await fetch("/api/trip-admin", { method: "POST", body: formData })
          const data = await response.json().catch(() => null)
          return {
            error: response.ok ? null : data?.error || "Nao foi possivel registrar a passagem anexada.",
            document: data?.document ?? null,
            flight: data?.flight ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/tickets/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: resolveProtectedWriteError(uploadResult.error || "Nao foi possivel anexar a passagem."), document: null, flight: null }
          }

          const metadataResult = await createDocumentMetadata({
            tripId,
            clientId: null,
            agencyId,
            ownerUserId,
            name: fileName.trim() || file.name.replace(/\.[^.]+$/, ""),
            type: "ticket",
            filePath: uploadResult.data.path,
            fileUrl: uploadResult.data.fileUrl,
            mimeType: file.type,
            size: file.size,
            isPrivate: false,
            visibility: "public_trip",
            aiExtractedData: {},
          })

          if (metadataResult.error || !metadataResult.data) {
            return { error: resolveProtectedWriteError(metadataResult.error || "Nao foi possivel registrar a passagem."), document: null, flight: null }
          }

          const flightResult = await upsertTripFlight({
            tripId,
            documentId: metadataResult.data.id,
            extractionStatus: "pending",
            extractedData: {},
          })

          if (flightResult.error || !flightResult.data) {
            return { error: resolveProtectedWriteError(flightResult.error || "Nao foi possivel registrar a passagem anexada."), document: null, flight: null }
          }

          return { error: null, document: metadataResult.data, flight: flightResult.data }
        })()

    if (savedTicket.error || !savedTicket.document || !savedTicket.flight) {
      console.error("[TICKET] upload error", savedTicket.error)
      setError(savedTicket.error || "Nao foi possivel registrar a passagem anexada.")
      setUploading(false)
      return
    }

    console.log("[TICKET] upload success", savedTicket.document.id)
    onSave({
      flight: mapFlightRecordToView(savedTicket.flight, [savedTicket.document]),
      document: savedTicket.document,
    })

    if (shouldUseSupabase()) {
      onSave({
        flight: mapFlightRecordToView(
          {
            ...savedTicket.flight,
            extractionStatus: "processing",
          },
          [savedTicket.document],
        ),
      })

      void requestTripFlightExtraction({
        tripId,
        documentId: savedTicket.document.id,
        flightId: savedTicket.flight.id,
        tripSlug,
        adminToken,
      })
        .then((processingResult) => {
          if (processingResult.error) {
            console.error("[TICKET] extraction error", processingResult.error)
          }

          const nextDocument = processingResult.data?.document ?? savedTicket.document
          const nextFlight = processingResult.data?.flight

          if (nextDocument) {
            onSave({ document: nextDocument })
          }

          if (nextFlight) {
            onSave({
              flight: mapFlightRecordToView(nextFlight, [nextDocument]),
            })
          }
        })
        .catch((processingError) => {
          console.error("[TICKET] extraction request failed", processingError)
        })
    }

    setUploading(false)
    setFileName("")
  }

  return (
    <Modal open={open} onClose={onClose} title="Anexar Passagem">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Nome do arquivo</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Ex: Embarque Nova York"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <label className="block p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-[#5de0e6]/30 transition-colors text-center cursor-pointer">
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando arquivo...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
              <p className="text-sm text-white/60">Clique para selecionar a passagem</p>
              <p className="text-xs text-white/30 mt-1">PDF, PNG, JPG ou JPEG ate 10MB</p>
            </>
          )}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => void handleFileUpload(e.target.files?.[0])} />
        </label>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="text-sm text-white/70">A passagem sera salva imediatamente e aparecera no link com o estado honesto: extracao pendente.</p>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </Modal>
  )
}

// Hotel Section
function HotelSection({
  tripData,
  loading,
  onSaveHotel,
  onDeleteHotel,
}: {
  tripData: any
  loading: boolean
  onSaveHotel: (data: any) => void
  onDeleteHotel: (hotelId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState<any>(null)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const hotels = Array.isArray(tripData.hotels) ? tripData.hotels : tripData.hotel ? [tripData.hotel] : []

  return (
    <section id="hotel" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Hospedagem</h2>
              <p className="text-sm text-white/40">{hotels.length > 0 ? `${hotels.length} hospedagem(ns) cadastrada(s)` : "Nenhuma hospedagem cadastrada"}</p>
            </div>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[#5de0e6] hover:bg-[#5de0e6]/10"
              onClick={() => {
                setSelectedHotel(null)
                setEditing(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </motion.div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse">
                <div className="h-5 w-40 rounded bg-white/10" />
                <div className="mt-4 h-24 rounded-2xl bg-white/5" />
              </div>
            ))}
          </div>
        ) : hotels.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhuma hospedagem adicionada.
          </motion.div>
        ) : (
          <div className="space-y-4">
            {hotels.map((hotel: any, index: number) => (
              <motion.div
                key={hotel.id || `${hotel.name}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative rounded-3xl overflow-hidden bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]"
              >
                <div className="relative h-48 sm:h-64">
                  <Image src={hotel.image || tripData.heroImage} alt={hotel.name} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-semibold text-white">{hotel.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-white/60">
                      <MapPin className="w-3 h-3" />
                      <span className="text-sm">{hotel.address || "Endereco nao informado"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 rounded-xl bg-white/[0.03]">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Check-in</p>
                      <p className="text-sm text-white font-medium mt-1">{hotel.checkIn || "Nao informado"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03]">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider">Check-out</p>
                      <p className="text-sm text-white font-medium mt-1">{hotel.checkOut || "Nao informado"}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <span className="text-sm text-white/40">{hotel.confirmationCode || "Reserva nao informada"}</span>
                    {canWrite && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#5de0e6] hover:bg-[#5de0e6]/10"
                          onClick={() => {
                            setSelectedHotel(hotel)
                            setEditing(true)
                          }}
                        >
                          <Edit3 className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-300 hover:bg-red-500/10"
                          onClick={() => void onDeleteHotel(hotel.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <EditHotelModal
        open={editing}
        onClose={() => setEditing(false)}
        hotel={selectedHotel ?? {}}
        onSave={(data) => {
          void onSaveHotel(data)
          setEditing(false)
        }}
      />
    </section>
  )
}

// Edit Hotel Modal
function EditHotelModal({ open, onClose, hotel, onSave }: { open: boolean; onClose: () => void; hotel: any; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState(hotel)

  useEffect(() => {
    setFormData(hotel || {})
  }, [hotel])

  return (
    <Modal open={open} onClose={onClose} title={formData?.id ? "Editar Hospedagem" : "Adicionar Hospedagem"}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Nome do Hotel</label>
          <input
            type="text"
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Endereco</label>
          <input
            type="text"
            value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Check-in</label>
            <input
              type="date"
              value={formData.checkIn || ""}
              onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Check-out</label>
            <input
              type="date"
              value={formData.checkOut || ""}
              onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Codigo da Reserva</label>
          <input
            type="text"
            value={formData.confirmationCode || ""}
            onChange={(e) => setFormData({ ...formData, confirmationCode: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Observacoes</label>
          <textarea
            value={formData.notes || ""}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full mt-1 min-h-24 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <Button onClick={() => onSave(formData)} disabled={!formData.name} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
          Salvar Alteracoes
        </Button>
      </div>
    </Modal>
  )
}

function UploadExistingItineraryModal({
  open,
  onClose,
  tripId,
  ownerUserId,
  agencyId,
  tripSlug,
  adminToken,
  adminProxyMode,
  ensureSensitiveAccess,
  onSave,
}: {
  open: boolean
  onClose: () => void
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  tripSlug: string
  adminToken: string | null
  adminProxyMode: boolean
  ensureSensitiveAccess: () => boolean
  onSave: (payload: { itinerary: TripItineraryRecord; document: any }) => void
}) {
  const [title, setTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) {
      setTitle("")
      setUploading(false)
      setError("")
    }
  }, [open])

  const handleUpload = async (file?: File | null) => {
    if (!file) return
    if (!ensureSensitiveAccess()) return
    if (!ownerUserId && !adminProxyMode) {
      setError("Este anexo exige autenticacao real para ser salvo no Supabase. Entre com login para continuar.")
      return
    }

    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo invalido.")
      return
    }

    setUploading(true)
    setError("")

    const savedUpload = adminProxyMode
      ? await (async () => {
          const formData = new FormData()
          formData.set("action", "uploadItineraryDocument")
          formData.set("tripId", tripId)
          formData.set("tripSlug", tripSlug)
          if (adminToken) formData.set("adminToken", adminToken)
          formData.set("title", title.trim() || file.name.replace(/\.[^.]+$/, ""))
          formData.set("file", file)
          const response = await fetch("/api/trip-admin", { method: "POST", body: formData })
          const data = await response.json().catch(() => null)
          return {
            error: response.ok ? null : data?.error || "Nao foi possivel registrar o roteiro anexado.",
            itinerary: data?.itinerary ?? null,
            document: data?.document ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/itineraries/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: uploadResult.error || "Nao foi possivel anexar o roteiro.", itinerary: null, document: null }
          }

          const metadataResult = await createDocumentMetadata({
            tripId,
            clientId: null,
            agencyId,
            ownerUserId,
            name: title.trim() || file.name.replace(/\.[^.]+$/, ""),
            type: "itinerary",
            filePath: uploadResult.data.path,
            fileUrl: uploadResult.data.fileUrl,
            mimeType: file.type,
            size: file.size,
            isPrivate: false,
            visibility: "public_trip",
            aiExtractedData: {
              source: "manual_itinerary_upload",
              ai_used: false,
            },
          })

          if (metadataResult.error || !metadataResult.data) {
            return { error: metadataResult.error || "Nao foi possivel registrar o roteiro anexado.", itinerary: null, document: null }
          }

          const itineraryResult = await upsertTripItinerary({
            tripId,
            documentId: metadataResult.data.id,
            title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
            mode: "uploaded",
            status: "uploaded",
            content: { days: [] },
            pdfUrl: metadataResult.data.filePath,
            createdBy: ownerUserId,
          })

          if (itineraryResult.error || !itineraryResult.data) {
            return { error: itineraryResult.error || "Nao foi possivel registrar o modo de roteiro anexado.", itinerary: null, document: null }
          }

          return { error: null, itinerary: itineraryResult.data, document: metadataResult.data }
        })()

    if (savedUpload.error || !savedUpload.itinerary || !savedUpload.document) {
      setError(savedUpload.error || "Nao foi possivel registrar o roteiro anexado.")
      setUploading(false)
      return
    }

    onSave({ itinerary: savedUpload.itinerary, document: savedUpload.document })
    setUploading(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Anexar roteiro existente">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Titulo do roteiro</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Roteiro completo de Paris"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <label className="block p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-[#5de0e6]/30 transition-colors text-center cursor-pointer">
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando roteiro...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
              <p className="text-sm text-white/60">Clique para selecionar PDF, imagem ou documento</p>
              <p className="text-xs text-white/30 mt-1">Sem leitura de IA e sem consumo de creditos</p>
            </>
          )}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="hidden" onChange={(event) => void handleUpload(event.target.files?.[0])} />
        </label>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </Modal>
  )
}

// Itinerary Section
function ItinerarySection({
  tripData,
  loading,
  offlineReadOnly,
  offlineDocumentContext,
  itineraryRecords,
  tripId,
  ownerUserId,
  agencyId,
  routeSlug,
  tripAdminToken,
  adminLinkMutationMode,
  ensureSensitiveAccess,
  onUpdateItinerary,
  onGenerateSimple,
  onGenerateComplete,
  onSaveUploadedItinerary,
  onDeleteItinerary,
}: {
  tripData: any
  loading: boolean
  offlineReadOnly: boolean
  offlineDocumentContext: OfflineDocumentContext | null
  itineraryRecords: TripItineraryRecord[]
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  routeSlug: string
  tripAdminToken: string | null
  adminLinkMutationMode: boolean
  ensureSensitiveAccess: () => boolean
  onUpdateItinerary: (data: any) => Promise<void> | void
  onGenerateSimple: () => Promise<void>
  onGenerateComplete: () => Promise<void>
  onSaveUploadedItinerary: (payload: { itinerary: TripItineraryRecord; document: any }) => void
  onDeleteItinerary: (record: TripItineraryRecord) => Promise<void>
}) {
  const [activeDay, setActiveDay] = useState(1)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<"simple" | "complete" | null>(null)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()
  const itinerary = Array.isArray(tripData.itinerary) ? tripData.itinerary : []
  const activeItinerary = itinerary.find((d: any) => d.day === activeDay)
  const simpleRecord = itineraryRecords.find((record) => record.mode === "simple" && (record.status === "completed" || record.status === "draft" || record.status === "generating")) ?? null
  const documentRecords = itineraryRecords.filter((record) => record.mode !== "simple")
  const hasGenerating = itineraryRecords.some((record) => record.status === "generating")
  const realPlannedDays = calculateTripDayCount(tripData?.startDate, tripData?.endDate)
  const plannedDaysLabel = simpleRecord
    ? `${realPlannedDays ?? itinerary.length} dia(s) planejado(s)`
    : documentRecords.length > 0
      ? `${documentRecords.length} roteiro(s) salvo(s)`
      : "Nenhum roteiro criado"
  const groupedActiveItems = activeItinerary
    ? [
        { key: "morning", label: "Manha", items: activeItinerary.items.filter((item: any) => item.period === "morning") },
        { key: "afternoon", label: "Tarde", items: activeItinerary.items.filter((item: any) => item.period === "afternoon") },
        { key: "evening", label: "Noite", items: activeItinerary.items.filter((item: any) => item.period === "evening") },
        { key: "flexible", label: "Flexivel", items: activeItinerary.items.filter((item: any) => !item.period || item.period === "flexible") },
      ].filter((group) => group.items.length > 0)
    : []

  useEffect(() => {
    if (!activeItinerary && itinerary[0]?.day) {
      setActiveDay(itinerary[0].day)
    }
  }, [activeItinerary, itinerary])

  const upsertItineraryDay = (dayNumber: number, updater: (currentItems: any[]) => any[]) => {
    const existingDay = itinerary.find((entry: any) => entry.day === dayNumber)
    const nextItems = updater(Array.isArray(existingDay?.items) ? existingDay.items : [])

    const nextDays = !existingDay
      ? [
          ...itinerary,
          {
            day: dayNumber,
            date: `Dia ${dayNumber}`,
            title: `Dia ${dayNumber}`,
            items: nextItems,
          },
        ]
      : itinerary.map((entry: any) =>
          entry.day === dayNumber
            ? {
                ...entry,
                items: nextItems,
              }
            : entry,
        )

    onUpdateItinerary(nextDays)
  }

  const handleGenerate = async (mode: "simple" | "complete") => {
    if (offlineReadOnly) {
      showToast("Indisponivel offline.", "info")
      return
    }
    if (!ensureSensitiveAccess()) return
    setBusyAction(mode)

    try {
      if (mode === "simple") {
        await onGenerateSimple()
      } else {
        await onGenerateComplete()
      }
    } finally {
      setBusyAction(null)
    }
  }

  const handleOpenItineraryDocument = async (record: TripItineraryRecord) => {
    const document = Array.isArray(tripData.documents) ? tripData.documents.find((entry: any) => entry.id === record.documentId) : null

    if (offlineReadOnly) {
      await openOfflineDocumentFromPackage({
        document,
        context: offlineDocumentContext,
        onUnavailable: (message) => showToast(message, "info"),
      })
      return
    }

    if (!document && !record.pdfUrl) {
      showToast("Documento do roteiro nao encontrado.", "error")
      return
    }

    const resolvedUrl = document?.fileUrl
      ? { data: document.fileUrl, error: null }
      : document?.filePath
        ? await getSignedDocumentUrl(document.filePath)
        : record.pdfUrl
          ? await getSignedDocumentUrl(record.pdfUrl)
          : { data: null, error: "Arquivo indisponivel para visualizacao." }

    if (resolvedUrl.error || !resolvedUrl.data) {
      showToast(resolvedUrl.error || "Nao foi possivel abrir o roteiro.", "error")
      return
    }

    window.open(resolvedUrl.data, "_blank", "noopener,noreferrer")
  }

  return (
    <section id="itinerary" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Roteiro</h2>
              <p className="text-sm text-white/40">
                {plannedDaysLabel}
              </p>
            </div>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => void handleGenerate("simple")} disabled={busyAction !== null}>
                <Sparkles className="w-4 h-4 mr-2" />
                {busyAction === "simple" ? "Gerando..." : "Criar roteiro simples"}
              </Button>
              <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10" onClick={() => void handleGenerate("complete")} disabled={busyAction !== null}>
                <FileText className="w-4 h-4 mr-2" />
                {busyAction === "complete" ? "Gerando PDF..." : "Criar roteiro completo em PDF"}
              </Button>
              <Button size="sm" variant="ghost" className="text-white/80 hover:bg-white/10" onClick={() => setUploadOpen(true)} disabled={busyAction !== null}>
                <Upload className="w-4 h-4 mr-2" />
                Anexar roteiro existente
              </Button>
              {simpleRecord?.status === "completed" ? (
                <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingItem(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Editar roteiro simples
                </Button>
              ) : null}
            </div>
          ) : null}
        </motion.div>

        {loading ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 animate-pulse">
              <div className="h-5 w-40 rounded bg-white/10" />
              <div className="mt-4 h-24 rounded-2xl bg-white/5" />
            </div>
          </div>
        ) : !simpleRecord && documentRecords.length === 0 && !hasGenerating ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhum roteiro criado.
          </div>
        ) : null}

        {hasGenerating ? (
          <div className="mb-6 rounded-3xl border border-[#5de0e6]/20 bg-[#5de0e6]/10 p-6 text-sm text-white/80">
            Gerando roteiro. Aguarde a finalizacao no backend para ver o resultado real.
          </div>
        ) : null}

        {simpleRecord?.status === "completed" && itinerary.length > 0 ? (
          <>
            <div className="mb-4 rounded-2xl border border-[#5de0e6]/20 bg-[#5de0e6]/10 p-4 text-sm text-white/80">
              Roteiro simples criado com IA e salvo para edicao no modo admin.
              {realPlannedDays ? ` Periodo real: ${realPlannedDays} dia(s).` : ""}
            </div>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {itinerary.map((day: any) => (
                <motion.button
                  key={day.day}
                  onClick={() => setActiveDay(day.day)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    "flex-shrink-0 px-4 py-3 rounded-xl border transition-all duration-300",
                    activeDay === day.day
                      ? "bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 border-[#5de0e6]/40 text-white"
                      : "bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-white/10",
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider opacity-60">Dia {day.day}</p>
                  <p className="text-sm font-medium mt-0.5">{day.date}</p>
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeItinerary ? (
                <motion.div
                  key={activeDay}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  <div className="mb-6 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-medium text-white">{activeItinerary.title}</h3>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {activeItinerary.items.length} atividade(s)
                      </span>
                    </div>
                    {activeItinerary.summary ? <p className="text-sm text-white/65">{activeItinerary.summary}</p> : null}
                    {(activeItinerary.tips || activeItinerary.important) ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeItinerary.tips ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#5de0e6]/80">Observacao util</p>
                            <p className="mt-2 text-sm text-white/70">{activeItinerary.tips}</p>
                          </div>
                        ) : null}
                        {activeItinerary.important ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#5de0e6]/80">Importante</p>
                            <p className="mt-2 text-sm text-white/70">{activeItinerary.important}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative pl-8">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-[#5de0e6]/50 via-[#004aad]/30 to-transparent" />

                    <div className="space-y-8">
                      {groupedActiveItems.map((group) => (
                        <div key={group.key} className="space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="h-px flex-1 bg-white/10" />
                            <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">{group.label}</p>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="space-y-6">
                            {group.items.map((item: any, i: number) => {
                        const IconComponent = iconMap[item.icon] || MapPin
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="relative group"
                          >
                            <div className={cn("absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center", item.highlight ? "bg-gradient-to-br from-[#5de0e6] to-[#004aad]" : "bg-white/10 border border-white/20")}>
                              <IconComponent className={cn("w-3 h-3", item.highlight ? "text-white" : "text-white/60")} />
                            </div>

                            <div
                              onClick={() => canWrite && setEditingItem(item)}
                              className={cn(
                                "p-4 rounded-xl transition-all duration-300",
                                item.highlight ? "bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20" : "bg-white/[0.02] border border-white/[0.06] hover:border-white/10",
                                canWrite && "cursor-pointer",
                              )}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs text-[#5de0e6] font-medium">{item.time}</p>
                                  <p className="text-white font-medium mt-1">{item.title}</p>
                                  {item.location ? <p className="mt-2 text-sm text-white/50">{item.location}</p> : null}
                                  {item.description ? <p className="mt-2 text-sm text-white/60">{item.description}</p> : null}
                                </div>
                                {canWrite ? <Edit3 className="w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
                              </div>
                            </div>
                          </motion.div>
                        )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}

        {documentRecords.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {documentRecords.map((record) => (
              <div key={record.id} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{record.title}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {record.mode === "complete_pdf" ? "PDF completo gerado com IA" : "Roteiro anexado manualmente"}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-wider text-white/50">
                    {record.status === "completed"
                      ? "Concluido"
                      : record.status === "uploaded"
                        ? "Anexado"
                        : record.status === "failed"
                          ? "Falhou"
                          : record.status === "generating"
                            ? "Gerando"
                            : record.status}
                  </span>
                </div>
                {record.status === "failed" ? (
                  <p className="mt-3 text-sm text-red-300">Falha honesta na geracao. Este roteiro nao possui arquivo valido para abrir.</p>
                ) : null}
                {record.status === "generating" ? (
                  <p className="mt-3 text-sm text-white/55">Gerando roteiro e vinculando arquivo real no backend...</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {record.documentId ? (
                    <Button size="sm" variant="outline" className="border-white/10 text-white/80" onClick={() => void handleOpenItineraryDocument(record)}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Abrir
                    </Button>
                  ) : null}
                  {canWrite ? (
                    <Button size="sm" variant="ghost" className="text-red-300 hover:bg-red-500/10" onClick={() => void onDeleteItinerary(record)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <EditItineraryItemModal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSave={(data) => {
          upsertItineraryDay(activeDay, (items) => items.map((item: any) => (item.id === editingItem.id ? { ...item, ...data } : item)))
          showToast("Atividade atualizada!", "success")
          setEditingItem(null)
        }}
        onDelete={() => {
          upsertItineraryDay(activeDay, (items) => items.filter((item: any) => item.id !== editingItem.id))
          showToast("Atividade removida!", "success")
          setEditingItem(null)
        }}
      />
      <AddItineraryItemModal
        open={addingItem}
        onClose={() => setAddingItem(false)}
        day={activeDay}
        onSave={(data) => {
          upsertItineraryDay(activeDay, (items) => [
            ...items,
            {
              id: `manual-item-${Date.now()}`,
              icon: data.type === "food" ? "UtensilsCrossed" : data.type === "transport" ? "Car" : "MapPin",
              ...data,
            },
          ])
          showToast("Atividade adicionada!", "success")
          setAddingItem(false)
        }}
      />
      <UploadExistingItineraryModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        tripId={tripId}
        ownerUserId={ownerUserId}
        agencyId={agencyId}
        tripSlug={routeSlug}
        adminToken={tripAdminToken}
        adminProxyMode={adminLinkMutationMode}
        ensureSensitiveAccess={ensureSensitiveAccess}
        onSave={onSaveUploadedItinerary}
      />
    </section>
  )
}

// Edit Itinerary Item Modal
function EditItineraryItemModal({ open, onClose, item, onSave, onDelete }: { open: boolean; onClose: () => void; item: any; onSave: (data: any) => void; onDelete: () => void }) {
  const [formData, setFormData] = useState(item || {})

  useEffect(() => {
    if (item) setFormData(item)
  }, [item])

  if (!item) return null

  return (
    <Modal open={open} onClose={onClose} title="Editar Atividade">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Titulo</label>
          <input
            type="text"
            value={formData.title || ""}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Horario</label>
          <input
            type="text"
            value={formData.time || ""}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Tipo</label>
  <select
  value={formData.type || "attraction"}
  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
  className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
  >
  <option value="attraction" className="bg-[#0a0a0a] text-white">Atracao</option>
  <option value="food" className="bg-[#0a0a0a] text-white">Alimentacao</option>
  <option value="transport" className="bg-[#0a0a0a] text-white">Transporte</option>
  <option value="hotel" className="bg-[#0a0a0a] text-white">Hospedagem</option>
  <option value="experience" className="bg-[#0a0a0a] text-white">Experiencia</option>
  <option value="flight" className="bg-[#0a0a0a] text-white">Voo</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Periodo</label>
          <select
            value={formData.period || "flexible"}
            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="morning" className="bg-[#0a0a0a] text-white">Manha</option>
            <option value="afternoon" className="bg-[#0a0a0a] text-white">Tarde</option>
            <option value="evening" className="bg-[#0a0a0a] text-white">Noite</option>
            <option value="flexible" className="bg-[#0a0a0a] text-white">Flexivel</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="highlight"
            checked={formData.highlight || false}
            onChange={(e) => setFormData({ ...formData, highlight: e.target.checked })}
            className="w-4 h-4 rounded bg-white/10 border-white/20"
          />
          <label htmlFor="highlight" className="text-sm text-white/70">Destaque do dia</label>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => onSave(formData)} className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
            Salvar
          </Button>
          <Button onClick={onDelete} variant="ghost" className="text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Add Itinerary Item Modal
function AddItineraryItemModal({ open, onClose, day, onSave }: { open: boolean; onClose: () => void; day: number; onSave: (data: any) => void }) {
  const [formData, setFormData] = useState({ title: "", time: "", type: "attraction", period: "flexible", highlight: false })

  return (
    <Modal open={open} onClose={onClose} title="Adicionar ao Roteiro">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#5de0e6]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Dia {day}</p>
            <p className="text-xs text-white/40">Adicione atividades manualmente ou complemente o roteiro simples gerado por IA.</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Titulo</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Passeio pela cidade"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Horario</label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Tipo</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="attraction" className="bg-[#0a0a0a] text-white">Atracao</option>
            <option value="food" className="bg-[#0a0a0a] text-white">Alimentacao</option>
            <option value="transport" className="bg-[#0a0a0a] text-white">Transporte</option>
            <option value="hotel" className="bg-[#0a0a0a] text-white">Hospedagem</option>
            <option value="experience" className="bg-[#0a0a0a] text-white">Experiencia</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Periodo</label>
          <select
            value={formData.period}
            onChange={(e) => setFormData({ ...formData, period: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="morning" className="bg-[#0a0a0a] text-white">Manha</option>
            <option value="afternoon" className="bg-[#0a0a0a] text-white">Tarde</option>
            <option value="evening" className="bg-[#0a0a0a] text-white">Noite</option>
            <option value="flexible" className="bg-[#0a0a0a] text-white">Flexivel</option>
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.highlight}
            onChange={(e) => setFormData({ ...formData, highlight: e.target.checked })}
            className="sr-only"
          />
          <div className={cn(
            "w-10 h-6 rounded-full transition-colors relative",
            formData.highlight ? "bg-gradient-to-r from-[#5de0e6] to-[#004aad]" : "bg-white/10"
          )}>
            <div className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
              formData.highlight ? "translate-x-5" : "translate-x-1"
            )} />
          </div>
          <span className="text-sm text-white">Destacar como atividade principal</span>
        </label>

        <div className="flex gap-3">
          <Button onClick={onClose} variant="ghost" className="flex-1 bg-white/[0.03] text-white hover:bg-white/[0.06]">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(formData)
              onClose()
            }}
            disabled={!formData.title || !formData.time}
            className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0"
          >
            Adicionar Atividade
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Documents Section
function DocumentsSection({
  tripData,
  loading,
  offlineReadOnly,
  offlineDocumentContext,
  onAddDocument,
  onDeleteDocument,
  tripId,
  ownerUserId,
  agencyId,
  routeSlug,
  tripAdminToken,
  adminLinkMutationMode,
  ensureSensitiveAccess,
}: {
  tripData: any
  loading: boolean
  offlineReadOnly: boolean
  offlineDocumentContext: OfflineDocumentContext | null
  onAddDocument: (data: any) => void
  onDeleteDocument: (documentId: string) => Promise<void>
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  routeSlug: string
  tripAdminToken: string | null
  adminLinkMutationMode: boolean
  ensureSensitiveAccess: () => boolean
}) {
  const [showPrivate, setShowPrivate] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [addingDoc, setAddingDoc] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<any>(null)
  const [pinModal, setPinModal] = useState(false)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()

  const documents = Array.isArray(tripData.documents) ? tripData.documents : []
  const isPrivateDocument = (document: any) =>
    document?.private === true || document?.isPrivate === true || document?.visibility === "private"

  const publicDocs = documents.filter((d: any) => !isPrivateDocument(d))
  const privateDocs = documents.filter((d: any) => isPrivateDocument(d))

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return

    const isMobileViewport = typeof window !== "undefined" ? window.innerWidth < 768 : false
    logTripDocumentsDev("section_render", {
      tripId: tripData?.id ?? null,
      isMobileViewport,
      isAdmin,
      loading,
      counts: getDocumentDebugCounts(documents),
      rendered: true,
    })
  }, [documents, isAdmin, loading, tripData?.id])

  const getDocIcon = (type: string) => {
    switch (type) {
      case "passport": return "🛂"
      case "visa": return "📋"
      case "insurance": return "🛡️"
      case "voucher": return "🎫"
      case "ticket": return "🎟️"
      default: return "📄"
    }
  }

  const handleUnlock = () => {
    setPinModal(true)
  }

  return (
    <section id="documents" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Documentos</h2>
              <p className="text-sm text-white/40">{documents.length} arquivos</p>
            </div>
          </div>
          {canWrite && (
            <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingDoc(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 animate-pulse">
                <div className="h-8 w-8 rounded bg-white/10" />
                <div className="mt-3 h-4 rounded bg-white/10" />
                <div className="mt-2 h-3 w-20 rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            {isAdmin ? "Nenhum documento adicionado." : "Nenhum documento publico adicionado."}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {publicDocs.map((doc: any, i: number) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewingDoc(doc)}
              className="cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#5de0e6]/30 transition-all duration-300 text-left min-h-[112px]"
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setViewingDoc(doc)
                }
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-2xl">{getDocIcon(doc.type)}</span>
                {canWrite ? (
                  <button
                    type="button"
                    className="rounded-lg p-1 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                    onClick={(event) => {
                      event.stopPropagation()
                      void onDeleteDocument(doc.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <p className="text-sm text-white font-medium mt-2 break-words">{doc.name}</p>
              <p className="text-xs text-white/40 mt-1">Compartilhavel</p>
            </motion.div>
          ))}
        </div>
        )}

        {isAdmin && privateDocs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#004aad]/30 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[#5de0e6]" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Documentos Privados</p>
                  <p className="text-xs text-white/40">{privateDocs.length} arquivos protegidos</p>
                </div>
              </div>
              
              {!unlocked ? (
                <Button size="sm" onClick={handleUnlock} className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
                  <Fingerprint className="w-4 h-4 mr-2" />
                  Desbloquear
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setUnlocked(false)} className="text-white/60">
                  <Lock className="w-4 h-4 mr-2" />
                  Bloquear
                </Button>
              )}
            </div>

            <AnimatePresence>
              {unlocked && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
                    {privateDocs.map((doc: any, i: number) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setViewingDoc(doc)}
                        className="cursor-pointer p-3 rounded-xl bg-[#004aad]/10 border border-[#004aad]/30 hover:border-[#5de0e6]/50 transition-all duration-300 text-left min-h-[104px]"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setViewingDoc(doc)
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getDocIcon(doc.type)}</span>
                            <Shield className="w-3 h-3 text-[#5de0e6]" />
                          </div>
                          {canWrite ? (
                          <button
                            type="button"
                            className="rounded-lg p-1 text-white/40 hover:bg-red-500/10 hover:text-red-300"
                            onClick={(event) => {
                              event.stopPropagation()
                              void onDeleteDocument(doc.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          ) : null}
                        </div>
                        <p className="text-sm text-white font-medium mt-2 break-words">{doc.name}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!unlocked && <p className="text-xs text-white/30 text-center mt-3">Use PIN ou biometria para acessar documentos privados</p>}
          </motion.div>
        )}

        <div className="mt-4 flex items-center gap-2 text-white/30">
          <Shield className="w-4 h-4" />
          <p className="text-xs">Documentos privados nao aparecem no link compartilhavel</p>
        </div>
      </div>

      <PinModal
        open={pinModal}
        onClose={() => setPinModal(false)}
        tripId={tripId}
        onSuccess={() => {
          setUnlocked(true)
          setPinModal(false)
          showToast("Documentos desbloqueados!", "success")
        }}
      />
      <ViewDocumentModal open={!!viewingDoc} onClose={() => setViewingDoc(null)} document={viewingDoc} offlineReadOnly={offlineReadOnly} offlineDocumentContext={offlineDocumentContext} />
      <AddDocumentModal open={addingDoc} onClose={() => setAddingDoc(false)} tripId={tripId} ownerUserId={ownerUserId} agencyId={agencyId} tripSlug={routeSlug} adminToken={tripAdminToken} adminProxyMode={adminLinkMutationMode} ensureSensitiveAccess={ensureSensitiveAccess} onSave={(data) => { onAddDocument(data); showToast("Documento adicionado!", "success"); setAddingDoc(false) }} />
    </section>
  )
}

// PIN Modal
function PinModal({
  open,
  onClose,
  onSuccess,
  tripId,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tripId: string
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAccessMethods = getTripLinkQuickAccessMethods(tripId)

  useEffect(() => {
    if (!open) {
      setPin("")
      setConfirmPin("")
      setError("")
      setIsSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (pin.length !== 4) return

    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await verifyTripLinkPin(tripId, pin)
      if (!isValid) {
        setError("PIN invalido")
        return
      }

      onSuccess()
      setPin("")
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Acesso rapido nao configurado neste dispositivo"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePin = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) return
    if (pin !== confirmPin) {
      setError("Os PINs nao conferem.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await saveTripLinkPin(tripId, pin)
      onSuccess()
      setPin("")
      setConfirmPin("")
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Nao foi possivel configurar o PIN neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBiometricUnlock = async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await authenticateTripLinkBiometric(tripId)
      if (!isValid) {
        setError("Nao foi possivel validar a biometria neste dispositivo.")
        return
      }

      onSuccess()
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Biometria indisponivel neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Desbloquear Documentos">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center">
          <Fingerprint className="w-8 h-8 text-[#5de0e6]" />
        </div>
        <p className="text-white/60 text-sm mb-6">
          {quickAccessMethods.pinEnabled
            ? "Use PIN ou biometria deste dispositivo para acessar os documentos protegidos."
            : "Crie um PIN neste dispositivo para proteger acoes sensiveis desta viagem."}
        </p>
        <input
          type="tel"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-center text-xl tracking-[1em] focus:outline-none focus:border-[#5de0e6]/50"
          placeholder={quickAccessMethods.pinEnabled ? "Digite seu PIN" : "Crie um PIN"}
        />
        {!quickAccessMethods.pinEnabled ? (
          <input
            type="tel"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="mt-3 w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-center text-xl tracking-[1em] focus:outline-none focus:border-[#5de0e6]/50"
            placeholder="Confirme o PIN"
          />
        ) : null}
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        <Button
          onClick={() => void (quickAccessMethods.pinEnabled ? handleSubmit() : handleCreatePin())}
          disabled={isSubmitting || pin.length !== 4 || (!quickAccessMethods.pinEnabled && confirmPin.length !== 4)}
          className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50"
        >
          {quickAccessMethods.pinEnabled ? "Desbloquear" : "Criar PIN neste dispositivo"}
        </Button>
        {quickAccessMethods.biometricEnabled && (
          <Button
            variant="outline"
            onClick={() => void handleBiometricUnlock()}
            disabled={isSubmitting}
            className="w-full mt-3 border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Usar Face ID / biometria
          </Button>
        )}
        <p className="text-xs text-white/30 mt-4">O PIN deste link pertence apenas a este dispositivo e nao e compartilhado com o portal ou com outros aparelhos.</p>
      </div>
    </Modal>
  )
}

// View Document Modal
function ViewDocumentModal({
  open,
  onClose,
  document,
  offlineReadOnly = false,
  offlineDocumentContext = null,
}: {
  open: boolean
  onClose: () => void
  document: any
  offlineReadOnly?: boolean
  offlineDocumentContext?: OfflineDocumentContext | null
}) {
  const [offlineMessage, setOfflineMessage] = useState("")
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (open) {
      setOfflineMessage("")
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setOfflineMessage("")
  }, [open])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  if (!document) return null

  const openDocumentOnDevice = async () => {
    setOfflineMessage("")

    if (offlineReadOnly) {
      await openOfflineDocumentFromPackage({
        document,
        context: offlineDocumentContext,
        onUnavailable: (message) => setOfflineMessage(message),
        registerCleanup: (objectUrl) => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
          }
          objectUrlRef.current = objectUrl
        },
      })
      return
    }

    const pendingWindow = typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null
    const urlResult = document.filePath ? await getSignedDocumentUrl(document.filePath) : { data: document.fileUrl, error: null }

    if (!urlResult.data) {
      pendingWindow?.close()
      return
    }

    if (pendingWindow) {
      pendingWindow.location.href = urlResult.data
      return
    }

    window.location.href = urlResult.data
  }

  const getDocIcon = (type: string) => {
    switch (type) {
      case "passport": return "🛂"
      case "visa": return "📋"
      case "insurance": return "🛡️"
      case "voucher": return "🎫"
      case "ticket": return "🎟️"
      default: return "📄"
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={document.name}>
      <div className="text-center py-8">
        <span className="text-6xl">{getDocIcon(document.type)}</span>
        <p className="text-white font-medium mt-4">{document.name}</p>
        <p className="text-white/40 text-sm mt-2">{document.private ? "Documento Privado" : "Documento Compartilhavel"}</p>
        
        <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-white/40">Preview do documento</p>
          <div className="mt-4 h-48 bg-white/[0.02] rounded-xl flex items-center justify-center">
            <p className="text-white/20 text-sm">
              {offlineReadOnly
                ? offlineDocumentContext?.packageStatus === "legacy_snapshot"
                  ? "Arquivos nao sao garantidos neste snapshot salvo."
                  : offlineMessage || "Arquivo salvo localmente quando disponivel."
                : "Visualizacao do PDF/Imagem"}
            </p>
          </div>
        </div>

        {offlineReadOnly && offlineMessage ? <p className="mt-3 text-sm text-amber-200">{offlineMessage}</p> : null}

        <div className="flex gap-3 mt-6">
          <Button className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50" onClick={() => void openDocumentOnDevice()}>
            <Download className="w-4 h-4 mr-2" />
            {offlineReadOnly ? "Abrir offline" : "Baixar"}
          </Button>
          <Button variant="ghost" className="text-white/60 hover:bg-white/10">
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Add Document Modal
function AddDocumentModal({ open, onClose, onSave, tripId, ownerUserId, agencyId, tripSlug, adminToken, adminProxyMode, ensureSensitiveAccess }: { open: boolean; onClose: () => void; onSave: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; tripSlug: string; adminToken: string | null; adminProxyMode: boolean; ensureSensitiveAccess: () => boolean }) {
  const [formData, setFormData] = useState({ name: "", type: "voucher", private: false })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setError("")
      return
    }

    setUploading(false)
    setError("")
  }, [open])

  const handleUpload = async (file?: File | null) => {
    if (!file) return
    if (!ensureSensitiveAccess()) {
      return
    }
    if (!ownerUserId && !adminProxyMode) {
      setError("Este documento exige autenticacao real para ser anexado no Supabase. Entre com login para continuar.")
      return
    }
    console.log("[DOCUMENT] file selected", file.name)
    setError("")
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo invalido.")
      return
    }

    setUploading(true)
    const savedDocument = adminProxyMode
      ? await (async () => {
          const uploadForm = new FormData()
          uploadForm.set("action", "uploadDocument")
          uploadForm.set("tripId", tripId)
          uploadForm.set("tripSlug", tripSlug)
          if (adminToken) uploadForm.set("adminToken", adminToken)
          uploadForm.set("name", formData.name.trim() || file.name.replace(/\.[^.]+$/, ""))
          uploadForm.set("type", formData.type)
          uploadForm.set("isPrivate", String(formData.private))
          uploadForm.set("visibility", formData.private ? "private" : "public_trip")
          uploadForm.set("file", file)
          const response = await fetch("/api/trip-admin", { method: "POST", body: uploadForm })
          const data = await response.json().catch(() => null)
          return {
            error: response.ok ? null : data?.error || "Nao foi possivel registrar o documento.",
            document: data?.document ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/documents/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: resolveProtectedWriteError(uploadResult.error || "Nao foi possivel anexar o documento."), document: null }
          }

          const metadataResult = await createDocumentMetadata({
            tripId,
            clientId: null,
            agencyId,
            ownerUserId,
            name: formData.name.trim() || file.name.replace(/\.[^.]+$/, ""),
            type: formData.type,
            filePath: uploadResult.data.path,
            fileUrl: uploadResult.data.fileUrl,
            mimeType: file.type,
            size: file.size,
            isPrivate: formData.private,
            visibility: formData.private ? "private" : "public_trip",
            aiExtractedData: {},
          })

          return {
            error: metadataResult.error ? resolveProtectedWriteError(metadataResult.error || "Nao foi possivel registrar o documento.") : null,
            document: metadataResult.data ?? null,
          }
        })()

    if (savedDocument.error || !savedDocument.document) {
      console.error("[DOCUMENT] upload error", savedDocument.error)
      setError(savedDocument.error || "Nao foi possivel registrar o documento.")
      setUploading(false)
      return
    }

    console.log("[DOCUMENT] upload success", savedDocument.document.id)
    setUploading(false)
    onSave(savedDocument.document)
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Documento">
      <div className="space-y-4">
        <label className="block p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-[#5de0e6]/30 transition-colors text-center cursor-pointer">
          <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
          <p className="text-sm text-white/60">Clique para selecionar um arquivo</p>
          <p className="text-xs text-white/30 mt-1">PDF, PNG, JPG ate 10MB</p>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => void handleUpload(e.target.files?.[0])} />
        </label>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Nome do documento</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Reserva do restaurante"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Tipo</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50 appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='rgba(255,255,255,0.4)'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}
          >
            <option value="voucher" className="bg-[#0a0a0a] text-white">Voucher</option>
            <option value="ticket" className="bg-[#0a0a0a] text-white">Ingresso</option>
            <option value="insurance" className="bg-[#0a0a0a] text-white">Seguro</option>
            <option value="passport" className="bg-[#0a0a0a] text-white">Passaporte</option>
            <option value="visa" className="bg-[#0a0a0a] text-white">Visto</option>
            <option value="other" className="bg-[#0a0a0a] text-white">Outro</option>
          </select>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <input
            type="checkbox"
            id="private"
            checked={formData.private}
            onChange={(e) => setFormData({ ...formData, private: e.target.checked })}
            className="w-4 h-4 rounded bg-white/10 border-white/20"
          />
          <div>
            <label htmlFor="private" className="text-sm text-white font-medium">Documento privado</label>
            <p className="text-xs text-white/40">Nao aparece no link compartilhavel</p>
          </div>
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}

        <Button onClick={handleUpload} disabled={uploading || !formData.name} className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Enviando...
            </div>
          ) : (
            "Adicionar Documento"
          )}
        </Button>
      </div>
    </Modal>
  )
}

// Concierge Section
function ConciergeSection({ tripData, onOpenCredits, offlineReadOnly = false }: { tripData: any; onOpenCredits: () => void; offlineReadOnly?: boolean }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Ola! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informacoes reais que ja estejam adicionadas.` }
  ])
  const [typing, setTyping] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const hasFlights = Array.isArray(tripData.flights) && tripData.flights.length > 0
  const hasHotel = Boolean(tripData.hotel)
  const hasItinerary = Array.isArray(tripData.itinerary) && tripData.itinerary.length > 0

  useEffect(() => {
    setMessages([
      { role: "assistant", content: `Ola! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informacoes reais que ja estejam adicionadas.` }
    ])
    setConversationId(null)
  }, [tripData.destination])

  useEffect(() => {
    if (offlineReadOnly) return
    if (!shouldUseSupabase() || !tripData?.id) return
    if (!isAdmin && !user?.id) return

    let active = true

    const loadConversation = async () => {
      const conversationsResult = await listConversationsByTrip(tripData.id)
      if (!active || !(conversationsResult.data ?? []).length) return

      const conciergeConversation =
        conversationsResult.data.find((conversation) => conversation.channel === "concierge") ??
        conversationsResult.data[0]

      if (!conciergeConversation) return

      const messagesResult = await listMessages(conciergeConversation.id)
      if (!active) return

      setConversationId(conciergeConversation.id)

      if ((messagesResult.data ?? []).length === 0) return

      setMessages(
        (messagesResult.data ?? []).map((entry) => ({
          role: entry.role === "user" ? "user" : "assistant",
          content: entry.content,
        }))
      )
    }

    void loadConversation()

    return () => {
      active = false
    }
  }, [isAdmin, tripData?.id, user?.id, offlineReadOnly])

  const suggestions = [
    "Mostrar hospedagem",
    "Mostrar roteiro",
    "Mostrar passagens",
    "Mostrar documentos"
  ]

  const buildResponse = (userMessage: string) => {
    let response = "Ainda nao encontrei dados reais suficientes nessa viagem para responder com precisao."

    if (userMessage.includes("hosped")) {
      response = hasHotel
        ? `Sua hospedagem atual e ${tripData.hotel.name}. Check-in: ${tripData.hotel.checkIn}. Check-out: ${tripData.hotel.checkOut}.`
        : "Ainda nao ha hospedagem real adicionada."
    } else if (userMessage.includes("roteiro")) {
      response = hasItinerary
        ? `Seu roteiro possui ${tripData.itinerary.length} dias planejados. Abra a secao de roteiro para ver os detalhes reais.`
        : "Ainda nao ha roteiro real criado."
    } else if (userMessage.includes("passag")) {
      response = hasFlights
        ? `Sua viagem possui ${tripData.flights.length} passagem(ns) adicionada(s).`
        : "Ainda nao ha passagens reais adicionadas."
    } else if (userMessage.includes("document")) {
      response = Array.isArray(tripData.documents) && tripData.documents.length > 0
        ? `Sua viagem possui ${tripData.documents.length} documento(s) real(is) cadastrado(s).`
        : "Ainda nao ha documentos reais adicionados."
    }

    return response
  }

  const requestRealConciergeReply = async (userMessage: string) => {
    const response = await fetch("/api/ai/concierge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripId: tripData?.id,
        conversationId,
        message: userMessage,
        origin: isAdmin ? "trip-admin-link" : "trip-public-link",
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false as const,
        error: data?.error || "Nao foi possivel obter uma resposta real do concierge desta viagem.",
      }
    }

    return {
      ok: true as const,
      conversationId: data?.conversationId ?? null,
      assistantMessage: data?.assistantMessage ?? "",
      warning: data?.warning ?? null,
    }
  }

  const handleSend = async () => {
    if (offlineReadOnly) {
      showToast("Indisponivel offline.", "info")
      return
    }
    if (!message.trim()) return

    const userMessage = message
    const normalizedUserMessage = userMessage.toLowerCase()
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setMessage("")
    setTyping(true)

    window.setTimeout(async () => {
      if (shouldUseSupabase() && tripData?.id) {
        const result = await requestRealConciergeReply(userMessage)

        if (!result.ok) {
          console.error("[CONCIERGE] real response error", result.error)
          showToast(result.error, "info")
          setTyping(false)
          return
        }

        if (result.conversationId) {
          setConversationId(result.conversationId)
        }

        if (result.warning) {
          showToast(result.warning, "info")
        }

        setMessages((prev) => [...prev, { role: "assistant", content: result.assistantMessage }])
        setTyping(false)
        return
      }

      const response = buildResponse(normalizedUserMessage)
      setMessages((prev) => [...prev, { role: "assistant", content: response }])
      setTyping(false)
    }, 1500)
  }

  return (
    <section id="concierge" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Concierge IA</h2>
            <p className="text-sm text-white/40">Tire duvidas sobre sua viagem</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] overflow-hidden">
          {offlineReadOnly ? (
            <div className="border-b border-white/[0.06] bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Indisponivel offline.
            </div>
          ) : null}
          <div className="h-80 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] p-3 rounded-2xl", msg.role === "user" ? "bg-gradient-to-br from-[#5de0e6] to-[#004aad] text-white" : "bg-white/[0.05] text-white/90")}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-[#5de0e6]" />
                      <span className="text-[10px] text-[#5de0e6] font-medium">Concierge</span>
                    </div>
                  )}
                  <p className="text-sm">{msg.content}</p>
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/[0.05] p-3 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-[#5de0e6]" />
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-[#5de0e6]/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-[#5de0e6]/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-[#5de0e6]/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/[0.06]">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => setMessage(s)} className="flex-shrink-0 px-3 py-1.5 text-xs text-white/60 bg-white/[0.05] hover:bg-white/10 rounded-full transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Pergunte sobre sua viagem..."
                disabled={offlineReadOnly}
                className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50 transition-colors"
              />
              <Button onClick={handleSend} disabled={offlineReadOnly} className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="px-4 py-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-xs text-white/40">{tripData.credits.balance} creditos restantes</span>
            </div>
            <Button size="sm" variant="ghost" onClick={onOpenCredits} className="text-[#5de0e6] text-xs">
              Comprar mais
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// Sharing Modal
function ShareModal({ open, onClose, tripData }: { open: boolean; onClose: () => void; tripData: any }) {
  const [copied, setCopied] = useState<string | null>(null)
  const { showToast } = useToast()
  const { isAdmin } = useContext(PermissionContext)

  const handleCopy = (type: string, link: string) => {
    navigator.clipboard.writeText(link)
    setCopied(type)
    showToast("Link copiado!", "success")
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="Compartilhar Viagem">
      <div className="space-y-4">
        {isAdmin && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-sm font-medium text-white">Link Administrador</span>
            </div>
            <p className="text-xs text-white/40 mb-3">Acesso completo a todos os documentos</p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-black/30">
              <code className="flex-1 text-xs text-white/60 truncate">{tripData.adminLink}</code>
              <Button size="sm" variant="ghost" onClick={() => handleCopy("admin", tripData.adminLink)} className="text-[#5de0e6]">
                {copied === "admin" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-white/60" />
            <span className="text-sm font-medium text-white">Link Compartilhavel</span>
          </div>
          <p className="text-xs text-white/40 mb-3">Sem documentos privados</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03]">
            <code className="flex-1 text-xs text-white/60 truncate">{tripData.shareLink}</code>
            <Button size="sm" variant="ghost" onClick={() => handleCopy("public", tripData.shareLink)} className="text-white/60">
              {copied === "public" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <p className="text-sm text-white font-medium mb-2">Compartilhar via</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                const shareText = encodeURIComponent(`Acompanhe a viagem: ${tripData.shareLink}`)
                window.open(`https://wa.me/?text=${shareText}`, "_blank", "noopener,noreferrer")
              }}
              className="flex-1 p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-colors"
            >
              WhatsApp
            </button>
            <button
              onClick={() => {
                const subject = encodeURIComponent(`Viagem ${tripData.destination}`)
                const body = encodeURIComponent(`Acompanhe a viagem por aqui: ${tripData.shareLink}`)
                window.location.href = `mailto:?subject=${subject}&body=${body}`
              }}
              className="flex-1 p-3 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-white/60 text-sm font-medium transition-colors"
            >
              Email
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#5de0e6] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white font-medium">Privacidade garantida</p>
            <p className="text-xs text-white/40 mt-1">Documentos privados (passaportes, vistos) nao aparecem no link compartilhavel.</p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Menu Modal
function MenuModal({
  open,
  onClose,
  onOpenTravelers,
  onOpenSettings,
  onOpenSecurity,
  onOpenCredits,
}: {
  open: boolean
  onClose: () => void
  onOpenTravelers: () => void
  onOpenSettings: () => void
  onOpenSecurity: () => void
  onOpenCredits: () => void
}) {
  const { isAdmin } = useContext(PermissionContext)
  const menuItems = [
    ...(isAdmin ? [
      { icon: User, label: "Viajantes", action: onOpenTravelers },
      { icon: Settings, label: "Configuracoes", action: onOpenSettings },
      { icon: Shield, label: "Seguranca", action: onOpenSecurity },
    ] : []),
    { icon: CreditCard, label: "Credito", action: onOpenCredits },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title="Menu da Viagem">
      <div className="space-y-2">
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); onClose() }}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center">
              <item.icon className="w-5 h-5 text-white/60" />
            </div>
            <span className="text-white font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

function TravelersModal({
  open,
  onClose,
  travelers,
  onUpdateTravelers,
}: {
  open: boolean
  onClose: () => void
  travelers: { name: string; avatar?: string; role: string }[]
  onUpdateTravelers: (travelers: { name: string; avatar?: string; role: string }[]) => void
}) {
  const { canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [form, setForm] = useState({ name: "", role: "acompanhante" })

  const startEditing = (index: number) => {
    setEditingIndex(index)
    setForm({ name: travelers[index]?.name ?? "", role: travelers[index]?.role ?? "acompanhante" })
  }

  const resetForm = () => {
    setEditingIndex(null)
    setForm({ name: "", role: "acompanhante" })
  }

  const handleSave = () => {
    if (!canWrite) return
    if (!form.name.trim()) return

    if (editingIndex === null) {
      onUpdateTravelers([...travelers, { name: form.name.trim(), role: form.role, avatar: "/placeholder.svg?height=40&width=40" }])
      showToast("Viajante adicionado.", "success")
    } else {
      onUpdateTravelers(travelers.map((traveler, index) => index === editingIndex ? { ...traveler, name: form.name.trim(), role: form.role } : traveler))
      showToast("Viajante atualizado.", "success")
    }

    resetForm()
  }

  const handleRemove = (index: number) => {
    if (!canWrite) return
    onUpdateTravelers(travelers.filter((_, travelerIndex) => travelerIndex !== index))
    showToast("Viajante removido.", "success")
    if (editingIndex === index) resetForm()
  }

  const handleSetPrimary = (index: number) => {
    if (!canWrite) return
    onUpdateTravelers(travelers.map((traveler, travelerIndex) => ({
      ...traveler,
      role: travelerIndex === index ? "principal" : traveler.role === "principal" ? "acompanhante" : traveler.role
    })))
    showToast("Responsavel principal atualizado.", "success")
  }

  return (
    <Modal open={open} onClose={onClose} title="Viajantes">
      <div className="space-y-6">
        <div className="space-y-3">
          {travelers.map((traveler, index) => (
            <div key={`${traveler.name}-${index}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{traveler.name}</p>
                  <p className="text-xs text-white/40">{traveler.role === "principal" ? "Responsavel principal" : "Viajante"}</p>
                </div>
                <div className="flex gap-2">
                  {canWrite && (
                    <>
                      <button onClick={() => startEditing(index)} className="rounded-xl bg-white/[0.05] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleRemove(index)} className="rounded-xl bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {canWrite && traveler.role !== "principal" && (
                <button onClick={() => handleSetPrimary(index)} className="mt-3 text-xs font-medium text-[#5de0e6]">
                  Definir como responsavel principal
                </button>
              )}
            </div>
          ))}
        </div>

        {canWrite ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="mb-4 text-sm font-medium text-white">{editingIndex === null ? "Adicionar viajante" : "Editar viajante"}</p>
            <div className="space-y-3">
              <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nome do viajante" className="border-white/10 bg-white/[0.03] text-white" />
              <div className="grid grid-cols-2 gap-2">
                {["principal", "acompanhante"].map((role) => (
                  <button
                    key={role}
                    onClick={() => setForm((prev) => ({ ...prev, role }))}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm transition-colors",
                      form.role === role ? "border-[#5de0e6]/40 bg-[#5de0e6]/10 text-[#5de0e6]" : "border-white/10 bg-white/[0.03] text-white/60"
                    )}
                  >
                    {role === "principal" ? "Principal" : "Acompanhante"}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-white/10" onClick={resetForm}>
                  Limpar
                </Button>
                <Button className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white" onClick={handleSave}>
                  {editingIndex === null ? "Adicionar" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/50">
            Este link esta em modo de visualizacao. O gerenciamento de viajantes fica disponivel apenas no link administrador.
          </div>
        )}
      </div>
    </Modal>
  )
}

function TripSettingsModal({
  open,
  onClose,
  tripData,
  onSave,
}: {
  open: boolean
  onClose: () => void
  tripData: any
  onSave: (data: { privacy: string; permissions: string; status: string; preferences: string }) => void
}) {
  const { canWrite } = useContext(PermissionContext)
  const [form, setForm] = useState({
    preferences: "Roteiro premium com foco em experiencias culturais e gastronomia.",
    privacy: "privado",
    permissions: "edicao_restrita",
    status: tripData.status ?? "upcoming",
  })

  useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, status: tripData.status ?? prev.status }))
    }
  }, [open, tripData.status])

  return (
    <Modal open={open} onClose={onClose} title="Configuracoes">
      <div className="space-y-4">
        <div>
          <Label className="text-white/60">Preferencias da viagem</Label>
          <textarea
            value={form.preferences}
            onChange={(e) => canWrite && setForm((prev) => ({ ...prev, preferences: e.target.value }))}
            disabled={!canWrite}
            className="mt-2 min-h-[110px] w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white outline-none"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-white/60">Privacidade</Label>
            <div className="mt-2 grid gap-2">
              {["privado", "compartilhavel"].map((privacy) => (
                <button
                  key={privacy}
                  onClick={() => canWrite && setForm((prev) => ({ ...prev, privacy }))}
                  disabled={!canWrite}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    form.privacy === privacy ? "border-[#5de0e6]/40 bg-[#5de0e6]/10 text-[#5de0e6]" : "border-white/10 bg-white/[0.03] text-white/60"
                  )}
                >
                  {privacy === "privado" ? "Somente administradores" : "Liberar link compartilhavel"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-white/60">Permissoes</Label>
            <div className="mt-2 grid gap-2">
              {["edicao_restrita", "colaborativa"].map((permission) => (
                <button
                  key={permission}
                  onClick={() => canWrite && setForm((prev) => ({ ...prev, permissions: permission }))}
                  disabled={!canWrite}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    form.permissions === permission ? "border-[#5de0e6]/40 bg-[#5de0e6]/10 text-[#5de0e6]" : "border-white/10 bg-white/[0.03] text-white/60"
                  )}
                >
                  {permission === "edicao_restrita" ? "Somente equipe principal" : "Edicao colaborativa"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <Label className="text-white/60">Status da viagem</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {["upcoming", "ongoing", "completed"].map((status) => (
              <button
                key={status}
                onClick={() => canWrite && setForm((prev) => ({ ...prev, status }))}
                disabled={!canWrite}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm transition-colors",
                  form.status === status ? "border-[#5de0e6]/40 bg-[#5de0e6]/10 text-[#5de0e6]" : "border-white/10 bg-white/[0.03] text-white/60"
                )}
              >
                {status === "upcoming" ? "Planejada" : status === "ongoing" ? "Em andamento" : "Concluida"}
              </button>
            ))}
          </div>
        </div>
        {canWrite ? (
          <Button className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white" onClick={() => onSave(form)}>
            Salvar configuracoes
          </Button>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/50">
            Este link esta em modo de visualizacao. As configuracoes da viagem ficam disponiveis apenas no link administrador.
          </div>
        )}
      </div>
    </Modal>
  )
}

function TripSecurityModal({
  open,
  onClose,
  tripId,
  tripTitle,
  onSecurityUpdated,
}: {
  open: boolean
  onClose: () => void
  tripId: string
  tripTitle: string
  onSecurityUpdated: () => void
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const securityMethods = getTripLinkQuickAccessMethods(tripId)

  useEffect(() => {
    if (!open) {
      setPin("")
      setConfirmPin("")
      setError("")
      setIsSubmitting(false)
    }
  }, [open])

  const handleSavePin = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) return
    if (pin !== confirmPin) {
      setError("Os PINs nao conferem.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await saveTripLinkPin(tripId, pin)
      setPin("")
      setConfirmPin("")
      onSecurityUpdated()
    } catch (securityError) {
      const message = securityError instanceof Error ? securityError.message : "Nao foi possivel salvar o PIN neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemovePin = () => {
    disableTripLinkPin(tripId)
    setPin("")
    setConfirmPin("")
    setError("")
    onSecurityUpdated()
  }

  const handleToggleBiometric = async () => {
    setIsSubmitting(true)
    setError("")

    try {
      if (securityMethods.biometricEnabled) {
        disableTripLinkBiometric(tripId)
      } else {
        await registerTripLinkBiometric(tripId, tripTitle)
      }

      onSecurityUpdated()
    } catch (securityError) {
      const message = securityError instanceof Error ? securityError.message : "Nao foi possivel atualizar a biometria neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Seguranca">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">Proteja acoes sensiveis desta viagem utilizando PIN ou biometria neste dispositivo.</p>
          <p className="mt-2 text-xs text-white/40">O PIN do link e independente do portal, nao e compartilhado com a agencia e fica restrito a este aparelho.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">Status do PIN</p>
            <p className="mt-2 text-sm text-white">{securityMethods.pinEnabled ? "PIN configurado" : "PIN nao configurado"}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">Biometria</p>
            <p className="mt-2 text-sm text-white">
              {securityMethods.biometricEnabled ? "Biometria ativa" : securityMethods.biometricSupported ? "Biometria inativa" : "Biometria indisponivel"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <p className="text-sm font-medium text-white">{securityMethods.pinEnabled ? "Alterar PIN" : "Criar PIN"}</p>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Digite 4 digitos"
            className="text-center text-xl tracking-[0.6em]"
          />
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Confirme o PIN"
            className="text-center text-xl tracking-[0.6em]"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => void handleSavePin()}
              disabled={isSubmitting || pin.length !== 4 || confirmPin.length !== 4}
              className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
            >
              {securityMethods.pinEnabled ? "Alterar PIN" : "Salvar PIN"}
            </Button>
            {securityMethods.pinEnabled ? (
              <Button variant="outline" onClick={handleRemovePin} className="border-white/10 text-red-300 hover:bg-red-500/10">
                Remover PIN
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <p className="text-sm font-medium text-white">Biometria neste dispositivo</p>
          <p className="text-xs text-white/40">Use Face ID, Touch ID ou WebAuthn quando o navegador oferecer suporte confiavel.</p>
          <Button
            variant="outline"
            onClick={() => void handleToggleBiometric()}
            disabled={isSubmitting || !securityMethods.biometricSupported}
            className="w-full border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {securityMethods.biometricEnabled ? "Desativar biometria" : "Ativar biometria"}
          </Button>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">Dispositivos protegidos</p>
          {securityMethods.devices.length > 0 ? (
            <div className="mt-3 space-y-2">
              {securityMethods.devices.map((device) => (
                <div key={device.updatedAt} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <p className="text-sm text-white">{device.label}</p>
                  <p className="text-xs text-white/40">Ultima atualizacao: {new Date(device.updatedAt).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-white/40">Nenhum dispositivo protegido ainda para esta viagem.</p>
          )}
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
          Seu PIN e biometria protegem alteracoes importantes desta viagem. Apenas dispositivos autorizados podem realizar acoes administrativas.
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

// Offline Section
function OfflineSection({
  tripData,
  isAdmin,
  sensitiveAccessGranted,
  agencyBranding,
}: {
  tripData: any
  isAdmin: boolean
  sensitiveAccessGranted: boolean
  agencyBranding: { name: string | null; logoUrl: string | null; isAgency: boolean }
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const { showToast } = useToast()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const offlineResult = await saveTripOfflinePackage(
        {
          ...tripData,
          agencyBranding,
        },
        {
          audience: getOfflineSaveAudience({ isAdmin, sensitiveAccessGranted }),
          allowPrivateDocuments: isAdmin && sensitiveAccessGranted,
        },
      )

      setDownloaded(true)
      showToast(offlineResult.message, offlineResult.persisted.failures.length > 0 ? "info" : "success")
    } catch (error) {
      console.error("[OFFLINE] save failed", error)
      showToast(error instanceof Error ? error.message : "Nao foi possivel salvar esta viagem offline.", "error")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section id="offline" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Acesso Offline</h2>
            <p className="text-sm text-white/40">Salve sua viagem para acessar sem internet</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-medium text-white mb-2">{downloaded ? "Viagem salva offline!" : "Salvar viagem offline"}</h3>
              <p className="text-sm text-white/40 mb-4">{downloaded ? getOfflineWarningMessage() : "Salve o ultimo resumo, passagens extraidas, hospedagem, documentos ja abertos, roteiro e informacoes rapidas para consultar sem internet."}</p>
              
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {["Roteiro", "Vouchers", "Documentos", "Contatos"].map((item) => (
                  <span key={item} className={cn("px-3 py-1 text-xs rounded-full", downloaded ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.05] text-white/40")}>
                    {downloaded && <Check className="w-3 h-3 inline mr-1" />}
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <Button onClick={() => void handleDownload()} disabled={downloading || downloaded} className={cn("px-6 py-6 rounded-xl transition-all duration-300", downloaded ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0")}>
              {downloading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Baixando...</span>
                </div>
              ) : downloaded ? (
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  <span>Salvo</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  <span>Salvar Offline</span>
                </div>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function OfflineModeBanner({ status }: { status: OfflineTripPackageStatus }) {
  const message =
    status === "partial"
      ? "Modo offline ativo. Algumas funcionalidades estao indisponiveis e alguns arquivos podem nao estar disponiveis offline."
      : status === "legacy_snapshot"
        ? "Modo offline ativo. Esta e uma versao salva anterior. Arquivos podem nao estar disponiveis offline."
        : "Modo offline ativo. Algumas funcionalidades estao indisponiveis."

  return (
    <section className="px-4 pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {message}
        </div>
      </div>
    </section>
  )
}

// Quick Info Section
function QuickInfoSection({ tripData }: { tripData: any }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const quickInfo = normalizeQuickInfo(tripData?.quickInfo)

  const infoCards = [
    { id: "currency", icon: "💶", label: "Moeda", value: quickInfo.currency.name, sub: `1 ${quickInfo.currency.symbol} = ${quickInfo.currency.rate}`, detail: "Cotacao e disponibilidade podem variar. Consulte fontes locais antes da viagem." },
    { id: "language", icon: "🗣️", label: "Idioma", value: quickInfo.language, detail: "As informacoes de idioma sao exibidas com base no destino informado da viagem." },
    { id: "timezone", icon: "🕐", label: "Fuso Horario", value: quickInfo.timezone, detail: "O fuso horario e apresentado a partir do destino configurado. Confirme horarios finais com a operacao da viagem." },
    { id: "emergency", icon: "🆘", label: "Emergencia", value: quickInfo.emergency, detail: "Use este numero para emergencias locais quando houver confirmacao do destino." },
    { id: "embassy", icon: "🏛️", label: "Embaixada BR", value: quickInfo.embassy, detail: "Contato consular exibido conforme o destino informado. Se estiver indisponivel, mantenha os contatos da sua agencia." },
  ]

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6]/50 to-[#004aad]/50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Informacoes Rapidas</h2>
            <p className="text-sm text-white/40">Dados uteis sobre o destino</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {infoCards.map((card, i) => (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setExpanded(expanded === card.id ? null : card.id)}
              className={cn(
                "p-4 rounded-xl border transition-all duration-300 text-left",
                expanded === card.id
                  ? "bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border-[#5de0e6]/30"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
              )}
            >
              <span className="text-2xl">{card.icon}</span>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-2">{card.label}</p>
              <p className="text-sm text-white font-medium mt-1">{card.value}</p>
              {card.sub && <p className="text-xs text-white/30 mt-0.5">{card.sub}</p>}
              
              <AnimatePresence>
                {expanded === card.id && (
                  <motion.p
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="text-xs text-white/50 mt-3 pt-3 border-t border-white/10"
                  >
                    {card.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}

// Credits Modal
function CreditsModal({ open, onClose, credits }: { open: boolean; onClose: () => void; credits: any }) {
  const { showToast } = useToast()

  const plans = [
    { name: "Pacote Basico", credits: 50, price: "R$ 19,90", popular: false, mode: "Compra" },
    { name: "Pacote Viajante", credits: 150, price: "R$ 39,90", popular: true, mode: "Compra" },
    { name: "Plano Premium", credits: 500, price: "R$ 99,90", popular: false, mode: "Upgrade" },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Creditos">
      <div className="space-y-6">
        <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20">
          <p className="text-4xl font-bold text-white">{credits.balance}</p>
          <p className="text-sm text-white/60 mt-1">creditos disponiveis</p>
          <div className="w-full h-2 bg-white/10 rounded-full mt-4">
            <div className="h-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-full" style={{ width: `${(credits.balance / credits.total) * 100}%` }} />
          </div>
          <p className="text-xs text-white/40 mt-2">{credits.used} usados de {credits.total}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-white/40">Consumo da viagem</p>
            <p className="mt-2 text-2xl font-semibold text-white">{credits.used}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs text-white/40">Saldo atual</p>
            <p className="mt-2 text-2xl font-semibold text-white">{credits.balance}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-white font-medium mb-3">Comprar mais ou fazer upgrade</p>
          <div className="space-y-3">
            {plans.map((plan) => (
              <button
                key={plan.name}
                onClick={() => showToast(`Compra de creditos para ${plan.name} ainda nao esta integrada.`, "info")}
                className={cn(
                  "w-full p-4 rounded-xl border transition-all flex items-center justify-between",
                  plan.popular
                    ? "bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border-[#5de0e6]/30"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                )}
                >
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <p className="text-white font-medium">{plan.name}</p>
                    <p className="text-xs text-white/40">{plan.credits} creditos • {plan.mode}</p>
                  </div>
                  {plan.popular && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#5de0e6] text-black rounded-full">POPULAR</span>
                  )}
                </div>
                <p className="text-[#5de0e6] font-semibold">{plan.price}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="mb-3 text-sm font-medium text-white">Historico resumido</p>
          <div className="space-y-2 text-sm text-white/60">
            <div className="flex items-center justify-between">
              <span>Roteiro com IA</span>
              <span>-2 creditos</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Concierge da viagem</span>
              <span>-1 credito</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ajuste do link</span>
              <span>-0 credito</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// Footer
function TripFooter({ agencyBranding }: { agencyBranding: { name: string | null; logoUrl: string | null; isAgency: boolean } }) {
  return (
    <footer className="py-10 px-4 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {agencyBranding.isAgency ? (
              <div className="flex flex-col gap-0.5">
                <Image
                  src={agencyBranding.logoUrl || "/vuei-logo.png"}
                  alt={agencyBranding.name || "Vuei"}
                  width={80}
                  height={32}
                  className="h-5 w-auto object-contain opacity-75"
                />
                <span className="text-[9px] uppercase tracking-[0.14em] text-white/30">
                  Powered by Vuei
                </span>
              </div>
            ) : (
              <Image
                src="/vuei-logo.png"
                alt="Vuei"
                width={104}
                height={36}
                className="h-6 w-auto object-contain opacity-80"
              />
            )}
            <span className="text-sm text-white/30">{agencyBranding.name ? `${agencyBranding.name} no seu link inteligente` : "Sua viagem inteligente"}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/suporte" className="text-xs text-white/40 hover:text-white/60 transition-colors">Suporte</a>
            <a href="/termos" className="text-xs text-white/40 hover:text-white/60 transition-colors">Termos</a>
            <a href="/privacidade" className="text-xs text-white/40 hover:text-white/60 transition-colors">Privacidade</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SensitiveAccessModal({
  open,
  tripId,
  onClose,
  onSuccess,
  onLogin,
  onConfigureQuickAccess,
}: {
  open: boolean
  tripId: string
  onClose: () => void
  onSuccess: () => void
  onLogin: () => void
  onConfigureQuickAccess: () => void
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAccessMethods = getTripLinkQuickAccessMethods(tripId)

  useEffect(() => {
    if (!open) {
      setPin("")
      setConfirmPin("")
      setError("")
      setIsSubmitting(false)
    }
  }, [open])

  const handlePinUnlock = async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await verifyTripLinkPin(tripId, pin)
      if (!isValid) {
        setError("PIN invalido")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Acesso rapido nao configurado neste dispositivo"
      setError(message)
    } finally {
      setIsSubmitting(false)
      setPin("")
    }
  }

  const handleCreatePin = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) return
    if (pin !== confirmPin) {
      setError("Os PINs nao conferem.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await saveTripLinkPin(tripId, pin)
      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Nao foi possivel configurar o PIN neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
      setPin("")
      setConfirmPin("")
    }
  }

  const handleBiometricUnlock = async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const success = await authenticateTripLinkBiometric(tripId)
      if (!success) {
        setError("Nao foi possivel validar a biometria neste dispositivo.")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Biometria indisponivel neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Desbloqueie para editar esta viagem">
      <div className="w-full">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20">
          <Lock className="h-8 w-8 text-[#5de0e6]" />
        </div>
        <p className="mt-3 text-center text-sm text-white/55">
          {quickAccessMethods.pinEnabled
            ? "Seu PIN e biometria protegem alteracoes importantes desta viagem. Apenas dispositivos autorizados podem realizar acoes administrativas."
            : "Crie um PIN neste dispositivo para proteger acoes sensiveis desta viagem."}
        </p>

        <div className="mt-6 space-y-3">
          {quickAccessMethods.biometricEnabled && (
            <Button
              onClick={() => void handleBiometricUnlock()}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0 hover:opacity-90"
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              Usar Face ID / biometria
            </Button>
          )}

          {quickAccessMethods.pinEnabled && (
            <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <Label className="text-white/70">Usar PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 text-center text-lg font-semibold tracking-[0.22em] sm:tracking-[0.28em] px-3 placeholder:tracking-normal placeholder:text-base"
              />
              <Button
                onClick={() => void handlePinUnlock()}
                disabled={isSubmitting || pin.length !== 4}
                className="w-full bg-white/[0.06] text-white hover:bg-white/[0.12]"
              >
                Desbloquear com PIN
              </Button>
            </div>
          )}

          {!quickAccessMethods.pinEnabled && (
            <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-100">Crie um PIN neste dispositivo para proteger acoes sensiveis desta viagem.</p>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Crie um PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 text-center text-lg font-semibold tracking-[0.22em] sm:tracking-[0.28em] px-3 placeholder:tracking-normal placeholder:text-base"
              />
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="Confirme o PIN"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 text-center text-lg font-semibold tracking-[0.22em] sm:tracking-[0.28em] px-3 placeholder:tracking-normal placeholder:text-base"
              />
              <Button
                onClick={() => void handleCreatePin()}
                disabled={isSubmitting || pin.length !== 4 || confirmPin.length !== 4}
                className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0 hover:opacity-90"
              >
                Criar PIN neste dispositivo
              </Button>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={onLogin}
          className="mt-5 w-full border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]"
        >
          Entrar com login
        </Button>
        <Button
          variant="ghost"
          onClick={onConfigureQuickAccess}
          className="mt-3 w-full text-[#5de0e6] hover:bg-white/[0.04] hover:text-[#5de0e6]"
        >
          Gerenciar seguranca neste dispositivo
        </Button>
      </div>
    </Modal>
  )
}

// Main page component
export default function TripPage() {
  const params = useParams<{ id?: string; slug?: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const adminRouteActive = Boolean(pathname?.startsWith("/viagem/") && pathname?.endsWith("/admin"))
  const routeSlug =
    typeof params?.id === "string"
      ? params.id
      : typeof params?.slug === "string"
        ? params.slug
        : initialTripData.id
  const [tripData, setTripData] = useState(() => normalizeTripViewData(initialTripData))
  const [isAdmin, setIsAdmin] = useState(false)
  const [canWrite, setCanWrite] = useState(false)
  const [isLoadingTrip, setIsLoadingTrip] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editTripOpen, setEditTripOpen] = useState(false)
  const [travelersOpen, setTravelersOpen] = useState(false)
  const [tripSettingsOpen, setTripSettingsOpen] = useState(false)
  const [securitySettingsOpen, setSecuritySettingsOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [tripOwnerUserId, setTripOwnerUserId] = useState<string | null>(null)
  const [tripAdminToken, setTripAdminToken] = useState<string | null>(null)
  const [tripItineraryRecords, setTripItineraryRecords] = useState<TripItineraryRecord[]>([])
  const [sensitiveAccessGranted, setSensitiveAccessGranted] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [quickAccessGateRequired, setQuickAccessGateRequired] = useState(false)
  const [adminLinkMutationMode, setAdminLinkMutationMode] = useState(false)
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(false)
  const [offlinePackageStatus, setOfflinePackageStatus] = useState<OfflineTripPackageStatus | null>(null)
  const [offlineDocumentContext, setOfflineDocumentContext] = useState<OfflineDocumentContext | null>(null)
  const [agencyBranding, setAgencyBranding] = useState<{ name: string | null; logoUrl: string | null; isAgency: boolean }>({ name: null, logoUrl: null, isAgency: false })
  const [sectionsLoading, setSectionsLoading] = useState({
    flights: true,
    hotels: true,
    itineraries: true,
    documents: true,
  })
  const pendingSensitiveActionRef = useRef<(() => void) | null>(null)
  const loadRequestRef = useRef(0)

  const handleCloseSensitiveAccessModal = () => {
    setSecurityModalOpen(false)
    pendingSensitiveActionRef.current = null
  }

  useEffect(() => {
    setSensitiveAccessGranted(false)
    pendingSensitiveActionRef.current = null
    setQuickAccessGateRequired(false)
  }, [tripOwnerUserId, user?.id, params?.id, params?.slug])

  useEffect(() => {
    if (typeof window === "undefined") return

    const searchParams = new URLSearchParams(window.location.search)
    const adminToken = searchParams.get("adminToken")
    const publicToken = searchParams.get("token") || searchParams.get("publicToken")
    const isPublicRoute = pathname?.startsWith("/v/") ?? false
    const isAdminRoute = isAdminLinkMode(searchParams, pathname)

    setIsAdmin(false)
    setCanWrite(false)
    setTripAdminToken(adminToken)
    setAdminLinkMutationMode(false)
    setOfflineModeEnabled(false)
    setOfflinePackageStatus(null)
    setOfflineDocumentContext(null)
    setTripItineraryRecords([])
    setSectionsLoading({
      flights: true,
      hotels: true,
      itineraries: true,
      documents: true,
    })
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId

    const loadTrip = async () => {
      const tripPerf = startPerfMeasure("trip.base")
      setIsLoadingTrip(true)
      setLoadError(null)
      devLog("trip.loading", routeSlug)

      const useSupabase = shouldUseSupabase()
      const routeMode = isAdminRoute ? "admin" : isPublicRoute ? "public" : "portal"
      const isMobileViewport = typeof window !== "undefined" ? window.innerWidth < 768 : false

      logTripDocumentsDev("trip_load_started", {
        routeSlug,
        routeMode,
        isMobileViewport,
      })

      const loadOfflinePackage = async (reason: "offline" | "network") => {
        const offlinePackage = await loadTripOfflinePackage({
          tripIdOrSlug: routeSlug,
          audience: getOfflineReadAudience(isAdminRoute),
        })
        if (!offlinePackage) return false
        if (loadRequestRef.current !== requestId) return true

        const audience = getOfflineReadAudience(isAdminRoute)
        const offlineTrip = buildTripDataFromOfflinePackage(offlinePackage, audience)
        setOfflineModeEnabled(true)
        setOfflinePackageStatus(offlineTrip.status)
        setOfflineDocumentContext({
          tripId: offlinePackage.tripId,
          audience,
          packageKey: offlinePackage.packageKey ?? offlinePackage.payload?.offlineMeta?.packageKey ?? null,
          packageStatus: offlineTrip.status,
        })
        setTripOwnerUserId(null)
        setTripAdminToken(null)
        setAdminLinkMutationMode(false)
        setQuickAccessGateRequired(false)
        setSensitiveAccessGranted(false)
        setCanWrite(false)
        setIsAdmin(isAdminRoute)
        setTripItineraryRecords([])
        setAgencyBranding(offlineTrip.agencyBranding)
        setTripData(offlineTrip.tripData)
        setSectionsLoading({
          flights: false,
          hotels: false,
          itineraries: false,
          documents: false,
        })
        setIsLoadingTrip(false)
        tripPerf.end({ tripId: offlinePackage.tripId, mode: "offline", reason })
        return true
      }

      if (isOfflineModeActive()) {
        const offlineLoaded = await loadOfflinePackage("offline")
        if (!offlineLoaded) {
          setLoadError("Esta viagem nao foi salva para uso offline neste dispositivo.")
          setIsLoadingTrip(false)
        }
        return
      }

      try {
        const repositoryTrip = adminToken
          ? await getTripByAdminToken(adminToken)
          : publicToken
            ? await getTripByPublicToken(publicToken)
            : await getTripBySlug(routeSlug)

        if (repositoryTrip.data) {
          if (loadRequestRef.current !== requestId) return
          setTripOwnerUserId(repositoryTrip.data.ownerUserId ?? null)
          setTripAdminToken(repositoryTrip.data.adminToken ?? adminToken ?? null)
          const isOwner = Boolean(user?.id && repositoryTrip.data.ownerUserId && user.id === repositoryTrip.data.ownerUserId)
          const isPublicLinkRequest = isPublicRoute || Boolean(publicToken)
          const adminLinkAccessMode = isAdminRoute && !isOwner

          logTripDocumentsDev("trip_resolved", {
            routeSlug,
            tripId: repositoryTrip.data.id,
            routeMode,
            isMobileViewport,
            hasAdminToken: Boolean(adminToken),
            hasPublicToken: Boolean(publicToken),
            isOwner,
          })

          if (isPublicLinkRequest && repositoryTrip.data.visibility !== "public") {
            console.error("[TRIP] erro ao carregar link", "Esta viagem nao esta publicada para acesso publico.")
            setLoadError("Esta viagem nao esta disponivel publicamente.")
            setIsLoadingTrip(false)
            return
          }

          if (isAdminRoute && authLoading) {
            return
          }

          setQuickAccessGateRequired(false)
          setAdminLinkMutationMode(adminLinkAccessMode)

          const canEditTrip = isAdminRoute && (Boolean(user) ? (isOwner || adminLinkAccessMode) : true)
          const canWriteTrip = isAdminRoute && (isOwner || adminLinkAccessMode)
          setIsAdmin(canEditTrip)
          setCanWrite(canWriteTrip)

          setTripData(
            buildTripDataFromStoredTrip({
              id: repositoryTrip.data.id,
              slug: repositoryTrip.data.slug,
              name: repositoryTrip.data.title,
              destination: repositoryTrip.data.destination,
              agencyId: repositoryTrip.data.agencyId ?? null,
              clientId: repositoryTrip.data.clientId ?? null,
              country: repositoryTrip.data.country ?? undefined,
              city: repositoryTrip.data.city ?? undefined,
              startDate: repositoryTrip.data.startDate ?? undefined,
              endDate: repositoryTrip.data.endDate ?? undefined,
              passengersCount: repositoryTrip.data.travelersCount,
              status: repositoryTrip.data.status,
              coverImage: repositoryTrip.data.coverImage ?? undefined,
              adminLink: repositoryTrip.data.adminLink,
              shareLink: repositoryTrip.data.publicLink,
              flights: [],
              hotels: [],
              hotel: repositoryTrip.data.accommodations?.[0] ?? null,
              itinerary: repositoryTrip.data.itinerary,
              documents: [],
              travelersCount: repositoryTrip.data.travelersCount,
            })
          )
          setIsLoadingTrip(false)
          tripPerf.end({ tripId: repositoryTrip.data.id })

          void (async () => {
            const sectionsPerf = startPerfMeasure("trip.sections")
            const adminSectionsPromise = canWriteTrip && adminLinkAccessMode
              ? fetch(`/api/trip-admin?tripId=${encodeURIComponent(repositoryTrip.data.id)}&tripSlug=${encodeURIComponent(routeSlug)}${repositoryTrip.data.adminToken ? `&adminToken=${encodeURIComponent(repositoryTrip.data.adminToken)}` : ""}`).then(async (response) => {
                  const data = await response.json().catch(() => null)
                  if (!response.ok) {
                    throw new Error(data?.error || "Falha ao carregar dados administrativos da viagem.")
                  }
                  return data
                })
              : null

            const [documentsSettled, flightsSettled, itinerariesSettled, hotelsSettled, agencySettled] = await Promise.allSettled([
              adminSectionsPromise
                ? adminSectionsPromise.then((data: any) => ({ source: "admin-api" as const, data: data?.documents ?? [], error: null }))
                : (canWriteTrip ? listDocumentsByTrip(repositoryTrip.data.id) : listPublicTripDocuments(repositoryTrip.data.id)),
              adminSectionsPromise
                ? adminSectionsPromise.then((data: any) => ({ source: "admin-api" as const, data: data?.flights ?? [], error: null }))
                : (canWriteTrip ? listTripFlights(repositoryTrip.data.id) : listPublicTripFlights(repositoryTrip.data.id)),
              adminSectionsPromise
                ? adminSectionsPromise.then((data: any) => ({ source: "admin-api" as const, data: data?.itineraries ?? [], error: null }))
                : listTripItineraries(repositoryTrip.data.id),
              adminSectionsPromise
                ? adminSectionsPromise.then((data: any) => ({ source: "admin-api" as const, data: data?.hotels ?? [], error: null }))
                : listTripHotels(repositoryTrip.data.id),
              repositoryTrip.data.agencyId ? getAgencyById(repositoryTrip.data.agencyId) : Promise.resolve(null),
            ])

            if (loadRequestRef.current !== requestId) return

            const documentsResult =
              documentsSettled.status === "fulfilled"
                ? documentsSettled.value
                : { source: "error" as const, data: [] as any[], error: documentsSettled.reason instanceof Error ? documentsSettled.reason.message : "Falha ao buscar documentos." }
            const flightsResult =
              flightsSettled.status === "fulfilled"
                ? flightsSettled.value
                : { source: "error" as const, data: [] as any[], error: flightsSettled.reason instanceof Error ? flightsSettled.reason.message : "Falha ao buscar voos." }
            const itinerariesResult =
              itinerariesSettled.status === "fulfilled"
                ? itinerariesSettled.value
                : { source: "error" as const, data: [] as TripItineraryRecord[], error: itinerariesSettled.reason instanceof Error ? itinerariesSettled.reason.message : "Falha ao buscar roteiros." }
            const hotelsResult =
              hotelsSettled.status === "fulfilled"
                ? hotelsSettled.value
                : { source: "error" as const, data: [] as any[], error: hotelsSettled.reason instanceof Error ? hotelsSettled.reason.message : "Falha ao buscar hospedagens." }
            const agencyResult = agencySettled.status === "fulfilled" ? agencySettled.value : null
            const resolvedDocuments = Array.isArray(documentsResult.data) ? documentsResult.data : []
            const sectionErrors = [
              documentsResult.error,
              flightsResult.error,
              itinerariesResult.error,
              hotelsResult.error,
              agencySettled.status === "rejected" ? agencySettled.reason instanceof Error ? agencySettled.reason.message : "Falha ao buscar branding da agencia." : null,
            ].filter((value): value is string => Boolean(value))

            if (typeof navigator !== "undefined" && navigator.onLine === false && sectionErrors.some((error) => isOfflineRecoverableError(error))) {
              const offlineLoaded = await loadOfflinePackage("network")
              if (offlineLoaded) {
                return
              }
            }

            logTripDocumentsDev("query_result", {
              routeSlug,
              tripId: repositoryTrip.data.id,
              routeMode,
              isMobileViewport,
              adminMode: canWriteTrip,
              querySource: documentsResult.source,
              queryError: documentsResult.error ?? null,
              counts: getDocumentDebugCounts(resolvedDocuments),
              documents: getSafeDocumentDebugRows(resolvedDocuments),
            })

            const simpleItinerary = resolveSimpleTripItinerary(itinerariesResult.data ?? [])
            setTripItineraryRecords(itinerariesResult.data ?? [])
            setAgencyBranding({
              name: agencyResult?.data?.name ?? null,
              logoUrl: agencyResult?.data?.branding?.linkLogoUrl || agencyResult?.data?.logo || null,
              isAgency: Boolean(repositoryTrip.data.agencyId),
            })

            setTripData((prev) =>
              buildTripDataFromStoredTrip({
                id: repositoryTrip.data.id,
                slug: repositoryTrip.data.slug,
                name: repositoryTrip.data.title,
                destination: repositoryTrip.data.destination,
                agencyId: repositoryTrip.data.agencyId ?? null,
                clientId: repositoryTrip.data.clientId ?? null,
                country: repositoryTrip.data.country ?? undefined,
                city: repositoryTrip.data.city ?? undefined,
                startDate: repositoryTrip.data.startDate ?? undefined,
                endDate: repositoryTrip.data.endDate ?? undefined,
                passengersCount: repositoryTrip.data.travelersCount,
                status: repositoryTrip.data.status,
                coverImage: repositoryTrip.data.coverImage ?? undefined,
                adminLink: repositoryTrip.data.adminLink,
                shareLink: repositoryTrip.data.publicLink,
                flights: (flightsResult.data ?? []).map((flight) => mapFlightRecordToView(flight, resolvedDocuments)),
                hotel: hotelsResult.data[0]
                  ? {
                      ...hotelsResult.data[0],
                      image: repositoryTrip.data.coverImage ?? undefined,
                      amenities: [],
                    }
                  : repositoryTrip.data.accommodations?.[0] ?? null,
                hotels: hotelsResult.data.map((hotel) => ({
                  ...hotel,
                  image: repositoryTrip.data.coverImage ?? undefined,
                  amenities: [],
                })),
                itinerary: simpleItinerary ? mapItineraryContentToLegacyDays(simpleItinerary.content) : repositoryTrip.data.itinerary,
                documents: resolvedDocuments,
                travelersCount: repositoryTrip.data.travelersCount,
              })
            )

            logTripDocumentsDev("post_filter_counts", {
              routeSlug,
              tripId: repositoryTrip.data.id,
              routeMode,
              isMobileViewport,
              adminMode: canWriteTrip,
              counts: getDocumentDebugCounts(resolvedDocuments),
            })
            setSectionsLoading({
              flights: false,
              hotels: false,
              itineraries: false,
              documents: false,
            })
            sectionsPerf.end({ tripId: repositoryTrip.data.id })
          })().catch((error) => {
            console.error("[TRIP] section load error", error)
            setSectionsLoading({
              flights: false,
              hotels: false,
              itineraries: false,
              documents: false,
            })
          })
          return
        }
        if (useSupabase) {
          if (repositoryTrip.error && isOfflineRecoverableError(new Error(repositoryTrip.error))) {
            const offlineLoaded = await loadOfflinePackage("network")
            if (offlineLoaded) {
              return
            }
          }
          const message = repositoryTrip.error || "Viagem nao encontrada ou link expirado."
          console.error("[TRIP] erro ao carregar link", message)
          setLoadError("Viagem nao encontrada ou link expirado.")
          setIsLoadingTrip(false)
          return
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar viagem."
        console.error("[TRIP] erro ao carregar link", message)
        if (useSupabase && isOfflineRecoverableError(error)) {
          const offlineLoaded = await loadOfflinePackage("network")
          if (offlineLoaded) {
            return
          }
        }
        if (useSupabase) {
          setLoadError("Viagem nao encontrada ou link expirado.")
          setIsLoadingTrip(false)
          return
        }
      }

      if (isPublicRoute || isAdminRoute) {
        devLog("trip.notFound", routeSlug)
        setLoadError("Viagem nao encontrada ou link expirado.")
        setIsLoadingTrip(false)
        return
      }

      try {
        const portalTrips = extractTripsStoragePayload(window.localStorage.getItem(TRIPS_STORAGE_KEY)).trips
        const agencyTrips = extractAgencyStorageState(window.localStorage.getItem(AGENCY_STORAGE_KEY)).trips
        const allTrips = [...portalTrips, ...agencyTrips]
        const matchedTrip = allTrips.find((trip) => trip.slug === routeSlug || trip.id === routeSlug)

        if (matchedTrip) {
          setAgencyBranding({ name: null, logoUrl: null, isAgency: false })
          setTripData(buildTripDataFromStoredTrip(matchedTrip))
          setSectionsLoading({
            flights: false,
            hotels: false,
            itineraries: false,
            documents: false,
          })
          setIsLoadingTrip(false)
          return
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar viagem local."
        console.error("[TRIP] erro ao carregar link", message)
      }

      devLog("trip.notFound", routeSlug)
      setLoadError("Viagem nao encontrada ou link expirado.")
      setIsLoadingTrip(false)
    }

    void loadTrip()
  }, [params?.id, params?.slug, pathname, user?.id, authLoading])

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type })
  }

  const blockOfflineMutation = () => {
    if (!offlineModeEnabled) return false
    showToast("Indisponivel offline.", "info")
    return true
  }

  const callTripAdminApi = async <T,>(payload: Record<string, unknown>) => {
    const response = await fetch("/api/trip-admin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        tripId: tripData.id,
        tripSlug: routeSlug,
        adminToken: tripAdminToken,
      }),
    })

    const data = (await response.json().catch(() => null)) as T & { error?: string } | null
    return {
      ok: response.ok,
      data,
      error: response.ok ? null : data?.error || "Nao foi possivel concluir a acao administrativa.",
    }
  }

  const callTripAdminUploadApi = async <T,>(action: string, file: File, fields: Record<string, string>) => {
    const formData = new FormData()
    formData.set("action", action)
    formData.set("tripId", tripData.id)
    formData.set("tripSlug", routeSlug)
    if (tripAdminToken) {
      formData.set("adminToken", tripAdminToken)
    }
    Object.entries(fields).forEach(([key, value]) => {
      formData.set(key, value)
    })
    formData.set("file", file)

    const response = await fetch("/api/trip-admin", {
      method: "POST",
      body: formData,
    })

    const data = (await response.json().catch(() => null)) as T & { error?: string } | null
    return {
      ok: response.ok,
      data,
      error: response.ok ? null : data?.error || "Nao foi possivel concluir o upload administrativo.",
    }
  }

  const handleRequireAuthenticatedAdmin = () => {
    const target = pathname || `/viagem/${routeSlug}/admin`
    router.replace(`/login?redirect=${encodeURIComponent(target)}`)
  }

  const requireSensitiveAccess = (onGranted: () => void) => {
    if (!tripData.id) {
      showToast("Nao foi possivel validar a seguranca desta viagem.", "error")
      return
    }

    if (sensitiveAccessGranted) {
      onGranted()
      return
    }

    pendingSensitiveActionRef.current = onGranted
    setSecurityModalOpen(true)
  }

  const ensureSensitiveAccess = () => {
    if (!tripData.id) {
      showToast("Nao foi possivel validar a seguranca desta viagem.", "error")
      return false
    }

    if (!sensitiveAccessGranted) {
      setSecurityModalOpen(true)
      return false
    }

    return true
  }

  const handleConfigureQuickAccess = () => {
    setSecurityModalOpen(false)
    setSecuritySettingsOpen(true)
  }

  const handleNavigate = (section: string) => {
    if (section === "concierge") {
      document.getElementById("concierge")?.scrollIntoView({ behavior: "smooth" })
    } else if (section === "credits") {
      setCreditsOpen(true)
    } else {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth" })
    }
  }

  const handleUpdateTrip = (data: any) => {
    if (blockOfflineMutation()) return
    requireSensitiveAccess(() => {
      setTripData(prev => ({
        ...prev,
        destination: data.destination,
        country: data.country,
        dates: { start: data.startDate, end: data.endDate },
        status: data.status
      }))
      showToast("Viagem atualizada!", "success")
    })
  }

  const handleUpdateFlight = async (id: string, data: any) => {
    if (blockOfflineMutation()) return
    if (!ensureSensitiveAccess()) return
    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ flight?: TripFlightRecord }>({
          action: "upsertFlight",
          flightId: id,
          documentId: data.document?.id ?? data.documentId ?? null,
          airline: data.airline ?? null,
          flightNumber: data.flightNumber ?? null,
          bookingReference: data.bookingReference ?? null,
          originAirport: data.origin?.city ?? null,
          destinationAirport: data.destination?.city ?? null,
          departureAt: data.departureAt ?? null,
          arrivalAt: data.arrivalAt ?? null,
          passengerName: data.passengerName ?? null,
          qrCodePayload: data.qrCodePayload ?? null,
          baggageInfo: data.baggageInfo ?? null,
          terminal: data.terminal ?? null,
          gate: data.gate ?? null,
          seat: data.seat ?? null,
          extractedData: data.extractedData ?? {},
          extractionStatus: "manual",
        })
      : await upsertTripFlight({
          id,
          tripId: tripData.id,
          documentId: data.document?.id ?? data.documentId ?? null,
          airline: data.airline ?? null,
          flightNumber: data.flightNumber ?? null,
          bookingReference: data.bookingReference ?? null,
          originAirport: data.origin?.city ?? null,
          destinationAirport: data.destination?.city ?? null,
          departureAt: data.departureAt ?? null,
          arrivalAt: data.arrivalAt ?? null,
          passengerName: data.passengerName ?? null,
          qrCodePayload: data.qrCodePayload ?? null,
          baggageInfo: data.baggageInfo ?? null,
          terminal: data.terminal ?? null,
          gate: data.gate ?? null,
          seat: data.seat ?? null,
          extractedData: data.extractedData ?? {},
          extractionStatus: "manual",
        })

    const nextFlight = adminLinkMutationMode ? result.data?.flight ?? null : result.data
    if (result.error || !nextFlight) {
      showToast(resolveProtectedWriteError(result.error || "Nao foi possivel atualizar a passagem."), "error")
      return
    }

    setTripData(prev => ({
      ...prev,
      flights: prev.flights.map((flight: any) =>
        flight.id === id ? mapFlightRecordToView(nextFlight, prev.documents) : flight
      )
    }))
  }

  const handleAddFlight = (data: any) => {
    if (blockOfflineMutation()) return
    if (!ensureSensitiveAccess()) return

    const upsertById = (items: any[], item: any) => {
      const index = items.findIndex((entry) => entry?.id === item?.id)
      if (index === -1) return [...items, item]

      const nextItems = [...items]
      nextItems[index] = {
        ...nextItems[index],
        ...item,
      }
      return nextItems
    }

    setTripData(prev => ({
      ...prev,
      documents: data.document ? upsertById(prev.documents, { ...data.document, private: data.document.private ?? false }) : prev.documents,
      flights: data.flight ? upsertById(prev.flights, data.flight) : prev.flights,
    }))
  }

  const handleSaveHotel = async (data: any) => {
    if (blockOfflineMutation()) return
    console.log(data?.id ? "[HOTEL] update started" : "[HOTEL] create started")

    if (!tripData.id) {
      showToast("Viagem nao encontrada para salvar a hospedagem.", "error")
      return
    }

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleSaveHotel(data) })
      return
    }

    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ hotel?: any }>({
          action: "saveHotel",
          hotelId: data?.id ?? null,
          name: data.name,
          address: data.address,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          confirmationCode: data.confirmationCode,
          notes: data.notes,
        })
      : data?.id
        ? await updateTripHotel(data.id, {
            name: data.name,
            address: data.address,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            confirmationCode: data.confirmationCode,
            notes: data.notes,
          })
        : await createTripHotel({
            tripId: tripData.id,
            name: data.name,
            address: data.address,
            checkIn: data.checkIn,
            checkOut: data.checkOut,
            confirmationCode: data.confirmationCode,
            notes: data.notes,
          })

    const savedHotel = adminLinkMutationMode ? result.data?.hotel ?? null : result.data
    if (result.error || !savedHotel) {
      console.error("[HOTEL] error", result.error)
      showToast(resolveProtectedWriteError(result.error || "Nao foi possivel salvar a hospedagem."), "error")
      return
    }

    console.log("[HOTEL] success", savedHotel.id)
    setTripData(prev => ({
      ...prev,
      hotels: data?.id
        ? (Array.isArray(prev.hotels) ? prev.hotels : []).map((hotel: any) =>
            hotel.id === savedHotel.id
              ? { ...hotel, ...savedHotel, image: hotel.image || prev.heroImage, amenities: hotel.amenities || [] }
              : hotel,
          )
        : [
            ...(Array.isArray(prev.hotels) ? prev.hotels : []),
            {
              ...savedHotel,
              image: prev.heroImage,
              amenities: [],
            },
          ],
      hotel:
        data?.id
          ? ((Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === savedHotel.id)
              ? { ...(Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === savedHotel.id), ...savedHotel, image: prev.heroImage, amenities: [] }
              : { ...savedHotel, image: prev.heroImage, amenities: [] })
          : (prev.hotel ?? { ...savedHotel, image: prev.heroImage, amenities: [] }),
    }))
    showToast("Hospedagem salva com sucesso.", "success")
  }

  const handleDeleteHotel = async (hotelId: string) => {
    if (blockOfflineMutation()) return
    console.log("[HOTEL] delete started")

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteHotel(hotelId) })
      return
    }

    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ success?: boolean }>({
          action: "deleteHotel",
          hotelId,
        })
      : await deleteTripHotel(hotelId)

    const hotelDeleted = adminLinkMutationMode ? result.ok : result.success
    if (!hotelDeleted) {
      console.error("[HOTEL] error", result.error)
      showToast(resolveProtectedWriteError(result.error || "Nao foi possivel excluir a hospedagem."), "error")
      return
    }

    console.log("[HOTEL] success", hotelId)
    setTripData((prev) => {
      const nextHotels = (Array.isArray(prev.hotels) ? prev.hotels : []).filter((hotel: any) => hotel.id !== hotelId)
      return {
        ...prev,
        hotels: nextHotels,
        hotel: nextHotels[0] ?? null,
      }
    })
    showToast("Hospedagem removida com sucesso.", "success")
  }

  const syncTripItineraryRecord = (record: TripItineraryRecord) => {
    setTripItineraryRecords((prev) => [record, ...prev.filter((entry) => entry.id !== record.id)])
  }

  const handleUpdateItinerary = async (data: any) => {
    if (blockOfflineMutation()) return
    const normalizedDays = Array.isArray(data) ? data : []
    setTripData((prev) => ({ ...prev, itinerary: normalizedDays }))

    const currentSimpleRecord = resolveSimpleTripItinerary(tripItineraryRecords)
    const payloadContent = mapLegacyDaysToItineraryContent(normalizedDays, currentSimpleRecord?.content ?? null)
    const title = currentSimpleRecord?.title || `Roteiro simples - ${tripData.destination || "Viagem"}`

    if (shouldUseSupabase() && !adminLinkMutationMode) {
      if (!sensitiveAccessGranted) {
        requireSensitiveAccess(() => { void handleUpdateItinerary(normalizedDays) })
        return
      }

      if (!tripOwnerUserId) {
        showToast("Entre com login para salvar o roteiro simples desta viagem.", "error")
        return
      }
    }

    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ itinerary?: TripItineraryRecord }>({
          action: "saveSimpleItinerary",
          itineraryId: currentSimpleRecord?.id ?? null,
          title,
          content: payloadContent,
        })
      : await upsertTripItinerary({
          id: currentSimpleRecord?.id,
          tripId: tripData.id,
          title,
          mode: "simple",
          status: "completed",
          content: payloadContent,
          createdBy: currentSimpleRecord?.createdBy ?? tripOwnerUserId,
        })

    const nextItineraryRecord = adminLinkMutationMode ? result.data?.itinerary ?? null : result.data
    if (result.error || !nextItineraryRecord) {
      console.error("[ITINERARY] save simple error", result.error)
      showToast(resolveProtectedWriteError(result.error || "Nao foi possivel salvar o roteiro simples."), "error")
      return
    }

    syncTripItineraryRecord(nextItineraryRecord)
    showToast("Roteiro simples salvo com sucesso.", "success")
  }

  const handleGenerateItinerary = async (mode: "simple" | "complete_pdf") => {
    if (blockOfflineMutation()) return
    if (!ensureSensitiveAccess()) return

    const label = mode === "simple" ? "roteiro simples" : "roteiro completo"

    if (shouldUseSupabase() && !adminLinkMutationMode && !tripOwnerUserId) {
      showToast(`Entre com login para gerar o ${label} desta viagem.`, "error")
      return
    }

    const result = await requestAiItineraryGeneration({
      tripId: tripData.id,
      mode,
      tripSlug: routeSlug,
      adminToken: adminLinkMutationMode ? tripAdminToken : null,
    })

    if (result.error || !result.data?.itinerary) {
      console.error("[ITINERARY] generate error", result.error || result.data?.error)
      showToast(resolveProtectedWriteError(result.error || result.data?.error || `Nao foi possivel gerar o ${label}.`), "error")
      return
    }

    const nextItinerary = result.data.itinerary as TripItineraryRecord
    if (mode === "complete_pdf" && nextItinerary.status === "completed" && !nextItinerary.documentId && !result.data.document) {
      console.error("[ITINERARY] complete pdf missing document", nextItinerary)
      showToast("O roteiro foi marcado como concluido, mas nenhum documento valido foi retornado pelo backend.", "error")
      return
    }

    syncTripItineraryRecord(nextItinerary)

    if (nextItinerary.mode === "simple") {
      setTripData((prev) => ({
        ...prev,
        itinerary: mapItineraryContentToLegacyDays(nextItinerary.content),
      }))
      showToast("Roteiro simples gerado com IA.", "success")
    } else {
      if (result.data.document) {
        setTripData((prev) => ({
          ...prev,
          documents: [result.data.document, ...(Array.isArray(prev.documents) ? prev.documents.filter((entry: any) => entry.id !== result.data.document.id) : [])],
        }))
      }
      showToast("Roteiro completo em PDF gerado com sucesso.", "success")
    }
  }

  const handleSaveUploadedItinerary = (payload: { itinerary: TripItineraryRecord; document: any }) => {
    if (blockOfflineMutation()) return
    syncTripItineraryRecord(payload.itinerary)
    setTripData((prev) => ({
      ...prev,
      documents: [payload.document, ...(Array.isArray(prev.documents) ? prev.documents.filter((entry: any) => entry.id !== payload.document.id) : [])],
    }))
    showToast("Roteiro anexado com sucesso.", "success")
  }

  const handleDeleteItinerary = async (record: TripItineraryRecord) => {
    if (blockOfflineMutation()) return
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteItinerary(record) })
      return
    }

    const linkedDocument = record.documentId
      ? (Array.isArray(tripData.documents) ? tripData.documents : []).find((entry: any) => entry.id === record.documentId)
      : null

    const confirmed = window.confirm(
      linkedDocument
        ? "Excluir este roteiro e o arquivo vinculado?"
        : "Excluir este roteiro?"
    )
    if (!confirmed) return

    let storageWarning: string | null = null

    if (adminLinkMutationMode) {
      const deleteResult = await callTripAdminApi<{ success?: boolean }>({
        action: "deleteItinerary",
        itineraryId: record.id,
        documentId: linkedDocument?.id ?? null,
        documentPath: linkedDocument?.filePath ?? null,
      })

      if (!deleteResult.ok) {
        console.error("[ITINERARY] delete error", deleteResult.error)
        showToast(resolveProtectedWriteError(deleteResult.error || "Nao foi possivel excluir o roteiro."), "error")
        return
      }
    } else {
      if (linkedDocument?.filePath) {
        const storageResult = await deleteDocumentFile(linkedDocument.filePath)
        if (!storageResult.success) {
          console.error("[ITINERARY] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Nao foi possivel remover o arquivo do storage."
        }
      }

      const itineraryResult = await deleteTripItinerary(record.id)
      if (!itineraryResult.success) {
        console.error("[ITINERARY] delete error", itineraryResult.error)
        showToast(resolveProtectedWriteError(itineraryResult.error || "Nao foi possivel excluir o roteiro."), "error")
        return
      }

      if (linkedDocument?.id) {
        const documentResult = await deleteDocument(linkedDocument.id)
        if (!documentResult.success) {
          console.error("[ITINERARY] linked document delete error", documentResult.error)
          showToast(resolveProtectedWriteError(documentResult.error || "O roteiro foi removido, mas o documento vinculado nao foi excluido."), "error")
          return
        }
      }

      if (storageWarning) {
        showToast(storageWarning, "info")
      }
    }

    setTripItineraryRecords((prev) => prev.filter((entry) => entry.id !== record.id))
    setTripData((prev) => ({
      ...prev,
      itinerary: record.mode === "simple" ? [] : prev.itinerary,
      documents: linkedDocument?.id
        ? (Array.isArray(prev.documents) ? prev.documents : []).filter((entry: any) => entry.id !== linkedDocument.id)
        : prev.documents,
    }))

    showToast(storageWarning ? `Roteiro excluido. Aviso do storage: ${storageWarning}` : "Roteiro excluido com sucesso.", storageWarning ? "info" : "success")
  }

  const handleAddDocument = (data: any) => {
    if (blockOfflineMutation()) return
    requireSensitiveAccess(() => {
      setTripData(prev => ({
        ...prev,
        documents: [...prev.documents, { ...data, private: data.private ?? data.isPrivate ?? false }]
      }))
    })
  }

  const handleDeleteFlight = async (flightId: string) => {
    if (blockOfflineMutation()) return
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteFlight(flightId) })
      return
    }

    const flight = (Array.isArray(tripData.flights) ? tripData.flights : []).find((entry: any) => entry.id === flightId)
    if (!flight) {
      showToast("Passagem nao encontrada para exclusao.", "error")
      return
    }

    const confirmed = window.confirm(
      flight.document ? "Excluir esta passagem e o arquivo original vinculado?" : "Excluir esta passagem?"
    )
    if (!confirmed) return

    let storageWarning: string | null = null
    if (adminLinkMutationMode) {
      const deleteResult = await callTripAdminApi<{ success?: boolean }>({
        action: "deleteFlight",
        flightId,
        documentId: flight.document?.id ?? null,
        documentPath: flight.document?.filePath ?? null,
      })
      if (!deleteResult.ok) {
        console.error("[TICKET] flight delete error", deleteResult.error)
        showToast(resolveProtectedWriteError(deleteResult.error || "Nao foi possivel excluir a passagem."), "error")
        return
      }
    } else {
      if (flight.document?.filePath) {
        const storageResult = await deleteDocumentFile(flight.document.filePath)
        if (!storageResult.success) {
          console.error("[TICKET] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Nao foi possivel remover o arquivo do storage."
        }
      }

      const flightResult = await deleteTripFlight(flightId)
      if (!flightResult.success) {
        console.error("[TICKET] flight delete error", flightResult.error)
        showToast(resolveProtectedWriteError(flightResult.error || "Nao foi possivel excluir a passagem."), "error")
        return
      }

      if (flight.document?.id) {
        const documentResult = await deleteDocument(flight.document.id)
        if (!documentResult.success) {
          console.error("[TICKET] document delete error", documentResult.error)
          showToast(resolveProtectedWriteError(documentResult.error || "A passagem foi removida, mas o documento vinculado nao foi excluido."), "error")
          return
        }
      }
    }

    setTripData((prev) => ({
      ...prev,
      flights: (Array.isArray(prev.flights) ? prev.flights : []).filter((entry: any) => entry.id !== flightId),
      documents: flight.document?.id
        ? (Array.isArray(prev.documents) ? prev.documents : []).filter((document: any) => document.id !== flight.document.id)
        : prev.documents,
    }))

    showToast(storageWarning ? `Passagem excluida. Aviso do storage: ${storageWarning}` : "Passagem excluida com sucesso.", storageWarning ? "info" : "success")
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (blockOfflineMutation()) return
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteDocument(documentId) })
      return
    }

    const document = (Array.isArray(tripData.documents) ? tripData.documents : []).find((entry: any) => entry.id === documentId)
    if (!document) {
      showToast("Arquivo nao encontrado para exclusao.", "error")
      return
    }

    const linkedFlight = (Array.isArray(tripData.flights) ? tripData.flights : []).find((entry: any) => entry.document?.id === documentId)
    const confirmed = window.confirm(
      linkedFlight ? "Excluir este arquivo e a passagem vinculada?" : "Excluir este arquivo?"
    )
    if (!confirmed) return

    let storageWarning: string | null = null
    if (adminLinkMutationMode) {
      const deleteResult = await callTripAdminApi<{ success?: boolean }>({
        action: "deleteDocument",
        documentId,
        documentPath: document.filePath ?? null,
        linkedFlightId: linkedFlight?.id ?? null,
      })
      if (!deleteResult.ok) {
        console.error("[DOCUMENT] delete error", deleteResult.error)
        showToast(resolveProtectedWriteError(deleteResult.error || "Nao foi possivel excluir o arquivo."), "error")
        return
      }
    } else {
      if (document.filePath) {
        const storageResult = await deleteDocumentFile(document.filePath)
        if (!storageResult.success) {
          console.error("[DOCUMENT] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Nao foi possivel remover o arquivo do storage."
        }
      }

      if (linkedFlight) {
        const flightResult = await deleteTripFlight(linkedFlight.id)
        if (!flightResult.success) {
          console.error("[DOCUMENT] linked flight delete error", flightResult.error)
          showToast(resolveProtectedWriteError(flightResult.error || "Nao foi possivel excluir a passagem vinculada."), "error")
          return
        }
      }

      const documentResult = await deleteDocument(documentId)
      if (!documentResult.success) {
        console.error("[DOCUMENT] delete error", documentResult.error)
        showToast(resolveProtectedWriteError(documentResult.error || "Nao foi possivel excluir o arquivo."), "error")
        return
      }
    }

    setTripData((prev) => ({
      ...prev,
      documents: (Array.isArray(prev.documents) ? prev.documents : []).filter((entry: any) => entry.id !== documentId),
      flights: linkedFlight
        ? (Array.isArray(prev.flights) ? prev.flights : []).filter((entry: any) => entry.id !== linkedFlight.id)
        : prev.flights,
    }))

    showToast(storageWarning ? `Arquivo excluido. Aviso do storage: ${storageWarning}` : "Arquivo excluido com sucesso.", storageWarning ? "info" : "success")
  }

  const handleUpdateTravelers = (travelers: { name: string; avatar?: string; role: string }[]) => {
    if (blockOfflineMutation()) return
    requireSensitiveAccess(() => {
      setTripData(prev => ({ ...prev, travelers }))
    })
  }

  const handleSaveTripSettings = (data: { privacy: string; permissions: string; status: string; preferences: string }) => {
    if (blockOfflineMutation()) return
    requireSensitiveAccess(() => {
      setTripData(prev => ({ ...prev, status: data.status, tripPreferences: data }))
      setTripSettingsOpen(false)
      showToast("Configuracoes da viagem atualizadas.", "success")
    })
  }

  if (isLoadingTrip) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] px-6 py-5 text-sm text-white/60">
          Carregando viagem...
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <AlertCircle className="h-6 w-6 text-[#5de0e6]" />
          </div>
          <h1 className="text-xl font-semibold text-white">{loadError}</h1>
          <p className="mt-3 text-sm text-white/50">
            {loadError === "Voce nao tem permissao para editar esta viagem."
              ? "Entre com a conta proprietaria da viagem para acessar o modo administrador."
              : "Confira se o link esta correto ou peca um novo compartilhamento."}
          </p>
        </div>
      </main>
    )
  }

  if (adminRouteActive && !user && quickAccessGateRequired && !sensitiveAccessGranted) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="max-w-md rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
            <Lock className="h-6 w-6 text-[#5de0e6]" />
          </div>
          <h1 className="text-xl font-semibold text-white">Desbloqueie para editar esta viagem</h1>
          <p className="mt-3 text-sm text-white/50">
            Use PIN ou biometria configurados neste dispositivo para abrir o modo administrador sem login tradicional.
          </p>
          <SensitiveAccessModal
            open
            onClose={handleCloseSensitiveAccessModal}
            tripId={tripData.id}
            onSuccess={() => {
              setSensitiveAccessGranted(true)
              setQuickAccessGateRequired(false)
              setIsAdmin(true)
              setCanWrite(false)
              const pendingAction = pendingSensitiveActionRef.current
              pendingSensitiveActionRef.current = null
              setToast({ message: "Acesso rapido liberado para esta viagem.", type: "success" })
              pendingAction?.()
            }}
            onLogin={handleRequireAuthenticatedAdmin}
            onConfigureQuickAccess={handleConfigureQuickAccess}
          />
        </div>
      </main>
    )
  }

  return (
    <PermissionContext.Provider value={{ isAdmin, canWrite, setIsAdmin }}>
      <ToastContext.Provider value={{ showToast }}>
        <main className="min-h-screen bg-black text-white">
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#004aad]/10 via-transparent to-transparent pointer-events-none" />
          <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBoMXYxaC0xeiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] pointer-events-none opacity-50" />
          <FloatingParticles />

          <TripHeader tripData={tripData} agencyBranding={agencyBranding} onOpenShare={() => setShareOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
          {offlineModeEnabled && offlinePackageStatus ? <OfflineModeBanner status={offlinePackageStatus} /> : null}
          <TripHero tripData={tripData} onEditTrip={() => setEditTripOpen(true)} />
          <QuickAccessCards tripData={tripData} onNavigate={handleNavigate} />
          <FlightsSection loading={sectionsLoading.flights} tripData={tripData} onUpdateFlight={handleUpdateFlight} onAddFlight={handleAddFlight} onDeleteFlight={handleDeleteFlight} onDeleteDocument={handleDeleteDocument} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} routeSlug={routeSlug} tripAdminToken={tripAdminToken} adminLinkMutationMode={adminLinkMutationMode} ensureSensitiveAccess={ensureSensitiveAccess} offlineReadOnly={offlineModeEnabled} offlineDocumentContext={offlineDocumentContext} />
          <HotelSection loading={sectionsLoading.hotels} tripData={tripData} onSaveHotel={handleSaveHotel} onDeleteHotel={handleDeleteHotel} />
          <ItinerarySection
            loading={sectionsLoading.itineraries}
            tripData={tripData}
            itineraryRecords={tripItineraryRecords}
            offlineReadOnly={offlineModeEnabled}
            offlineDocumentContext={offlineDocumentContext}
            tripId={tripData.id}
            ownerUserId={tripOwnerUserId}
            agencyId={profile?.agencyId ?? null}
            routeSlug={routeSlug}
            tripAdminToken={tripAdminToken}
            adminLinkMutationMode={adminLinkMutationMode}
            ensureSensitiveAccess={ensureSensitiveAccess}
            onUpdateItinerary={handleUpdateItinerary}
            onGenerateSimple={() => handleGenerateItinerary("simple")}
            onGenerateComplete={() => handleGenerateItinerary("complete_pdf")}
            onSaveUploadedItinerary={handleSaveUploadedItinerary}
            onDeleteItinerary={handleDeleteItinerary}
          />
          <DocumentsSection loading={sectionsLoading.documents} tripData={tripData} onAddDocument={handleAddDocument} onDeleteDocument={handleDeleteDocument} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} routeSlug={routeSlug} tripAdminToken={tripAdminToken} adminLinkMutationMode={adminLinkMutationMode} ensureSensitiveAccess={ensureSensitiveAccess} offlineReadOnly={offlineModeEnabled} offlineDocumentContext={offlineDocumentContext} />
          <ConciergeSection tripData={tripData} onOpenCredits={() => setCreditsOpen(true)} offlineReadOnly={offlineModeEnabled} />
          <OfflineSection tripData={tripData} isAdmin={isAdmin} sensitiveAccessGranted={sensitiveAccessGranted} agencyBranding={agencyBranding} />
          <QuickInfoSection tripData={tripData} />
          <TripFooter agencyBranding={agencyBranding} />

          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} tripData={tripData} />
          <SensitiveAccessModal
            open={securityModalOpen}
            onClose={handleCloseSensitiveAccessModal}
            tripId={tripData.id}
            onSuccess={() => {
              setSensitiveAccessGranted(true)
              setSecurityModalOpen(false)
              const pendingAction = pendingSensitiveActionRef.current
              pendingSensitiveActionRef.current = null
              setToast({ message: "Acesso rapido liberado para acoes sensiveis.", type: "success" })
              pendingAction?.()
            }}
            onLogin={handleRequireAuthenticatedAdmin}
            onConfigureQuickAccess={handleConfigureQuickAccess}
          />
          <MenuModal
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onOpenTravelers={() => {
              setMenuOpen(false)
              setTravelersOpen(true)
            }}
            onOpenSettings={() => {
              setMenuOpen(false)
              setTripSettingsOpen(true)
            }}
            onOpenSecurity={() => {
              setMenuOpen(false)
              setSecuritySettingsOpen(true)
            }}
            onOpenCredits={() => {
              setMenuOpen(false)
              setCreditsOpen(true)
            }}
          />
          <EditTripModal open={editTripOpen} onClose={() => setEditTripOpen(false)} tripData={tripData} onSave={handleUpdateTrip} />
          <TravelersModal open={travelersOpen} onClose={() => setTravelersOpen(false)} travelers={tripData.travelers} onUpdateTravelers={handleUpdateTravelers} />
          <TripSettingsModal open={tripSettingsOpen} onClose={() => setTripSettingsOpen(false)} tripData={tripData} onSave={handleSaveTripSettings} />
          <TripSecurityModal open={securitySettingsOpen} onClose={() => setSecuritySettingsOpen(false)} tripId={tripData.id} tripTitle={tripData.destination} onSecurityUpdated={() => setToast({ message: "Seguranca do dispositivo atualizada.", type: "success" })} />
          <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} credits={tripData.credits} />

          <AnimatePresence>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </AnimatePresence>
        </main>
      </ToastContext.Provider>
    </PermissionContext.Provider>
  )
}
