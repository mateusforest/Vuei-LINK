"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import Image from "next/image"
import { useParams, usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { extractAgencyStorageState } from "@/lib/mappers/agency-mappers"
import { extractTripsStoragePayload } from "@/lib/mappers/trip-mappers"
import { shouldUseSupabase } from "@/lib/data-source"
import { getTripByAdminToken, getTripByPublicToken, getTripBySlug } from "@/lib/repositories/trips-repository"
import { createDocumentMetadata, getSignedDocumentUrl, listDocumentsByTrip, listPublicTripDocuments, uploadDocumentFile } from "@/lib/repositories/documents-repository"
import { createTripHotel, deleteTripHotel, listTripHotels, updateTripHotel } from "@/lib/repositories/trip-hotels-repository"
import { validateDocumentFile } from "@/lib/files/file-validation"
import { getDestinationCoverImage, getDestinationMetadata } from "@/lib/trip-destination"
import { useAuth } from "@/contexts/auth-context"
import { buildAdminTripUrl, buildPublicTripUrl, isAdminLinkMode } from "@/lib/security/link-tokens"
import {
  authenticateQuickAccessBiometric,
  getQuickAccessMethods,
  verifyQuickAccessPin,
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
  const flights = Array.isArray(storedTrip.flights) ? storedTrip.flights : []
  const itinerary = Array.isArray(storedTrip.itinerary) ? storedTrip.itinerary : []
  const documents = Array.isArray(storedTrip.documents) ? storedTrip.documents : []
  const heroImage = storedTrip.coverImage || getDestinationCoverImage(storedTrip.destination, storedTrip.city || city, storedTrip.country || country)
  const quickInfo = buildQuickInfo(storedTrip.destination, storedTrip.country || country, storedTrip.city || city)

  console.log("[LINK] cover resolved", heroImage)
  console.log("[LINK] metadata resolved", quickInfo)

  return normalizeTripViewData({
    ...initialTripData,
    id: storedTrip.id || storedTrip.slug || initialTripData.id,
    destination: city || storedTrip.title || "Minha Viagem",
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
    return "Desbloqueio concluido, mas esta acao ainda exige login da conta proprietaria para salvar no banco."
  }

  return error || "Nao foi possivel concluir esta acao."
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
function TripHeader({ tripData, onOpenShare, onOpenMenu }: { tripData: any; onOpenShare: () => void; onOpenMenu: () => void }) {
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
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Image src="/vuei-logo.png" alt="Vuei" width={80} height={32} className="h-7 w-auto" />
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
  const { isAdmin } = useContext(PermissionContext)
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
              {isAdmin && (
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
function FlightCard({ flight, index, onEdit, onViewQR }: { flight: any; index: number; onEdit: () => void; onViewQR: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const { isAdmin } = useContext(PermissionContext)

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
              <Plane className={cn("w-5 h-5 text-[#5de0e6]", flight.type === "volta" && "rotate-180")} />
            </div>
            <div>
              <p className="text-sm text-white/50">{flight.type === "ida" ? "Ida" : "Volta"}</p>
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
                  <p className="text-sm text-white font-medium">{flight.terminal}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Portao</p>
                  <p className="text-sm text-white font-medium">{flight.gate}</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Assento</p>
                  <p className="text-sm text-white font-medium">{flight.seat}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-400">Confirmado</span>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit() }} className="text-white/60 hover:bg-white/10">
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onViewQR() }} className="text-[#5de0e6] hover:bg-[#5de0e6]/10">
                    <QrCode className="w-4 h-4 mr-2" />
                    Ver QR Code
                  </Button>
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
    <Modal open={open} onClose={onClose} title={`Editar Voo ${flight.type === "ida" ? "de Ida" : "de Volta"}`}>
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
            <label className="text-xs text-white/50 uppercase tracking-wider">Origem (Codigo)</label>
            <input
              type="text"
              value={formData.origin?.code || ""}
              onChange={(e) => setFormData({ ...formData, origin: { ...formData.origin, code: e.target.value } })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Destino (Codigo)</label>
            <input
              type="text"
              value={formData.destination?.code || ""}
              onChange={(e) => setFormData({ ...formData, destination: { ...formData.destination, code: e.target.value } })}
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
    <Modal open={open} onClose={onClose} title="Boarding Pass">
      <div className="text-center">
        <div className="w-48 h-48 mx-auto mb-6 bg-white rounded-2xl p-4 flex items-center justify-center">
          <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2ZmZiIvPjxwYXRoIGQ9Ik0xMCAxMGgyMHYyMEgxMHptMzAgMGgyMHYyMEg0MHptMzAgMGgyMHYyMEg3MHptMzAgMGgyMHYyMEgxMDB6bTMwIDBoMjB2MjBIMTMwem0zMCAwaDIwdjIwSDE2MHptLTE1MCAzMGgyMHYyMEgxMHptNjAgMGgyMHYyMEg3MHptNjAgMGgyMHYyMEgxMzB6bS0xMjAgMzBoMjB2MjBIMTB6bTMwIDBoMjB2MjBINDB6bTMwIDBoMjB2MjBINzB6bTMwIDBoMjB2MjBIMTAwem0zMCAwaDIwdjIwSDEzMHptMzAgMGgyMHYyMEgxNjB6bS0xNTAgMzBoMjB2MjBIMTB6bTYwIDBoMjB2MjBINzB6bTMwIDBoMjB2MjBIMTAwem0zMCAwaDIwdjIwSDEzMHptMzAgMGgyMHYyMEgxNjB6bS0xNTAgMzBoMjB2MjBIMTB6bTMwIDBoMjB2MjBINDB6bTMwIDBoMjB2MjBINzB6bTMwIDBoMjB2MjBIMTAwem0zMCAwaDIwdjIwSDEzMHptMzAgMGgyMHYyMEgxNjB6bS0xNTAgMzBoMjB2MjBIMTB6bTMwIDBoMjB2MjBINDB6bTMwIDBoMjB2MjBINzB6bTYwIDBoMjB2MjBIMTYweiIgZmlsbD0iIzAwMCIvPjwvc3ZnPg==')] bg-contain" />
        </div>
        <p className="text-white font-semibold text-lg">{flight.flightNumber}</p>
        <p className="text-white/60 text-sm mt-1">{flight.origin.code} → {flight.destination.code}</p>
        <p className="text-white/40 text-xs mt-4">Apresente este codigo no embarque</p>
      </div>
    </Modal>
  )
}

// Flights Section
function FlightsSection({ tripData, onUpdateFlight, onAddFlight, tripId, ownerUserId, agencyId, ensureSensitiveAccess }: { tripData: any; onUpdateFlight: (id: number, data: any) => void; onAddFlight: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; ensureSensitiveAccess: () => boolean }) {
  const [editingFlight, setEditingFlight] = useState<any>(null)
  const [viewingQR, setViewingQR] = useState<any>(null)
  const [addingFlight, setAddingFlight] = useState(false)
  const { isAdmin } = useContext(PermissionContext)
  const { showToast } = useToast()
  const flights = Array.isArray(tripData.flights) ? tripData.flights : []
  const ticketDocuments = Array.isArray(tripData.documents) ? tripData.documents.filter((document: any) => document.type === "ticket") : []

  const handleSaveFlight = (data: any) => {
    onUpdateFlight(data.id, data)
    showToast("Voo atualizado com sucesso!", "success")
  }

  const handleOpenTicketDocument = async (document: any) => {
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
              <p className="text-sm text-white/40">{flights.length > 0 ? `${flights.length} voos confirmados` : `${ticketDocuments.length} passagem(ns) anexada(s)`}</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingFlight(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Anexar
            </Button>
          )}
        </motion.div>

        {flights.length === 0 && ticketDocuments.length === 0 ? (
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
            />
          ))}
          {ticketDocuments.map((document: any) => (
            <div key={document.id} className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-sm font-medium text-white">{document.name}</p>
              <p className="mt-2 text-xs text-white/40">Arquivo de passagem anexado</p>
              <p className="mt-1 text-xs text-white/30">{document.mimeType || "Nao informado"}</p>
              <div className="mt-4">
                <Button size="sm" variant="outline" className="border-white/10 text-white/70" onClick={() => void handleOpenTicketDocument(document)}>
                  <Download className="mr-2 h-4 w-4" />
                  Abrir anexo
                </Button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      <EditFlightModal open={!!editingFlight} onClose={() => setEditingFlight(null)} flight={editingFlight} onSave={handleSaveFlight} />
      <QRCodeModal open={!!viewingQR} onClose={() => setViewingQR(null)} flight={viewingQR} />
      <AddFlightModal open={addingFlight} onClose={() => setAddingFlight(false)} tripId={tripId} ownerUserId={ownerUserId} agencyId={agencyId} ensureSensitiveAccess={ensureSensitiveAccess} onSave={(data) => { onAddFlight(data); showToast("Arquivo anexado. A leitura automatica estara disponivel em breve.", "info"); setAddingFlight(false) }} />
    </section>
  )
}

// Add Flight Modal
function AddFlightModal({ open, onClose, onSave, tripId, ownerUserId, agencyId, ensureSensitiveAccess }: { open: boolean; onClose: () => void; onSave: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; ensureSensitiveAccess: () => boolean }) {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")

  const handleFileUpload = async (file?: File | null) => {
    if (!file) return
    if (!ownerUserId) {
      setError("Desbloqueie com PIN ou Face ID para anexar esta passagem.")
      return
    }
    if (!ensureSensitiveAccess()) {
      setError("Desbloqueie com PIN ou biometria antes de anexar passagens.")
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

    const path = `${ownerUserId}/${tripId}/tickets/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
    const uploadResult = await uploadDocumentFile(file, path)
    if (uploadResult.error || !uploadResult.data) {
      console.error("[TICKET] upload error", uploadResult.error)
      setError(resolveProtectedWriteError(uploadResult.error || "Nao foi possivel anexar a passagem."))
      setUploading(false)
      return
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
      console.error("[TICKET] upload error", metadataResult.error)
      setError(resolveProtectedWriteError(metadataResult.error || "Nao foi possivel registrar a passagem."))
      setUploading(false)
      return
    }

    console.log("[TICKET] upload success", metadataResult.data.id)
    onSave(metadataResult.data)
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
          <p className="text-sm text-white/70">Arquivo anexado. A leitura automatica estara disponivel em breve.</p>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </Modal>
  )
}

// Hotel Section
function HotelSection({
  tripData,
  onSaveHotel,
  onDeleteHotel,
}: {
  tripData: any
  onSaveHotel: (data: any) => void
  onDeleteHotel: (hotelId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState<any>(null)
  const { isAdmin } = useContext(PermissionContext)
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
          {isAdmin && (
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

        {hotels.length === 0 ? (
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
                    {isAdmin && (
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

// Itinerary Section
function ItinerarySection({ tripData, onUpdateItinerary }: { tripData: any; onUpdateItinerary: (data: any) => void }) {
  const [activeDay, setActiveDay] = useState(1)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [addingItem, setAddingItem] = useState(false)
  const { isAdmin } = useContext(PermissionContext)
  const { showToast } = useToast()
  const itinerary = Array.isArray(tripData.itinerary) ? tripData.itinerary : []

  const activeItinerary = itinerary.find((d: any) => d.day === activeDay)

  const upsertItineraryDay = (dayNumber: number, updater: (currentItems: any[]) => any[]) => {
    const existingDay = itinerary.find((entry: any) => entry.day === dayNumber)
    const nextItems = updater(Array.isArray(existingDay?.items) ? existingDay.items : [])

    if (!existingDay) {
      onUpdateItinerary([
        ...itinerary,
        {
          day: dayNumber,
          date: `Dia ${dayNumber}`,
          title: `Dia ${dayNumber}`,
          items: nextItems,
        },
      ])
      return
    }

    onUpdateItinerary(
      itinerary.map((entry: any) =>
        entry.day === dayNumber
          ? {
              ...entry,
              items: nextItems,
            }
          : entry,
      ),
    )
  }

  return (
    <section id="itinerary" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Roteiro</h2>
              <p className="text-sm text-white/40">{itinerary.length} dias planejados</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingItem(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </motion.div>

        {itinerary.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhum roteiro criado.
          </div>
        ) : (
        <>
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
                  : "bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white hover:border-white/10"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider opacity-60">Dia {day.day}</p>
              <p className="text-sm font-medium mt-0.5">{day.date}</p>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeItinerary && (
            <motion.div
              key={activeDay}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <h3 className="text-lg font-medium text-white mb-6">{activeItinerary.title}</h3>
              
              <div className="relative pl-8">
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-[#5de0e6]/50 via-[#004aad]/30 to-transparent" />
                
                <div className="space-y-6">
                  {activeItinerary.items.map((item: any, i: number) => {
                    const IconComponent = iconMap[item.icon] || MapPin
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative group"
                      >
                        <div className={cn(
                          "absolute -left-8 top-1 w-6 h-6 rounded-full flex items-center justify-center",
                          item.highlight ? "bg-gradient-to-br from-[#5de0e6] to-[#004aad]" : "bg-white/10 border border-white/20"
                        )}>
                          <IconComponent className={cn("w-3 h-3", item.highlight ? "text-white" : "text-white/60")} />
                        </div>

                        <div 
                          onClick={() => isAdmin && setEditingItem(item)}
                          className={cn(
                            "p-4 rounded-xl transition-all duration-300",
                            item.highlight
                              ? "bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20"
                              : "bg-white/[0.02] border border-white/[0.06] hover:border-white/10",
                            isAdmin && "cursor-pointer"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs text-[#5de0e6] font-medium">{item.time}</p>
                              <p className="text-white font-medium mt-1">{item.title}</p>
                            </div>
                            {isAdmin ? (
                              <Edit3 className="w-4 h-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-white/30" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
        )}
      </div>

      <EditItineraryItemModal 
        open={!!editingItem} 
        onClose={() => setEditingItem(null)} 
        item={editingItem} 
        onSave={(data) => { 
          upsertItineraryDay(activeDay, (items) =>
            items.map((item: any) => (item.id === editingItem.id ? { ...item, ...data } : item)),
          )
          showToast("Atividade atualizada!", "success"); 
          setEditingItem(null) 
        }}
        onDelete={() => {
          upsertItineraryDay(activeDay, (items) => items.filter((item: any) => item.id !== editingItem.id))
          showToast("Atividade removida!", "success");
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
  id: Date.now(),
  icon: data.type === "food" ? "UtensilsCrossed" : data.type === "transport" ? "Car" : "MapPin",
  ...data,
  },
  ])
  showToast("Atividade adicionada!", "success");
  setAddingItem(false)
  }}
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
  const [formData, setFormData] = useState({ title: "", time: "", type: "attraction", highlight: false })

  return (
    <Modal open={open} onClose={onClose} title="Adicionar ao Roteiro">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-[#5de0e6]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Dia {day}</p>
            <p className="text-xs text-white/40">Adicione atividades manualmente. A geracao automatica ainda nao esta conectada.</p>
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
  onAddDocument,
  tripId,
  ownerUserId,
  agencyId,
  tripOwnerUserId,
  profileSettings,
  ensureSensitiveAccess,
}: {
  tripData: any
  onAddDocument: (data: any) => void
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  tripOwnerUserId: string | null
  profileSettings: any
  ensureSensitiveAccess: () => boolean
}) {
  const [showPrivate, setShowPrivate] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [addingDoc, setAddingDoc] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<any>(null)
  const [pinModal, setPinModal] = useState(false)
  const { isAdmin } = useContext(PermissionContext)
  const { showToast } = useToast()

  const documents = Array.isArray(tripData.documents) ? tripData.documents : []
  const publicDocs = documents.filter((d: any) => !d.private)
  const privateDocs = documents.filter((d: any) => d.private)

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
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Documentos</h2>
              <p className="text-sm text-white/40">{documents.length} arquivos</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="text-[#5de0e6] hover:bg-[#5de0e6]/10" onClick={() => setAddingDoc(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          )}
        </motion.div>

        {documents.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhum documento adicionado.
          </div>
        ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {publicDocs.map((doc: any, i: number) => (
            <motion.button
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setViewingDoc(doc)}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#5de0e6]/30 transition-all duration-300 text-left"
            >
              <span className="text-2xl">{getDocIcon(doc.type)}</span>
              <p className="text-sm text-white font-medium mt-2 truncate">{doc.name}</p>
              <p className="text-xs text-white/40 mt-1">Compartilhavel</p>
            </motion.button>
          ))}
        </div>
        )}

        {isAdmin && privateDocs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="p-5 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.06]">
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-white/[0.06]">
                    {privateDocs.map((doc: any, i: number) => (
                      <motion.button
                        key={doc.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => setViewingDoc(doc)}
                        className="p-3 rounded-xl bg-[#004aad]/10 border border-[#004aad]/30 hover:border-[#5de0e6]/50 transition-all duration-300 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{getDocIcon(doc.type)}</span>
                          <Shield className="w-3 h-3 text-[#5de0e6]" />
                        </div>
                        <p className="text-sm text-white font-medium mt-2 truncate">{doc.name}</p>
                      </motion.button>
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
        ownerUserId={tripOwnerUserId}
        profileSettings={profileSettings ?? null}
        onSuccess={() => {
          setUnlocked(true)
          setPinModal(false)
          showToast("Documentos desbloqueados!", "success")
        }}
      />
      <ViewDocumentModal open={!!viewingDoc} onClose={() => setViewingDoc(null)} document={viewingDoc} />
      <AddDocumentModal open={addingDoc} onClose={() => setAddingDoc(false)} tripId={tripId} ownerUserId={ownerUserId} agencyId={agencyId} ensureSensitiveAccess={ensureSensitiveAccess} onSave={(data) => { onAddDocument(data); showToast("Documento adicionado!", "success"); setAddingDoc(false) }} />
    </section>
  )
}

// PIN Modal
function PinModal({
  open,
  onClose,
  onSuccess,
  ownerUserId,
  profileSettings,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  ownerUserId: string | null
  profileSettings: any
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAccessMethods = getQuickAccessMethods(ownerUserId, profileSettings)

  const handleSubmit = async () => {
    if (pin.length !== 4 || !ownerUserId) return

    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await verifyQuickAccessPin(ownerUserId, pin, { profileSettings })
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

  const handleBiometricUnlock = async () => {
    if (!ownerUserId) return

    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await authenticateQuickAccessBiometric(ownerUserId)
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
        <p className="text-white/60 text-sm mb-6">Digite seu PIN de 4 digitos</p>
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(
              "w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold transition-all",
              pin.length > i ? "bg-[#5de0e6]/20 border-[#5de0e6]/50 text-white" : "bg-white/[0.05] border-white/10 text-white/20"
            )}>
              {pin.length > i ? "•" : ""}
            </div>
          ))}
        </div>
        <input
          type="tel"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white text-center text-xl tracking-[1em] focus:outline-none focus:border-[#5de0e6]/50"
          placeholder="• • • •"
        />
        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        <Button onClick={() => void handleSubmit()} disabled={isSubmitting || pin.length !== 4 || !ownerUserId} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
          Desbloquear
        </Button>
        {quickAccessMethods.biometricEnabled && (
          <Button
            variant="outline"
            onClick={() => void handleBiometricUnlock()}
            disabled={isSubmitting || !ownerUserId}
            className="w-full mt-3 border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]"
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            Usar Face ID / biometria
          </Button>
        )}
        <p className="text-xs text-white/30 mt-4">O PIN desta area usa a configuracao de acesso rapido vinculada a sua conta. A biometria continua sendo por dispositivo.</p>
      </div>
    </Modal>
  )
}

// View Document Modal
function ViewDocumentModal({ open, onClose, document }: { open: boolean; onClose: () => void; document: any }) {
  if (!document) return null

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
            <p className="text-white/20 text-sm">Visualizacao do PDF/Imagem</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0" onClick={async () => {
            const urlResult = document.filePath ? await getSignedDocumentUrl(document.filePath) : { data: document.fileUrl, error: null }
            if (urlResult.data) {
              window.open(urlResult.data, "_blank", "noopener,noreferrer")
            }
          }}>
            <Download className="w-4 h-4 mr-2" />
            Baixar
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
function AddDocumentModal({ open, onClose, onSave, tripId, ownerUserId, agencyId, ensureSensitiveAccess }: { open: boolean; onClose: () => void; onSave: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; ensureSensitiveAccess: () => boolean }) {
  const [formData, setFormData] = useState({ name: "", type: "voucher", private: false })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const handleUpload = async (file?: File | null) => {
    if (!file) return
    if (!ownerUserId) {
      setError("Desbloqueie com PIN ou Face ID para anexar este documento.")
      return
    }
    if (!ensureSensitiveAccess()) {
      setError("Desbloqueie com PIN ou biometria antes de anexar documentos.")
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
    const path = `${ownerUserId}/${tripId}/documents/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
    const uploadResult = await uploadDocumentFile(file, path)
    if (uploadResult.error || !uploadResult.data) {
      console.error("[DOCUMENT] upload error", uploadResult.error)
      setError(resolveProtectedWriteError(uploadResult.error || "Nao foi possivel anexar o documento."))
      setUploading(false)
      return
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

    if (metadataResult.error || !metadataResult.data) {
      console.error("[DOCUMENT] upload error", metadataResult.error)
      setError(resolveProtectedWriteError(metadataResult.error || "Nao foi possivel registrar o documento."))
      setUploading(false)
      return
    }

    console.log("[DOCUMENT] upload success", metadataResult.data.id)
    setUploading(false)
    onSave(metadataResult.data)
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
function ConciergeSection({ tripData, onOpenCredits }: { tripData: any; onOpenCredits: () => void }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Ola! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informacoes reais que ja estejam adicionadas.` }
  ])
  const [typing, setTyping] = useState(false)
  const { isAdmin } = useContext(PermissionContext)
  const hasFlights = Array.isArray(tripData.flights) && tripData.flights.length > 0
  const hasHotel = Boolean(tripData.hotel)
  const hasItinerary = Array.isArray(tripData.itinerary) && tripData.itinerary.length > 0

  useEffect(() => {
    setMessages([
      { role: "assistant", content: `Ola! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informacoes reais que ja estejam adicionadas.` }
    ])
  }, [tripData.destination])

  const suggestions = [
    "Mostrar hospedagem",
    "Mostrar roteiro",
    "Mostrar passagens",
    "Mostrar documentos"
  ]

  const handleSend = () => {
    if (!message.trim()) return
    
    setMessages(prev => [...prev, { role: "user", content: message }])
    const userMessage = message.toLowerCase()
    setMessage("")
    setTyping(true)
    
    setTimeout(() => {
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
      setMessages(prev => [...prev, { role: "assistant", content: response }])
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
                className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50 transition-colors"
              />
              <Button onClick={handleSend} className="bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
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
  onOpenCredits,
}: {
  open: boolean
  onClose: () => void
  onOpenTravelers: () => void
  onOpenSettings: () => void
  onOpenCredits: () => void
}) {
  const { isAdmin } = useContext(PermissionContext)
  const menuItems = [
    ...(isAdmin ? [
      { icon: User, label: "Viajantes", action: onOpenTravelers },
      { icon: Settings, label: "Configuracoes", action: onOpenSettings },
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
  const { isAdmin } = useContext(PermissionContext)
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
    if (!isAdmin) return
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
    if (!isAdmin) return
    onUpdateTravelers(travelers.filter((_, travelerIndex) => travelerIndex !== index))
    showToast("Viajante removido.", "success")
    if (editingIndex === index) resetForm()
  }

  const handleSetPrimary = (index: number) => {
    if (!isAdmin) return
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
                  {isAdmin && (
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
              {isAdmin && traveler.role !== "principal" && (
                <button onClick={() => handleSetPrimary(index)} className="mt-3 text-xs font-medium text-[#5de0e6]">
                  Definir como responsavel principal
                </button>
              )}
            </div>
          ))}
        </div>

        {isAdmin ? (
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
  const { isAdmin } = useContext(PermissionContext)
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
            onChange={(e) => isAdmin && setForm((prev) => ({ ...prev, preferences: e.target.value }))}
            disabled={!isAdmin}
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
                  onClick={() => isAdmin && setForm((prev) => ({ ...prev, privacy }))}
                  disabled={!isAdmin}
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
                  onClick={() => isAdmin && setForm((prev) => ({ ...prev, permissions: permission }))}
                  disabled={!isAdmin}
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
                onClick={() => isAdmin && setForm((prev) => ({ ...prev, status }))}
                disabled={!isAdmin}
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
        {isAdmin ? (
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

// Offline Section
function OfflineSection() {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const { showToast } = useToast()

  const handleDownload = () => {
    setDownloading(true)
    setTimeout(() => {
      setDownloading(false)
      setDownloaded(true)
      showToast("Viagem salva offline!", "success")
    }, 2000)
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
              <p className="text-sm text-white/40 mb-4">{downloaded ? "Todos os seus documentos, vouchers e roteiros estao disponiveis mesmo sem internet." : "Baixe roteiros, documentos e vouchers para acessar durante a viagem, mesmo sem conexao."}</p>
              
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {["Roteiro", "Vouchers", "Documentos", "Contatos"].map((item) => (
                  <span key={item} className={cn("px-3 py-1 text-xs rounded-full", downloaded ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.05] text-white/40")}>
                    {downloaded && <Check className="w-3 h-3 inline mr-1" />}
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <Button onClick={handleDownload} disabled={downloading || downloaded} className={cn("px-6 py-6 rounded-xl transition-all duration-300", downloaded ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0")}>
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
                onClick={() => showToast(`${plan.mode} mock iniciado para ${plan.name}.`, "success")}
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
function TripFooter() {
  return (
    <footer className="py-12 px-4 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image src="/vuei-logo.png" alt="Vuei" width={80} height={32} className="h-6 w-auto opacity-60" />
            <span className="text-sm text-white/30">Sua viagem inteligente</span>
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
  ownerUserId,
  profileSettings,
  onClose,
  onSuccess,
  onLogin,
  onConfigureQuickAccess,
}: {
  open: boolean
  ownerUserId: string | null
  profileSettings: any
  onClose: () => void
  onSuccess: () => void
  onLogin: () => void
  onConfigureQuickAccess: () => void
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAccessMethods = getQuickAccessMethods(ownerUserId, profileSettings)

  const handlePinUnlock = async () => {
    if (!ownerUserId) {
      setError("Configure o PIN desta conta ou use a biometria deste dispositivo para continuar.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await verifyQuickAccessPin(ownerUserId, pin, { profileSettings })
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

  const handleBiometricUnlock = async () => {
    if (!ownerUserId) {
      setError("Configure o PIN desta conta ou use a biometria deste dispositivo para continuar.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const success = await authenticateQuickAccessBiometric(ownerUserId)
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
          Use PIN ou biometria para liberar acoes sensiveis desta viagem. Se o banco exigir autenticacao para salvar, voce podera entrar apenas nesse momento.
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
                className="text-center text-xl tracking-[0.6em]"
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

          {!quickAccessMethods.pinEnabled && !quickAccessMethods.biometricEnabled && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
              Acesso rapido nao configurado neste dispositivo ou nesta conta.
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
          Configurar acesso rapido neste dispositivo
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
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [tripOwnerUserId, setTripOwnerUserId] = useState<string | null>(null)
  const [sensitiveAccessGranted, setSensitiveAccessGranted] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [quickAccessGateRequired, setQuickAccessGateRequired] = useState(false)
  const pendingSensitiveActionRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setSensitiveAccessGranted(false)
    pendingSensitiveActionRef.current = null
    setQuickAccessGateRequired(false)
  }, [tripOwnerUserId, user?.id, params?.id, params?.slug])

  useEffect(() => {
    if (typeof window === "undefined") return

    const routeSlug =
      typeof params?.id === "string"
        ? params.id
        : typeof params?.slug === "string"
          ? params.slug
          : initialTripData.id
    const searchParams = new URLSearchParams(window.location.search)
    const adminToken = searchParams.get("adminToken")
    const publicToken = searchParams.get("token") || searchParams.get("publicToken")
    const isPublicRoute = pathname?.startsWith("/v/") ?? false
    const isAdminRoute = isAdminLinkMode(searchParams, pathname)

    setIsAdmin(false)
    setCanWrite(false)

    const loadTrip = async () => {
      setIsLoadingTrip(true)
      setLoadError(null)
      console.log("[TRIP] carregando link", routeSlug)
      console.log("[LINK] loading trip", routeSlug)

      const useSupabase = shouldUseSupabase()

      try {
        const repositoryTrip = adminToken
          ? await getTripByAdminToken(adminToken)
          : publicToken
            ? await getTripByPublicToken(publicToken)
            : await getTripBySlug(routeSlug)

        if (repositoryTrip.data) {
          setTripOwnerUserId(repositoryTrip.data.ownerUserId ?? null)
          const isOwner = Boolean(user?.id && repositoryTrip.data.ownerUserId && user.id === repositoryTrip.data.ownerUserId)
          const quickAccessMethods = getQuickAccessMethods(repositoryTrip.data.ownerUserId ?? null, null)
          const requiresQuickAccessGate = Boolean(isAdminRoute && !user && quickAccessMethods.configured)

          if (isAdminRoute && user && !isOwner) {
            console.error("[TRIP] erro ao carregar link", "Usuario sem permissao para editar a viagem.")
            setLoadError("Voce nao tem permissao para editar esta viagem.")
            setIsLoadingTrip(false)
            return
          }

          if (isAdminRoute && !user) {
            if (!quickAccessMethods.configured) {
              const redirectTarget = pathname || `/viagem/${repositoryTrip.data.slug}/admin`
              router.replace(`/login?redirect=${encodeURIComponent(redirectTarget)}`)
              setIsLoadingTrip(false)
              return
            }
            setQuickAccessGateRequired(requiresQuickAccessGate)
          } else {
            setQuickAccessGateRequired(false)
          }

          const canEditTrip = isAdminRoute && (Boolean(user) ? isOwner : !requiresQuickAccessGate)
          const canWriteTrip = isAdminRoute && isOwner
          setIsAdmin(canEditTrip)
          setCanWrite(canWriteTrip)

          const documentsResult = canWriteTrip
            ? await listDocumentsByTrip(repositoryTrip.data.id)
            : await listPublicTripDocuments(repositoryTrip.data.id)
          const hotelsResult = await listTripHotels(repositoryTrip.data.id)

          console.log("[LINK] trip loaded", repositoryTrip.data.id)
          setTripData(
            buildTripDataFromStoredTrip({
              id: repositoryTrip.data.id,
              slug: repositoryTrip.data.slug,
              name: repositoryTrip.data.title,
              destination: repositoryTrip.data.destination,
              country: repositoryTrip.data.country ?? undefined,
              city: repositoryTrip.data.city ?? undefined,
              startDate: repositoryTrip.data.startDate ?? undefined,
              endDate: repositoryTrip.data.endDate ?? undefined,
              passengersCount: repositoryTrip.data.travelersCount,
              status: repositoryTrip.data.status,
              coverImage: repositoryTrip.data.coverImage ?? undefined,
              adminLink: repositoryTrip.data.adminLink,
              shareLink: repositoryTrip.data.publicLink,
              flights: repositoryTrip.data.flights,
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
              itinerary: repositoryTrip.data.itinerary,
              documents: documentsResult.data,
              travelersCount: repositoryTrip.data.travelersCount,
            })
          )
          setIsLoadingTrip(false)
          return
        }
        if (useSupabase) {
          const message = repositoryTrip.error || "Viagem nao encontrada ou link expirado."
          console.error("[TRIP] erro ao carregar link", message)
          setLoadError("Viagem nao encontrada ou link expirado.")
          setIsLoadingTrip(false)
          return
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar viagem."
        console.error("[TRIP] erro ao carregar link", message)
        if (useSupabase) {
          setLoadError("Viagem nao encontrada ou link expirado.")
          setIsLoadingTrip(false)
          return
        }
      }

      if (isPublicRoute || isAdminRoute) {
        console.log("[LINK] trip not found", routeSlug)
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
          setTripData(buildTripDataFromStoredTrip(matchedTrip))
          setIsLoadingTrip(false)
          return
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar viagem local."
        console.error("[TRIP] erro ao carregar link", message)
      }

      console.log("[LINK] trip not found", routeSlug)
      setLoadError("Viagem nao encontrada ou link expirado.")
      setIsLoadingTrip(false)
    }

    void loadTrip()
  }, [params?.id, params?.slug, pathname, user?.id, authLoading])

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type })
  }

  const handleRequireAuthenticatedAdmin = () => {
    const routeSlug =
      typeof params?.id === "string"
        ? params.id
        : typeof params?.slug === "string"
          ? params.slug
          : tripData.id
    const target = pathname || `/viagem/${routeSlug}/admin`
    router.replace(`/login?redirect=${encodeURIComponent(target)}`)
  }

  const requireSensitiveAccess = (onGranted: () => void) => {
    if (!tripOwnerUserId) {
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
    if (!tripOwnerUserId) {
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
    const routeSlug =
      typeof params?.id === "string"
        ? params.id
        : typeof params?.slug === "string"
          ? params.slug
          : tripData.id
    const target = pathname || `/viagem/${routeSlug}/admin`
    const quickAccessTarget = `/portal/configuracoes?quickAccess=1&returnTo=${encodeURIComponent(target)}`
    router.replace(`/login?redirect=${encodeURIComponent(quickAccessTarget)}`)
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

  const handleUpdateFlight = (id: number, data: any) => {
  if (!ensureSensitiveAccess()) return
  setTripData(prev => ({
  ...prev,
  flights: prev.flights.map(f => f.id === id ? data : f)
  }))
  }

  const handleAddFlight = (data: any) => {
    if (!ensureSensitiveAccess()) return
    setTripData(prev => ({
      ...prev,
      documents: [...prev.documents, { ...data, private: data.private ?? false }]
    }))
  }

  const handleSaveHotel = async (data: any) => {
    console.log(data?.id ? "[HOTEL] update started" : "[HOTEL] create started")

    if (!tripData.id) {
      showToast("Viagem nao encontrada para salvar a hospedagem.", "error")
      return
    }

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleSaveHotel(data) })
      return
    }

    const result = data?.id
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

    if (result.error || !result.data) {
      console.error("[HOTEL] error", result.error)
      showToast(resolveProtectedWriteError(result.error || "Nao foi possivel salvar a hospedagem."), "error")
      return
    }

    console.log("[HOTEL] success", result.data.id)
    setTripData(prev => ({
      ...prev,
      hotels: data?.id
        ? (Array.isArray(prev.hotels) ? prev.hotels : []).map((hotel: any) =>
            hotel.id === result.data!.id
              ? { ...hotel, ...result.data, image: hotel.image || prev.heroImage, amenities: hotel.amenities || [] }
              : hotel,
          )
        : [
            ...(Array.isArray(prev.hotels) ? prev.hotels : []),
            {
              ...result.data,
              image: prev.heroImage,
              amenities: [],
            },
          ],
      hotel:
        data?.id
          ? ((Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === result.data!.id)
              ? { ...(Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === result.data!.id), ...result.data, image: prev.heroImage, amenities: [] }
              : { ...result.data, image: prev.heroImage, amenities: [] })
          : (prev.hotel ?? { ...result.data, image: prev.heroImage, amenities: [] }),
    }))
    showToast("Hospedagem salva com sucesso.", "success")
  }

  const handleDeleteHotel = async (hotelId: string) => {
    console.log("[HOTEL] delete started")

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteHotel(hotelId) })
      return
    }

    const result = await deleteTripHotel(hotelId)

    if (!result.success) {
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

  const handleUpdateItinerary = (data: any) => {
    setTripData(prev => ({ ...prev, itinerary: data }))
  }

  const handleAddDocument = (data: any) => {
    requireSensitiveAccess(() => {
      setTripData(prev => ({
        ...prev,
        documents: [...prev.documents, { ...data, private: data.private ?? data.isPrivate ?? false }]
      }))
    })
  }

  const handleUpdateTravelers = (travelers: { name: string; avatar?: string; role: string }[]) => {
    requireSensitiveAccess(() => {
      setTripData(prev => ({ ...prev, travelers }))
    })
  }

  const handleSaveTripSettings = (data: { privacy: string; permissions: string; status: string; preferences: string }) => {
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
            onClose={() => setSecurityModalOpen(false)}
            ownerUserId={tripOwnerUserId}
            profileSettings={null}
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

          <TripHeader tripData={tripData} onOpenShare={() => setShareOpen(true)} onOpenMenu={() => setMenuOpen(true)} />
          <TripHero tripData={tripData} onEditTrip={() => setEditTripOpen(true)} />
          <QuickAccessCards tripData={tripData} onNavigate={handleNavigate} />
  <FlightsSection tripData={tripData} onUpdateFlight={handleUpdateFlight} onAddFlight={handleAddFlight} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} ensureSensitiveAccess={ensureSensitiveAccess} />
  <HotelSection tripData={tripData} onSaveHotel={handleSaveHotel} onDeleteHotel={handleDeleteHotel} />
  <ItinerarySection tripData={tripData} onUpdateItinerary={handleUpdateItinerary} />
  <DocumentsSection tripData={tripData} onAddDocument={handleAddDocument} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} tripOwnerUserId={tripOwnerUserId} profileSettings={profile?.settings ?? null} ensureSensitiveAccess={ensureSensitiveAccess} />
  <ConciergeSection tripData={tripData} onOpenCredits={() => setCreditsOpen(true)} />
          <OfflineSection />
          <QuickInfoSection tripData={tripData} />
          <TripFooter />

          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} tripData={tripData} />
          <SensitiveAccessModal
            open={securityModalOpen}
            onClose={() => setSecurityModalOpen(false)}
            ownerUserId={tripOwnerUserId}
            profileSettings={profile?.settings ?? null}
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
            onOpenCredits={() => {
              setMenuOpen(false)
              setCreditsOpen(true)
            }}
          />
          <EditTripModal open={editTripOpen} onClose={() => setEditTripOpen(false)} tripData={tripData} onSave={handleUpdateTrip} />
          <TravelersModal open={travelersOpen} onClose={() => setTravelersOpen(false)} travelers={tripData.travelers} onUpdateTravelers={handleUpdateTravelers} />
          <TripSettingsModal open={tripSettingsOpen} onClose={() => setTripSettingsOpen(false)} tripData={tripData} onSave={handleSaveTripSettings} />
          <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} credits={tripData.credits} />

          <AnimatePresence>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </AnimatePresence>
        </main>
      </ToastContext.Provider>
    </PermissionContext.Provider>
  )
}
