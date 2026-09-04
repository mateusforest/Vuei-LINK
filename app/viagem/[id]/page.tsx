"use client"

import { useState, useEffect, useRef, createContext, useContext } from "react"
import Image from "next/image"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { extractAgencyStorageState } from "@/lib/mappers/agency-mappers"
import { extractTripsStoragePayload } from "@/lib/mappers/trip-mappers"
import { shouldUseSupabase } from "@/lib/data-source"
import { DOCUMENT_UPLOAD_TYPE_OPTIONS } from "@/lib/constants/document-upload-types"
import { getTripByAdminToken, getTripByPublicToken, getTripBySlug, updateTrip as updateTripRepository } from "@/lib/repositories/trips-repository"
import { createDocumentMetadata, deleteDocument, deleteDocumentFile, listDocumentsByTrip, listPublicTripDocuments, uploadDocumentFile } from "@/lib/repositories/documents-repository"
import { deleteTripFlight, listPublicTripFlights, listTripFlights, requestTripFlightExtraction, upsertTripFlight } from "@/lib/repositories/trip-flights-repository"
import { createTripHotel, deleteTripHotel, listTripHotels, updateTripHotel } from "@/lib/repositories/trip-hotels-repository"
import { deleteTripItinerary, listTripItineraries, requestAiItineraryGeneration, upsertTripItinerary } from "@/lib/repositories/trip-itineraries-repository"
import { listConversationsByTrip, listMessages } from "@/lib/repositories/ai-repository"
import { resolveDocumentMimeType, validateDocumentFile } from "@/lib/files/file-validation"
import {
  DEFAULT_TRIP_HERO_IMAGE,
  getDestinationCoverImage,
  getDestinationMetadata,
  resolveAgencyBrandLogo,
  resolveTripHeroImage,
} from "@/lib/trip-destination"
import { getOfflineWarningMessage, prepareTripRoutesForOffline, saveTripOfflinePackage } from "@/lib/offline/trip-offline"
import { getOfflineDocumentBlob, getOfflineImageBlob, loadTripOfflinePackage } from "@/lib/offline/offline-package-manager"
import { isOfflineModeActive } from "@/lib/offline/offline-mode"
import { useAuth } from "@/contexts/auth-context"
import { buildAdminTripUrl, buildPublicTripUrl, isAdminLinkMode } from "@/lib/security/link-tokens"
import { isTripPublicLinkActive } from "@/lib/security/trip-link-lifecycle"
import { resolveTravelerPlan, resolveTravelerPlanFromBillingStatus } from "@/lib/billing/traveler-plans"
import {
  clearPendingTripClaimSession,
  findPendingTripClaimSession,
  isPendingTripClaimSessionActive,
} from "@/lib/pending-trip-claim"
import { getPendingTripDraft } from "@/lib/repositories/pending-trip-claim-repository"
import { ImageWithFallback } from "@/components/system/image-with-fallback"
import { getTravelerBillingStatus } from "@/lib/repositories/traveler-billing-repository"
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
  ChevronRight, Calendar, Clock, Users, Sun, Moon, Cloud, Thermometer,
  Shield, Lock, Fingerprint, Download, Copy, Check, Send, Sparkles,
  Globe, Phone, AlertCircle, CreditCard, QrCode, Navigation,
  ChevronDown, Play, Pause, Volume2, Star, Heart, ExternalLink,
  X, Edit3, Plus, Trash2, Upload, Eye, EyeOff, Settings, User,
  ArrowLeft, MoreVertical, CheckCircle2, XCircle, Camera, Pencil, Briefcase
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { devLog, startPerfMeasure } from "@/lib/dev/perf"
import { CREDIT_BALANCE_CHANGED_EVENT, dispatchCreditBalanceChanged } from "@/lib/credits/credit-events"
import {
  buildTripDocumentAccessHref,
  buildTripSectionsAccessHref,
  findTripDocument,
  getContentTripDocuments,
  getPublicTripDocuments,
  getTicketTripDocuments,
  getTripDocumentCounts,
  getTripDocuments,
  isPrivateTripDocument,
} from "@/lib/trips/trip-document-view"

const TRIPS_STORAGE_KEY = "vuei_trips"
const AGENCY_STORAGE_KEY = "vuei_agency"

type TravelerItem = {
  id: string
  name: string
  avatar?: string
  role: "principal" | "acompanhante"
}

type PersistedTravelerPayload = {
  id: string
  name: string
  role?: string | null
  isPrimary?: boolean | null
  avatarUrl?: string | null
}

type TripPinApiAccessMode = "admin" | "public"

type TripPinStatusPayload = {
  pinConfigured: boolean
  pinScope: "traveler_portal" | "agency_trip" | null
  ownerType: "traveler" | "agency" | null
  trip?: {
    id: string
    slug: string
    title: string
    destination: string
    country: string | null
    city: string | null
    startDate: string | null
    endDate: string | null
    status: string
    ownerType: "traveler" | "agency"
    ownerUserId: string | null
    agencyId: string | null
    clientId: string | null
    visibility: "private" | "public"
    linkActivatedAt: string | null
    linkAccessUntil: string | null
    travelersCount: number
    coverImage: string | null
    adminLink: string | null
    publicLink: string | null
  }
}

const TRIP_PIN_STATUS_TIMEOUT_MS = 4000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRealTripUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim())
}

function getTripPinOfflineMessage(accessMode: TripPinApiAccessMode) {
  if (accessMode === "admin") {
    return "Você está offline. A viagem pode ser consultada, mas o modo de edição precisa de internet para validar o PIN."
  }

  return "Você está offline. A viagem pode ser consultada, mas as áreas protegidas precisam de internet para validar o PIN."
}

function buildTripPinQuery(params: {
  tripId?: string | null
  tripSlug: string
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripPinApiAccessMode
}) {
  const searchParams = new URLSearchParams()
  if (params.tripId) {
    searchParams.set("tripId", params.tripId)
  }
  searchParams.set("tripSlug", params.tripSlug)
  searchParams.set("accessMode", params.accessMode)

  if (params.adminToken) {
    searchParams.set("adminToken", params.adminToken)
  }

  if (params.publicToken) {
    searchParams.set("publicToken", params.publicToken)
  }

  return searchParams.toString()
}

async function loadTripPinStatus(params: {
  tripId?: string | null
  tripSlug: string
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripPinApiAccessMode
}) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      ok: false,
      data: null,
      error: getTripPinOfflineMessage(params.accessMode),
      isOffline: true,
    }
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null
  const timeoutId =
    typeof window !== "undefined" && controller
      ? window.setTimeout(() => controller.abort(), TRIP_PIN_STATUS_TIMEOUT_MS)
      : null

  try {
    const response = await fetch(`/api/trip-pin?${buildTripPinQuery(params)}`, controller ? { signal: controller.signal } : undefined)
    const data = (await response.json().catch(() => null)) as (TripPinStatusPayload & { error?: string }) | null

    return {
      ok: response.ok,
      data,
      error: response.ok ? null : data?.error ?? "Não foi possível consultar o PIN desta viagem.",
      isOffline: false,
    }
  } catch (error) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false
    const aborted = error instanceof DOMException && error.name === "AbortError"

    return {
      ok: false,
      data: null,
      error: offline || aborted ? getTripPinOfflineMessage(params.accessMode) : error instanceof Error ? error.message : "Não foi possível consultar o PIN desta viagem.",
      isOffline: offline || aborted,
    }
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
    }
  }
}

async function verifyTripPinOnServer(params: {
  tripId: string
  tripSlug: string
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripPinApiAccessMode
  pin: string
}) {
  if (!isRealTripUuid(params.tripId)) {
    return {
      ok: false,
      data: null,
      error: "Aguarde a viagem ser carregada antes de validar o PIN.",
    }
  }

  const response = await fetch("/api/trip-pin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })

  const data = (await response.json().catch(() => null)) as (TripPinStatusPayload & { verified?: boolean; error?: string }) | null

  return {
    ok: response.ok,
    data,
    error: response.ok ? null : data?.error ?? "Não foi possível validar o PIN desta viagem.",
  }
}

function getTripPinSetupMessage(status: TripPinStatusPayload | null) {
  if (status?.ownerType === "agency") {
    return "PIN ainda não configurado. Peça ao responsável pela viagem para configurar o PIN no portal."
  }

  return "PIN ainda não configurado. Peça ao responsável pela viagem para configurar o PIN no portal."
}

function hasTripAuthenticatedAdminAccess(params: {
  userId?: string | null
  profileRole?: string | null
  profileAgencyId?: string | null
  ownerUserId?: string | null
  tripAgencyId?: string | null
}) {
  if (!params.userId) return false
  if (params.profileRole === "master") return true
  if (params.ownerUserId && params.userId === params.ownerUserId) return true

  return Boolean(
    params.tripAgencyId &&
    params.profileAgencyId &&
    params.tripAgencyId === params.profileAgencyId &&
    (params.profileRole === "agency_owner" || params.profileRole === "agency_member"),
  )
}

function mapTripPinSnapshotToStoredTrip(snapshot: NonNullable<TripPinStatusPayload["trip"]>, tokens: {
  adminToken?: string | null
  publicToken?: string | null
}) {
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    destination: snapshot.destination,
    country: snapshot.country,
    city: snapshot.city,
    startDate: snapshot.startDate,
    endDate: snapshot.endDate,
    status: snapshot.status,
    ownerType: snapshot.ownerType,
    ownerUserId: snapshot.ownerUserId,
    agencyId: snapshot.agencyId,
    clientId: snapshot.clientId,
    visibility: snapshot.visibility,
    linkActivatedAt: snapshot.linkActivatedAt,
    linkAccessUntil: snapshot.linkAccessUntil,
    travelersCount: snapshot.travelersCount,
    coverImage: snapshot.coverImage,
    adminToken: tokens.adminToken ?? null,
    publicToken: tokens.publicToken ?? null,
    adminLink: snapshot.adminLink ?? buildAdminTripUrl(snapshot.slug, tokens.adminToken ?? null),
    publicLink: snapshot.publicLink ?? buildPublicTripUrl(snapshot.slug),
    travelers: [],
    flights: [],
    accommodations: [],
    itinerary: [],
    documents: [],
  }
}

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
        "fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl",
        type === "success" && "border-emerald-700/40 bg-emerald-600/92 text-white",
        type === "error" && "border-red-700/30 bg-red-600/92 text-white",
        type === "info" && "border-sky-700/30 bg-sky-600/92 text-white"
      )}
    >
      {type === "success" && <CheckCircle2 className="w-5 h-5" />}
      {type === "error" && <XCircle className="w-5 h-5" />}
      {type === "info" && <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium leading-none">{message}</span>
    </motion.div>
  )
}

function resolveTripShellTone(explicitTone?: "dark" | "light") {
  if (explicitTone) return explicitTone
  if (typeof document !== "undefined" && document.body.getAttribute("data-trip-link-theme") === "light") {
    return "light" as const
  }
  return "dark" as const
}

// Modal wrapper
function Modal({
  open,
  onClose,
  children,
  title,
  tone,
  showCloseButton = true,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  tone?: "dark" | "light"
  showCloseButton?: boolean
}) {
  const resolvedTone = resolveTripShellTone(tone)

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
            data-tone={resolvedTone}
            className="trip-dialog-backdrop fixed inset-0 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            data-tone={resolvedTone}
            className="trip-modal-surface fixed inset-3 z-50 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[90dvh]"
          >
            {title && (
              <div
                className={cn("trip-dialog-header sticky top-0 z-10 flex items-center", showCloseButton ? "justify-between" : "justify-center")}
              >
                <h3 className="trip-dialog-title">{title}</h3>
                {showCloseButton ? (
                  <button onClick={onClose} className="trip-dialog-close" aria-label="Fechar modal">
                    <X className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            )}
            <div className={cn("trip-dialog-content trip-modal-content", resolvedTone === "light" ? "trip-link-light-shell" : "trip-link-dark-shell")}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Bottom Sheet (mobile drawer)
function BottomSheet({
  open,
  onClose,
  children,
  title,
  tone,
  contentClassName,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  tone?: "dark" | "light"
  contentClassName?: string
}) {
  const resolvedTone = resolveTripShellTone(tone)

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
            data-tone={resolvedTone}
            className="trip-dialog-backdrop fixed inset-0 z-50"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            data-tone={resolvedTone}
            className={cn("trip-sheet-surface fixed bottom-0 left-0 right-0 z-50 max-h-[88dvh] overflow-auto", contentClassName)}
          >
            <div
              className="trip-dialog-header trip-sheet-header sticky top-0 z-10"
            >
              <div className="trip-sheet-handle" />
              {title && (
                <div className="flex items-center justify-between">
                  <h3 className="trip-dialog-title">{title}</h3>
                  <button
                    onClick={onClose}
                    className="trip-dialog-close"
                    aria-label="Fechar seção"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            <div className={cn("trip-dialog-content trip-panel-content", resolvedTone === "light" ? "trip-link-light-shell" : "trip-link-dark-shell")}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const DEFAULT_HERO_IMAGE = DEFAULT_TRIP_HERO_IMAGE

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
  credits: { balance: 0, used: 0, total: 0 },
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

function sanitizeHotelText(value: unknown) {
  if (typeof value !== "string") return null

  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return null

  const lowered = normalized.toLowerCase()
  if (["undefined", "null", "invalid date", "we", "nan"].includes(lowered)) {
    return null
  }

  return normalized
}

const HOTEL_MONTH_INDEX: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  marco: 2,
  março: 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
}

function parseHotelDateValue(value?: string | null) {
  const normalized = sanitizeHotelText(value)
  if (!normalized) return null

  const compactNormalized = normalized
    .replace(/\s+-\s+\d{1,2}:\d{2}.*$/i, "")
    .replace(/\s+as\s+\d{1,2}:\d{2}.*$/i, "")
    .trim()

  const parsed = compactNormalized.includes("T") ? new Date(compactNormalized) : new Date(`${compactNormalized}T12:00:00`)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed
  }

  const slashMatch = compactNormalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, day, month, year] = slashMatch
    const slashDate = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0)
    if (!Number.isNaN(slashDate.getTime())) {
      return slashDate
    }
  }

  const normalizedParts = compactNormalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim()

  const longMonthMatch = normalizedParts.match(/^(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})$/)
  const shortMonthMatch = normalizedParts.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/)
  const monthMatch = longMonthMatch ?? shortMonthMatch

  if (monthMatch) {
    const [, day, monthLabel, year] = monthMatch
    const monthIndex = HOTEL_MONTH_INDEX[monthLabel]
    if (typeof monthIndex === "number") {
      const namedMonthDate = new Date(Number(year), monthIndex, Number(day), 12, 0, 0)
      if (!Number.isNaN(namedMonthDate.getTime())) {
        return namedMonthDate
      }
    }
  }

  return null
}

function formatHotelDate(value?: string | null) {
  const parsed = parseHotelDateValue(value)
  if (!parsed) return null

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function resolveHotelDisplayName(hotel: any) {
  return (
    sanitizeHotelText(hotel?.hotelName) ||
    sanitizeHotelText(hotel?.hotel_name) ||
    sanitizeHotelText(hotel?.name) ||
    "Hospedagem cadastrada"
  )
}

function resolveHotelLocation(hotel: any) {
  const parts = [
    sanitizeHotelText(hotel?.address),
    sanitizeHotelText(hotel?.city),
    sanitizeHotelText(hotel?.country),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(", ") : null
}

function resolveHotelReservationCode(hotel: any) {
  return (
    sanitizeHotelText(hotel?.reservationCode) ||
    sanitizeHotelText(hotel?.reservation_code) ||
    sanitizeHotelText(hotel?.confirmationNumber) ||
    sanitizeHotelText(hotel?.confirmation_number) ||
    sanitizeHotelText(hotel?.confirmationCode) ||
    sanitizeHotelText(hotel?.confirmation_code) ||
    null
  )
}

function calculateHotelNights(hotel: any) {
  const checkIn = parseHotelDateValue(hotel?.checkIn ?? hotel?.check_in)
  const checkOut = parseHotelDateValue(hotel?.checkOut ?? hotel?.check_out)
  if (!checkIn || !checkOut) return 0

  return Math.max(Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)), 0)
}

function sortHotelsForDisplay(hotels: any[]) {
  return [...hotels].sort((left, right) => {
    const leftDate = parseHotelDateValue(left?.checkIn ?? left?.check_in)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightDate = parseHotelDateValue(right?.checkIn ?? right?.check_in)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return leftDate - rightDate
  })
}

function normalizeHotelForDisplay(hotel: any) {
  const name = resolveHotelDisplayName(hotel)
  const location = resolveHotelLocation(hotel)
  const reservationCode = resolveHotelReservationCode(hotel)
  const checkInRaw = sanitizeHotelText(hotel?.checkIn ?? hotel?.check_in)
  const checkOutRaw = sanitizeHotelText(hotel?.checkOut ?? hotel?.check_out)
  const checkIn = formatHotelDate(checkInRaw)
  const checkOut = formatHotelDate(checkOutRaw)
  const nights = calculateHotelNights(hotel)
  const notes = sanitizeHotelText(hotel?.notes)

  return {
    ...hotel,
    image: null,
    name,
    displayName: name,
    location,
    checkInRaw,
    checkOutRaw,
    checkIn: checkIn || "Não informado",
    checkOut: checkOut || "Não informado",
    nights,
    reservationCode,
    confirmationCode: reservationCode || null,
    notes,
    documentId: sanitizeHotelText(hotel?.documentId ?? hotel?.document_id),
  }
}

function formatTravelerHeroDateRange(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return "Datas a definir"

  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Datas a definir"
  }

  const startDay = start.toLocaleDateString("pt-BR", { day: "2-digit" })
  const endDay = end.toLocaleDateString("pt-BR", { day: "2-digit" })
  const startMonth = start.toLocaleDateString("pt-BR", { month: "short" }).replace(/\.$/, ".")
  const endMonth = end.toLocaleDateString("pt-BR", { month: "short" }).replace(/\.$/, ".")

  if (start.getFullYear() !== end.getFullYear()) {
    return `${startDay} ${startMonth} ${start.getFullYear()} – ${endDay} ${endMonth} ${end.getFullYear()}`
  }

  if (startMonth === endMonth) {
    return `${startDay}–${endDay} ${endMonth} ${end.getFullYear()}`
  }

  return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${end.getFullYear()}`
}

function calculateDaysUntil(dateString?: string) {
  if (!dateString) return 0

  const targetDate = new Date(`${dateString}T12:00:00`)
  const today = new Date()
  const diff = targetDate.getTime() - today.getTime()

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function buildTravelers(count?: number) {
  const safeCount = typeof count === "number" ? count : 1
  const total = Math.max(safeCount, 0)

  if (total === 0) {
    return [] as TravelerItem[]
  }

  return Array.from({ length: total }, (_, index) => ({
    id: `fallback-${index}`,
    name: index === 0 ? "Viajante Principal" : `Acompanhante ${index}`,
    avatar: "/placeholder.svg?height=40&width=40",
    role: index === 0 ? "principal" : "acompanhante",
  }))
}

function normalizeTravelerRole(role?: string | null, isPrimary?: boolean | null) {
  if (isPrimary || role === "primary" || role === "principal") {
    return "principal" as const
  }

  return "acompanhante" as const
}

function mapPersistedTravelerToView(traveler: PersistedTravelerPayload, index: number): TravelerItem {
  return {
    id: traveler.id || `traveler-${index}`,
    name: traveler.name || (index === 0 ? "Viajante Principal" : `Acompanhante ${index}`),
    avatar: traveler.avatarUrl || "/placeholder.svg?height=40&width=40",
    role: normalizeTravelerRole(traveler.role, traveler.isPrimary),
  }
}

function mapPersistedTravelersToView(travelers?: PersistedTravelerPayload[] | null) {
  if (!Array.isArray(travelers) || travelers.length === 0) {
    return [] as TravelerItem[]
  }

  return travelers.map((traveler, index) => mapPersistedTravelerToView(traveler, index))
}

function resolveTripTravelersCount(tripData: any) {
  if (Array.isArray(tripData?.travelers) && tripData.travelers.length > 0) {
    return tripData.travelers.length
  }

  if (typeof tripData?.travelersCount === "number") {
    return Math.max(tripData.travelersCount, 0)
  }

  return 0
}

function buildQuickInfo(destination?: string, country?: string, city?: string) {
  return getDestinationMetadata(destination, country, city)
}

function normalizeQuickInfo(quickInfo?: any) {
  const currency = quickInfo?.currency ?? {}

  return {
    currency: {
      name: currency?.name || "Não informado",
      symbol: currency?.symbol || "-",
      rate: currency?.rate || "Não informado",
    },
    language: quickInfo?.language || "Não informado",
    timezone: quickInfo?.timezone || "Não informado",
    emergency: quickInfo?.emergency || "Não informado",
    embassy: quickInfo?.embassy || "Não informado",
  }
}

function normalizeTravelers(travelers?: any, fallbackCount?: number) {
  if (Array.isArray(travelers) && travelers.length > 0) {
    return travelers.map((traveler, index) => ({
      id: typeof traveler?.id === "string" && traveler.id.trim() ? traveler.id : `fallback-${index}`,
      name: traveler?.name || (index === 0 ? "Viajante Principal" : `Acompanhante ${index}`),
      avatar: traveler?.avatar || "/placeholder.svg?height=40&width=40",
      role: traveler?.role || (index === 0 ? "principal" : "acompanhante"),
    }))
  }

  return buildTravelers(fallbackCount)
}

function formatFlightDateTime(dateString?: string | null) {
  if (!dateString) return { date: "Não informado", time: "--:--" }

  const date = new Date(dateString)
  return {
    date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  }
}

function calculateFlightDuration(departureAt?: string | null, arrivalAt?: string | null) {
  if (!departureAt || !arrivalAt) return "Horário não informado"

  const diff = new Date(arrivalAt).getTime() - new Date(departureAt).getTime()
  if (!Number.isFinite(diff) || diff <= 0) return "Horário não informado"

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

function sanitizeFlightTextSafe(value: unknown) {
  if (typeof value !== "string") return null

  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return null

  const invalidValues = new Set(["undefined", "null", "invalid date", "[object object]", "--:--", "---", "-", "we"])
  if (invalidValues.has(normalized.toLowerCase())) return null

  return normalized
}

function parseFlightLocalDateTimeParts(value?: string | null) {
  const normalizedValue = sanitizeFlightTextSafe(value)
  if (!normalizedValue) return null

  const timeOnlyMatch = normalizedValue.match(/^(\d{1,2}):(\d{2})$/)
  if (timeOnlyMatch) {
    return {
      year: null as number | null,
      month: null as number | null,
      day: null as number | null,
      hour: Number(timeOnlyMatch[1]),
      minute: Number(timeOnlyMatch[2]),
      second: 0,
      hasDate: false,
      hasTime: true,
    }
  }

  const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    return {
      year: Number(dateOnlyMatch[1]),
      month: Number(dateOnlyMatch[2]),
      day: Number(dateOnlyMatch[3]),
      hour: null as number | null,
      minute: null as number | null,
      second: 0,
      hasDate: true,
      hasTime: false,
    }
  }

  const dateTimeMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})[tT](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[zZ]|[+-]\d{2}:\d{2})?$/)
  if (dateTimeMatch) {
    return {
      year: Number(dateTimeMatch[1]),
      month: Number(dateTimeMatch[2]),
      day: Number(dateTimeMatch[3]),
      hour: Number(dateTimeMatch[4]),
      minute: Number(dateTimeMatch[5]),
      second: Number(dateTimeMatch[6] ?? "0"),
      hasDate: true,
      hasTime: true,
    }
  }

  return null
}

function formatFlightDateTimeSafe(dateString?: string | null) {
  const normalizedValue = sanitizeFlightTextSafe(dateString)
  if (!normalizedValue) return { date: "Data não informada", time: null as string | null, hasDate: false }

  const parsedParts = parseFlightLocalDateTimeParts(normalizedValue)
  if (parsedParts) {
    const formatTime = (hour: number, minute: number) => `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`

    if (parsedParts.hasDate) {
      const literalDate = new Date(parsedParts.year!, parsedParts.month! - 1, parsedParts.day!, 12, 0, 0)
      return {
        date: literalDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
        time: parsedParts.hasTime && parsedParts.hour !== null && parsedParts.minute !== null ? formatTime(parsedParts.hour, parsedParts.minute) : null,
        hasDate: true,
      }
    }

    if (parsedParts.hasTime && parsedParts.hour !== null && parsedParts.minute !== null) {
      return { date: "Data não informada", time: formatTime(parsedParts.hour, parsedParts.minute), hasDate: false }
    }
  }

  const date = new Date(normalizedValue)
  if (Number.isNaN(date.getTime())) {
    const dateOnlyMatch = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})$/)
    if (dateOnlyMatch) {
      const fallbackDate = new Date(`${dateOnlyMatch[1]}T00:00:00`)
      if (!Number.isNaN(fallbackDate.getTime())) {
        return {
          date: fallbackDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
          time: null as string | null,
          hasDate: true,
        }
      }
    }

    const timeOnlyMatch = normalizedValue.match(/^(\d{1,2}):(\d{2})$/)
    if (timeOnlyMatch) {
      return { date: "Data não informada", time: normalizedValue, hasDate: false }
    }

    return { date: "Data não informada", time: null as string | null, hasDate: false }
  }

  const hasExplicitTime = /t\d{2}:\d{2}/i.test(normalizedValue) || /\d{2}:\d{2}/.test(normalizedValue)

  return {
    date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }),
    time: hasExplicitTime ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null,
    hasDate: true,
  }
}

function calculateFlightDurationSafe(departureAt?: string | null, arrivalAt?: string | null) {
  const departureValue = sanitizeFlightTextSafe(departureAt)
  const arrivalValue = sanitizeFlightTextSafe(arrivalAt)
  if (!departureValue || !arrivalValue) return null

  const departureParts = parseFlightLocalDateTimeParts(departureValue)
  const arrivalParts = parseFlightLocalDateTimeParts(arrivalValue)
  if (departureParts?.hasDate && departureParts.hasTime && arrivalParts?.hasDate && arrivalParts.hasTime) {
    const departureDate = new Date(
      departureParts.year!,
      departureParts.month! - 1,
      departureParts.day!,
      departureParts.hour!,
      departureParts.minute!,
      departureParts.second
    )
    const arrivalDate = new Date(
      arrivalParts.year!,
      arrivalParts.month! - 1,
      arrivalParts.day!,
      arrivalParts.hour!,
      arrivalParts.minute!,
      arrivalParts.second
    )
    const localDiff = arrivalDate.getTime() - departureDate.getTime()
    if (Number.isFinite(localDiff) && localDiff > 0) {
      const totalMinutes = Math.round(localDiff / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      return `${hours}h ${minutes.toString().padStart(2, "0")}m`
    }
  }

  const diff = new Date(arrivalValue).getTime() - new Date(departureValue).getTime()
  if (!Number.isFinite(diff) || diff <= 0) return null

  const totalMinutes = Math.round(diff / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

function normalizeAirportCodeSafe(value?: string | null) {
  const normalizedValue = sanitizeFlightTextSafe(value)
  if (!normalizedValue) return "—"
  const match = normalizedValue.match(/\b[A-Z]{3}\b/)
  return match?.[0] ?? normalizedValue.slice(0, 3).toUpperCase()
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
  return sanitizeFlightTextSafe(value)
}

function hasMeaningfulFlightExtraction(flight?: TripFlightRecord | null) {
  if (!flight) return false

  return Boolean(
    flight.airline ||
      flight.flightNumber ||
      flight.originAirport ||
      flight.destinationAirport ||
      flight.departureAt ||
      flight.arrivalAt ||
      flight.bookingReference ||
      flight.passengerName ||
      getFlightExtractedValue(flight, "airline") ||
      getFlightExtractedValue(flight, "flight_number") ||
      getFlightExtractedValue(flight, "origin_airport") ||
      getFlightExtractedValue(flight, "destination_airport") ||
      getFlightExtractedValue(flight, "departure_at") ||
      getFlightExtractedValue(flight, "arrival_at") ||
      getFlightExtractedValue(flight, "booking_reference") ||
      getFlightExtractedValue(flight, "passenger_name")
  )
}

function hasMinimumFlightCardData(flight?: {
  airline?: string | null
  flightNumber?: string | null
  originAirport?: string | null
  destinationAirport?: string | null
  departureAt?: string | null
  arrivalAt?: string | null
} | null) {
  if (!flight) return false

  const originAirport = sanitizeFlightTextSafe(flight.originAirport)
  const destinationAirport = sanitizeFlightTextSafe(flight.destinationAirport)
  const airline = sanitizeFlightTextSafe(flight.airline)
  const flightNumber = sanitizeFlightTextSafe(flight.flightNumber)
  const departureAt = sanitizeFlightTextSafe(flight.departureAt)
  const arrivalAt = sanitizeFlightTextSafe(flight.arrivalAt)

  return Boolean(originAirport && destinationAirport && (departureAt || arrivalAt || flightNumber || airline))
}

function getPreferredStructuredFlight(flights: any[]) {
  return flights.find((flight) => flight?.hasStructuredCardData) ?? null
}

function mapFlightRecordToView(flight: TripFlightRecord, documents?: any[]) {
  const airline = sanitizeFlightTextSafe(flight.airline) || getFlightExtractedValue(flight, "airline")
  const flightNumber = sanitizeFlightTextSafe(flight.flightNumber) || getFlightExtractedValue(flight, "flight_number")
  const bookingReference =
    sanitizeFlightTextSafe(flight.bookingReference) || getFlightExtractedValue(flight, "booking_reference")
  const originAirport = sanitizeFlightTextSafe(flight.originAirport) || getFlightExtractedValue(flight, "origin_airport")
  const destinationAirport =
    sanitizeFlightTextSafe(flight.destinationAirport) || getFlightExtractedValue(flight, "destination_airport")
  const departureAt = sanitizeFlightTextSafe(flight.departureAt) || getFlightExtractedValue(flight, "departure_at")
  const arrivalAt = sanitizeFlightTextSafe(flight.arrivalAt) || getFlightExtractedValue(flight, "arrival_at")
  const passengerName =
    sanitizeFlightTextSafe(flight.passengerName) || getFlightExtractedValue(flight, "passenger_name")
  const baggageInfo = sanitizeFlightTextSafe(flight.baggageInfo) || getFlightExtractedValue(flight, "baggage_info")
  const terminal = sanitizeFlightTextSafe(flight.terminal) || getFlightExtractedValue(flight, "terminal")
  const gate = sanitizeFlightTextSafe(flight.gate) || getFlightExtractedValue(flight, "gate")
  const seat = sanitizeFlightTextSafe(flight.seat) || getFlightExtractedValue(flight, "seat")
  const qrCodePayload = sanitizeFlightTextSafe(flight.qrCodePayload) || getFlightExtractedValue(flight, "qr_code_payload")
  const departure = formatFlightDateTimeSafe(departureAt)
  const arrival = formatFlightDateTimeSafe(arrivalAt)
  const linkedDocument = Array.isArray(documents) ? documents.find((document: any) => document.id === flight.documentId) ?? null : null
  const hasUsefulData = hasMeaningfulFlightExtraction(flight)
  const extractionStatus = flight.extractionStatus === "failed" && hasUsefulData ? "completed" : flight.extractionStatus
  const hasStructuredCardData = hasMinimumFlightCardData({
    airline,
    flightNumber,
    originAirport,
    destinationAirport,
    departureAt,
    arrivalAt,
  })
  const metaItems = [
    terminal ? { label: "Terminal", value: terminal } : null,
    gate ? { label: "Portão", value: gate } : null,
    seat ? { label: "Assento", value: seat } : null,
  ].filter(Boolean)

  return {
    id: flight.id,
    airline: airline || "Passagem anexada",
    flightNumber: flightNumber || "Voo não identificado",
    bookingReference,
    extractionStatus,
    hasStructuredCardData,
    extractedData: flight.extractedData ?? {},
    passengerName,
    baggageInfo,
    terminal,
    gate,
    seat,
    qrCodePayload,
    date: departure.date,
    duration: calculateFlightDurationSafe(departureAt, arrivalAt),
    scheduleLabel:
      departure.time && arrival.time
        ? `${departure.time} - ${arrival.time}`
        : departure.time || arrival.time || null,
    origin: {
      code: normalizeAirportCodeSafe(originAirport),
      city: originAirport || "Origem não informada",
      time: departure.time,
    },
    destination: {
      code: normalizeAirportCodeSafe(destinationAirport),
      city: destinationAirport || "Destino não informado",
      time: arrival.time,
    },
    metaItems,
    document: linkedDocument,
  }
}

function getFlightStatusCopy(flight: any) {
  const extractedData = flight?.extractedData && typeof flight.extractedData === "object"
    ? flight.extractedData as Record<string, unknown>
    : null
  const failureReason = typeof extractedData?.failure_reason === "string" ? extractedData.failure_reason.toLowerCase() : ""
  const reasonCode = typeof extractedData?.reason_code === "string" ? extractedData.reason_code : ""
  const hasInsufficientCreditsError =
    reasonCode === "insufficient_credits" ||
    failureReason.includes("saldo insuficiente") ||
    failureReason.includes("créditos insuficientes") ||
    failureReason.includes("creditos insuficientes")

  if (flight.extractionStatus === "completed") {
    return {
      eyebrow: "Dados extraídos por IA",
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

  if (flight.extractionStatus === "failed" && hasInsufficientCreditsError) {
    return {
      eyebrow: "Créditos insuficientes",
      detail: "Você não possui créditos suficientes para extrair automaticamente os dados desta passagem. Adicione créditos ou altere seu plano para continuar utilizando a Extração IA.",
      tone: "error" as const,
    }
  }

  if (flight.extractionStatus === "failed") {
    return {
      eyebrow: "Passagem anexada",
      detail: "Não foi possível extrair os dados desta passagem. Envie um cartão de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visíveis.",
      tone: "error" as const,
    }
  }

  if (flight.extractionStatus === "failed") {
    return {
      eyebrow: "Passagem anexada",
      detail: "Não foi possível extrair os dados desta passagem. Envie um cartão de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visíveis.",
      tone: "error" as const,
    }
    return {
      eyebrow: "Passagem anexada",
      detail: "NÃ£o foi possÃ­vel extrair os dados desta passagem. Envie um cartÃ£o de embarque individual ou uma imagem limpa, sem cortes e com todos os dados visÃ­veis.",
      tone: "error" as const,
    }
    return {
      eyebrow: "Passagem anexada",
      detail: "Não conseguimos ler esta passagem automaticamente. Você ainda pode abrir o documento original.",
      tone: "error" as const,
    }
  }

  return {
    eyebrow: "Passagem anexada",
    detail: "Estamos analisando as informações da passagem.",
    tone: "pending" as const,
  }
}

function isFlightExtractionGuidanceMessage(message?: string | null) {
  const normalizedMessage = (message || "").toLowerCase()
  return normalizedMessage.includes("não foi possível extrair os dados desta passagem") || normalizedMessage.includes("nao foi possivel extrair os dados desta passagem")
}

function FlightExtractionGuidanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Como obter a melhor extração">
      <div className="space-y-5">
        <p className="text-sm text-white/70">A IA funciona melhor quando a passagem está completa, legível e sem cortes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">Correto</p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-800">
              <li>- Cartão de embarque individual</li>
              <li>- Todos os dados visíveis</li>
              <li>- QR Code completo</li>
              <li>- Boa resolução</li>
              <li>- Sem cortes</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Evite</p>
            <ul className="mt-3 space-y-2 text-sm text-amber-800">
              <li>- Prints cortados</li>
              <li>- Voucher com vários voos</li>
              <li>- Documento desfocado</li>
              <li>- QR Code cortado</li>
              <li>- Parte da passagem escondida</li>
            </ul>
          </div>
        </div>
        <Button onClick={onClose} className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
          Entendi
        </Button>
      </div>
    </Modal>
  )
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
  const hotels = sortHotelsForDisplay(Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []).map(
    normalizeHotelForDisplay,
  )
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []
  const documents = Array.isArray(tripData?.documents) ? tripData.documents : []
  const weatherIcon =
    typeof tripData?.weather?.icon === "function" || typeof tripData?.weather?.icon === "object"
      ? tripData.weather.icon
      : Cloud

  return {
    ...tripData,
    destination: tripData?.destination || "Minha Viagem",
    country: tripData?.country || "Não informado",
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
    heroImage: resolveTripHeroImage({
      coverImage: tripData?.heroImage,
      destination: tripData?.destination,
      city: tripData?.city,
      country: tripData?.country,
    }),
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
  const heroImage = resolveTripHeroImage({
    coverImage: storedTrip.coverImage,
    destination: storedTrip.destination,
    city: storedTrip.city || city,
    country: storedTrip.country || country,
  })
  const quickInfo = buildQuickInfo(storedTrip.destination, storedTrip.country || country, storedTrip.city || city)

  console.log("[LINK] cover resolved", heroImage)
  console.log("[LINK] metadata resolved", quickInfo)

  return normalizeTripViewData({
    ...initialTripData,
    id: storedTrip.id || storedTrip.slug || initialTripData.id,
    slug: storedTrip.slug || null,
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
          image: null,
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

function isOfflineTripItineraryRecord(value: unknown): value is TripItineraryRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as TripItineraryRecord).id === "string" &&
      typeof (value as TripItineraryRecord).mode === "string" &&
      typeof (value as TripItineraryRecord).status === "string",
  )
}

function resolveOfflineItineraryState(payloadItineraries: unknown[]) {
  if (payloadItineraries.every(isOfflineTripItineraryRecord)) {
    const itineraryRecords = payloadItineraries as TripItineraryRecord[]
    const simpleRecord = resolveSimpleTripItinerary(itineraryRecords)

    return {
      itineraryRecords,
      itineraryDays: simpleRecord?.content ? mapItineraryContentToLegacyDays(simpleRecord.content) : [],
    }
  }

  return {
    itineraryRecords: [] as TripItineraryRecord[],
    itineraryDays: payloadItineraries,
  }
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
  const itineraryPayload = Array.isArray(payload.itineraries) ? payload.itineraries : []
  const offlineItineraryState = resolveOfflineItineraryState(itineraryPayload)

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
      itinerary: offlineItineraryState.itineraryDays,
      documents,
      adminLink: buildAdminTripUrl(typeof trip.slug === "string" ? trip.slug : pkg.slug ?? pkg.tripId),
      shareLink: buildPublicTripUrl(typeof trip.slug === "string" ? trip.slug : pkg.slug ?? pkg.tripId),
    }),
    itineraryRecords: offlineItineraryState.itineraryRecords,
    agencyBranding: {
      name: typeof branding?.name === "string" ? branding.name : null,
      logoUrl: typeof branding?.logoUrl === "string" ? branding.logoUrl : typeof branding?.linkLogoUrl === "string" ? branding.linkLogoUrl : null,
      isAgency: Boolean(branding?.isAgency),
    },
    status: normalizeOfflinePackageStatus(pkg.status),
  }
}

function resolveTripAgencyId(source: any) {
  if (!source || typeof source !== "object") return null

  return source.agencyId ?? source.agency_id ?? source.agency?.id ?? null
}

type TripBrandingAccessMode = "admin" | "public"

type TripAgencyBrandingPayload = {
  agencyId: string | null
  name: string | null
  logoUrl: string | null
  linkLogoUrl: string | null
  isAgency: boolean
}

type TripTravelerCreditsPayload = {
  hidden: boolean
  isAgencyTrip: boolean
  balance: number
  planCreditsAvailable: number
  purchasedCreditsAvailable: number
  currentPeriodEnd: string | null
  currentPlan: "free" | "premium"
  subscriptionStatus: string
}

async function fetchTripAgencyBranding(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripBrandingAccessMode
}) {
  const searchParams = new URLSearchParams({
    accessMode: params.accessMode,
  })

  if (params.tripId) {
    searchParams.set("tripId", params.tripId)
  }

  if (params.tripSlug) {
    searchParams.set("tripSlug", params.tripSlug)
  }

  if (params.adminToken) {
    searchParams.set("adminToken", params.adminToken)
  }

  if (params.publicToken) {
    searchParams.set("publicToken", params.publicToken)
  }

  try {
    const response = await fetch(`/api/trip-branding?${searchParams.toString()}`, {
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => null)) as TripAgencyBrandingPayload | { error?: string } | null

    if (!response.ok) {
      console.error("[TRIP] trip branding fetch failed", payload)
      return null
    }

    if (!payload || typeof payload !== "object" || !("isAgency" in payload)) {
      return null
    }

    return payload as TripAgencyBrandingPayload
  } catch (error) {
    console.error("[TRIP] trip branding request error", error)
    return null
  }
}

async function fetchTripTravelerCredits(params: {
  tripId?: string | null
  tripSlug?: string | null
  adminToken?: string | null
  publicToken?: string | null
  accessMode: TripBrandingAccessMode
}) {
  const searchParams = new URLSearchParams({
    accessMode: params.accessMode,
  })

  if (params.tripId) {
    searchParams.set("tripId", params.tripId)
  }

  if (params.tripSlug) {
    searchParams.set("tripSlug", params.tripSlug)
  }

  if (params.adminToken) {
    searchParams.set("adminToken", params.adminToken)
  }

  if (params.publicToken) {
    searchParams.set("publicToken", params.publicToken)
  }

  try {
    const response = await fetch(`/api/trip-credits?${searchParams.toString()}`, {
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => null)) as TripTravelerCreditsPayload | { error?: string } | null

    if (!response.ok) {
      console.error("[TRIP] trip credits fetch failed", payload)
      return null
    }

    if (!payload || typeof payload !== "object" || !("hidden" in payload)) {
      return null
    }

    return payload as TripTravelerCreditsPayload
  } catch (error) {
    console.error("[TRIP] trip credits request error", error)
    return null
  }
}

function formatCreditsPeriodEnd(value?: string | null) {
  if (!value) return "Não informado"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "Não informado"

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getTravelerMonthlyCredits(plan?: "free" | "premium" | null) {
  return plan === "premium" ? 150 : 40
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

function revokeOfflineObjectUrls(urls: string[]) {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

async function openOfflineDocumentFromPackage(params: {
  document: any
  context: OfflineDocumentContext | null
  onUnavailable: (message: string) => void
  registerCleanup?: ((url: string | null) => void) | null
  getPreparedUrl?: (() => string | null) | null
}) {
  const { document, context, onUnavailable, registerCleanup, getPreparedUrl } = params

  if (!context || !document?.id) {
    onUnavailable("Este arquivo não está disponível offline.")
    return false
  }

  if (context.packageStatus === "legacy_snapshot") {
    onUnavailable("Este arquivo não está disponível offline.")
    return false
  }

  const pendingWindow = typeof window !== "undefined" ? window.open("", "_blank", "noopener,noreferrer") : null
  const preparedUrl = getPreparedUrl?.() ?? null
  if (preparedUrl) {
    if (pendingWindow) {
      pendingWindow.location.href = preparedUrl
      return true
    }

    const preparedWindow = window.open(preparedUrl, "_blank", "noopener,noreferrer")
    if (preparedWindow) return true

    onUnavailable("Não foi possível abrir automaticamente. Toque novamente para abrir o arquivo.")
    return false
  }

  const blobRecord = await getOfflineDocumentBlob(document.id, {
    tripId: context.tripId,
    packageKey: context.packageKey,
    audience: context.audience,
  })

  if (!blobRecord?.blob) {
    pendingWindow?.close()
    onUnavailable("Este arquivo não está disponível offline.")
    return false
  }

  const objectUrl = URL.createObjectURL(blobRecord.blob)
  registerOfflineObjectUrl(objectUrl, registerCleanup)

  if (pendingWindow) {
    pendingWindow.location.href = objectUrl
    return true
  }

  const openedWindow = window.open(objectUrl, "_blank", "noopener,noreferrer")
  if (openedWindow) {
    return true
  }

  onUnavailable("Não foi possível abrir automaticamente. Toque novamente para abrir o arquivo.")
  return false
}

function resolveProtectedWriteError(error?: string | null) {
  const normalized = (error ?? "").toLowerCase()

  if (normalized.includes("auth session missing")) {
    return "Não foi possível concluir a operação. Atualize a página e tente novamente."
  }

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("jwt") ||
    normalized.includes("not authenticated") ||
    normalized.includes("auth") ||
    normalized.includes("unauthorized")
  ) {
    return "Não foi possível concluir esta ação administrativa neste dispositivo."
  }

  return error || "Não foi possível concluir esta ação."
}

function resolvePublicTripErrorMessage(error?: string | null) {
  const normalized = (error ?? "").toLowerCase()

  if (normalized.includes("auth session missing")) {
    return "Não foi possível concluir a operação. Atualize a página e tente novamente."
  }

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("unauthorized") ||
    normalized.includes("not authenticated") ||
    normalized.includes("jwt")
  ) {
    return "Faça login novamente para continuar."
  }

  return error || "Não foi possível concluir a operação."
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
  const counts = getTripDocumentCounts(documents)
  return { ...counts, general: documents.filter((document) => !["ticket", "itinerary"].includes(document?.type ?? "")).length }
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
                {agencyBranding.logoUrl ? (
                  <Image
                    src={agencyBranding.logoUrl}
                    alt={agencyBranding.name || "Agência"}
                    width={144}
                    height={48}
                    className="h-7 w-auto max-w-[120px] object-contain sm:h-8 sm:max-w-[150px]"
                  />
                ) : (
                  <span className="max-w-[150px] truncate text-sm font-semibold tracking-[-0.03em] text-slate-900">
                    {agencyBranding.name || "Agência parceira"}
                  </span>
                )}
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
              Visualização
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
  const travelersCount = resolveTripTravelersCount(tripData)
  const WeatherIcon = tripData?.weather?.icon || Cloud

  return (
    <motion.section ref={ref} className="relative h-[85vh] min-h-[600px] overflow-hidden">
      <motion.div style={{ y }} className="absolute inset-0">
        <ImageWithFallback src={tripData.heroImage} fallbackSrc={DEFAULT_HERO_IMAGE} alt={tripData.destination} fill className="object-cover" priority />
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
                <p className="text-xs text-white/50">Período</p>
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
                <span className="text-sm font-medium">Sua aventura começa em breve</span>
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

function getItinerarySummaryState(itineraryDays: any[], itineraryRecords?: TripItineraryRecord[]) {
  const normalizedDays = Array.isArray(itineraryDays) ? itineraryDays : []
  const normalizedRecords = Array.isArray(itineraryRecords) ? itineraryRecords : []
  const simpleRecord = resolveSimpleTripItinerary(normalizedRecords)
  const plannedDays = normalizedDays.length > 0
    ? normalizedDays.length
    : Array.isArray(simpleRecord?.content?.days)
      ? simpleRecord.content.days.length
      : 0
  const attachedRecords = normalizedRecords.filter(
    (record) => record.mode !== "simple" && (record.status === "uploaded" || record.status === "completed")
  )

  if (plannedDays > 0) {
    return {
      count: plannedDays,
      summary: `${plannedDays} dia(s) planejado(s)`,
      detail: "Abra para ver",
      status: "Ver",
      statusClassName: "text-[#2563eb]",
    }
  }

  if (attachedRecords.length > 0) {
    return {
      count: attachedRecords.length,
      summary: `${attachedRecords.length} roteiro(s) anexado(s)`,
      detail: "Abra para ver",
      status: "Ver",
      statusClassName: "text-[#2563eb]",
    }
  }

  return {
    count: 0,
    summary: "Nenhum roteiro",
    detail: "Monte depois",
    status: "Vazio",
    statusClassName: "text-slate-400",
  }
}

// Quick access cards
function QuickAccessCards({ tripData, itineraryRecords, onNavigate }: { tripData: any; itineraryRecords?: TripItineraryRecord[]; onNavigate: (section: string) => void }) {
  const visibleDocuments = Array.isArray(tripData.documents)
    ? tripData.documents.filter((document: any) => document.type !== "itinerary")
    : []
  const ticketDocuments = visibleDocuments
    ? visibleDocuments.filter((document: any) => document.type === "ticket")
    : []
  const flightsCount = Array.isArray(tripData?.flights) ? tripData.flights.length : 0
  const itineraryCount = getItinerarySummaryState(Array.isArray(tripData?.itinerary) ? tripData.itinerary : [], itineraryRecords).count
  const documentsCount = visibleDocuments.length

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

type TravelerPublicPanel = "flights" | "hotel" | "itinerary" | "documents" | "concierge" | "offline" | null

type TripLinkTheme = "light" | "dark"

const TRIP_LINK_THEME_STORAGE_KEY = "vuei_trip_link_theme"

function TripLinkThemeStyles() {
  return (
    <style jsx global>{`
      .trip-link-page {
        --trip-page-bg: #f4f0e8;
        --trip-shell-bg: rgba(250, 248, 243, 0.74);
        --trip-text: #10203a;
        --trip-muted: #647086;
        --trip-faint: #8f98a8;
        --trip-accent: #1769ef;
        --trip-accent-soft: rgba(23, 105, 239, 0.1);
        --trip-status: #2775eb;
        --trip-surface: rgba(255, 255, 255, 0.58);
        --trip-surface-hover: rgba(255, 255, 255, 0.78);
        --trip-icon-surface: linear-gradient(145deg, rgba(255,255,255,0.92), rgba(239,242,247,0.68));
        --trip-border: rgba(255, 255, 255, 0.82);
        --trip-border-soft: rgba(122, 137, 160, 0.2);
        --trip-divider: rgba(112, 126, 148, 0.2);
        --trip-shadow: 0 24px 70px rgba(47, 57, 76, 0.13), inset 0 1px 0 rgba(255,255,255,0.9);
        --trip-soft-shadow: 0 14px 34px rgba(58, 68, 88, 0.1), inset 0 1px 0 rgba(255,255,255,0.86);
        --trip-nav-bg: rgba(248, 246, 241, 0.76);
        min-height: 100vh;
        background:
          radial-gradient(circle at 9% 4%, rgba(255,255,255,0.96) 0, rgba(255,255,255,0) 30%),
          radial-gradient(circle at 93% 42%, rgba(225,209,191,0.5) 0, rgba(225,209,191,0) 35%),
          linear-gradient(145deg, #f7f5f0 0%, #eee9e1 100%);
        color: var(--trip-text);
        transition: background 360ms ease, color 260ms ease;
      }
      .trip-link-page[data-theme="dark"] {
        --trip-page-bg: #07101a;
        --trip-shell-bg: rgba(8, 16, 26, 0.78);
        --trip-text: #f7f4ef;
        --trip-muted: #a7adb8;
        --trip-faint: #7d8795;
        --trip-accent: #efbd72;
        --trip-accent-soft: rgba(239, 189, 114, 0.12);
        --trip-status: #a8c4ff;
        --trip-surface: rgba(255, 255, 255, 0.055);
        --trip-surface-hover: rgba(255, 255, 255, 0.085);
        --trip-icon-surface: linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035));
        --trip-border: rgba(255, 255, 255, 0.2);
        --trip-border-soft: rgba(255, 255, 255, 0.1);
        --trip-divider: rgba(255, 255, 255, 0.1);
        --trip-shadow: 0 28px 80px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255,255,255,0.1);
        --trip-soft-shadow: 0 16px 40px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255,255,255,0.08);
        --trip-nav-bg: rgba(15, 22, 31, 0.82);
        background:
          radial-gradient(circle at 87% 5%, rgba(114,73,31,0.24) 0, rgba(114,73,31,0) 27%),
          radial-gradient(circle at 3% 48%, rgba(18,54,87,0.22) 0, rgba(18,54,87,0) 34%),
          linear-gradient(145deg, #08121d 0%, #050a11 100%);
      }
      .traveler-public-shell {
        position: relative;
        isolation: isolate;
        margin: 0 auto;
        display: flex;
        min-height: 100vh;
        width: 100%;
        max-width: 520px;
        flex-direction: column;
        overflow: hidden;
        color: var(--trip-text);
        background: var(--trip-shell-bg);
        transition: background 360ms ease, color 260ms ease;
      }
      .traveler-public-shell::before,
      .traveler-public-shell::after {
        position: absolute;
        z-index: -1;
        border-radius: 999px;
        content: "";
        pointer-events: none;
        filter: blur(54px);
      }
      .traveler-public-shell::before {
        left: -18%;
        top: 2%;
        height: 270px;
        width: 270px;
        background: rgba(255,255,255,0.44);
      }
      .traveler-public-shell::after {
        right: -24%;
        top: 42%;
        height: 310px;
        width: 310px;
        background: rgba(220,199,176,0.24);
      }
      .trip-link-page[data-theme="dark"] .traveler-public-shell::before {
        background: rgba(25, 72, 111, 0.18);
      }
      .trip-link-page[data-theme="dark"] .traveler-public-shell::after {
        background: rgba(120, 76, 31, 0.14);
      }
      .trip-shell-inner {
        position: relative;
        display: flex;
        min-height: 100vh;
        flex: 1;
        flex-direction: column;
        padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 90px);
      }
      .trip-top-header {
        display: flex;
        min-height: 46px;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .trip-brand-badge,
      .trip-round-action,
      .trip-avatar-action,
      .trip-summary-panel,
      .trip-offline-card,
      .trip-bottom-nav {
        border: 1px solid var(--trip-border);
        background: var(--trip-surface);
        box-shadow: var(--trip-soft-shadow);
        -webkit-backdrop-filter: blur(18px) saturate(140%);
        backdrop-filter: blur(18px) saturate(140%);
        transition: background 260ms ease, border-color 260ms ease, color 260ms ease, box-shadow 260ms ease;
      }
      .trip-brand-badge {
        display: flex;
        min-width: 0;
        max-width: 272px;
        align-items: center;
        gap: 10px;
        border-radius: 999px;
        padding: 9px 13px;
      }
      .trip-brand-logo {
        height: 28px;
        width: auto;
        max-width: 116px;
        flex-shrink: 0;
        object-fit: contain;
      }
      .trip-brand-divider {
        height: 24px;
        width: 1px;
        flex-shrink: 0;
        background: var(--trip-divider);
      }
      .trip-brand-credit {
        min-width: 0;
        color: var(--trip-muted);
        font-size: 0.7rem;
        font-weight: 450;
        line-height: 1.15;
      }
      .trip-brand-credit strong {
        color: var(--trip-text);
        font-weight: 650;
      }
      .trip-header-actions {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 7px;
      }
      .trip-round-action,
      .trip-avatar-action {
        display: flex;
        height: 44px;
        width: 44px;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
      }
      .trip-round-action {
        color: var(--trip-text);
      }
      .trip-round-action:hover {
        background: var(--trip-surface-hover);
        transform: translateY(-1px);
      }
      .trip-avatar-action {
        border-color: color-mix(in srgb, var(--trip-accent) 42%, transparent);
        color: white;
        font-size: 1rem;
        font-weight: 650;
        background: linear-gradient(145deg, #347be2, #163d85);
        box-shadow: 0 12px 30px rgba(29, 78, 165, 0.28), inset 0 1px 0 rgba(255,255,255,0.35);
      }
      .trip-link-page[data-theme="dark"] .trip-avatar-action {
        color: var(--trip-accent);
        background: linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
        box-shadow: 0 14px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      .trip-hero-card {
        position: relative;
        margin-top: 14px;
        aspect-ratio: 1.68 / 1;
        min-height: 250px;
        width: 100%;
        min-width: 0;
        max-width: 100%;
        overflow: hidden;
        overflow: clip;
        isolation: isolate;
        border: 1px solid rgba(255,255,255,0.7);
        border-radius: 29px;
        box-shadow: 0 26px 54px rgba(35, 45, 61, 0.2), inset 0 1px 0 rgba(255,255,255,0.55);
      }
      .trip-hero-media {
        position: absolute;
        inset: 0;
        z-index: 0;
        overflow: hidden;
        border-radius: inherit;
      }
      .trip-hero-image {
        inset: 0 !important;
        display: block;
        height: 100% !important;
        width: 100% !important;
        max-width: none !important;
        object-fit: cover;
        object-position: 68% 52%;
      }
      .trip-link-page[data-theme="dark"] .trip-hero-card {
        border-color: rgba(255,255,255,0.5);
        box-shadow: 0 28px 62px rgba(0,0,0,0.48), inset 0 1px 0 rgba(255,255,255,0.2);
      }
      .trip-hero-overlay {
        position: absolute;
        inset: 0;
        z-index: 1;
        background:
          linear-gradient(90deg, rgba(5,14,27,0.76) 0%, rgba(5,14,27,0.38) 52%, rgba(5,14,27,0.04) 82%),
          linear-gradient(0deg, rgba(5,12,22,0.78) 0%, rgba(5,12,22,0.04) 58%);
      }
      .trip-link-page[data-theme="dark"] .trip-hero-overlay {
        background:
          linear-gradient(90deg, rgba(3,10,19,0.84) 0%, rgba(3,10,19,0.46) 54%, rgba(3,10,19,0.08) 82%),
          linear-gradient(0deg, rgba(2,8,15,0.9) 0%, rgba(2,8,15,0.05) 58%);
      }
      .trip-hero-content {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: flex;
        max-width: 78%;
        flex-direction: column;
        justify-content: flex-end;
        padding: 24px 23px;
        color: #fff;
      }
      .trip-display-title,
      .trip-section-title,
      .trip-summary-title,
      .trip-offline-title {
        font-family: Georgia, "Times New Roman", serif;
      }
      .trip-display-title {
        font-size: clamp(3rem, 13vw, 4.2rem);
        font-weight: 400;
        line-height: 0.9;
        letter-spacing: -0.055em;
        text-wrap: balance;
      }
      .trip-hero-country {
        margin-top: 13px;
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 9px;
        color: rgba(255,255,255,0.82);
        font-size: 1rem;
      }
      .trip-hero-rule {
        margin: 15px 0 14px;
        height: 1px;
        width: 26px;
        background: rgba(255,255,255,0.8);
      }
      .trip-date-pill {
        display: inline-flex;
        max-width: max-content;
        align-items: center;
        gap: 10px;
        border: 1px solid rgba(255,255,255,0.5);
        border-radius: 999px;
        padding: 11px 16px;
        background: rgba(10,20,34,0.26);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.2);
        -webkit-backdrop-filter: blur(12px);
        backdrop-filter: blur(12px);
        font-size: 0.92rem;
        font-weight: 520;
        white-space: nowrap;
      }
      .trip-section-title {
        margin: 18px 4px 8px;
        color: var(--trip-text);
        font-size: 1.58rem;
        font-weight: 500;
        letter-spacing: -0.035em;
      }
      .trip-summary-panel {
        overflow: hidden;
        border-radius: 26px;
        padding: 0 17px;
        box-shadow: var(--trip-shadow);
      }
      .trip-summary-row {
        display: grid;
        min-height: 76px;
        grid-template-columns: 52px minmax(0, 1fr) auto 16px;
        align-items: center;
        gap: 13px;
        width: 100%;
        color: var(--trip-text);
        text-align: left;
      }
      .trip-summary-row + .trip-summary-row {
        border-top: 1px solid var(--trip-divider);
      }
      .trip-summary-row:hover {
        background: linear-gradient(90deg, transparent, var(--trip-accent-soft), transparent);
      }
      .trip-summary-icon {
        display: flex;
        height: 48px;
        width: 48px;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--trip-border);
        border-radius: 17px;
        color: var(--trip-accent);
        background: var(--trip-icon-surface);
        box-shadow: var(--trip-soft-shadow);
      }
      .trip-summary-copy {
        min-width: 0;
      }
      .trip-summary-title {
        overflow: hidden;
        color: var(--trip-text);
        font-size: 1.12rem;
        font-weight: 500;
        line-height: 1.15;
        letter-spacing: -0.025em;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .trip-summary-text,
      .trip-summary-detail {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .trip-summary-text {
        margin-top: 3px;
        color: var(--trip-muted);
        font-size: 0.84rem;
      }
      .trip-summary-detail {
        margin-top: 2px;
        color: var(--trip-accent);
        font-size: 0.79rem;
        font-weight: 520;
      }
      .trip-summary-status {
        display: flex;
        align-items: center;
        gap: 7px;
        color: var(--trip-status);
        font-size: 0.76rem;
        font-weight: 500;
        white-space: nowrap;
      }
      .trip-summary-status[data-status="confirmado"],
      .trip-summary-status[data-status="pronto"] {
        color: #3aa675;
      }
      .trip-status-dot {
        height: 6px;
        width: 6px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 12px color-mix(in srgb, currentColor 55%, transparent);
      }
      .trip-summary-chevron {
        color: var(--trip-muted);
      }
      .trip-offline-card {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 48px minmax(0,1fr) auto;
        align-items: center;
        gap: 14px;
        width: 100%;
        border-radius: 26px;
        padding: 11px 16px;
        color: var(--trip-text);
      }
      .trip-offline-title {
        color: var(--trip-text);
        font-size: 1.04rem;
        font-weight: 500;
      }
      .trip-offline-subtitle {
        margin-top: 3px;
        color: var(--trip-muted);
        font-size: 0.78rem;
      }
      .trip-download-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid color-mix(in srgb, var(--trip-accent) 70%, transparent);
        border-radius: 999px;
        padding: 9px 13px;
        color: var(--trip-accent);
        background: color-mix(in srgb, var(--trip-surface-hover) 88%, transparent);
        box-shadow: 0 10px 24px color-mix(in srgb, var(--trip-accent) 12%, transparent);
        font-size: 0.78rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .trip-offline-banner {
        margin-top: 12px;
        border: 1px solid rgba(217, 155, 53, 0.28);
        border-radius: 20px;
        padding: 10px 14px;
        color: #9a6b1f;
        background: rgba(255, 244, 217, 0.72);
        font-size: 0.78rem;
      }
      .trip-link-page[data-theme="dark"] .trip-offline-banner {
        color: #efbd72;
        background: rgba(120,76,31,0.13);
      }
      .trip-bottom-nav {
        position: fixed;
        z-index: 40;
        left: 50%;
        bottom: max(10px, env(safe-area-inset-bottom));
        width: min(calc(100% - 24px), 488px);
        transform: translateX(-50%);
        border-radius: 30px;
        padding: 7px 8px 6px;
        background: var(--trip-nav-bg);
        box-shadow: var(--trip-shadow);
      }
      .trip-bottom-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 2px;
      }
      .trip-bottom-item {
        position: relative;
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        border-radius: 21px;
        padding: 6px 2px 4px;
        color: var(--trip-muted);
        text-align: center;
      }
      .trip-bottom-item[data-active="true"] {
        color: var(--trip-accent);
        background: linear-gradient(135deg, var(--trip-accent-soft), transparent);
      }
      .trip-bottom-item[data-active="true"]::after {
        position: absolute;
        bottom: -6px;
        height: 2px;
        width: 34px;
        border-radius: 999px;
        background: var(--trip-accent);
        content: "";
      }
      .trip-bottom-icon {
        position: relative;
        display: flex;
        height: 30px;
        width: 30px;
        align-items: center;
        justify-content: center;
      }
      .trip-bottom-badge {
        position: absolute;
        right: -6px;
        top: -5px;
        border: 1px solid var(--trip-border);
        border-radius: 999px;
        padding: 2px 5px;
        color: var(--trip-text);
        background: var(--trip-nav-bg);
        box-shadow: var(--trip-soft-shadow);
        font-size: 8px;
        font-weight: 650;
      }
      .trip-bottom-label {
        overflow: hidden;
        max-width: 100%;
        font-size: 0.66rem;
        font-weight: 520;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .trip-claim-notice {
        border-color: var(--trip-border) !important;
        color: var(--trip-text);
        background: var(--trip-surface) !important;
        box-shadow: var(--trip-soft-shadow) !important;
        backdrop-filter: blur(18px);
      }
      .trip-claim-notice [class*="text-slate-9"] {
        color: var(--trip-text) !important;
      }
      .trip-claim-notice [class*="text-slate-6"] {
        color: var(--trip-muted) !important;
      }
      @media (min-width: 640px) {
        .traveler-public-shell {
          margin-block: 20px;
          min-height: calc(100vh - 40px);
          border: 1px solid var(--trip-border-soft);
          border-radius: 42px;
          box-shadow: var(--trip-shadow);
        }
        .trip-shell-inner {
          min-height: calc(100vh - 40px);
          padding-inline: 24px;
        }
      }
      @media (max-width: 430px) {
        .trip-shell-inner {
          padding-inline: 12px;
        }
        .trip-brand-badge {
          max-width: 205px;
          gap: 7px;
          padding-inline: 10px;
        }
        .trip-brand-logo {
          max-width: 86px;
        }
        .trip-brand-credit {
          font-size: 0.61rem;
        }
        .trip-header-actions {
          gap: 5px;
        }
        .trip-round-action,
        .trip-avatar-action {
          height: 39px;
          width: 39px;
        }
        .trip-hero-card {
          min-height: 244px;
          border-radius: 27px;
        }
        .trip-hero-image {
          object-position: 64% 52%;
        }
        .trip-hero-content {
          max-width: 86%;
          padding: 21px 20px;
        }
        .trip-display-title {
          font-size: clamp(3rem, 16vw, 4.1rem);
        }
        .trip-summary-panel {
          padding-inline: 13px;
        }
        .trip-summary-row {
          grid-template-columns: 48px minmax(0, 1fr) auto 14px;
          gap: 10px;
        }
        .trip-summary-icon {
          height: 44px;
          width: 44px;
        }
        .trip-summary-status {
          font-size: 0.7rem;
        }
        .trip-offline-card {
          grid-template-columns: 44px minmax(0,1fr) auto;
          gap: 10px;
          padding-inline: 13px;
        }
        .trip-download-pill {
          padding-inline: 10px;
        }
      }
      @media (max-width: 360px) {
        .trip-brand-credit,
        .trip-summary-status span:last-child,
        .trip-download-pill span {
          display: none;
        }
        .trip-brand-badge {
          max-width: 122px;
        }
        .trip-summary-row {
          grid-template-columns: 44px minmax(0, 1fr) 8px 14px;
        }
        .trip-download-pill {
          height: 38px;
          width: 38px;
          justify-content: center;
          padding: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .trip-link-page,
        .traveler-public-shell,
        .trip-brand-badge,
        .trip-round-action,
        .trip-avatar-action,
        .trip-summary-panel,
        .trip-offline-card,
        .trip-bottom-nav {
          transition: none;
        }
      }
      .trip-link-light-shell section[id] {
        padding: 0 !important;
      }
      .trip-link-light-shell [class*="text-white"] {
        color: #0f172a !important;
      }
      .trip-link-light-shell [class*="text-white/"] {
        color: #64748b !important;
      }
      .trip-link-light-shell [class*="bg-[#0a0a0a]"],
      .trip-link-light-shell [class*="bg-black"],
      .trip-link-light-shell [class*="bg-white/[0.02]"],
      .trip-link-light-shell [class*="bg-white/[0.03]"],
      .trip-link-light-shell [class*="bg-white/[0.04]"],
      .trip-link-light-shell [class*="bg-white/[0.05]"] {
        background: rgba(255, 255, 255, 0.92) !important;
      }
      .trip-link-light-shell [class*="border-white"] {
        border-color: rgba(148, 163, 184, 0.18) !important;
      }
      .trip-link-light-shell [class*="text-[#5de0e6]"] {
        color: #2563eb !important;
      }
      .trip-link-light-shell [class*="from-[#5de0e6]"],
      .trip-link-light-shell [class*="to-[#004aad]"] {
        box-shadow: none !important;
      }
      .trip-link-light-shell label,
      .trip-link-light-shell .text-xs.uppercase,
      .trip-link-light-shell .text-xs.tracking-wider {
        color: #64748b !important;
      }
      .trip-link-light-shell input,
      .trip-link-light-shell textarea,
      .trip-link-light-shell select {
        background: #ffffff !important;
        color: #0f172a !important;
        border-color: rgba(148, 163, 184, 0.22) !important;
      }
      .trip-link-light-shell input::placeholder,
      .trip-link-light-shell textarea::placeholder {
        color: #94a3b8 !important;
      }
      .trip-link-light-shell option {
        background: #ffffff !important;
        color: #0f172a !important;
      }
      .trip-link-light-shell .text-muted-foreground,
      .trip-link-light-shell [class*="text-slate-4"],
      .trip-link-light-shell [class*="text-slate-5"],
      .trip-link-light-shell [class*="text-slate-6"] {
        color: #64748b !important;
      }
      .trip-link-dark-shell [class*="text-slate-8"],
      .trip-link-dark-shell [class*="text-slate-9"],
      .trip-link-dark-shell [class*="text-black"] {
        color: #f7f4ef !important;
      }
      .trip-link-dark-shell [class*="text-slate-4"],
      .trip-link-dark-shell [class*="text-slate-5"],
      .trip-link-dark-shell [class*="text-slate-6"],
      .trip-link-dark-shell [class*="text-slate-7"],
      .trip-link-dark-shell .text-muted-foreground {
        color: #a7adb8 !important;
      }
      .trip-link-dark-shell [class*="text-[#2563eb]"],
      .trip-link-dark-shell [class*="text-[#5de0e6]"] {
        color: #efbd72 !important;
      }
      .trip-link-dark-shell [class*="bg-white"],
      .trip-link-dark-shell [class*="bg-[#eef4ff]"],
      .trip-link-dark-shell [class*="bg-[#eff6ff]"],
      .trip-link-dark-shell [class*="bg-[linear-gradient(180deg,#ffffff"] {
        background: rgba(255, 255, 255, 0.055) !important;
      }
      .trip-link-dark-shell [class*="border-slate"],
      .trip-link-dark-shell [class*="border-[#dbe5f4]"] {
        border-color: rgba(255, 255, 255, 0.1) !important;
      }
      .trip-link-dark-shell input,
      .trip-link-dark-shell textarea,
      .trip-link-dark-shell select {
        background: rgba(255, 255, 255, 0.055) !important;
        color: #f7f4ef !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
      }
      .trip-link-dark-shell input::placeholder,
      .trip-link-dark-shell textarea::placeholder {
        color: #7d8795 !important;
      }
      .trip-link-dark-shell option {
        background: #111923 !important;
        color: #f7f4ef !important;
      }
      .trip-dialog-backdrop {
        background: rgba(52, 63, 78, 0.2);
        -webkit-backdrop-filter: blur(8px) saturate(110%);
        backdrop-filter: blur(8px) saturate(110%);
      }
      .trip-dialog-backdrop[data-tone="dark"] {
        background: rgba(1, 6, 12, 0.74);
      }
      .trip-modal-surface,
      .trip-sheet-surface {
        --dialog-text: #10203a;
        --dialog-muted: #657187;
        --dialog-faint: #8f98a8;
        --dialog-accent: #1769ef;
        --dialog-accent-soft: rgba(23, 105, 239, 0.1);
        --dialog-border: rgba(255, 255, 255, 0.84);
        --dialog-divider: rgba(112, 126, 148, 0.2);
        --dialog-card: rgba(255, 255, 255, 0.58);
        --dialog-card-strong: rgba(255, 255, 255, 0.78);
        --dialog-icon: linear-gradient(145deg, rgba(255,255,255,0.96), rgba(231,237,247,0.72));
        --dialog-header: rgba(248, 246, 241, 0.82);
        border: 1px solid var(--dialog-border);
        color: var(--dialog-text);
        background:
          radial-gradient(circle at 92% 0%, rgba(210, 224, 247, 0.52), transparent 28%),
          radial-gradient(circle at 8% 100%, rgba(235, 218, 198, 0.46), transparent 32%),
          linear-gradient(145deg, rgba(252,251,248,0.96), rgba(239,235,228,0.92));
        box-shadow: 0 30px 90px rgba(35, 45, 61, 0.2), inset 0 1px 0 rgba(255,255,255,0.94);
        -webkit-backdrop-filter: blur(24px) saturate(135%);
        backdrop-filter: blur(24px) saturate(135%);
      }
      .trip-modal-surface[data-tone="dark"],
      .trip-sheet-surface[data-tone="dark"] {
        --dialog-text: #f7f4ef;
        --dialog-muted: #a7adb8;
        --dialog-faint: #7d8795;
        --dialog-accent: #efbd72;
        --dialog-accent-soft: rgba(239, 189, 114, 0.11);
        --dialog-border: rgba(255, 255, 255, 0.16);
        --dialog-divider: rgba(255, 255, 255, 0.1);
        --dialog-card: rgba(255, 255, 255, 0.052);
        --dialog-card-strong: rgba(255, 255, 255, 0.078);
        --dialog-icon: linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.025));
        --dialog-header: rgba(10, 18, 28, 0.84);
        background:
          radial-gradient(circle at 94% 0%, rgba(126, 82, 36, 0.22), transparent 27%),
          radial-gradient(circle at 3% 96%, rgba(23, 68, 103, 0.2), transparent 31%),
          linear-gradient(145deg, rgba(12,21,32,0.97), rgba(5,11,18,0.96));
        box-shadow: 0 34px 100px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      .trip-modal-surface {
        border-radius: 30px;
      }
      .trip-sheet-surface {
        width: min(100%, 680px);
        margin-inline: auto;
        overflow-x: hidden;
        border-bottom: 0;
        border-radius: 34px 34px 0 0;
        box-shadow: 0 -28px 84px rgba(35, 45, 61, 0.2), inset 0 1px 0 rgba(255,255,255,0.92);
      }
      .trip-sheet-surface[data-tone="dark"] {
        box-shadow: 0 -32px 92px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.1);
      }
      .trip-dialog-header {
        padding: 17px 20px;
        border-bottom: 1px solid var(--dialog-divider);
        color: var(--dialog-text);
        background: var(--dialog-header);
        -webkit-backdrop-filter: blur(22px) saturate(130%);
        backdrop-filter: blur(22px) saturate(130%);
      }
      .trip-sheet-header {
        padding-top: 11px;
        padding-bottom: 15px;
      }
      .trip-sheet-handle {
        width: 46px;
        height: 4px;
        margin: 0 auto 13px;
        border-radius: 999px;
        background: var(--dialog-divider);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
      }
      .trip-dialog-title {
        color: var(--dialog-text);
        font-family: Georgia, "Times New Roman", serif;
        font-size: 1.3rem;
        font-weight: 500;
        line-height: 1.15;
        letter-spacing: -0.03em;
      }
      .trip-dialog-close {
        display: flex;
        height: 38px;
        width: 38px;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        border: 1px solid var(--dialog-border);
        border-radius: 14px;
        color: var(--dialog-muted);
        background: var(--dialog-card);
        box-shadow: 0 9px 22px rgba(46, 58, 75, 0.08), inset 0 1px 0 rgba(255,255,255,0.55);
        transition: background 180ms ease, color 180ms ease, transform 180ms ease;
      }
      .trip-dialog-close:hover {
        color: var(--dialog-text);
        background: var(--dialog-card-strong);
        transform: translateY(-1px);
      }
      .trip-dialog-content {
        padding: 20px 20px calc(env(safe-area-inset-bottom) + 24px);
        color: var(--dialog-text);
      }
      .trip-panel-content {
        padding-top: 17px;
      }
      .trip-panel-content section[id] {
        padding: 0 0 8px !important;
      }
      .trip-panel-content section[id] > div {
        width: 100%;
        max-width: none !important;
        margin: 0 !important;
      }
      .trip-panel-content section[id] > div > :first-child {
        margin-bottom: 18px !important;
      }
      .trip-panel-content section[id] > div > :first-child > div:first-child > div:first-child {
        border: 1px solid var(--dialog-border);
        color: var(--dialog-accent);
        background: var(--dialog-icon) !important;
        box-shadow: 0 10px 24px rgba(46,58,75,0.09), inset 0 1px 0 rgba(255,255,255,0.5);
      }
      .trip-panel-content section[id] > div > :first-child > div:first-child > div:first-child svg {
        color: var(--dialog-accent) !important;
      }
      .trip-panel-content section[id] h2 {
        color: var(--dialog-text) !important;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 1.32rem !important;
        font-weight: 500 !important;
        letter-spacing: -0.025em;
      }
      .trip-panel-content section[id] h2 + p {
        color: var(--dialog-muted) !important;
      }
      .trip-panel-content section[id] > div > :first-child button {
        border: 1px solid var(--dialog-border);
        border-radius: 999px;
        color: var(--dialog-accent) !important;
        background: var(--dialog-card) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);
      }
      .trip-panel-heading {
        gap: 14px;
      }
      .trip-panel-heading-icon {
        display: flex;
        height: 46px !important;
        width: 46px !important;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--dialog-border);
        border-radius: 16px !important;
        color: var(--dialog-accent);
        background: var(--dialog-icon) !important;
        box-shadow: 0 11px 28px rgba(46,58,75,0.09), inset 0 1px 0 rgba(255,255,255,0.48);
      }
      .trip-panel-heading-icon svg {
        color: var(--dialog-accent) !important;
      }
      .trip-panel-heading-title {
        color: var(--dialog-text) !important;
      }
      .trip-panel-heading-title + p {
        color: var(--dialog-muted) !important;
      }
      .trip-panel-card {
        border-color: var(--dialog-border) !important;
        color: var(--dialog-text);
        background: var(--dialog-card) !important;
        box-shadow: 0 15px 38px rgba(42,53,70,0.08), inset 0 1px 0 rgba(255,255,255,0.38);
        -webkit-backdrop-filter: blur(16px) saturate(125%);
        backdrop-filter: blur(16px) saturate(125%);
      }
      .trip-panel-card:hover {
        border-color: color-mix(in srgb, var(--dialog-accent) 28%, var(--dialog-border)) !important;
        background: var(--dialog-card-strong) !important;
      }
      .trip-sheet-surface[data-tone="dark"] .trip-panel-card [class*="from-slate-100"][class*="via-white"] {
        background: var(--dialog-icon) !important;
      }
      .trip-panel-content [class*="rounded-3xl"][class*="border"]:not([class*="amber"]):not([class*="emerald"]):not([class*="red"]),
      .trip-panel-content [class*="rounded-2xl"][class*="border"]:not([class*="amber"]):not([class*="emerald"]):not([class*="red"]),
      .trip-modal-content [class*="rounded-3xl"][class*="border"]:not([class*="amber"]):not([class*="emerald"]):not([class*="red"]),
      .trip-modal-content [class*="rounded-2xl"][class*="border"]:not([class*="amber"]):not([class*="emerald"]):not([class*="red"]) {
        border-color: var(--dialog-border) !important;
        background: var(--dialog-card) !important;
        box-shadow: 0 14px 36px rgba(42,53,70,0.08), inset 0 1px 0 rgba(255,255,255,0.4);
      }
      .trip-modal-surface[data-tone="dark"] .trip-panel-content [class*="from-[#5de0e6]"][class*="to-[#004aad]"],
      .trip-modal-surface[data-tone="dark"] .trip-modal-content [class*="from-[#5de0e6]"][class*="to-[#004aad]"],
      .trip-sheet-surface[data-tone="dark"] .trip-panel-content [class*="from-[#5de0e6]"][class*="to-[#004aad]"] {
        background: linear-gradient(135deg, #efbd72, #9c6330) !important;
      }
      .trip-dialog-content input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
      .trip-dialog-content textarea,
      .trip-dialog-content select {
        min-height: 46px;
        border: 1px solid var(--dialog-border) !important;
        border-radius: 15px !important;
        color: var(--dialog-text) !important;
        background-color: var(--dialog-card-strong) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.38), 0 8px 20px rgba(43,54,70,0.05);
      }
      .trip-dialog-content input::placeholder,
      .trip-dialog-content textarea::placeholder {
        color: var(--dialog-faint) !important;
      }
      .trip-dialog-content label:not(.trip-upload-dropzone) {
        color: var(--dialog-muted) !important;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
      .trip-dialog-content code {
        color: var(--dialog-muted) !important;
      }
      .trip-upload-dropzone {
        border: 1px dashed color-mix(in srgb, var(--dialog-accent) 38%, var(--dialog-border)) !important;
        border-radius: 22px !important;
        color: var(--dialog-muted) !important;
        background:
          radial-gradient(circle at 50% 0%, var(--dialog-accent-soft), transparent 48%),
          var(--dialog-card) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.38);
      }
      .trip-upload-dropzone:hover {
        border-color: color-mix(in srgb, var(--dialog-accent) 64%, transparent) !important;
        background-color: var(--dialog-card-strong) !important;
      }
      .trip-upload-dropzone svg,
      .trip-upload-dropzone [class*="text-white"] {
        color: var(--dialog-accent) !important;
      }
      .trip-upload-dropzone p {
        color: var(--dialog-muted) !important;
      }
      .trip-upload-dropzone p + p {
        color: var(--dialog-faint) !important;
      }
      .trip-document-type-select {
        padding-right: 42px !important;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23657087'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.8' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E") !important;
        background-repeat: no-repeat !important;
        background-position: right 14px center !important;
        background-size: 16px !important;
      }
      .trip-modal-surface[data-tone="dark"] .trip-document-type-select {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23efbd72'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.8' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E") !important;
      }
      @media (max-width: 639px) {
        .trip-modal-surface {
          border-radius: 27px;
        }
        .trip-sheet-surface {
          border-left: 0;
          border-right: 0;
          border-radius: 29px 29px 0 0;
        }
        .trip-dialog-header {
          padding-inline: 16px;
        }
        .trip-dialog-content {
          padding: 16px 16px calc(env(safe-area-inset-bottom) + 22px);
        }
      }
    `}</style>
  )
}

function buildTravelerCardSummaries(tripData: any, itineraryRecords?: TripItineraryRecord[]) {
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const hotels = Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []
  const documents = getContentTripDocuments(getTripDocuments<any>(tripData))
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []
  const flight = getPreferredStructuredFlight(flights)
  const rawHotel = hotels[0]
  const hotelNights =
    rawHotel?.checkIn && rawHotel?.checkOut
      ? Math.max(
          Math.round((new Date(rawHotel.checkOut).getTime() - new Date(rawHotel.checkIn).getTime()) / (1000 * 60 * 60 * 24)),
          0,
        )
      : 0
  const hotelDetail = rawHotel
    ? [rawHotel.checkIn || "Check-in pendente", hotelNights > 0 ? `${hotelNights} noite(s)` : rawHotel.checkOut || null]
        .filter(Boolean)
        .join(" • ")
    : "Abra para ver"
  const hotel = rawHotel ? { ...rawHotel, checkIn: hotelDetail, checkOut: "" } : rawHotel

  const itineraryCard = getItinerarySummaryState(itinerary, itineraryRecords)

  return [
    {
      id: "flights" as const,
      icon: Plane,
      title: "Passagens",
      summary: flight
        ? `${flight.origin?.city || "---"} -> ${flight.destination?.city || "---"}`
        : getTicketTripDocuments(documents).length > 0
          ? `${getTicketTripDocuments(documents).length} bilhete(s)`
          : "Nenhuma passagem",
      detail: flight
        ? `${flight.date || "Data pendente"}${flight.origin?.time ? ` • ${flight.origin.time}` : ""}${flight.destination?.time ? ` - ${flight.destination.time || "Horário não informado"}` : ""}`
        : "Abra para ver",
      status: flight ? "Confirmado" : "Pendente",
      statusClassName: flight ? "text-emerald-600" : "text-slate-400",
    },
    {
      id: "hotel" as const,
      icon: Hotel,
      title: "Hospedagem",
      summary: hotel?.name || "Nenhuma hospedagem",
      detail: hotel
        ? `${hotel.checkIn || "Check-in pendente"}${hotel.checkOut ? ` • ${hotel.checkOut}` : ""}`
        : "Abra para ver",
      status: hotel ? "Confirmado" : "Pendente",
      statusClassName: hotel ? "text-emerald-600" : "text-slate-400",
    },
    {
      id: "documents" as const,
      icon: FileText,
      title: "Documentos",
      summary: documents.length > 0 ? `${documents.length} documento(s)` : "Nenhum documento",
      detail: documents.length > 0 ? "Abra para ver" : "Adicione depois",
      status: documents.length > 0 ? "Pronto" : "Vazio",
      statusClassName: documents.length > 0 ? "text-[#2563eb]" : "text-slate-400",
    },
    {
      id: "itinerary" as const,
      icon: MapPin,
      title: "Roteiro",
      summary: itineraryCard.summary,
      detail: itineraryCard.detail,
      status: itineraryCard.status,
      statusClassName: itineraryCard.statusClassName,
    },
  ]
}

function buildTravelerCardSummariesClean(tripData: any, itineraryRecords?: TripItineraryRecord[]) {
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const hotels = sortHotelsForDisplay(Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []).map(
    normalizeHotelForDisplay,
  )
  const documents = getContentTripDocuments(getTripDocuments<any>(tripData))
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []
  const flight = getPreferredStructuredFlight(flights)
  const hotel = hotels[0] ?? null
  const hotelDetail = hotel
    ? [hotel.checkIn || "Check-in a definir", hotel.nights > 0 ? `${hotel.nights} noite${hotel.nights > 1 ? "s" : ""}` : hotel.checkOut || null]
        .filter(Boolean)
        .join(" • ")
    : "Abra para ver"

  const itineraryCard = getItinerarySummaryState(itinerary, itineraryRecords)

  return [
    {
      id: "flights" as const,
      icon: Plane,
      title: "Passagens",
      summary: flight
        ? `${flight.origin?.city || "---"} -> ${flight.destination?.city || "---"}`
        : getTicketTripDocuments(documents).length > 0
          ? `${getTicketTripDocuments(documents).length} bilhete(s)`
          : "Nenhuma passagem",
      detail: flight
        ? `${flight.date || "Data pendente"}${flight.origin?.time ? ` • ${flight.origin.time}` : ""}${flight.destination?.time ? ` - ${flight.destination.time || "Horário não informado"}` : ""}`
        : "Abra para ver",
      status: flight ? "Confirmado" : "Pendente",
      statusClassName: flight ? "text-emerald-600" : "text-slate-400",
    },
    {
      id: "hotel" as const,
      icon: Hotel,
      title: "Hospedagem",
      summary: hotel?.displayName || "Nenhuma hospedagem",
      detail: hotelDetail,
      status: hotel ? "Confirmado" : "Pendente",
      statusClassName: hotel ? "text-emerald-600" : "text-slate-400",
    },
    {
      id: "documents" as const,
      icon: FileText,
      title: "Documentos",
      summary: documents.length > 0 ? `${documents.length} documento(s)` : "Nenhum documento",
      detail: documents.length > 0 ? "Abra para ver" : "Adicione depois",
      status: documents.length > 0 ? "Pronto" : "Vazio",
      statusClassName: documents.length > 0 ? "text-[#2563eb]" : "text-slate-400",
    },
    {
      id: "itinerary" as const,
      icon: MapPin,
      title: "Roteiro",
      summary: itineraryCard.summary,
      detail: itineraryCard.detail,
      status: itineraryCard.status,
      statusClassName: itineraryCard.statusClassName,
    },
  ]
}

function TravelerPublicShell({
  tripData,
  itineraryRecords,
  agencyBranding,
  offlineModeEnabled,
  offlinePackageStatus,
  theme,
  onToggleTheme,
  canShare = true,
  onOpenShare,
  onOpenMenu,
  onOpenPanel,
}: {
  tripData: any
  itineraryRecords?: TripItineraryRecord[]
  agencyBranding: { name: string | null; logoUrl: string | null; isAgency: boolean }
  offlineModeEnabled: boolean
  offlinePackageStatus: OfflineTripPackageStatus | null
  theme: TripLinkTheme
  onToggleTheme: () => void
  canShare?: boolean
  onOpenShare: () => void
  onOpenMenu: () => void
  onOpenPanel: (panel: Exclude<TravelerPublicPanel, null> | "more" | "home") => void
}) {
  const travelers = Array.isArray(tripData?.travelers) ? tripData.travelers : []
  const cards = buildTravelerCardSummariesClean(tripData, itineraryRecords)
  const parsedDestination = parseTripDestination(tripData?.destination)
  const offlineReady = offlineModeEnabled || tripData?.offlineEnabled || Boolean(offlinePackageStatus)
  const avatarLetter = travelers[0]?.name?.charAt(0)?.toUpperCase() || parsedDestination.city.charAt(0).toUpperCase()
  const countryLabel = tripData.country || parsedDestination.country || "Destino"
  const heroDateLabel = formatTravelerHeroDateRange(tripData?.startDate, tripData?.endDate)
  const showAgencyBranding = agencyBranding.isAgency && Boolean(agencyBranding.logoUrl || agencyBranding.name)

  return (
    <div
      data-ui-version="traveler-link-v2"
      data-route-mode="public-b2c"
      data-render-file="app/viagem/[id]/page.tsx"
      data-theme={theme}
      className="traveler-public-shell"
    >
      <div className="trip-shell-inner">
        <header className="trip-top-header">
          <div className="min-w-0">
            {showAgencyBranding ? (
              <div className="trip-brand-badge">
                {agencyBranding.logoUrl ? (
                  <Image
                    src={agencyBranding.logoUrl}
                    alt={agencyBranding.name || "Agência"}
                    width={156}
                    height={46}
                    className="trip-brand-logo"
                  />
                ) : (
                  <span className="truncate text-sm font-semibold tracking-[-0.03em] text-[var(--trip-text)]">
                    {agencyBranding.name}
                  </span>
                )}
                <span aria-hidden="true" className="trip-brand-divider" />
                <span className="trip-brand-credit">
                  Desenvolvido por <strong>Vuei</strong>
                </span>
              </div>
            ) : (
              <div className="trip-brand-badge w-fit">
                <Image src="/vuei-logo.png" alt="Vuei" width={160} height={46} className="trip-brand-logo" priority />
              </div>
            )}
          </div>

          <div className="trip-header-actions">
            {canShare ? (
              <button
                onClick={onOpenShare}
                className="trip-round-action"
                aria-label="Compartilhar viagem"
              >
                <Share2 className="h-5 w-5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleTheme}
              className="trip-round-action"
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Tema claro" : "Tema escuro"}
            >
              {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
            <button
              onClick={onOpenMenu}
              className="trip-avatar-action"
              aria-label="Abrir menu"
            >
              {avatarLetter}
            </button>
          </div>
        </header>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="trip-hero-card"
        >
          <div className="trip-hero-media">
            <ImageWithFallback
              src={tripData.heroImage}
              fallbackSrc={DEFAULT_HERO_IMAGE}
              alt={tripData.destination}
              fill
              sizes="(max-width: 639px) calc(100vw - 24px), 472px"
              className="trip-hero-image"
              priority
            />
          </div>
          <div className="trip-hero-overlay" />
          <div className="trip-hero-content">
            <h1 className="trip-display-title">{parsedDestination.city}</h1>
            <div className="trip-hero-country">
              <Globe className="h-5 w-5 shrink-0" />
              <span className="truncate">{countryLabel}</span>
            </div>
            <div className="trip-hero-rule" />
            <div className="trip-date-pill">
              <Calendar className="h-5 w-5 shrink-0" />
              <span className="overflow-hidden text-ellipsis">{heroDateLabel}</span>
            </div>
          </div>
        </motion.section>

        <section>
          <h2 className="trip-section-title">Sua viagem</h2>
          <div className="trip-summary-panel">
            {cards.map((card) => (
              <button key={card.id} onClick={() => onOpenPanel(card.id)} className="trip-summary-row">
                <div className="trip-summary-icon">
                  <card.icon className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="trip-summary-copy">
                  <p className="trip-summary-title">{card.title}</p>
                  <p className="trip-summary-text">{card.summary}</p>
                  <p className="trip-summary-detail">{card.detail}</p>
                </div>
                <div className="trip-summary-status" data-status={card.status.toLowerCase()}>
                  <span className="trip-status-dot" />
                  <span>{card.status}</span>
                </div>
                <ChevronRight className="trip-summary-chevron h-5 w-5 shrink-0" />
              </button>
            ))}
          </div>
        </section>

        <section>
          <button
            onClick={() => onOpenPanel("offline")}
            className="trip-offline-card"
          >
            <div className="trip-summary-icon h-11 w-11 rounded-2xl">
              {offlineReady ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
            </div>
            <div className="min-w-0 text-left">
              <p className="trip-offline-title truncate">Disponível offline</p>
              <p className="trip-offline-subtitle truncate">{offlineReady ? "Baixado neste dispositivo" : "Baixe os documentos"}</p>
            </div>
            <div className="trip-download-pill">
              <Download className="h-4 w-4" />
              <span className="whitespace-nowrap">Baixar docs</span>
            </div>
          </button>
        </section>

        {offlineModeEnabled && offlinePackageStatus ? (
          <div className="trip-offline-banner">
            {offlinePackageStatus === "partial"
              ? "Modo offline ativo com disponibilidade parcial."
              : offlinePackageStatus === "legacy_snapshot"
                ? "Modo offline ativo com pacote salvo anterior."
                : "Modo offline ativo neste dispositivo."}
          </div>
        ) : null}
      </div>

      <nav className="trip-bottom-nav" aria-label="Navegação da viagem">
        <div className="trip-bottom-grid">
          {[
            { id: "home", label: "Viagem", icon: Briefcase },
            { id: "itinerary", label: "Roteiro", icon: MapPin },
            { id: "concierge", label: "Concierge", icon: MessageCircle, badge: "IA" },
            { id: "documents", label: "Documentos", icon: FileText },
            { id: "more", label: "Mais", icon: MoreVertical },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenPanel(item.id as Exclude<TravelerPublicPanel, null> | "more" | "home")}
              className="trip-bottom-item"
              data-active={item.id === "home"}
            >
              <div className="trip-bottom-icon">
                <item.icon className="h-5 w-5" strokeWidth={1.8} />
                {item.badge ? (
                  <span className="trip-bottom-badge">{item.badge}</span>
                ) : null}
              </div>
              <span className="trip-bottom-label">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

// Edit Trip Modal
function EditTripModal({ open, onClose, tripData, onSave }: { open: boolean; onClose: () => void; tripData: any; onSave: (data: any) => Promise<boolean> }) {
  const [formData, setFormData] = useState({
    destination: tripData.destination,
    country: tripData.country,
    startDate: tripData.startDate || "",
    endDate: tripData.endDate || "",
    status: tripData.status
  })

  useEffect(() => {
    if (!open) return
    setFormData({
      destination: tripData.destination,
      country: tripData.country,
      startDate: tripData.startDate || "",
      endDate: tripData.endDate || "",
      status: tripData.status,
    })
  }, [open, tripData.country, tripData.destination, tripData.endDate, tripData.startDate, tripData.status])

  const handleSave = async () => {
    const saved = await onSave(formData)
    if (saved) {
      onClose()
    }
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
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 uppercase tracking-wider">Data Fim</label>
            <input
              type="date"
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
  <option value="completed" className="bg-[#0a0a0a] text-white">Concluída</option>
  </select>
        </div>
        <Button onClick={() => void handleSave()} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
          Salvar alterações
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
  onOpenGuidance,
}: {
  flight: any
  index: number
  onEdit: () => void
  onViewQR: () => void
  onOpenDetails: () => void
  onOpenDocument: () => void
  onDelete: () => void
  onOpenGuidance: () => void
}) {
  const { canWrite } = useContext(PermissionContext)
  const statusCopy = getFlightStatusCopy(flight)
  const dataSourceLabel =
    flight.extractionStatus === "completed"
      ? "Dados extraídos por IA"
      : flight.extractionStatus === "manual"
        ? "Dados manuais"
        : statusCopy.eyebrow
  const compactMeta = [
    { label: "Terminal", value: flight.terminal || "--" },
    { label: "Portão", value: flight.gate || "--" },
    { label: "Assento", value: flight.seat || "--" },
  ]
  const routeSchedule = [flight.origin.time, flight.destination.time].filter(Boolean).join(" - ")
  const showStatusNote = !["completed", "manual"].includes(flight.extractionStatus ?? "")
  const shouldRenderStructuredCard = flight.hasStructuredCardData !== false

  if (!shouldRenderStructuredCard) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        className="group"
      >
        <div className="trip-panel-card relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 hover:border-[#5de0e6]/20 sm:p-5">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20">
              <Plane className="h-5 w-5 text-[#5de0e6]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-white">Passagem anexada</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{statusCopy.detail}</p>
              {statusCopy.tone === "error" && isFlightExtractionGuidanceMessage(statusCopy.detail) ? (
                <button type="button" onClick={onOpenGuidance} className="mt-2 text-xs font-medium text-[#7cecf0] underline underline-offset-4 transition hover:text-[#5de0e6]">
                  Ver dicas para uma extração melhor
                </button>
              ) : null}
              {flight.document ? <p className="mt-2 text-xs text-white/45">Você ainda pode abrir o arquivo anexado.</p> : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            {flight.document ? (
              <Button size="sm" variant="outline" onClick={onOpenDocument} className="justify-start whitespace-normal border-white/10 px-3 text-left text-white/80 hover:bg-white/10 hover:text-white sm:justify-center sm:whitespace-nowrap sm:px-3 sm:text-center">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir passagem
              </Button>
            ) : null}
            {canWrite ? (
              <Button size="sm" variant="ghost" onClick={() => void onDelete()} className="justify-start whitespace-normal px-3 text-left text-red-300 hover:bg-red-500/10 hover:text-red-200 sm:justify-center sm:whitespace-nowrap sm:px-3 sm:text-center">
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            ) : null}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <div
        className="trip-panel-card relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 hover:border-[#5de0e6]/20 sm:p-5"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-transparent via-[#5de0e6]/30 to-transparent" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20">
              <Plane className="h-5 w-5 text-[#5de0e6]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">{flight.airline}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#5de0e6]/18 bg-[#5de0e6]/10 px-2.5 py-1 text-[11px] font-medium text-[#7cecf0]">
                  {dataSourceLabel}
                </span>
                {showStatusNote ? (
                  <span
                    className={cn(
                      "text-[11px]",
                      statusCopy.tone === "pending" && "text-amber-200",
                      statusCopy.tone === "error" && "text-red-200"
                    )}
                  >
                    {statusCopy.detail}
                  </span>
                ) : null}
                {showStatusNote && statusCopy.tone === "error" && isFlightExtractionGuidanceMessage(statusCopy.detail) ? (
                  <button type="button" onClick={onOpenGuidance} className="text-[11px] font-medium text-[#7cecf0] underline underline-offset-4 transition hover:text-[#5de0e6]">
                    Ver dicas para uma extração melhor
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs font-medium text-white/55">{flight.date || "Data não informada"}</p>
            {flight.flightNumber ? (
              <span className="mt-1 block text-xl font-semibold leading-none text-[#5de0e6]">
                {flight.flightNumber}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-4 sm:gap-4">
          <div className="min-w-0 text-left md:text-center">
            <p className="mt-2 text-2xl font-semibold leading-none text-[#2a7fff]">{flight.origin.code}</p>
            <p className="mt-2 text-sm leading-snug text-white/55">{flight.origin.city}</p>
          </div>

          <div className="flex min-w-[136px] flex-col items-center justify-center gap-2 px-1 text-center">
            {flight.duration ? <p className="text-sm font-medium text-white/65">{flight.duration}</p> : null}
            <div className="flex w-full items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#5de0e6]/70 to-[#5de0e6]" />
              <Plane className="h-4 w-4 rotate-90 text-[#5de0e6]" />
              <div className="h-px flex-1 bg-gradient-to-r from-[#5de0e6] via-[#5de0e6]/70 to-transparent" />
            </div>
            {(routeSchedule || flight.scheduleLabel) ? (
              <p className="text-xs text-white/45">{routeSchedule || flight.scheduleLabel}</p>
            ) : null}
          </div>

          <div className="min-w-0 text-right md:text-center">
            <p className="mt-2 text-2xl font-semibold leading-none text-[#2a7fff]">{flight.destination.code}</p>
            <p className="mt-2 text-sm leading-snug text-white/55">{flight.destination.city}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
          <div className="grid grid-cols-3 divide-x divide-white/[0.08]">
            {compactMeta.map((item) => (
              <div key={item.label} className="px-3 py-3 text-center">
                <p className="text-xs text-white/45">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 sm:flex sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
          <Button size="sm" variant="ghost" onClick={onOpenDetails} className="h-9 justify-start whitespace-normal px-3 text-left text-white/72 hover:bg-white/5 hover:text-white sm:px-0 sm:text-center sm:hover:bg-transparent">
            <Eye className="mr-2 h-4 w-4" />
            Detalhes
          </Button>
          {flight.document ? (
            <Button size="sm" variant="ghost" onClick={onOpenDocument} className="h-9 justify-start whitespace-normal px-3 text-left text-[#4b84ff] hover:bg-white/5 hover:text-[#78a4ff] sm:px-0 sm:text-center sm:hover:bg-transparent">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir passagem
            </Button>
          ) : null}
          {canWrite ? (
            <Button size="sm" variant="ghost" onClick={onEdit} className="h-9 justify-start whitespace-normal px-3 text-left text-white/72 hover:bg-white/5 hover:text-white sm:px-0 sm:text-center sm:hover:bg-transparent">
              <Edit3 className="mr-2 h-4 w-4" />
              Editar
            </Button>
          ) : null}
          {canWrite ? (
            <Button size="sm" variant="ghost" onClick={() => void onDelete()} className="h-9 justify-start whitespace-normal px-3 text-left text-red-300 hover:bg-red-500/10 hover:text-red-200 sm:px-0 sm:text-center sm:hover:bg-transparent">
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </Button>
          ) : null}
          {flight.qrCodePayload ? (
            <Button size="sm" variant="ghost" onClick={onViewQR} className="h-9 justify-start whitespace-normal px-3 text-left text-[#5de0e6] hover:bg-white/5 hover:text-[#82eef2] sm:px-0 sm:text-center sm:hover:bg-transparent">
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </Button>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}

// Edit Flight Modal
function EditFlightModal({ open, onClose, flight, onSave }: { open: boolean; onClose: () => void; flight: any; onSave: (data: any) => Promise<boolean> }) {
  const [formData, setFormData] = useState(flight || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (flight) setFormData(flight)
  }, [flight])

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const success = await onSave(formData)
      if (success) {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!flight) return null

  return (
    <Modal open={open} onClose={onClose} title={`Editar passagem ${flight.flightNumber || ""}`.trim()}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <Button onClick={() => void handleSave()} disabled={saving} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar alterações"}
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
        <p className="text-white/40 text-xs mt-4">{flight.qrCodePayload ? "Apresente este código no embarque" : "Quando o QR code estiver disponível, ele aparecerá aqui."}</p>
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
            <p className="mt-2 text-sm text-white">{flight.airline || "Não informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Voo</p>
            <p className="mt-2 text-sm text-white">{flight.flightNumber || "Não identificado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Localizador</p>
            <p className="mt-2 text-sm text-white">{flight.bookingReference || "Não informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Passageiro</p>
            <p className="mt-2 text-sm text-white">{flight.passengerName || "Não informado"}</p>
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
            <p className="text-xs uppercase tracking-wider text-white/40">Saída</p>
            <p className="mt-2 text-sm text-white">{flight.date} • {flight.origin.time}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Chegada</p>
            <p className="mt-2 text-sm text-white">{flight.destination.time || "Horário não informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Terminal / Port?o</p>
            <p className="mt-2 text-sm text-white">{[flight.terminal, flight.gate].filter(Boolean).join(" / ") || "Não informado"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40">Assento / Bagagem</p>
            <p className="mt-2 text-sm text-white">{[flight.seat, flight.baggageInfo].filter(Boolean).join(" / ") || "Não informado"}</p>
          </div>
        </div>

        {flight.document && (
          <Button variant="outline" className="w-full border-white/10 text-white/80" onClick={() => void onOpenDocument(flight.document)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir passagem
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
  tripPublicToken,
  adminLinkMutationMode,
  ensureSensitiveAccess,
  onTrackExtraction,
}: {
  tripData: any
  loading: boolean
  offlineReadOnly: boolean
  offlineDocumentContext: OfflineDocumentContext | null
  onUpdateFlight: (id: string, data: any) => Promise<boolean>
  onAddFlight: (data: any) => void
  onDeleteFlight: (flightId: string) => Promise<void>
  onDeleteDocument: (documentId: string) => Promise<void>
  tripId: string
  ownerUserId: string | null
  agencyId: string | null
  routeSlug: string
  tripAdminToken: string | null
  tripPublicToken: string | null
  adminLinkMutationMode: boolean
  ensureSensitiveAccess: () => boolean
  onTrackExtraction: (payload: { flightId: string; documentId: string }) => void
}) {
  const [editingFlight, setEditingFlight] = useState<any>(null)
  const [viewingQR, setViewingQR] = useState<any>(null)
  const [selectedFlight, setSelectedFlight] = useState<any>(null)
  const [addingFlight, setAddingFlight] = useState(false)
  const [guidanceOpen, setGuidanceOpen] = useState(false)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()
  const flights = Array.isArray(tripData.flights) ? tripData.flights : []
  const structuredFlightsCount = flights.filter((flight: any) => flight?.hasStructuredCardData !== false).length
  const ticketDocuments = getTicketTripDocuments(getTripDocuments<any>(tripData)).filter(
    (document: any) => !flights.some((flight: any) => flight.document?.id === document.id),
  )

  const handleSaveFlight = async (data: any) => {
    const success = await onUpdateFlight(data.id, data)
    if (!success) return false
    showToast("Voo atualizado com sucesso!", "success")
    return true
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

    if (!document?.id) {
      showToast("Não foi possível abrir este documento agora. Tente novamente.", "error")
      return
    }

    const href = buildTripDocumentAccessHref({
      tripId,
      documentId: document.id,
      tripSlug: routeSlug,
      adminToken: tripAdminToken,
      publicToken: tripPublicToken,
      accessMode: canWrite ? "admin" : "public",
      disposition: "inline",
    })

    window.location.assign(href)
  }

  return (
    <section id="flights" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-heading flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Passagens</h2>
              <p className="text-sm text-white/40">{structuredFlightsCount > 0 ? `${structuredFlightsCount} voo(s) salvo(s)` : `${flights.length + ticketDocuments.length} passagem(ns) anexada(s)`}</p>
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
              onOpenGuidance={() => setGuidanceOpen(true)}
            />
          ))}
          {ticketDocuments.map((document: any) => (
            <div key={document.id} className="trip-panel-card rounded-3xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-sm font-medium text-white">{document.name}</p>
              <p className="mt-2 text-xs text-white/40">Passagem anexada. Estamos extraindo as informações.</p>
              <p className="mt-1 text-xs text-white/30">{document.mimeType || "Não informado"}</p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <Button size="sm" variant="outline" className="justify-start whitespace-normal border-white/10 px-3 text-left text-white/70 sm:justify-center sm:whitespace-nowrap sm:text-center" onClick={() => void handleOpenTicketDocument(document)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir passagem
                </Button>
                {canWrite ? (
                  <Button size="sm" variant="ghost" className="justify-start whitespace-normal px-3 text-left text-red-300 hover:bg-red-500/10 sm:justify-center sm:whitespace-nowrap sm:text-center" onClick={() => void onDeleteDocument(document.id)}>
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

      <EditFlightModal open={!!editingFlight} onClose={() => setEditingFlight(null)} flight={editingFlight} onSave={handleSaveFlight} />
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
        onTrackExtraction={onTrackExtraction}
        onOpenGuidance={() => setGuidanceOpen(true)}
        onSave={(data) => {
          onAddFlight(data)
          showToast("Passagem anexada. Estamos extraindo as informações.", "info")
          setAddingFlight(false)
        }}
      />
      <FlightExtractionGuidanceModal open={guidanceOpen} onClose={() => setGuidanceOpen(false)} />
    </section>
  )
}

// Add Flight Modal
function AddFlightModal({ open, onClose, onSave, tripId, ownerUserId, agencyId, tripSlug, adminToken, adminProxyMode, ensureSensitiveAccess, onTrackExtraction, onOpenGuidance }: { open: boolean; onClose: () => void; onSave: (data: any) => void; tripId: string; ownerUserId: string | null; agencyId: string | null; tripSlug: string; adminToken: string | null; adminProxyMode: boolean; ensureSensitiveAccess: () => boolean; onTrackExtraction: (payload: { flightId: string; documentId: string }) => void; onOpenGuidance: () => void }) {
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
      setError("Esta passagem exige autenticação real para ser anexada no Supabase. Entre com login para continuar.")
      return
    }

    console.log("[TICKET] file selected", file.name)
    setError("")
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo inválido.")
      return
    }

    const resolvedMimeType = resolveDocumentMimeType(file)
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
            error: response.ok ? null : data?.error || "Não foi possível registrar a passagem anexada.",
            document: data?.document ?? null,
            flight: data?.flight ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/tickets/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: resolveProtectedWriteError(uploadResult.error || "Não foi possível anexar a passagem."), document: null, flight: null }
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
            mimeType: resolvedMimeType,
            size: file.size,
            isPrivate: false,
            visibility: "public_trip",
            aiExtractedData: {},
          })

          if (metadataResult.error || !metadataResult.data) {
            return { error: resolveProtectedWriteError(metadataResult.error || "Não foi possível registrar a passagem."), document: null, flight: null }
          }

          const flightResult = await upsertTripFlight({
            tripId,
            documentId: metadataResult.data.id,
            extractionStatus: "pending",
            extractedData: {},
          })

          if (flightResult.error || !flightResult.data) {
            return { error: resolveProtectedWriteError(flightResult.error || "Não foi possível registrar a passagem anexada."), document: null, flight: null }
          }

          return { error: null, document: metadataResult.data, flight: flightResult.data }
        })()

    if (savedTicket.error || !savedTicket.document || !savedTicket.flight) {
      console.error("[TICKET] upload error", savedTicket.error)
      setError(savedTicket.error || "Não foi possível registrar a passagem anexada.")
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
      onTrackExtraction({
        flightId: savedTicket.flight.id,
        documentId: savedTicket.document.id,
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
      <div className="max-h-[calc(100dvh-12rem)] space-y-4 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-none">
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

        <label className={cn("trip-upload-dropzone block rounded-xl border-2 border-dashed border-white/10 p-8 text-center transition-colors", uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[#5de0e6]/30")}>
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando arquivo...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
              <p className="text-sm text-white/60">Clique para selecionar a passagem</p>
              <p className="text-xs text-white/30 mt-1">PDF, PNG, JPG, JPEG, HEIC ou HEIF até 10MB</p>
            </>
          )}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,image/heic,image/heif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => void handleFileUpload(e.target.files?.[0])}
          />
        </label>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="mt-2 text-xs leading-5 text-white/45">Para melhor leitura, envie um cartão de embarque individual ou uma imagem limpa da passagem, sem cortes e com todos os dados visíveis.</p>
          <p className="mt-1 text-xs leading-5 text-white/45">Para ida e volta, envie cada trecho separadamente.</p>
          <button type="button" onClick={onOpenGuidance} className="mt-2 text-xs font-medium text-[#7cecf0] underline underline-offset-4 transition hover:text-[#5de0e6]">
            Ver dicas para uma extração melhor
          </button>
          <p className="text-sm text-white/70">A passagem será salva imediatamente. Algumas informações podem aparecer em instantes.</p>
        </div>

        {error ? (
          <div>
            <p className="text-sm text-red-300">{error}</p>
            {isFlightExtractionGuidanceMessage(error) ? (
              <button type="button" onClick={onOpenGuidance} className="mt-2 text-xs font-medium text-[#7cecf0] underline underline-offset-4 transition hover:text-[#5de0e6]">
                Ver dicas para uma extração melhor
              </button>
            ) : null}
          </div>
        ) : null}
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
  routeSlug,
  tripAdminToken,
  tripPublicToken,
}: {
  tripData: any
  loading: boolean
  onSaveHotel: (data: any) => Promise<boolean>
  onDeleteHotel: (hotelId: string) => void
  routeSlug: string
  tripAdminToken: string | null
  tripPublicToken: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [selectedHotel, setSelectedHotel] = useState<any>(null)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const hotels = sortHotelsForDisplay(Array.isArray(tripData.hotels) ? tripData.hotels : tripData.hotel ? [tripData.hotel] : []).map(
    normalizeHotelForDisplay,
  )

  return (
    <section id="hotel" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-heading flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Hospedagem</h2>
              <p className="text-sm text-white/40">{hotels.length > 0 ? `${hotels.length} hospedagem${hotels.length > 1 ? "s" : ""} cadastrada${hotels.length > 1 ? "s" : ""}` : "Nenhuma hospedagem cadastrada"}</p>
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
            {hotels.map((hotel: any, index: number) => {
              const linkedVoucherHref =
                hotel.documentId && tripData?.id && routeSlug
                  ? buildTripDocumentAccessHref({
                      tripId: tripData.id,
                      documentId: hotel.documentId,
                      tripSlug: routeSlug,
                      accessMode: isAdmin ? "admin" : "public",
                      adminToken: tripAdminToken,
                      publicToken: tripPublicToken,
                      disposition: "inline",
                    })
                  : null
              const nights = hotel.nights ?? 0

              return (
                <motion.div
                  key={hotel.id || `${hotel.name}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="trip-panel-card relative rounded-3xl overflow-hidden bg-white/[0.02] backdrop-blur-xl border border-white/[0.06]"
                >
                  <div className="grid gap-0 sm:grid-cols-[132px_minmax(0,1fr)]">
                    <div className="relative flex min-h-[132px] items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-50">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.14),transparent_62%)]" />
                      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
                        <Hotel className="h-8 w-8 text-[#2563eb]" />
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-semibold text-white">{hotel.displayName}</h3>
                      <div className="mt-1 flex items-center gap-2 text-white/60">
                        <MapPin className="h-3 w-3" />
                        <span className="text-sm">{hotel.location || "Localização não informada"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 pt-0 sm:pt-5">
                    <div className="mb-4 grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-white/40">Check-in</p>
                        <p className="mt-1 text-sm font-medium text-white">{hotel.checkIn || "Não informado"}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-white/40">Check-out</p>
                        <p className="mt-1 text-sm font-medium text-white">{hotel.checkOut || "Não informado"}</p>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2 text-xs text-white/60">
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                        {nights > 0 ? `${nights} noite${nights > 1 ? "s" : ""}` : "Noites a confirmar"}
                      </span>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                        {hotel.reservationCode || "Código não informado"}
                      </span>
                    </div>

                    {hotel.notes ? <p className="mb-4 text-sm text-white/60">{hotel.notes}</p> : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                      {linkedVoucherHref ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#5de0e6] hover:bg-[#5de0e6]/10"
                          onClick={() => window.location.assign(linkedVoucherHref)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Abrir voucher
                        </Button>
                      ) : (
                        <span className="text-sm text-white/40">Voucher não informado</span>
                      )}
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
                            <Edit3 className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-300 hover:bg-red-500/10"
                            onClick={() => void onDeleteHotel(hotel.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <EditHotelModal open={editing} onClose={() => setEditing(false)} hotel={selectedHotel ?? {}} onSave={onSaveHotel} />
    </section>
  )
}

// Edit Hotel Modal
function EditHotelModal({ open, onClose, hotel, onSave }: { open: boolean; onClose: () => void; hotel: any; onSave: (data: any) => Promise<boolean> }) {
  const [formData, setFormData] = useState(hotel)
  const [saving, setSaving] = useState(false)
  const [uploadError, setUploadError] = useState("")

  useEffect(() => {
    setFormData(hotel || {})
    setUploadError("")
  }, [hotel])

  const handleVoucherSelected = (file?: File | null) => {
    if (!file) {
      setFormData((prev: any) => ({ ...prev, voucherFile: null }))
      setUploadError("")
      return
    }

    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setUploadError(validation.error || "Arquivo inválido.")
      return
    }

    setUploadError("")
    setFormData((prev: any) => ({ ...prev, voucherFile: file }))
  }

  const handleSave = async () => {
    if (saving || !formData.name || uploadError) return
    setSaving(true)
    try {
      const success = await onSave(formData)
      if (success) {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

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
          <label className="text-xs text-white/50 uppercase tracking-wider">Endere?o</label>
          <input
            type="text"
            value={formData.address || ""}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <label className="text-xs text-white/50 uppercase tracking-wider">Observações</label>
          <textarea
            value={formData.notes || ""}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full mt-1 min-h-24 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Voucher</label>
          <label className="mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition-colors hover:border-[#5de0e6]/40 hover:text-white">
            <span className="truncate">
              {formData.voucherFile instanceof File
                ? formData.voucherFile.name
                : formData.documentId
                  ? "Voucher vinculado. Selecione outro arquivo para substituir."
                  : "Selecionar voucher (PDF, PNG, JPG, JPEG, HEIC ou HEIF)"}
            </span>
            <Upload className="h-4 w-4 shrink-0" />
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,image/heic,image/heif"
              className="hidden"
              onChange={(e) => handleVoucherSelected(e.target.files?.[0])}
            />
          </label>
          {formData.voucherFile instanceof File ? (
            <button
              type="button"
              onClick={() => handleVoucherSelected(null)}
              className="mt-2 text-xs text-white/45 transition-colors hover:text-white/70"
            >
              Remover novo voucher selecionado
            </button>
          ) : null}
          {uploadError ? <p className="mt-2 text-sm text-red-300">{uploadError}</p> : null}
        </div>
        <Button onClick={() => void handleSave()} disabled={saving || !formData.name || Boolean(uploadError)} className="w-full mt-4 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50">
          {saving ? "Salvando..." : "Salvar alterações"}
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
      setError("Este anexo exige autenticação real para ser salvo no Supabase. Entre com login para continuar.")
      return
    }

    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo inválido.")
      return
    }

    const resolvedMimeType = resolveDocumentMimeType(file)
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
            error: response.ok ? null : data?.error || "Não foi possível registrar o roteiro anexado.",
            itinerary: data?.itinerary ?? null,
            document: data?.document ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/itineraries/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: uploadResult.error || "Não foi possível anexar o roteiro.", itinerary: null, document: null }
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
            mimeType: resolvedMimeType,
            size: file.size,
            isPrivate: false,
            visibility: "public_trip",
            aiExtractedData: {
              source: "manual_itinerary_upload",
              ai_used: false,
            },
          })

          if (metadataResult.error || !metadataResult.data) {
            return { error: metadataResult.error || "Não foi possível registrar o roteiro anexado.", itinerary: null, document: null }
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
            return { error: itineraryResult.error || "Não foi possível registrar o modo de roteiro anexado.", itinerary: null, document: null }
          }

          return { error: null, itinerary: itineraryResult.data, document: metadataResult.data }
        })()

    if (savedUpload.error || !savedUpload.itinerary || !savedUpload.document) {
      setError(savedUpload.error || "Não foi possível registrar o roteiro anexado.")
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
          <label className="text-xs text-white/50 uppercase tracking-wider">Título do roteiro</label>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex: Roteiro completo de Paris"
            className="w-full mt-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/30 focus:outline-none focus:border-[#5de0e6]/50"
          />
        </div>

        <label className={cn("trip-upload-dropzone block rounded-xl border-2 border-dashed border-white/10 p-8 text-center transition-colors", uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[#5de0e6]/30")}>
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando roteiro...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
              <p className="text-sm text-white/60">Clique para selecionar PDF, imagem ou documento</p>
              <p className="text-xs text-white/30 mt-1">Sem leitura de IA e sem consumo de créditos</p>
            </>
          )}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,image/heic,image/heif" className="hidden" disabled={uploading} onChange={(event) => void handleUpload(event.target.files?.[0])} />
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
  tripPublicToken,
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
  tripPublicToken: string | null
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
      showToast("Indisponível offline.", "info")
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
    const document = findTripDocument(getTripDocuments<any>(tripData), record.documentId)

    if (offlineReadOnly) {
      await openOfflineDocumentFromPackage({
        document,
        context: offlineDocumentContext,
        onUnavailable: (message) => showToast(message, "info"),
      })
      return
    }

    if (!document && !record.pdfUrl) {
      showToast("Documento do roteiro não encontrado.", "error")
      return
    }

    const href = buildTripDocumentAccessHref({
      tripId,
      itineraryId: record.id,
      tripSlug: routeSlug,
      adminToken: tripAdminToken,
      publicToken: tripPublicToken,
      accessMode: canWrite ? "admin" : "public",
      disposition: "inline",
    })

    window.location.assign(href)
  }

  return (
    <section id="itinerary" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-heading flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Roteiro</h2>
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
          <div className="trip-panel-card rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            Nenhum roteiro criado.
          </div>
        ) : null}

        {hasGenerating ? (
          <div className="mb-6 rounded-3xl border border-[#5de0e6]/20 bg-[#5de0e6]/10 p-6 text-sm text-white/80">
            Gerando roteiro. Aguarde a finalização no backend para ver o resultado real.
          </div>
        ) : null}

        {simpleRecord?.status === "completed" && itinerary.length > 0 ? (
          <>
            <div className="mb-4 rounded-2xl border border-[#5de0e6]/20 bg-[#5de0e6]/10 p-4 text-sm text-white/80">
              Roteiro simples criado com IA e salvo para edição no modo admin.
              {realPlannedDays ? ` Período real: ${realPlannedDays} dia(s).` : ""}
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
                            <p className="text-[10px] uppercase tracking-[0.18em] text-[#5de0e6]/80">Observação útil</p>
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
                      ? "Concluído"
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
                  <p className="mt-3 text-sm text-red-300">Falha honesta na geração. Este roteiro não possui arquivo válido para abrir.</p>
                ) : null}
                {record.status === "generating" ? (
                  <p className="mt-3 text-sm text-white/55">Gerando roteiro e vinculando arquivo real no backend...</p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {record.documentId || record.pdfUrl ? (
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
          <label className="text-xs text-white/50 uppercase tracking-wider">Horário</label>
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
  <option value="attraction" className="bg-[#0a0a0a] text-white">Atração</option>
  <option value="food" className="bg-[#0a0a0a] text-white">Alimentação</option>
  <option value="transport" className="bg-[#0a0a0a] text-white">Transporte</option>
  <option value="hotel" className="bg-[#0a0a0a] text-white">Hospedagem</option>
  <option value="experience" className="bg-[#0a0a0a] text-white">Experiencia</option>
  <option value="flight" className="bg-[#0a0a0a] text-white">Voo</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Período</label>
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
          <label className="text-xs text-white/50 uppercase tracking-wider">Horário</label>
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
            <option value="attraction" className="bg-[#0a0a0a] text-white">Atração</option>
            <option value="food" className="bg-[#0a0a0a] text-white">Alimentação</option>
            <option value="transport" className="bg-[#0a0a0a] text-white">Transporte</option>
            <option value="hotel" className="bg-[#0a0a0a] text-white">Hospedagem</option>
            <option value="experience" className="bg-[#0a0a0a] text-white">Experiencia</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-white/50 uppercase tracking-wider">Período</label>
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
  tripPublicToken,
  adminLinkMutationMode,
  ensureSensitiveAccess,
  onSensitiveAccessGranted,
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
  tripPublicToken: string | null
  adminLinkMutationMode: boolean
  ensureSensitiveAccess: () => boolean
  onSensitiveAccessGranted: () => void
}) {
  const [showPrivate, setShowPrivate] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [addingDoc, setAddingDoc] = useState(false)
  const [viewingDoc, setViewingDoc] = useState<any>(null)
  const [pinModal, setPinModal] = useState(false)
  const { isAdmin, canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()

  const documents = getContentTripDocuments(getTripDocuments<any>(tripData))
  const publicDocs = getPublicTripDocuments(documents)
  const privateDocs = documents.filter(isPrivateTripDocument)

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
      case "admission_ticket": return "🎫"
      default: return "📄"
    }
  }

  const handleUnlock = () => {
    setPinModal(true)
  }

  return (
    <section id="documents" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="trip-panel-heading flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Documentos</h2>
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
          <div className="trip-panel-card rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/50">
            {isAdmin ? "Nenhum documento adicionado." : "Nenhum documento público adicionado."}
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
              className="trip-panel-card cursor-pointer p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#5de0e6]/30 transition-all duration-300 text-left min-h-[112px]"
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
            </motion.div>
          ))}
        </div>
        )}

        {isAdmin && privateDocs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="trip-panel-card p-5 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#004aad]/30 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[#5de0e6]" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Documentos protegidos</p>
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
                        className="trip-panel-card cursor-pointer p-3 rounded-xl bg-[#004aad]/10 border border-[#004aad]/30 hover:border-[#5de0e6]/50 transition-all duration-300 text-left min-h-[104px]"
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

            {!unlocked && <p className="text-xs text-white/30 text-center mt-3">Use o PIN já criado no portal para acessar documentos privados</p>}
          </motion.div>
        )}

      </div>

      <PortalPinUnlockModal
        open={pinModal}
        onClose={() => setPinModal(false)}
        tripId={tripId}
        tripSlug={routeSlug}
        adminToken={tripAdminToken}
        publicToken={tripPublicToken}
        accessMode={canWrite ? "admin" : "public"}
        title="Desbloquear Documentos"
        configuredDescription="Use o PIN já criado no portal para acessar os documentos protegidos."
        onSuccess={() => {
          setUnlocked(true)
          onSensitiveAccessGranted()
          setPinModal(false)
          showToast("Documentos desbloqueados!", "success")
        }}
      />
      <ViewDocumentModal
        open={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        document={viewingDoc}
        tripId={tripId}
        tripSlug={routeSlug}
        adminToken={tripAdminToken}
        publicToken={tripPublicToken}
        accessMode={canWrite ? "admin" : "public"}
        offlineReadOnly={offlineReadOnly}
        offlineDocumentContext={offlineDocumentContext}
      />
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
  tripSlug,
  adminToken,
  publicToken,
  accessMode,
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  tripId: string
  tripSlug: string
  adminToken: string | null
  publicToken: string | null
  accessMode: TripPinApiAccessMode
}) {
  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [pinStatus, setPinStatus] = useState<TripPinStatusPayload | null>(null)

  useEffect(() => {
    if (!open) {
      setPin("")
      setError("")
      setIsSubmitting(false)
      setIsLoadingStatus(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    let active = true
    setIsLoadingStatus(true)
    setError("")

    void loadTripPinStatus({
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode,
    }).then((result) => {
      if (!active) return
      setIsLoadingStatus(false)

      if (!result.ok || !result.data) {
        setPinStatus(null)
        setError(result.error ?? "Não foi possível consultar o PIN desta viagem.")
        return
      }

      setPinStatus(result.data)
    })

    return () => {
      active = false
    }
  }, [open, tripId, tripSlug, adminToken, publicToken, accessMode])

  const handleSubmit = async () => {
    if (pin.length !== 4) return

    setIsSubmitting(true)
    setError("")

    try {
      const isValid = await verifyTripLinkPin(tripId, pin)
      if (!isValid) {
        setError("PIN inválido")
        return
      }

      onSuccess()
      setPin("")
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Acesso rápido não configurado neste dispositivo"
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePin = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) return
    if (pin !== confirmPin) {
      setError("Os PINs não conferem.")
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
      const message = pinError instanceof Error ? pinError.message : "Não foi possível configurar o PIN neste dispositivo."
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
        setError("Não foi possível validar a biometria neste dispositivo.")
        return
      }

      onSuccess()
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Biometria indisponível neste dispositivo."
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
            : "Crie um PIN neste dispositivo para proteger acoes sens?veis desta viagem."}
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
        <p className="text-xs text-white/30 mt-4">O PIN deste link pertence apenas a este dispositivo e não é compartilhado com o portal ou com outros aparelhos.</p>
      </div>
    </Modal>
  )
}

function PortalPinUnlockModal({
  open,
  onClose,
  onSuccess,
  tripId,
  tripSlug,
  adminToken,
  publicToken,
  accessMode,
  title,
  configuredDescription,
  tone = "dark",
  onLogin,
  loginLabel = "Entrar com login",
}: {
  open: boolean
  onClose: () => void
  onSuccess: (status?: (TripPinStatusPayload & { verified?: boolean; adminToken?: string | null }) | null) => void
  tripId: string
  tripSlug: string
  adminToken: string | null
  publicToken: string | null
  accessMode: TripPinApiAccessMode
  title: string
  configuredDescription: string
  tone?: "dark" | "light"
  onLogin?: (() => void) | null
  loginLabel?: string
}) {
  const isLight = tone === "light"
  const hasResolvedTripId = isRealTripUuid(tripId)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [pinStatus, setPinStatus] = useState<TripPinStatusPayload | null>(null)
  const [statusUnavailableReason, setStatusUnavailableReason] = useState<"offline" | null>(null)

  useEffect(() => {
    if (!open) {
      setPin("")
      setError("")
      setIsSubmitting(false)
      setIsLoadingStatus(false)
      setPinStatus(null)
      setStatusUnavailableReason(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (!hasResolvedTripId) {
      setIsLoadingStatus(true)
      setError("")
      setPinStatus(null)
      setStatusUnavailableReason(null)
      return
    }

    let active = true
    setIsLoadingStatus(true)
    setError("")
    setPinStatus(null)
    setStatusUnavailableReason(null)

    void (async () => {
      const result = await loadTripPinStatus({
        tripId,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
      })

      if (!active) return
      setIsLoadingStatus(false)

      if (!result.ok || !result.data) {
        setPinStatus(null)
        setStatusUnavailableReason(result.isOffline && accessMode === "admin" ? "offline" : null)
        setError(result.error ?? "Não foi possível consultar o PIN desta viagem.")
        return
      }

      setStatusUnavailableReason(null)
      setPinStatus(result.data)
    })()
    return () => {
      active = false
    }
  }, [open, hasResolvedTripId, tripId, tripSlug, adminToken, publicToken, accessMode])

  const handleSubmit = async () => {
    if (pin.length !== 4 || !hasResolvedTripId) return

    setIsSubmitting(true)
    setError("")

    try {
      const result = await verifyTripPinOnServer({
        tripId,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
        pin,
      })

      if (!result.ok || !result.data) {
        setError(result.error ?? "Não foi possível validar o PIN.")
        return
      }

      setPinStatus(result.data)

      if (!result.data.pinConfigured) {
        setError(getTripPinSetupMessage(result.data))
        return
      }

      if (!result.data.verified) {
        setError("PIN inválido.")
        return
      }

      onSuccess(result.data)
      setPin("")
    } catch (pinError) {
      const message = pinError instanceof Error ? pinError.message : "Não foi possível validar o PIN desta viagem."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLoadingView = isLoadingStatus
  const isOfflineUnavailable = accessMode === "admin" && !isLoadingView && statusUnavailableReason === "offline"
  const hasErrorView = !isLoadingView && Boolean(error)
  const hasConfiguredPin = !isLoadingView && pinStatus?.pinConfigured === true
  const hasMissingPin = !isLoadingView && !hasErrorView && !isOfflineUnavailable && pinStatus?.pinConfigured === false
  const helperText = isLoadingView
    ? configuredDescription
    : isOfflineUnavailable
      ? getTripPinOfflineMessage(accessMode)
    : hasConfiguredPin
      ? configuredDescription
      : getTripPinSetupMessage(pinStatus)

  return (
    <Modal tone={tone} open={open} onClose={onClose} title={title} showCloseButton={false}>
      <div className="w-full">
        <div className={cn("mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl", isLight ? "bg-[linear-gradient(180deg,#eff6ff,#dbeafe)]" : "bg-gradient-to-br from-[#5de0e6]/20 to-[#004aad]/20")}>
          <Lock className={cn("h-8 w-8", isLight ? "text-[#2563eb]" : "text-[#5de0e6]")} />
        </div>
        <p className={cn("text-center text-sm leading-6", isLight ? "text-slate-600" : "text-white/55")}>
          {helperText}
        </p>

        <div className="mt-6 space-y-3">
          {isLoadingView ? (
            <div className={cn("rounded-2xl border p-5 text-sm", isLight ? "border-slate-200 bg-[#fcfbf8] text-slate-600" : "border-white/[0.06] bg-white/[0.02] text-white/60")}>
              <div className="flex items-center justify-center gap-3">
                <div className={cn("h-5 w-5 animate-spin rounded-full border-2 border-transparent", isLight ? "border-slate-200 border-t-[#2563eb]" : "border-white/20 border-t-[#5de0e6]")} />
                <span>Verificando PIN...</span>
              </div>
              <p className="mt-2 text-center text-sm">Aguarde um instante.</p>
            </div>
          ) : null}

          {hasConfiguredPin ? (
            <div className={cn("space-y-3 rounded-2xl border p-4", isLight ? "border-slate-200 bg-[#fcfbf8]" : "border-white/[0.06] bg-white/[0.02]")}>
              <Label className={cn(isLight ? "text-slate-600" : "text-white/70")}>Usar PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className={cn(
                  "h-12 text-center text-lg font-semibold tracking-[0.22em] sm:tracking-[0.28em] px-3 placeholder:tracking-normal placeholder:text-base",
                  isLight ? "border-slate-200 bg-white text-slate-950 placeholder:text-slate-400" : "",
                )}
              />
              <Button
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || pin.length !== 4 || !hasResolvedTripId}
                className={cn(
                  "w-full border-0 text-white",
                  isLight ? "rounded-2xl bg-[#2563eb] hover:bg-[#1d4ed8]" : "bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90",
                )}
              >
                {isSubmitting ? "Validando PIN..." : "Desbloquear com PIN"}
              </Button>
            </div>
          ) : null}

          {hasMissingPin ? (
            <div className={cn("rounded-2xl border p-4 text-sm", isLight ? "border-slate-200 bg-[#fcfbf8] text-slate-600" : "border-amber-500/20 bg-amber-500/10 text-amber-100")}>
              {getTripPinSetupMessage(pinStatus)}
            </div>
          ) : null}

          {hasErrorView ? (
            <div className={cn("rounded-2xl border p-4 text-sm", isLight ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/20 bg-red-500/10 text-red-300")}>
              {error}
            </div>
          ) : null}

          {isOfflineUnavailable ? (
            <Button
              variant="outline"
              onClick={onClose}
              className={cn("w-full", isLight ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]")}
            >
              Entendi
            </Button>
          ) : null}
        </div>

        {onLogin && !isOfflineUnavailable ? (
          <Button
            variant="outline"
            onClick={onLogin}
            className={cn("mt-5 w-full", isLight ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50" : "border-white/[0.08] bg-transparent text-white/80 hover:bg-white/[0.06]")}
          >
            {loginLabel}
          </Button>
        ) : null}

        <p className={cn("mt-4 text-xs text-center", isLight ? "text-slate-500" : "text-white/35")}>
          Este PIN foi definido por quem criou a viagem.
        </p>
      </div>
    </Modal>
  )
}

function LinkSecurityInfoModal({
  open,
  onClose,
  tripId,
  tripSlug,
  adminToken,
  publicToken,
  accessMode,
}: {
  open: boolean
  onClose: () => void
  tripId: string
  tripSlug: string
  adminToken: string | null
  publicToken: string | null
  accessMode: TripPinApiAccessMode
}) {
  const [status, setStatus] = useState<TripPinStatusPayload | null>(null)
  const [error, setError] = useState("")
  const hasResolvedTripId = isRealTripUuid(tripId)

  useEffect(() => {
    if (!open) return

    if (!hasResolvedTripId) {
      setStatus(null)
      setError("")
      return
    }

    let active = true
    setError("")

    void loadTripPinStatus({
      tripId,
      tripSlug,
      adminToken,
      publicToken,
      accessMode,
    }).then((result) => {
      if (!active) return

      if (!result.ok || !result.data) {
        setStatus(null)
        setError(result.error ?? "Não foi possível consultar o PIN desta viagem.")
        return
      }

      setStatus(result.data)
    })

    return () => {
      active = false
    }
  }, [open, hasResolvedTripId, tripId, tripSlug, adminToken, publicToken, accessMode])

  return (
    <Modal open={open} onClose={onClose} title="Segurança">
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">O PIN desta viagem e definido apenas no portal responsavel.</p>
          <p className="mt-2 text-xs text-white/40">Este link serve apenas para solicitar o PIN já existente quando uma área protegida for aberta.</p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs uppercase tracking-wider text-white/40">Status do PIN</p>
          <p className="mt-2 text-sm text-white">{status?.pinConfigured ? "PIN configurado" : "PIN ainda não configurado"}</p>
          <p className="mt-2 text-xs text-white/40">{getTripPinSetupMessage(status)}</p>
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

// View Document Modal
function ViewDocumentModal({
  open,
  onClose,
  document,
  tripId,
  tripSlug,
  adminToken,
  publicToken,
  accessMode,
  offlineReadOnly = false,
  offlineDocumentContext = null,
}: {
  open: boolean
  onClose: () => void
  document: any
  tripId: string
  tripSlug: string
  adminToken: string | null
  publicToken: string | null
  accessMode: "admin" | "public"
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

  const documentOpenHref = !offlineReadOnly && document?.id
    ? buildTripDocumentAccessHref({
        tripId,
        documentId: document.id,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
        disposition: "inline",
      })
    : null

  const documentDownloadHref = !offlineReadOnly && document?.id
    ? buildTripDocumentAccessHref({
        tripId,
        documentId: document.id,
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
        disposition: "download",
      })
    : null

  const openDocumentOnDevice = async () => {
    setOfflineMessage("")

    if (offlineReadOnly) {
      await openOfflineDocumentFromPackage({
        document,
        context: offlineDocumentContext,
        onUnavailable: (message) => setOfflineMessage(message),
        getPreparedUrl: () => objectUrlRef.current,
        registerCleanup: (objectUrl) => {
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
          }
          objectUrlRef.current = objectUrl
        },
      })
      return
    }
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
        <div className="mt-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-white/40">Preview do documento</p>
          <div className="mt-4 h-48 bg-white/[0.02] rounded-xl flex items-center justify-center">
            <p className="text-white/20 text-sm">
              {offlineReadOnly
                ? offlineDocumentContext?.packageStatus === "legacy_snapshot"
                  ? "Arquivos não são garantidos neste snapshot salvo."
                  : offlineMessage || "Arquivo salvo localmente quando disponível."
                : "Visualização do PDF/Imagem"}
            </p>
          </div>
        </div>

        {offlineReadOnly && offlineMessage ? <p className="mt-3 text-sm text-amber-200">{offlineMessage}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {offlineReadOnly ? (
            <Button className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0 disabled:opacity-50" onClick={() => void openDocumentOnDevice()}>
              <Download className="w-4 h-4 mr-2" />
              Abrir offline
            </Button>
          ) : (
            <>
              {documentOpenHref ? (
                <Button asChild className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0">
                  <a href={documentOpenHref}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir documento
                  </a>
                </Button>
              ) : null}
              {documentDownloadHref ? (
                <Button asChild variant="outline" className="flex-1 border-white/[0.08] bg-white/[0.02] text-white hover:bg-white/10">
                  <a href={documentDownloadHref} download>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar
                  </a>
                </Button>
              ) : null}
            </>
          )}
          <Button variant="ghost" className="text-white/60 hover:bg-white/10" disabled>
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
      setError("Este documento exige autenticação real para ser anexado no Supabase. Entre com login para continuar.")
      return
    }
    console.log("[DOCUMENT] file selected", file.name)
    setError("")
    const validation = validateDocumentFile(file)
    if (!validation.valid) {
      setError(validation.error || "Arquivo inválido.")
      return
    }

    const resolvedMimeType = resolveDocumentMimeType(file)
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
            error: response.ok ? null : data?.error || "Não foi possível registrar o documento.",
            document: data?.document ?? null,
          }
        })()
      : await (async () => {
          const path = `${ownerUserId}/${tripId}/documents/${Date.now()}-${file.name.replace(/\s+/g, "-")}`
          const uploadResult = await uploadDocumentFile(file, path)
          if (uploadResult.error || !uploadResult.data) {
            return { error: resolveProtectedWriteError(uploadResult.error || "Não foi possível anexar o documento."), document: null }
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
            mimeType: resolvedMimeType,
            size: file.size,
            isPrivate: formData.private,
            visibility: formData.private ? "private" : "public_trip",
            aiExtractedData: {},
          })

          return {
            error: metadataResult.error ? resolveProtectedWriteError(metadataResult.error || "Não foi possível registrar o documento.") : null,
            document: metadataResult.data ?? null,
          }
        })()

    if (savedDocument.error || !savedDocument.document) {
      console.error("[DOCUMENT] upload error", savedDocument.error)
      setError(savedDocument.error || "Não foi possível registrar o documento.")
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
        <label className={cn("trip-upload-dropzone block rounded-xl border-2 border-dashed border-white/10 p-8 text-center transition-colors", uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-[#5de0e6]/30")}>
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-white/30 border-t-[#5de0e6] rounded-full animate-spin" />
              <p className="text-sm text-white/60">Enviando documento...</p>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 mx-auto text-white/40 mb-3" />
              <p className="text-sm text-white/60">Clique para selecionar um arquivo</p>
              <p className="text-xs text-white/30 mt-1">PDF, PNG, JPG, JPEG, HEIC ou HEIF até 10MB</p>
            </>
          )}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.heif,image/heic,image/heif" className="hidden" disabled={uploading} onChange={(e) => void handleUpload(e.target.files?.[0])} />
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
          <label className="text-xs text-white/50 uppercase tracking-wider">Tipo de documento</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="trip-document-type-select mt-1 w-full appearance-none rounded-xl border border-white/[0.08] bg-[#0a0a0a] px-4 py-3 text-white focus:border-[#5de0e6]/50 focus:outline-none"
          >
            {DOCUMENT_UPLOAD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="bg-[#0a0a0a] text-white">
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
      </div>
    </Modal>
  )
}

// Concierge Section
function ConciergeSection({
  tripData,
  onOpenCredits,
  showCredits = true,
  creditsBalance,
  offlineReadOnly = false,
  tripSlug,
  adminToken,
  publicToken,
  accessMode,
}: {
  tripData: any
  onOpenCredits: () => void
  showCredits?: boolean
  creditsBalance: number | null
  offlineReadOnly?: boolean
  tripSlug: string
  adminToken: string | null
  publicToken: string | null
  accessMode: "admin" | "public"
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState([
    { role: "assistant", content: `Olá! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informações reais que já estejam adicionadas.` }
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
      { role: "assistant", content: `Olá! Sou o concierge da sua viagem para ${tripData.destination}. Posso ajudar com informações reais que já estejam adicionadas.` }
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
    let response = "Ainda não encontrei dados reais suficientes nessa viagem para responder com precisão."

    if (userMessage.includes("hosped")) {
      response = hasHotel
        ? `Sua hospedagem atual e ${tripData.hotel.name}. Check-in: ${tripData.hotel.checkIn}. Check-out: ${tripData.hotel.checkOut}.`
        : "Ainda não há hospedagem real adicionada."
    } else if (userMessage.includes("roteiro")) {
      response = hasItinerary
        ? `Seu roteiro possui ${tripData.itinerary.length} dias planejados. Abra a seção de roteiro para ver os detalhes reais.`
        : "Ainda não há roteiro real criado."
    } else if (userMessage.includes("passag")) {
      response = hasFlights
        ? `Sua viagem possui ${tripData.flights.length} passagem(ns) adicionada(s).`
        : "Ainda não há passagens reais adicionadas."
    } else if (userMessage.includes("document")) {
      response = Array.isArray(tripData.documents) && tripData.documents.length > 0
        ? `Sua viagem possui ${tripData.documents.length} documento(s) real(is) cadastrado(s).`
        : "Ainda não há documentos reais adicionados."
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
        tripSlug,
        adminToken,
        publicToken,
        accessMode,
        conversationId,
        message: userMessage,
        origin: isAdmin ? "trip-admin-link" : "trip-public-link",
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false as const,
        error: data?.error || "Não foi possível obter uma resposta real do concierge desta viagem.",
      }
    }

    return {
      ok: true as const,
      conversationId: data?.conversationId ?? null,
      assistantMessage: data?.assistantMessage ?? "",
      warning: data?.warning ?? null,
      creditsCharged: typeof data?.creditsCharged === "number" ? data.creditsCharged : 0,
    }
  }

  const handleSend = async () => {
    if (offlineReadOnly) {
      showToast("Indisponível offline.", "info")
      return
    }
    if (!message.trim()) return

    const userMessage = message
    const normalizedUserMessage = userMessage.toLowerCase()
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setMessage("")
    setTyping(true)

    void (async () => {
      try {
        if (shouldUseSupabase() && tripData?.id) {
          const result = await requestRealConciergeReply(userMessage)

          if (!result.ok) {
            console.error("[CONCIERGE] real response error", result.error)
            showToast(resolvePublicTripErrorMessage(result.error), "info")
            return
          }

          if (result.conversationId) {
            setConversationId(result.conversationId)
          }

          if (result.warning) {
            showToast(result.warning, "info")
          }

          if (!result.warning && result.creditsCharged > 0) {
            dispatchCreditBalanceChanged({ amount: result.creditsCharged, feature: "concierge" })
          }

          setMessages((prev) => [...prev, { role: "assistant", content: result.assistantMessage }])
          return
        }

        const response = buildResponse(normalizedUserMessage)
        setMessages((prev) => [...prev, { role: "assistant", content: response }])
      } catch (error) {
        console.error("[CONCIERGE] request failed", error)
        showToast("Não conseguimos responder agora. Tente novamente.", "info")
      } finally {
        setTyping(false)
      }
    })()
  }

  return (
    <section id="concierge" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-heading flex items-center gap-3 mb-6">
          <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Concierge IA</h2>
            <p className="text-sm text-white/40">Tire dúvidas sobre sua viagem</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-card rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] overflow-hidden">
          {offlineReadOnly ? (
            <div className="border-b border-white/[0.06] bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Indisponível offline.
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

          {showCredits ? (
            <div className="px-4 py-3 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#5de0e6]" />
                <span className="text-xs text-white/40">
                  {typeof creditsBalance === "number" ? `${creditsBalance} créditos restantes` : "Sincronizando saldo real"}
                </span>
              </div>
              <Button size="sm" variant="ghost" onClick={onOpenCredits} className="text-[#5de0e6] text-xs">
                Ver saldo
              </Button>
            </div>
          ) : null}
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
        {false && isAdmin && (
          <div className="p-4 rounded-xl bg-gradient-to-br from-[#5de0e6]/10 to-[#004aad]/10 border border-[#5de0e6]/20">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-[#5de0e6]" />
              <span className="text-sm font-medium text-white">Link da Viagem</span>
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
            <span className="text-sm font-medium text-white">Link da Viagem</span>
          </div>
          <p className="text-xs text-white/40 mb-3">Um único link para acompanhar a viagem com segurança.</p>
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
            <p className="text-sm text-white font-medium">Acesso protegido</p>
            <p className="text-xs text-white/40 mt-1">Áreas sensíveis continuam seguindo a proteção configurada para esta viagem.</p>
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
  publicView = false,
  tone,
  showCredits = true,
  onOpenEditTrip,
  onOpenShare,
  onOpenOffline,
}: {
  open: boolean
  onClose: () => void
  onOpenTravelers: () => void
  onOpenSettings: () => void
  onOpenSecurity: () => void
  onOpenCredits: () => void
  publicView?: boolean
  tone?: TripLinkTheme
  showCredits?: boolean
  onOpenEditTrip?: () => void
  onOpenShare?: () => void
  onOpenOffline?: () => void
}) {
  const { isAdmin } = useContext(PermissionContext)
  const publicViewIsLight = publicView && tone !== "dark"
  const menuItems = [
    ...(isAdmin ? [
      ...(onOpenEditTrip ? [{ icon: Edit3, label: "Editar viagem", action: onOpenEditTrip }] : []),
      ...(onOpenShare ? [{ icon: Share2, label: "Compartilhar link", action: onOpenShare }] : []),
      ...(showCredits ? [{ icon: CreditCard, label: "Créditos", action: onOpenCredits }] : []),
      { icon: Shield, label: "Segurança", action: onOpenSecurity },
      ...(onOpenOffline ? [{ icon: WifiOff, label: "Offline", action: onOpenOffline }] : []),
      { icon: Settings, label: "Configurações", action: onOpenSettings },
      { icon: User, label: "Viajantes", action: onOpenTravelers },
    ] : []),
    { icon: CreditCard, label: "Créditos", action: onOpenCredits },
  ]

  return (
    <BottomSheet tone={publicView ? tone ?? "light" : "dark"} open={open} onClose={onClose} title="Menu da Viagem">
      <div className="space-y-2">
        {((isAdmin ? menuItems.slice(0, -1) : menuItems).filter((item) => showCredits || item.action !== onOpenCredits)).map((item, i) => (
          <button
            key={i}
            onClick={() => { item.action(); onClose() }}
            className={cn(
              "w-full flex items-center gap-4 rounded-xl p-4 text-left transition-colors",
              publicViewIsLight
                ? "border border-slate-200/80 bg-white/90 hover:bg-white"
                : "border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
            )}
          >
            <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", publicViewIsLight ? "bg-[#eef4ff]" : "bg-white/[0.05]")}>
              <item.icon className={cn("h-5 w-5", publicViewIsLight ? "text-[#2563eb]" : "text-[#efbd72]")} />
            </div>
            <span className={cn("font-medium", publicViewIsLight ? "text-slate-900" : "text-white")}>{item.label}</span>
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
  loading = false,
  onAddTraveler,
  onUpdateTraveler,
  onRemoveTraveler,
  onSetPrimaryTraveler,
}: {
  open: boolean
  onClose: () => void
  travelers: TravelerItem[]
  loading?: boolean
  onAddTraveler: (payload: { name: string; role: "principal" | "acompanhante" }) => Promise<boolean>
  onUpdateTraveler: (travelerId: string, payload: { name: string; role: "principal" | "acompanhante" }) => Promise<boolean>
  onRemoveTraveler: (travelerId: string) => Promise<boolean>
  onSetPrimaryTraveler: (travelerId: string) => Promise<boolean>
}) {
  const { canWrite } = useContext(PermissionContext)
  const { showToast } = useToast()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({ name: "", role: "acompanhante" as "principal" | "acompanhante" })

  const startEditing = (index: number) => {
    setEditingIndex(index)
    setForm({ name: travelers[index]?.name ?? "", role: travelers[index]?.role ?? "acompanhante" })
  }

  const resetForm = () => {
    setEditingIndex(null)
    setForm({ name: "", role: "acompanhante" })
  }

  useEffect(() => {
    if (!open) {
      resetForm()
      setIsSubmitting(false)
    }
  }, [open])

  const handleSave = async () => {
    if (!canWrite || loading || isSubmitting) return
    if (!form.name.trim()) return

    setIsSubmitting(true)
    try {
      const success = editingIndex === null
        ? await onAddTraveler({ name: form.name.trim(), role: form.role })
        : travelers[editingIndex]
          ? await onUpdateTraveler(travelers[editingIndex].id, { name: form.name.trim(), role: form.role })
          : false

      if (!success) return

      showToast(editingIndex === null ? "Viajante adicionado." : "Viajante atualizado.", "success")
      resetForm()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async (index: number) => {
    if (!canWrite || loading || isSubmitting) return
    const traveler = travelers[index]
    if (!traveler) return

    setIsSubmitting(true)
    try {
      const success = await onRemoveTraveler(traveler.id)
      if (!success) return
    } finally {
      setIsSubmitting(false)
    }

    showToast("Viajante removido.", "success")
    if (editingIndex === index) resetForm()
  }

  const handleSetPrimary = async (index: number) => {
    if (!canWrite || loading || isSubmitting) return
    const traveler = travelers[index]
    if (!traveler) return

    setIsSubmitting(true)
    try {
      const success = await onSetPrimaryTraveler(traveler.id)
      if (!success) return
    } finally {
      setIsSubmitting(false)
    }

    showToast("Responsável principal atualizado.", "success")
  }

  return (
    <Modal open={open} onClose={onClose} title="Viajantes">
      <div className="space-y-6">
        <div className="space-y-3">
          {travelers.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/50">
              Nenhum viajante detalhado foi persistido para esta viagem ainda.
            </div>
          ) : null}
          {travelers.map((traveler, index) => (
            <div key={`${traveler.id}-${index}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{traveler.name}</p>
                  <p className="text-xs text-white/40">{traveler.role === "principal" ? "Responsável principal" : "Viajante"}</p>
                </div>
                <div className="flex gap-2">
                  {canWrite && (
                    <>
                      <button disabled={loading || isSubmitting} onClick={() => startEditing(index)} className="rounded-xl bg-white/[0.05] p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button disabled={loading || isSubmitting} onClick={() => void handleRemove(index)} className="rounded-xl bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {canWrite && traveler.role !== "principal" && (
                <button disabled={loading || isSubmitting} onClick={() => void handleSetPrimary(index)} className="mt-3 text-xs font-medium text-[#5de0e6] disabled:opacity-50">
                  Definir como responsável principal
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
                    onClick={() => setForm((prev) => ({ ...prev, role: role as "principal" | "acompanhante" }))}
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
                <Button variant="outline" className="flex-1 border-white/10" onClick={resetForm} disabled={loading || isSubmitting}>
                  Limpar
                </Button>
                <Button className="flex-1 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white" onClick={() => void handleSave()} disabled={loading || isSubmitting}>
                  {loading || isSubmitting ? "Salvando..." : editingIndex === null ? "Adicionar" : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/50">
            Este link está em modo de visualização. O gerenciamento de viajantes fica disponível apenas para responsáveis autenticados.
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
    preferences: "Roteiro premium com foco em experiências culturais e gastronomia.",
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
    <Modal open={open} onClose={onClose} title="Configurações">
      <div className="space-y-4">
        <div>
          <Label className="text-white/60">Preferências da viagem</Label>
          <textarea
            value={form.preferences}
            onChange={(e) => canWrite && setForm((prev) => ({ ...prev, preferences: e.target.value }))}
            disabled={!canWrite}
            className="mt-2 min-h-[110px] w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white outline-none"
          />
        </div>
        {false ? <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-white/60">Privacidade</Label>
            <div className="mt-2 grid gap-2">
              {["privado", "compartilhável"].map((privacy) => (
                <button
                  key={privacy}
                  onClick={() => canWrite && setForm((prev) => ({ ...prev, privacy }))}
                  disabled={!canWrite}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    form.privacy === privacy ? "border-[#5de0e6]/40 bg-[#5de0e6]/10 text-[#5de0e6]" : "border-white/10 bg-white/[0.03] text-white/60"
                  )}
                >
                  {privacy === "privado" ? "Somente administradores" : "Liberar link compartilhável"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-white/60">Permissões</Label>
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
                  {permission === "edicao_restrita" ? "Somente equipe principal" : "Edição colaborativa"}
                </button>
              ))}
            </div>
          </div>
        </div> : null}
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
                {status === "upcoming" ? "Planejada" : status === "ongoing" ? "Em andamento" : "Concluída"}
              </button>
            ))}
          </div>
        </div>
        {canWrite ? (
          <Button className="w-full bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white" onClick={() => onSave(form)}>
            Salvar configurações
          </Button>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/50">
            Este link está em modo de visualização. As configurações da viagem ficam disponíveis apenas para responsáveis autenticados.
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
      setError("Os PINs não conferem.")
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
      const message = securityError instanceof Error ? securityError.message : "Não foi possível salvar o PIN neste dispositivo."
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
      const message = securityError instanceof Error ? securityError.message : "Não foi possível atualizar a biometria neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Segurança">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">Protej? acoes sens?veis desta viagem utilizando PIN ou biometria neste dispositivo.</p>
          <p className="mt-2 text-xs text-white/40">O PIN do link e independente do portal, não é compartilhado com a agência e fica restrito a este aparelho.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">Status do PIN</p>
            <p className="mt-2 text-sm text-white">{securityMethods.pinEnabled ? "PIN configurado" : "PIN não configurado"}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs uppercase tracking-wider text-white/40">Biometria</p>
            <p className="mt-2 text-sm text-white">
              {securityMethods.biometricEnabled ? "Biometria ativa" : securityMethods.biometricSupported ? "Biometria inativa" : "Biometria indisponível"}
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
            placeholder="Digite 4 dígitos"
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
                  <p className="text-xs text-white/40">Última atualização: {new Date(device.updatedAt).toLocaleString("pt-BR")}</p>
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
  tripItineraryRecords,
  isAdmin,
  sensitiveAccessGranted,
  agencyBranding,
  routeSlug,
  currentPathname,
}: {
  tripData: any
  tripItineraryRecords: TripItineraryRecord[]
  isAdmin: boolean
  sensitiveAccessGranted: boolean
  agencyBranding: { name: string | null; logoUrl: string | null; isAgency: boolean }
  routeSlug: string
  currentPathname: string
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [offlinePreparationPending, setOfflinePreparationPending] = useState(false)
  const { showToast } = useToast()

  const handleDownload = async () => {
    setDownloading(true)
    setOfflinePreparationPending(false)
    try {
      const offlineResult = await saveTripOfflinePackage(
        {
          ...tripData,
          slug: routeSlug,
          agencyBranding,
          itineraryRecords: tripItineraryRecords,
        },
        {
          audience: getOfflineSaveAudience({ isAdmin, sensitiveAccessGranted }),
          allowPrivateDocuments: isAdmin && sensitiveAccessGranted,
        },
      )
      const routePreparation = await prepareTripRoutesForOffline({
        slug: routeSlug,
        currentPathname,
        includeAdminRoute: isAdmin,
      })

      const routePreparationIncomplete = !routePreparation.navigationReady
      setDownloaded(!routePreparationIncomplete)
      setOfflinePreparationPending(routePreparationIncomplete)

      showToast(
        routePreparationIncomplete
          ? "Os dados da viagem foram salvos, mas o modo offline ainda precisa concluir a preparação do link. Mantenha a internet ativa, feche e abra este link uma vez antes de viajar."
          : offlineResult.message,
        routePreparationIncomplete || offlineResult.persisted.failures.length > 0 ? "info" : "success",
      )
    } catch (error) {
      console.error("[OFFLINE] save failed", error)
      showToast(resolvePublicTripErrorMessage(error instanceof Error ? error.message : "Não foi possível salvar esta viagem offline."), "error")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <section id="offline" className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-heading flex items-center gap-3 mb-6">
          <div className="trip-panel-heading-icon w-10 h-10 rounded-xl bg-gradient-to-br from-[#004aad] to-[#5de0e6] flex items-center justify-center">
            <WifiOff className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="trip-panel-heading-title text-xl font-semibold text-white">Acesso Offline</h2>
            <p className="text-sm text-white/40">Salve sua viagem para acessar sem internet</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="trip-panel-card p-6 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06]">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-medium text-white mb-2">
                {downloaded
                  ? "Viagem salva offline!"
                  : offlinePreparationPending
                    ? "Preparação offline em andamento"
                    : "Salvar viagem offline"}
              </h3>
              <p className="text-sm text-white/40 mb-4">
                {downloaded
                  ? getOfflineWarningMessage()
                  : offlinePreparationPending
                    ? "Os dados da viagem já foram salvos neste dispositivo, mas o link ainda precisa concluir a preparação offline com internet ativa."
                    : "Salve o último resumo, passagens extraídas, hospedagem, documentos já abertos, roteiro e informações rápidas para consultar sem internet."}
              </p>
              
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {["Roteiro", "Vouchers", "Documentos", "Contatos"].map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "px-3 py-1 text-xs rounded-full",
                      downloaded
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : offlinePreparationPending
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          : "bg-white/[0.05] text-white/40",
                    )}
                  >
                    {downloaded ? <Check className="w-3 h-3 inline mr-1" /> : null}
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <Button
              onClick={() => void handleDownload()}
              disabled={downloading || downloaded}
              className={cn(
                "px-6 py-6 rounded-xl transition-all duration-300",
                downloaded
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : offlinePreparationPending
                    ? "bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/20"
                    : "bg-gradient-to-r from-[#5de0e6] to-[#004aad] hover:opacity-90 text-white border-0",
              )}
            >
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
              ) : offlinePreparationPending ? (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>Concluir preparo</span>
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
      ? "Modo offline ativo. Algumas funcionalidades estão indisponíveis e alguns arquivos podem não estar disponíveis offline."
      : status === "legacy_snapshot"
        ? "Modo offline ativo. Esta é uma versão salva anterior. Arquivos podem não estar disponíveis offline."
        : "Modo offline ativo. Algumas funcionalidades estão indisponíveis."

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
    { id: "currency", icon: "💶", label: "Moeda", value: quickInfo.currency.name, sub: `1 ${quickInfo.currency.symbol} = ${quickInfo.currency.rate}`, detail: "Cotação e disponibilidade podem variar. Consulte fontes locais antes da viagem." },
    { id: "language", icon: "🗣️", label: "Idioma", value: quickInfo.language, detail: "As informações de idioma são exibidas com base no destino informado da viagem." },
    { id: "timezone", icon: "🕐", label: "Fuso horário", value: quickInfo.timezone, detail: "O fuso horário é apresentado a partir do destino configurado. Confirme horários finais com a operação da viagem." },
    { id: "emergency", icon: "🆘", label: "Emergência", value: quickInfo.emergency, detail: "Use este número para emergências locais quando houver confirmação do destino." },
    { id: "embassy", icon: "🏛️", label: "Embaixada BR", value: quickInfo.embassy, detail: "Contato consular exibido conforme o destino informado. Se estiver indisponível, mantenha os contatos da sua agência." },
  ]

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5de0e6]/50 to-[#004aad]/50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Informações rápidas</h2>
            <p className="text-sm text-white/40">Dados úteis sobre o destino</p>
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

function TravelerPublicCreditsModal({
  open,
  onClose,
  credits,
  tone,
}: {
  open: boolean
  onClose: () => void
  credits: TripTravelerCreditsPayload | null
  tone?: TripLinkTheme
}) {
  const balance = Math.max(credits?.balance ?? 0, 0)
  const planCredits = Math.max(credits?.planCreditsAvailable ?? 0, 0)
  const purchasedCredits = Math.max(credits?.purchasedCreditsAvailable ?? 0, 0)
  const monthlyCredits = getTravelerMonthlyCredits(credits?.currentPlan)
  const planCreditsUsed = Math.max(monthlyCredits - planCredits, 0)
  const usagePercentage = monthlyCredits > 0 ? Math.min((planCreditsUsed / monthlyCredits) * 100, 100) : 0

  return (
    <Modal tone={tone} open={open} onClose={onClose} title="Créditos">
      <div className="space-y-5">
        {!credits ? (
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4 text-sm text-slate-600">
            Sincronizando saldo real desta viagem...
          </div>
        ) : null}
        <div className="rounded-[26px] border border-[#dbe5f4] bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Créditos disponíveis</p>
              <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{balance}</p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              Plano {credits?.currentPlan === "premium" ? "Premium" : "Free"}
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5de0e6] to-[#004aad]" style={{ width: `${usagePercentage}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {planCreditsUsed} de {monthlyCredits} créditos mensais utilizados neste ciclo
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Créditos do plano</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{planCredits}</p>
            <p className="mt-1 text-xs text-slate-500">Disponiveis neste ciclo</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Saldo atual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{balance}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Créditos comprados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{purchasedCredits}</p>
            <p className="mt-1 text-xs text-slate-500">Acumulados fora do ciclo mensal</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Ciclo atual</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{formatCreditsPeriodEnd(credits?.currentPeriodEnd)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/92 p-4 text-sm text-slate-600">
          Recargas e compras sao feitas pelo portal.
        </div>
      </div>
    </Modal>
  )
}

function LinkCreditsSummaryModal({
  open,
  onClose,
  credits,
  tone,
}: {
  open: boolean
  onClose: () => void
  credits: TripTravelerCreditsPayload | null
  tone?: TripLinkTheme
}) {
  const balance = Math.max(credits?.balance ?? 0, 0)
  const planCredits = Math.max(credits?.planCreditsAvailable ?? 0, 0)
  const purchasedCredits = Math.max(credits?.purchasedCreditsAvailable ?? 0, 0)
  const monthlyCredits = getTravelerMonthlyCredits(credits?.currentPlan)
  const planCreditsUsed = Math.max(monthlyCredits - planCredits, 0)
  const usagePercentage = monthlyCredits > 0 ? Math.min((planCreditsUsed / monthlyCredits) * 100, 100) : 0

  return (
    <Modal tone={tone} open={open} onClose={onClose} title="Créditos">
      <div className="space-y-5">
        {!credits ? (
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4 text-sm text-slate-600">
            Sincronizando saldo real desta viagem...
          </div>
        ) : null}
        <div className="rounded-[26px] border border-[#dbe5f4] bg-[linear-gradient(180deg,#ffffff_0%,#eef5ff_100%)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-500">Créditos disponíveis</p>
              <p className="mt-1 text-4xl font-semibold tracking-[-0.04em] text-slate-950">{balance}</p>
            </div>
            <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
              Plano {credits?.currentPlan === "premium" ? "Premium" : "Free"}
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-[#5de0e6] to-[#004aad]" style={{ width: `${usagePercentage}%` }} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {planCreditsUsed} de {monthlyCredits} créditos mensais utilizados neste ciclo
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Créditos do plano</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{planCredits}</p>
            <p className="mt-1 text-xs text-slate-500">Disponiveis neste ciclo</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Saldo atual</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{balance}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Créditos comprados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{purchasedCredits}</p>
            <p className="mt-1 text-xs text-slate-500">Acumulados fora do ciclo mensal</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/92 p-4">
            <p className="text-xs text-slate-500">Ciclo atual</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{formatCreditsPeriodEnd(credits?.currentPeriodEnd)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/92 p-4 text-sm text-slate-600">
          Recargas e compras sao feitas pelo portal.
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
        setError("PIN inválido")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Acesso rápido não configurado neste dispositivo"
      setError(message)
    } finally {
      setIsSubmitting(false)
      setPin("")
    }
  }

  const handleCreatePin = async () => {
    if (pin.length !== 4 || confirmPin.length !== 4) return
    if (pin !== confirmPin) {
      setError("Os PINs não conferem.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await saveTripLinkPin(tripId, pin)
      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Não foi possível configurar o PIN neste dispositivo."
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
        setError("Não foi possível validar a biometria neste dispositivo.")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Biometria indisponível neste dispositivo."
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
            : "Crie um PIN neste dispositivo para proteger acoes sens?veis desta viagem."}
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
              <p className="text-sm text-amber-100">Crie um PIN neste dispositivo para proteger acoes sens?veis desta viagem.</p>
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
          Gerenciar segurança neste dispositivo
        </Button>
      </div>
    </Modal>
  )
}

function TravelerPublicSensitiveAccessModal({
  open,
  tripId,
  onClose,
  onSuccess,
  onLogin,
}: {
  open: boolean
  tripId: string
  onClose: () => void
  onSuccess: () => void
  onLogin: () => void
}) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const quickAccessMethods = getTripLinkQuickAccessMethods(tripId)

  useEffect(() => {
    if (!open) {
      setPin("")
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
        setError("PIN inválido.")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "PIN indisponível neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
      setPin("")
    }
  }

  const handleBiometricUnlock = async () => {
    setIsSubmitting(true)
    setError("")

    try {
      const success = await authenticateTripLinkBiometric(tripId)
      if (!success) {
        setError("Não foi possível validar a biometria neste dispositivo.")
        return
      }

      onSuccess()
    } catch (unlockError) {
      const message = unlockError instanceof Error ? unlockError.message : "Biometria indisponível neste dispositivo."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal tone="light" open={open} onClose={onClose} title="Desbloquear áreas sensíveis">
      <div className="w-full">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,#eff6ff,#dbeafe)]">
          <Lock className="h-8 w-8 text-[#2563eb]" />
        </div>
        <p className="text-center text-sm leading-6 text-slate-600">
          {quickAccessMethods.pinEnabled || quickAccessMethods.biometricEnabled
            ? "Use o PIN ou a biometria já configurados para abrir documentos, passagens, hospedagens e concierge."
            : "O PIN é configurado pelo responsável no portal/admin. Neste link você apenas desbloqueia com um acesso já existente."}
        </p>

        <div className="mt-6 space-y-3">
          {quickAccessMethods.biometricEnabled ? (
            <Button
              onClick={() => void handleBiometricUnlock()}
              disabled={isSubmitting}
              className="w-full rounded-2xl border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white hover:opacity-90"
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              Usar Face ID / biometria
            </Button>
          ) : null}

          {quickAccessMethods.pinEnabled ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white/92 p-4">
              <Label className="text-slate-600">Usar PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 border-slate-200 bg-white text-center text-lg font-semibold tracking-[0.28em] text-slate-950 placeholder:tracking-normal placeholder:text-slate-400"
              />
              <Button
                onClick={() => void handlePinUnlock()}
                disabled={isSubmitting || pin.length !== 4}
                className="w-full rounded-2xl border-0 bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
              >
                Desbloquear com PIN
              </Button>
            </div>
          ) : null}

          {!quickAccessMethods.pinEnabled && !quickAccessMethods.biometricEnabled ? (
            <div className="rounded-2xl border border-slate-200 bg-white/92 p-4 text-sm text-slate-600">
              Nenhum acesso r?pido foi configurado para este dispositivo.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <Button
          variant="outline"
          onClick={onLogin}
          className="mt-5 w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Entrar com login
        </Button>
      </div>
    </Modal>
  )
}

// Main page component
export default function TripPage() {
  const params = useParams<{ id?: string; slug?: string }>()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, profile, loading: authLoading } = useAuth()
  const [travelerPlan, setTravelerPlan] = useState(() => resolveTravelerPlan(profile))
  const adminRouteActive = Boolean(pathname?.startsWith("/viagem/") && pathname?.endsWith("/admin"))
  const isTripLinkRoute = Boolean((pathname?.startsWith("/viagem/") ?? false) || (pathname?.startsWith("/v/") ?? false))
  const routeSlug =
    typeof params?.id === "string"
      ? params.id
      : typeof params?.slug === "string"
        ? params.slug
        : initialTripData.id
  const searchParamsKey = searchParams?.toString() ?? ""
  const [tripData, setTripData] = useState(() => normalizeTripViewData(initialTripData))
  const [tripLinkTheme, setTripLinkTheme] = useState<TripLinkTheme>("light")
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
  const [travelerPanel, setTravelerPanel] = useState<TravelerPublicPanel>(null)
  const [tripOwnerUserId, setTripOwnerUserId] = useState<string | null>(null)
  const [tripAdminToken, setTripAdminToken] = useState<string | null>(null)
  const [tripPublicToken, setTripPublicToken] = useState<string | null>(null)
  const [tripItineraryRecords, setTripItineraryRecords] = useState<TripItineraryRecord[]>([])
  const [tripTravelersSource, setTripTravelersSource] = useState<"fallback" | "persisted">("fallback")
  const [travelersLoading, setTravelersLoading] = useState(false)
  const [sensitiveAccessGranted, setSensitiveAccessGranted] = useState(false)
  const [securityModalOpen, setSecurityModalOpen] = useState(false)
  const [securityAccessMode, setSecurityAccessMode] = useState<TripPinApiAccessMode>("public")
  const [authenticatedAdminEligible, setAuthenticatedAdminEligible] = useState(false)
  const [adminLinkMutationMode, setAdminLinkMutationMode] = useState(false)
  const [premiumGateModalOpen, setPremiumGateModalOpen] = useState(false)
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(false)
  const [offlinePackageStatus, setOfflinePackageStatus] = useState<OfflineTripPackageStatus | null>(null)
  const [offlineDocumentContext, setOfflineDocumentContext] = useState<OfflineDocumentContext | null>(null)
  const [agencyBranding, setAgencyBranding] = useState<{ name: string | null; logoUrl: string | null; isAgency: boolean }>({ name: null, logoUrl: null, isAgency: false })
  const [travelerCredits, setTravelerCredits] = useState<TripTravelerCreditsPayload | null>(null)
  const [hasTemporaryClaimAccess, setHasTemporaryClaimAccess] = useState(false)
  const [temporaryClaimNoticeDismissed, setTemporaryClaimNoticeDismissed] = useState(false)
  const [sectionsLoading, setSectionsLoading] = useState({
    flights: true,
    hotels: true,
    itineraries: true,
    documents: true,
  })
  const pendingSensitiveActionRef = useRef<(() => void) | null>(null)
  const loadRequestRef = useRef(0)
  const offlineImageUrlsRef = useRef<string[]>([])
  const flightPollingTimersRef = useRef<Map<string, ReturnType<typeof window.setTimeout>>>(new Map())
  const isAgencyTrip = Boolean(tripData?.agencyId || tripData?.agency_id || agencyBranding?.isAgency)

  const logOfflineLookupDev = (stage: string, payload: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "development") return
    console.info("[OFFLINE LOOKUP]", stage, payload)
  }

  const handleCloseSensitiveAccessModal = () => {
    setSecurityModalOpen(false)
    setSecurityAccessMode("public")
    pendingSensitiveActionRef.current = null
  }

  const handleDismissAdminUnlockModal = () => {
    setSecurityModalOpen(false)
    pendingSensitiveActionRef.current = null
    setSensitiveAccessGranted(false)
    setCanWrite(false)
    setIsAdmin(false)
    setAdminLinkMutationMode(false)
    router.replace("/")
  }

  useEffect(() => {
    return () => {
      for (const timer of flightPollingTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      flightPollingTimersRef.current.clear()
      if (offlineImageUrlsRef.current.length > 0) {
        revokeOfflineObjectUrls(offlineImageUrlsRef.current)
        offlineImageUrlsRef.current = []
      }
    }
  }, [])

  useEffect(() => {
    setTravelerPlan(resolveTravelerPlan(profile))

    if (!shouldUseSupabase() || !user || profile?.role !== "traveler") {
      return
    }

    let mounted = true

    const loadTravelerBilling = async () => {
      const result = await getTravelerBillingStatus()
      if (!mounted || result.error || !result.data) return
      setTravelerPlan(resolveTravelerPlanFromBillingStatus(result.data))
    }

    void loadTravelerBilling()

    return () => {
      mounted = false
    }
  }, [profile, user])

  useEffect(() => {
    setSensitiveAccessGranted(false)
    pendingSensitiveActionRef.current = null
    setTripTravelersSource("fallback")
    setTravelersLoading(false)
    setHasTemporaryClaimAccess(false)
    setTemporaryClaimNoticeDismissed(false)
  }, [tripOwnerUserId, user?.id, params?.id, params?.slug])

  useEffect(() => {
    if (typeof window === "undefined" || !tripData?.id) {
      setHasTemporaryClaimAccess(false)
      return
    }

    const pendingClaimSession = findPendingTripClaimSession({
      tripId: tripData.id,
      tripSlug: routeSlug,
    })
    const hasMatchingTemporaryClaim =
      Boolean(pendingClaimSession) &&
      pendingClaimSession?.tripId === tripData.id &&
      pendingClaimSession?.tripSlug === routeSlug &&
      typeof pendingClaimSession?.claimToken === "string" &&
      pendingClaimSession.claimToken.length > 0 &&
      isPendingTripClaimSessionActive(pendingClaimSession) &&
      !tripOwnerUserId &&
      !adminRouteActive

    setHasTemporaryClaimAccess(hasMatchingTemporaryClaim)
  }, [adminRouteActive, routeSlug, tripData?.id, tripOwnerUserId])

  useEffect(() => {
    if (hasTemporaryClaimAccess && securityAccessMode === "public" && securityModalOpen) {
      setSecurityModalOpen(false)
      pendingSensitiveActionRef.current = null
    }
  }, [hasTemporaryClaimAccess, securityAccessMode, securityModalOpen])

  useEffect(() => {
    setTravelerPanel(null)
  }, [routeSlug, pathname])

  useEffect(() => {
    if (isAgencyTrip && creditsOpen) {
      setCreditsOpen(false)
    }
  }, [creditsOpen, isAgencyTrip])

  useEffect(() => {
    if (isLoadingTrip || offlineModeEnabled || isAgencyTrip || !tripData?.id) {
      setTravelerCredits(null)
      return
    }

    let active = true

    const loadTravelerCredits = async () => {
      const credits = await fetchTripTravelerCredits({
        tripId: tripData.id,
        tripSlug: routeSlug,
        adminToken: tripAdminToken,
        publicToken: tripPublicToken,
        accessMode: adminRouteActive ? "admin" : "public",
      })

      if (!active) return

      if (!credits || credits.hidden || credits.isAgencyTrip) {
        setTravelerCredits(null)
        return
      }

      setTravelerCredits(credits)
    }

    void loadTravelerCredits()

    return () => {
      active = false
    }
  }, [adminRouteActive, isAgencyTrip, isLoadingTrip, offlineModeEnabled, routeSlug, tripAdminToken, tripData?.id, tripPublicToken])

  useEffect(() => {
    if (isLoadingTrip || offlineModeEnabled || isAgencyTrip || !tripData?.id) {
      return
    }

    const reloadCredits = () => {
      void (async () => {
        const credits = await fetchTripTravelerCredits({
          tripId: tripData.id,
          tripSlug: routeSlug,
          adminToken: tripAdminToken,
          publicToken: tripPublicToken,
          accessMode: adminRouteActive ? "admin" : "public",
        })

        if (!credits || credits.hidden || credits.isAgencyTrip) {
          return
        }

        setTravelerCredits(credits)
      })()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadCredits()
      }
    }

    window.addEventListener(CREDIT_BALANCE_CHANGED_EVENT, reloadCredits)
    window.addEventListener("focus", reloadCredits)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.removeEventListener(CREDIT_BALANCE_CHANGED_EVENT, reloadCredits)
      window.removeEventListener("focus", reloadCredits)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [adminRouteActive, isAgencyTrip, isLoadingTrip, offlineModeEnabled, routeSlug, tripAdminToken, tripData?.id, tripPublicToken])

  useEffect(() => {
    if (typeof window === "undefined") return

    const routeSearchParams = new URLSearchParams(searchParamsKey)
    const adminToken = routeSearchParams.get("adminToken") ?? tripAdminToken
    const publicToken = routeSearchParams.get("token") || routeSearchParams.get("publicToken")
    const isPublicRoute = pathname?.startsWith("/v/") ?? false
    const isAdminRoute = adminRouteActive || isAdminLinkMode(routeSearchParams, pathname)

    setIsAdmin(false)
    setCanWrite(false)
    setAuthenticatedAdminEligible(false)
    setTripAdminToken(adminToken)
    setTripPublicToken(publicToken)
    setAdminLinkMutationMode(false)
    setOfflineModeEnabled(false)
    setOfflinePackageStatus(null)
    setOfflineDocumentContext(null)
    if (offlineImageUrlsRef.current.length > 0) {
      revokeOfflineObjectUrls(offlineImageUrlsRef.current)
      offlineImageUrlsRef.current = []
    }
    setTripItineraryRecords([])
    setSectionsLoading({
      flights: true,
      hotels: true,
      itineraries: true,
      documents: true,
    })
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    const keepVisibleShellWhileRefreshing = sensitiveAccessGranted && Boolean(tripData?.id)

    const loadTrip = async () => {
      const tripPerf = startPerfMeasure("trip.base")
      if (!keepVisibleShellWhileRefreshing) {
        setIsLoadingTrip(true)
      }
      setLoadError(null)
      devLog("trip.loading", routeSlug)

      const useSupabase = shouldUseSupabase()
      const routeMode = isAdminRoute ? "admin" : isPublicRoute ? "public" : "portal"
      const isMobileViewport = typeof window !== "undefined" ? window.innerWidth < 768 : false

      if (false && isAdminRoute && !adminToken) {
        setLoadError("Este link administrativo é inválido ou expirou.")
        setIsLoadingTrip(false)
        return
      }

      logTripDocumentsDev("trip_load_started", {
        routeSlug,
        routeMode,
        isMobileViewport,
      })

      const loadOfflinePackage = async (reason: "offline" | "network") => {
        try {
          const offlinePackage = await loadTripOfflinePackage({
            tripIdOrSlug: routeSlug,
            audience: getOfflineReadAudience(isAdminRoute),
          })
          logOfflineLookupDev("package_lookup", {
            reason,
            routeSlug,
            audience: getOfflineReadAudience(isAdminRoute),
            found: Boolean(offlinePackage),
            packageAudience: offlinePackage?.audience ?? null,
            packageStatus: offlinePackage?.status ?? null,
            packageKey: offlinePackage?.packageKey ?? null,
            packageSlug: offlinePackage?.slug ?? null,
            documentCount: offlinePackage?.documentCount ?? null,
            imageCount: offlinePackage?.imageCount ?? null,
          })
          if (!offlinePackage) return false
          if (loadRequestRef.current !== requestId) return true

          const audience = getOfflineReadAudience(isAdminRoute)
          const offlineTrip = buildTripDataFromOfflinePackage(offlinePackage, audience)
          const packageKey = offlinePackage.packageKey ?? offlinePackage.payload?.offlineMeta?.packageKey ?? null
          const [heroImageBlob, brandingImageBlob] = await Promise.all([
            getOfflineImageBlob(`hero:${offlinePackage.tripId}`, {
              tripId: offlinePackage.tripId,
              packageKey,
              audience,
            }),
            getOfflineImageBlob(`branding:${offlinePackage.tripId}`, {
              tripId: offlinePackage.tripId,
              packageKey,
              audience,
            }),
          ])
          const nextTripData = { ...offlineTrip.tripData }
          const nextAgencyBranding = { ...offlineTrip.agencyBranding }
          const nextOfflineImageUrls: string[] = []

          if (heroImageBlob?.blob) {
            const heroObjectUrl = URL.createObjectURL(heroImageBlob.blob)
            nextOfflineImageUrls.push(heroObjectUrl)
            nextTripData.heroImage = heroObjectUrl
          }

          if (brandingImageBlob?.blob) {
            const brandingObjectUrl = URL.createObjectURL(brandingImageBlob.blob)
            nextOfflineImageUrls.push(brandingObjectUrl)
            nextAgencyBranding.logoUrl = brandingObjectUrl
          }

          if (offlineImageUrlsRef.current.length > 0) {
            revokeOfflineObjectUrls(offlineImageUrlsRef.current)
          }
          offlineImageUrlsRef.current = nextOfflineImageUrls

          setOfflineModeEnabled(true)
          setOfflinePackageStatus(offlineTrip.status)
          setOfflineDocumentContext({
            tripId: offlinePackage.tripId,
            audience,
            packageKey,
            packageStatus: offlineTrip.status,
          })
          setTripOwnerUserId(null)
          setTripAdminToken(null)
          setTripPublicToken(null)
          setAdminLinkMutationMode(false)
          setSensitiveAccessGranted(false)
          setCanWrite(false)
          setIsAdmin(isAdminRoute)
          setTripItineraryRecords(offlineTrip.itineraryRecords)
          setAgencyBranding(nextAgencyBranding)
          setTripData(nextTripData)
          setSectionsLoading({
            flights: false,
            hotels: false,
            itineraries: false,
            documents: false,
          })
          setIsLoadingTrip(false)
          tripPerf.end({ tripId: offlinePackage.tripId, mode: "offline", reason })
          return true
        } catch (error) {
          console.error("[TRIP] offline package load error", error)
          if (loadRequestRef.current === requestId) {
            setSectionsLoading({
              flights: false,
              hotels: false,
              itineraries: false,
              documents: false,
            })
            setLoadError("Não foi possível carregar esta viagem offline neste dispositivo.")
            setIsLoadingTrip(false)
          }
          return false
        }
      }

      if (isOfflineModeActive()) {
        const offlineLoaded = await loadOfflinePackage("offline")
        if (!offlineLoaded) {
          setLoadError("Esta viagem não foi salva para uso offline neste dispositivo.")
          setIsLoadingTrip(false)
        }
        return
      }

      try {
        const matchingPendingClaim = !isAdminRoute
          ? findPendingTripClaimSession({ tripSlug: routeSlug })
          : null
        const pendingDraftResult = matchingPendingClaim
          ? await getPendingTripDraft({
              tripId: matchingPendingClaim.tripId,
              tripSlug: matchingPendingClaim.tripSlug,
              claimToken: matchingPendingClaim.claimToken,
            })
          : null
        const pendingDraftTrip = pendingDraftResult?.data ?? null
        const hasVerifiedPendingDraftAccess = Boolean(pendingDraftTrip && matchingPendingClaim)

        if (
          matchingPendingClaim &&
          !pendingDraftTrip &&
          (pendingDraftResult?.code === "pending_access_invalid" ||
            pendingDraftResult?.code === "pending_access_expired" ||
            pendingDraftResult?.code === "pending_access_claimed")
        ) {
          clearPendingTripClaimSession(matchingPendingClaim.tripId)
        }

        const repositoryTripPromise = isTripLinkRoute
          ? getTripBySlug(routeSlug)
          : adminToken
            ? getTripByAdminToken(adminToken)
            : publicToken
              ? getTripByPublicToken(publicToken)
              : getTripBySlug(routeSlug)
        const isBrowserOffline = typeof navigator !== "undefined" && navigator.onLine === false
        const shouldAttemptOfflineTimeoutFallback = useSupabase && (isPublicRoute || isAdminRoute) && isBrowserOffline
        const lookupTimeoutMs = isMobileViewport ? 2200 : 3200
        let repositoryTrip:
          | Awaited<ReturnType<typeof getTripBySlug>>
          | Awaited<ReturnType<typeof getTripByAdminToken>>
          | Awaited<ReturnType<typeof getTripByPublicToken>>
        let fallbackTrip: ReturnType<typeof mapTripPinSnapshotToStoredTrip> | null = null

        let hydratedFromOfflineTimeout = false

        if (shouldAttemptOfflineTimeoutFallback) {
          const lookupRace = await Promise.race([
            repositoryTripPromise.then((result) => ({ type: "result" as const, result })),
            new Promise<{ type: "timeout" }>((resolve) => {
              window.setTimeout(() => resolve({ type: "timeout" }), lookupTimeoutMs)
            }),
          ])

          if (lookupRace.type === "timeout") {
            logOfflineLookupDev("online_timeout", {
              routeSlug,
              routeMode,
              lookupTimeoutMs,
            })
            const offlineLoaded = await loadOfflinePackage("network")
            hydratedFromOfflineTimeout = offlineLoaded
            repositoryTrip = await repositoryTripPromise
          } else {
            repositoryTrip = lookupRace.result
          }
        } else {
          repositoryTrip = await repositoryTripPromise
        }

        if (!pendingDraftTrip && !repositoryTrip.data && useSupabase && isTripLinkRoute) {
          const pinStatusResult = await loadTripPinStatus({
            tripSlug: routeSlug,
            adminToken,
            publicToken,
            accessMode: isAdminRoute ? "admin" : "public",
          })

          if (pinStatusResult.ok && pinStatusResult.data?.trip) {
            fallbackTrip = mapTripPinSnapshotToStoredTrip(pinStatusResult.data.trip, {
              adminToken,
              publicToken,
            })
          }
        }

        const resolvedTrip = pendingDraftTrip ?? repositoryTrip.data ?? fallbackTrip

        if (resolvedTrip) {
          if (loadRequestRef.current !== requestId) return
          if (hydratedFromOfflineTimeout) {
            if (offlineImageUrlsRef.current.length > 0) {
              revokeOfflineObjectUrls(offlineImageUrlsRef.current)
              offlineImageUrlsRef.current = []
            }
            setOfflineModeEnabled(false)
            setOfflinePackageStatus(null)
            setOfflineDocumentContext(null)
          }
          const resolvedAgencyId = resolveTripAgencyId(resolvedTrip)
          const preloadedAgencyBranding = hasVerifiedPendingDraftAccess
            ? null
            : await fetchTripAgencyBranding({
                tripId: resolvedTrip.id,
                tripSlug: resolvedTrip.slug ?? routeSlug,
                adminToken: resolvedTrip.adminToken ?? adminToken ?? null,
                publicToken: resolvedTrip.publicToken ?? publicToken ?? null,
                accessMode: isAdminRoute ? "admin" : "public",
              })
          const preloadedAgencyLogo = resolveAgencyBrandLogo(
            preloadedAgencyBranding?.linkLogoUrl,
            preloadedAgencyBranding?.logoUrl,
          )
          const preloadedAgencyName =
            preloadedAgencyBranding?.name ??
            (resolvedAgencyId ? "Agência parceira" : null)

          setAgencyBranding({
            name: preloadedAgencyName,
            logoUrl: preloadedAgencyLogo,
            isAgency: Boolean(resolvedAgencyId),
          })

          setTripOwnerUserId(resolvedTrip.ownerUserId ?? null)
          setHasTemporaryClaimAccess(hasVerifiedPendingDraftAccess)
          setTripAdminToken(resolvedTrip.adminToken ?? adminToken ?? null)
          setTripPublicToken(resolvedTrip.publicToken ?? publicToken ?? null)
          const isOwner = Boolean(user?.id && resolvedTrip.ownerUserId && user.id === resolvedTrip.ownerUserId)
          const authenticatedAdminAccess = hasTripAuthenticatedAdminAccess({
            userId: user?.id ?? null,
            profileRole: profile?.role ?? null,
            profileAgencyId: profile?.agencyId ?? null,
            ownerUserId: resolvedTrip.ownerUserId ?? null,
            tripAgencyId: resolvedAgencyId,
          })
          const isPublicLinkRequest = isPublicRoute || (!isAdminRoute && !authenticatedAdminAccess && !publicToken)
          const adminLinkAccessMode = isAdminRoute && !isOwner
          const adminAccessAllowed = isAdminRoute || authenticatedAdminAccess
          const adminPinGranted = !adminAccessAllowed || sensitiveAccessGranted
          const canEditTrip = adminAccessAllowed && adminPinGranted && (authenticatedAdminAccess || adminLinkAccessMode)
          const canWriteTrip = adminAccessAllowed && adminPinGranted && (authenticatedAdminAccess || adminLinkAccessMode)

          setAuthenticatedAdminEligible(authenticatedAdminAccess)

          logTripDocumentsDev("trip_resolved", {
            routeSlug,
            tripId: resolvedTrip.id,
            routeMode,
            isMobileViewport,
            hasAdminToken: Boolean(adminToken),
            hasPublicToken: Boolean(publicToken),
            isOwner,
            authenticatedAdminAccess,
          })

          if (isPublicLinkRequest && !hasVerifiedPendingDraftAccess && !isTripPublicLinkActive({
            ownerType: resolvedTrip.ownerType,
            visibility: resolvedTrip.visibility,
            linkActivatedAt: resolvedTrip.linkActivatedAt,
            linkAccessUntil: resolvedTrip.linkAccessUntil,
          })) {
            console.error("[TRIP] erro ao carregar link", "Esta viagem não está publicada para acesso público.")
            setLoadError("Esta viagem não está disponível publicamente.")
            setIsLoadingTrip(false)
            return
          }

          setAdminLinkMutationMode(Boolean(isAdminRoute && adminPinGranted && (resolvedTrip.adminToken ?? adminToken ?? null)))
          setIsAdmin(canEditTrip)
          setCanWrite(canWriteTrip)

          setTripData(
            buildTripDataFromStoredTrip({
              id: resolvedTrip.id,
              slug: resolvedTrip.slug,
              name: resolvedTrip.title,
              destination: resolvedTrip.destination,
              agencyId: resolvedAgencyId,
              clientId: resolvedTrip.clientId ?? null,
              country: resolvedTrip.country ?? undefined,
              city: resolvedTrip.city ?? undefined,
              startDate: resolvedTrip.startDate ?? undefined,
              endDate: resolvedTrip.endDate ?? undefined,
              passengersCount: resolvedTrip.travelersCount,
              status: resolvedTrip.status,
              coverImage: resolvedTrip.coverImage ?? undefined,
              adminLink: resolvedTrip.adminLink,
              shareLink: resolvedTrip.publicLink,
              flights: [],
              hotels: [],
              hotel: resolvedTrip.accommodations?.[0] ?? null,
              itinerary: resolvedTrip.itinerary,
              documents: [],
              travelersCount: resolvedTrip.travelersCount,
            })
          )
          setIsLoadingTrip(false)
          tripPerf.end({ tripId: resolvedTrip.id })

          if (hasVerifiedPendingDraftAccess) {
            setTripItineraryRecords([])
            setSectionsLoading({
              flights: false,
              hotels: false,
              itineraries: false,
              documents: false,
            })
            return
          }

          void (async () => {
            const sectionsPerf = startPerfMeasure("trip.sections")
            const resolvedAdminToken = resolvedTrip.adminToken ?? adminToken ?? null
            const resolvedPublicToken = resolvedTrip.publicToken ?? publicToken ?? null
            const sectionsAccessMode = canWriteTrip ? "admin" : "public"
            const sectionsHref = buildTripSectionsAccessHref({
              tripId: resolvedTrip.id,
              tripSlug: routeSlug,
              accessMode: sectionsAccessMode,
              adminToken: resolvedAdminToken,
              publicToken: resolvedPublicToken,
            })
            const sectionsPromise = shouldUseSupabase()
              ? fetch(sectionsHref).then(async (response) => {
                  const data = await response.json().catch(() => null)
                  if (!response.ok) {
                    throw new Error(data?.error || "Falha ao carregar as seções da viagem.")
                  }
                  return data
                })
              : null

            const [documentsSettled, flightsSettled, itinerariesSettled, hotelsSettled, agencySettled, travelersSettled] = await Promise.allSettled([
              sectionsPromise
                ? sectionsPromise.then((data: any) => ({ source: "sections-api" as const, data: data?.documents ?? [], error: null }))
                : (canWriteTrip ? listDocumentsByTrip(resolvedTrip.id) : listPublicTripDocuments(resolvedTrip.id)),
              sectionsPromise
                ? sectionsPromise.then((data: any) => ({ source: "sections-api" as const, data: data?.flights ?? [], error: null }))
                : (canWriteTrip ? listTripFlights(resolvedTrip.id) : listPublicTripFlights(resolvedTrip.id)),
              sectionsPromise
                ? sectionsPromise.then((data: any) => ({ source: "sections-api" as const, data: data?.itineraries ?? [], error: null }))
                : listTripItineraries(resolvedTrip.id),
              sectionsPromise
                ? sectionsPromise.then((data: any) => ({ source: "sections-api" as const, data: data?.hotels ?? [], error: null }))
                : listTripHotels(resolvedTrip.id),
              Promise.resolve(preloadedAgencyBranding),
              sectionsPromise
                ? sectionsPromise.then((data: any) => ({ source: "sections-api" as const, data: data?.travelers ?? [], error: null }))
                : Promise.resolve({ source: "hidden" as const, data: [] as PersistedTravelerPayload[], error: null }),
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
            const travelersResult =
              travelersSettled.status === "fulfilled"
                ? travelersSettled.value
                : { source: "error" as const, data: [] as PersistedTravelerPayload[], error: travelersSettled.reason instanceof Error ? travelersSettled.reason.message : "Falha ao buscar viajantes." }
            const resolvedDocuments = Array.isArray(documentsResult.data) ? documentsResult.data : []
            const resolvedTravelers = Array.isArray(travelersResult.data) ? travelersResult.data : []
            const sectionErrors = [
              documentsResult.error,
              flightsResult.error,
              itinerariesResult.error,
              hotelsResult.error,
              travelersResult.error,
              agencySettled.status === "rejected" ? agencySettled.reason instanceof Error ? agencySettled.reason.message : "Falha ao buscar branding da agência." : null,
            ].filter((value): value is string => Boolean(value))

            if (typeof navigator !== "undefined" && navigator.onLine === false && sectionErrors.some((error) => isOfflineRecoverableError(error))) {
              const offlineLoaded = await loadOfflinePackage("network")
              if (offlineLoaded) {
                return
              }
            }

            logTripDocumentsDev("query_result", {
              routeSlug,
              tripId: resolvedTrip.id,
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
              name: agencyResult?.name ?? preloadedAgencyName,
              logoUrl: resolveAgencyBrandLogo(
                agencyResult?.linkLogoUrl,
                agencyResult?.logoUrl,
                preloadedAgencyLogo,
              ),
              isAgency: Boolean(resolvedAgencyId),
            })
            if (isAdminRoute) {
              setTripTravelersSource(resolvedTravelers.length > 0 ? "persisted" : "fallback")
            }

            setTripData((prev) =>
              buildTripDataFromStoredTrip({
                id: resolvedTrip.id,
                slug: resolvedTrip.slug,
                name: resolvedTrip.title,
                destination: resolvedTrip.destination,
                agencyId: resolvedAgencyId,
                clientId: resolvedTrip.clientId ?? null,
                country: resolvedTrip.country ?? undefined,
                city: resolvedTrip.city ?? undefined,
                startDate: resolvedTrip.startDate ?? undefined,
                endDate: resolvedTrip.endDate ?? undefined,
                passengersCount: resolvedTrip.travelersCount,
                status: resolvedTrip.status,
                coverImage: resolvedTrip.coverImage ?? undefined,
                adminLink: resolvedTrip.adminLink,
                shareLink: resolvedTrip.publicLink,
                flights: (flightsResult.data ?? []).map((flight) => mapFlightRecordToView(flight, resolvedDocuments)),
                hotel: hotelsResult.data[0]
                  ? {
                      ...hotelsResult.data[0],
                      image: null,
                      amenities: [],
                    }
                  : resolvedTrip.accommodations?.[0] ?? null,
                hotels: hotelsResult.data.map((hotel) => ({
                  ...hotel,
                  image: null,
                  amenities: [],
                })),
                itinerary: simpleItinerary ? mapItineraryContentToLegacyDays(simpleItinerary.content) : resolvedTrip.itinerary,
                documents: resolvedDocuments,
                travelers: isAdminRoute ? mapPersistedTravelersToView(resolvedTravelers) : prev?.travelers,
                travelersCount: resolvedTrip.travelersCount,
              })
            )

            logTripDocumentsDev("post_filter_counts", {
              routeSlug,
              tripId: resolvedTrip.id,
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
            sectionsPerf.end({ tripId: resolvedTrip.id })
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
          const message = repositoryTrip.error || "Viagem não encontrada ou link expirado."
          console.error("[TRIP] erro ao carregar link", message)
          setLoadError("Viagem não encontrada ou link expirado.")
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
          setLoadError("Viagem não encontrada ou link expirado.")
          setIsLoadingTrip(false)
          return
        }
      }

      if (isPublicRoute || isAdminRoute) {
        devLog("trip.notFound", routeSlug)
        setLoadError("Viagem não encontrada ou link expirado.")
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
      setLoadError("Viagem não encontrada ou link expirado.")
      setIsLoadingTrip(false)
    }

    void loadTrip().catch((error) => {
      console.error("[TRIP] loadTrip unhandled error", error)
      if (loadRequestRef.current === requestId) {
        setSectionsLoading({
          flights: false,
          hotels: false,
          itineraries: false,
          documents: false,
        })
        setLoadError("Não foi possível carregar esta viagem offline neste dispositivo.")
        setIsLoadingTrip(false)
      }
    })
  }, [adminRouteActive, params?.id, params?.slug, pathname, searchParamsKey, authLoading, user?.id, profile?.role, profile?.agencyId, sensitiveAccessGranted])

  useEffect(() => {
    if (!isTripLinkRoute || typeof window === "undefined") return

    try {
      const storedTheme = window.localStorage.getItem(TRIP_LINK_THEME_STORAGE_KEY)
      if (storedTheme === "light" || storedTheme === "dark") {
        setTripLinkTheme(storedTheme)
      }
    } catch {
      // Mantém o tema claro quando a persistência local estiver indisponível.
    }
  }, [isTripLinkRoute])

  const handleToggleTripLinkTheme = () => {
    setTripLinkTheme((currentTheme) => {
      const nextTheme: TripLinkTheme = currentTheme === "light" ? "dark" : "light"
      try {
        window.localStorage.setItem(TRIP_LINK_THEME_STORAGE_KEY, nextTheme)
      } catch {
        // A troca continua funcionando mesmo quando o navegador bloqueia o storage.
      }
      return nextTheme
    })
  }

  useEffect(() => {
    if (typeof document === "undefined") return

    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    const ensureNamedMeta = (name: string) => {
      let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!element) {
        element = document.createElement("meta")
        element.setAttribute("name", name)
        document.head.appendChild(element)
      }
      return element
    }
    const viewportMeta = ensureNamedMeta("viewport")
    const appleCapableMeta = ensureNamedMeta("apple-mobile-web-app-capable")
    const appleStatusBarMeta = ensureNamedMeta("apple-mobile-web-app-status-bar-style")
    const previousThemeColor = themeColorMeta?.getAttribute("content")
    const previousViewport = viewportMeta?.getAttribute("content")
    const previousAppleCapable = appleCapableMeta?.getAttribute("content")
    const previousAppleStatusBar = appleStatusBarMeta?.getAttribute("content")
    const previousHtmlBackground = document.documentElement.style.backgroundColor
    const previousBodyBackground = document.body.style.backgroundColor
    const previousBodyColor = document.body.style.color

    if (isTripLinkRoute) {
      const backgroundColor = tripLinkTheme === "dark" ? "#07101a" : "#f4f0e8"
      const foregroundColor = tripLinkTheme === "dark" ? "#f7f4ef" : "#10203a"

      themeColorMeta?.setAttribute("content", backgroundColor)
      viewportMeta?.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover")
      appleCapableMeta?.setAttribute("content", "yes")
      appleStatusBarMeta?.setAttribute("content", tripLinkTheme === "dark" ? "black-translucent" : "default")
      document.documentElement.setAttribute("data-trip-public-theme", tripLinkTheme)
      document.body.setAttribute("data-trip-public-theme", tripLinkTheme)
      document.documentElement.setAttribute("data-trip-link-theme", tripLinkTheme)
      document.body.setAttribute("data-trip-link-theme", tripLinkTheme)
      document.documentElement.style.backgroundColor = backgroundColor
      document.body.style.backgroundColor = backgroundColor
      document.body.style.color = foregroundColor
    } else {
      document.documentElement.removeAttribute("data-trip-public-theme")
      document.body.removeAttribute("data-trip-public-theme")
      document.documentElement.removeAttribute("data-trip-link-theme")
      document.body.removeAttribute("data-trip-link-theme")
    }

    return () => {
      if (themeColorMeta && previousThemeColor) {
        themeColorMeta.setAttribute("content", previousThemeColor)
      }
      if (viewportMeta) {
        viewportMeta.setAttribute("content", previousViewport || "width=device-width, initial-scale=1")
      }
      if (appleCapableMeta) {
        appleCapableMeta.setAttribute("content", previousAppleCapable || "yes")
      }
      if (appleStatusBarMeta) {
        appleStatusBarMeta.setAttribute("content", previousAppleStatusBar || "default")
      }
      document.documentElement.removeAttribute("data-trip-public-theme")
      document.body.removeAttribute("data-trip-public-theme")
      document.documentElement.removeAttribute("data-trip-link-theme")
      document.body.removeAttribute("data-trip-link-theme")
      document.documentElement.style.backgroundColor = previousHtmlBackground
      document.body.style.backgroundColor = previousBodyBackground
      document.body.style.color = previousBodyColor
    }
  }, [isTripLinkRoute, tripLinkTheme])

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type })
  }

  const blockOfflineMutation = () => {
    if (!offlineModeEnabled) return false
    showToast("Indisponível offline.", "info")
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
      error: response.ok ? null : data?.error || "Não foi possível concluir a ação administrativa.",
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
      error: response.ok ? null : data?.error || "Não foi possível concluir o upload administrativo.",
    }
  }

  const applyPersistedTravelers = (travelers: PersistedTravelerPayload[], source: "fallback" | "persisted" = "persisted") => {
    const nextTravelers = mapPersistedTravelersToView(travelers)
    setTripTravelersSource(source)
    setTripData((prev: any) => ({
      ...prev,
      travelers: nextTravelers.length > 0 ? nextTravelers : source === "fallback" ? buildTravelers(prev?.travelersCount) : [],
      travelersCount: nextTravelers.length > 0 ? nextTravelers.length : source === "fallback" ? prev?.travelersCount ?? 0 : 0,
    }))
  }

  const ensurePersistedTripTravelers = async () => {
    if (!canWrite || !shouldUseSupabase()) {
      return true
    }

    if (tripTravelersSource === "persisted" || resolveTripTravelersCount(tripData) === 0) {
      return true
    }

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void ensurePersistedTripTravelers() })
      return false
    }

    setTravelersLoading(true)
    try {
      const result = await callTripAdminApi<{ travelers?: PersistedTravelerPayload[] }>({
        action: "ensureTravelersPersisted",
        travelersCount: resolveTripTravelersCount(tripData),
      })

      if (result.error) {
        showToast(resolveProtectedWriteError(result.error || "Não foi possível preparar os viajantes desta viagem."), "error")
        return false
      }

      applyPersistedTravelers(Array.isArray(result.data?.travelers) ? result.data.travelers : [], "persisted")
      return true
    } finally {
      setTravelersLoading(false)
    }
  }

  const handleRequireAuthenticatedAdmin = () => {
    const target = pathname || `/viagem/${routeSlug}/admin`
    router.replace(`/login?redirect=${encodeURIComponent(target)}`)
  }

  const hasRequiredSensitiveAccess = (accessMode: TripPinApiAccessMode) => {
    if (accessMode === "public" && hasTemporaryClaimAccess) return true
    if (!sensitiveAccessGranted) return false
    if (accessMode === "admin") return canWrite
    return true
  }

  const requireSensitiveAccess = (
    onGranted: () => void,
    accessMode: TripPinApiAccessMode = authenticatedAdminEligible || adminRouteActive ? "admin" : "public",
  ) => {
    if (!tripData.id) {
      showToast("Não foi possível validar a segurança desta viagem.", "error")
      return
    }

    if (hasRequiredSensitiveAccess(accessMode)) {
      onGranted()
      return
    }

    pendingSensitiveActionRef.current = onGranted
    setSecurityAccessMode(accessMode)
    setSecurityModalOpen(true)
  }

  const ensureSensitiveAccess = (
    accessMode: TripPinApiAccessMode = authenticatedAdminEligible || adminRouteActive ? "admin" : "public",
  ) => {
    if (!tripData.id) {
      showToast("Não foi possível validar a segurança desta viagem.", "error")
      return false
    }

    if (!hasRequiredSensitiveAccess(accessMode)) {
      setSecurityAccessMode(accessMode)
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
    const scrollToSection = () => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth" })
    }

    if (section === "documents" || section === "flights" || section === "hotel" || section === "concierge") {
      requireSensitiveAccess(scrollToSection)
      return
    }

    if (section === "credits") {
      if (isAgencyTrip) return
      setCreditsOpen(true)
    } else {
      scrollToSection()
    }
  }

  const handleOpenTravelerPanel = (panel: Exclude<TravelerPublicPanel, null> | "more" | "home") => {
    if (panel === "home") {
      setTravelerPanel(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    if (panel === "more") {
      setMenuOpen(true)
      return
    }

    if (panel === "documents" || panel === "flights" || panel === "hotel" || panel === "concierge") {
      requireSensitiveAccess(() => setTravelerPanel(panel))
      return
    }

    setTravelerPanel(panel)
  }

  const handleUpdateTrip = async (data: any) => {
    if (blockOfflineMutation()) return false
    if (!ensureSensitiveAccess()) return false
    if (!tripData.id) {
      showToast("Viagem não encontrada para atualizar.", "error")
      return false
    }

    const payload = {
      destination: data.destination,
      country: data.country,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: data.status,
    }

    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ trip?: { destination?: string | null; country?: string | null; startDate?: string | null; endDate?: string | null; status?: string | null } }>({
          action: "updateTrip",
          ...payload,
        })
      : await updateTripRepository(tripData.id, payload)

    const savedTrip = adminLinkMutationMode ? result.data?.trip ?? null : result.data
    const saveError = adminLinkMutationMode ? result.error : result.error

    if (saveError || !savedTrip) {
      showToast(resolveProtectedWriteError(saveError || "Não foi possível atualizar a viagem."), "error")
      return false
    }

    setTripData((prev: any) =>
      normalizeTripViewData({
        ...prev,
        destination: savedTrip.destination ?? payload.destination,
        country: savedTrip.country ?? payload.country,
        startDate: savedTrip.startDate ?? payload.startDate,
        endDate: savedTrip.endDate ?? payload.endDate,
        status: savedTrip.status ?? payload.status,
      }),
    )
    showToast("Viagem atualizada!", "success")
    return true
  }

  const handleUpdateFlight = async (id: string, data: any) => {
    if (blockOfflineMutation()) return false
    if (!ensureSensitiveAccess()) return false
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
      showToast(resolveProtectedWriteError(result.error || "Não foi possível atualizar a passagem."), "error")
      return false
    }

    setTripData(prev => ({
      ...prev,
      flights: prev.flights.map((flight: any) =>
        flight.id === id ? mapFlightRecordToView(nextFlight, prev.documents) : flight
      )
    }))
    return true
  }

  const mergeFlightPayloadIntoTripData = (data: any) => {
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

  const handleAddFlight = (data: any) => {
    if (blockOfflineMutation()) return
    if (!ensureSensitiveAccess()) return
    mergeFlightPayloadIntoTripData(data)
  }

  const startFlightExtractionPolling = (payload: { flightId: string; documentId: string }) => {
    if (!shouldUseSupabase() || offlineModeEnabled || !tripData.id) {
      return
    }

    const pollingKey = `${payload.flightId}:${payload.documentId}`
    const existingTimer = flightPollingTimersRef.current.get(pollingKey)
    if (existingTimer) {
      window.clearTimeout(existingTimer)
      flightPollingTimersRef.current.delete(pollingKey)
    }

    let attempts = 0
    const maxAttempts = 24

    const poll = async () => {
      attempts += 1

      let latestDocuments: any[] = []
      let latestFlightRecord: TripFlightRecord | null = null
      let pollingErrored = false

      if (adminLinkMutationMode) {
        const adminResponse = await fetch(`/api/trip-admin?tripId=${encodeURIComponent(tripData.id)}&tripSlug=${encodeURIComponent(routeSlug)}${tripAdminToken ? `&adminToken=${encodeURIComponent(tripAdminToken)}` : ""}`)
        const adminData = await adminResponse.json().catch(() => null)

        if (!adminResponse.ok) {
          pollingErrored = true
        } else {
          latestDocuments = Array.isArray(adminData?.documents) ? adminData.documents : []
          latestFlightRecord = (Array.isArray(adminData?.flights) ? adminData?.flights : []).find((entry) => entry.id === payload.flightId) ?? null
        }
      } else {
        const [flightsResult, documentsResult] = await Promise.all([
          isAdmin ? listTripFlights(tripData.id) : listPublicTripFlights(tripData.id),
          isAdmin ? listDocumentsByTrip(tripData.id) : listPublicTripDocuments(tripData.id),
        ])

        if (flightsResult.error || documentsResult.error) {
          pollingErrored = true
        } else {
          latestDocuments = Array.isArray(documentsResult.data) ? documentsResult.data : []
          latestFlightRecord = (Array.isArray(flightsResult.data) ? flightsResult.data : []).find((entry) => entry.id === payload.flightId) ?? null
        }
      }

      if (!pollingErrored) {
        const latestDocument = latestDocuments.find((entry: any) => entry.id === payload.documentId) ?? null

        if (latestFlightRecord || latestDocument) {
          mergeFlightPayloadIntoTripData({
            document: latestDocument,
            flight: latestFlightRecord ? mapFlightRecordToView(latestFlightRecord, latestDocuments) : null,
          })
        }

        const extractionStatus = latestFlightRecord?.extractionStatus ?? null
        const hasExtractedFlightData = hasMeaningfulFlightExtraction(latestFlightRecord)
        if (extractionStatus === "completed" || extractionStatus === "manual" || extractionStatus === "failed") {
          flightPollingTimersRef.current.delete(pollingKey)
          if (extractionStatus === "manual" && !hasExtractedFlightData) {
            showToast("Alguns dados não foram identificados. Revise a passagem manualmente.", "info")
          }
          if (extractionStatus === "failed" && !hasExtractedFlightData) {
            showToast("Não foi possível identificar esta passagem.", "info")
          }
          return
        }
      }

      if (attempts >= maxAttempts) {
        flightPollingTimersRef.current.delete(pollingKey)
        showToast("A análise da passagem ainda está terminando. Atualize novamente em instantes.", "info")
        return
      }

      const nextTimer = window.setTimeout(() => {
        void poll()
      }, 2500)
      flightPollingTimersRef.current.set(pollingKey, nextTimer)
    }

    void poll()
  }

  const handleSaveHotel = async (data: any) => {
    if (blockOfflineMutation()) return false
    console.log(data?.id ? "[HOTEL] update started" : "[HOTEL] create started")

    if (!tripData.id) {
      showToast("Viagem não encontrada para salvar a hospedagem.", "error")
      return false
    }

    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleSaveHotel(data) })
      return false
    }

    const hotelPayload = {
      name: data.name,
      address: data.address,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      confirmationCode: data.confirmationCode,
      notes: data.notes,
    }
    const isEditingHotel = Boolean(data?.id)

    const result = adminLinkMutationMode
      ? await callTripAdminApi<{ hotel?: any }>({
          action: "saveHotel",
          hotelId: data?.id ?? null,
          ...hotelPayload,
        })
      : data?.id
        ? await updateTripHotel(data.id, {
            ...hotelPayload,
          })
        : await createTripHotel({
            tripId: tripData.id,
            ...hotelPayload,
          })

    let savedHotel = adminLinkMutationMode ? result.data?.hotel ?? null : result.data
    if (result.error || !savedHotel) {
      console.error("[HOTEL] error", result.error)
      showToast(resolveProtectedWriteError(result.error || "Não foi possível salvar a hospedagem."), "error")
      return false
    }

    if (!data?.id) {
      data.id = savedHotel.id
    }

    let linkedDocument: any = null
    const voucherFile = data?.voucherFile instanceof File ? data.voucherFile : null

    if (voucherFile) {
      const voucherName = `Voucher - ${String(data.name || "Hospedagem").trim()}`
      const uploadResult = adminLinkMutationMode
        ? await callTripAdminUploadApi<{ document?: any }>("uploadDocument", voucherFile, {
            name: voucherName,
            type: "voucher",
            isPrivate: "false",
            visibility: "public_trip",
          })
        : await (async () => {
            if (!tripOwnerUserId) {
              return { ok: false, data: null, error: "Entre com login para anexar o voucher desta hospedagem." }
            }

            const resolvedMimeType = resolveDocumentMimeType(voucherFile)
            const path = `${tripOwnerUserId}/${tripData.id}/hotel-vouchers/${Date.now()}-${voucherFile.name.replace(/\s+/g, "-")}`
            const uploadedFile = await uploadDocumentFile(voucherFile, path)
            if (uploadedFile.error || !uploadedFile.data) {
              return { ok: false, data: null, error: resolveProtectedWriteError(uploadedFile.error || "Não foi possível anexar o voucher.") }
            }

            const metadataResult = await createDocumentMetadata({
              tripId: tripData.id,
              clientId: null,
              agencyId: profile?.agencyId ?? null,
              ownerUserId: tripOwnerUserId,
              name: voucherName,
              type: "voucher",
              filePath: uploadedFile.data.path,
              fileUrl: uploadedFile.data.fileUrl,
              mimeType: resolvedMimeType,
              size: voucherFile.size,
              isPrivate: false,
              visibility: "public_trip",
              aiExtractedData: {},
            })

            return {
              ok: !metadataResult.error && Boolean(metadataResult.data),
              data: metadataResult.data ? { document: metadataResult.data } : null,
              error: metadataResult.error ? resolveProtectedWriteError(metadataResult.error) : null,
            }
          })()

      linkedDocument = uploadResult.data?.document ?? null
      if (!uploadResult.ok || !linkedDocument) {
        console.error("[HOTEL] voucher upload error", uploadResult.error)
        showToast(uploadResult.error || "Não foi possível anexar o voucher da hospedagem.", "error")
        return false
      }

      const hotelWithVoucherResult = adminLinkMutationMode
        ? await callTripAdminApi<{ hotel?: any }>({
            action: "saveHotel",
            hotelId: savedHotel.id,
            documentId: linkedDocument.id,
            ...hotelPayload,
          })
        : await updateTripHotel(savedHotel.id, {
            ...hotelPayload,
            documentId: linkedDocument.id,
          })

      const hotelWithVoucher = adminLinkMutationMode ? hotelWithVoucherResult.data?.hotel ?? null : hotelWithVoucherResult.data
      if (hotelWithVoucherResult.error || !hotelWithVoucher) {
        console.error("[HOTEL] voucher link error", hotelWithVoucherResult.error)
        showToast(resolveProtectedWriteError(hotelWithVoucherResult.error || "Não foi possível vincular o voucher da hospedagem."), "error")
        return false
      }

      savedHotel = hotelWithVoucher
      data.voucherFile = null
    }

    console.log("[HOTEL] success", savedHotel.id)
    setTripData(prev => ({
      ...prev,
      documents: linkedDocument
        ? [linkedDocument, ...(Array.isArray(prev.documents) ? prev.documents.filter((entry: any) => entry.id !== linkedDocument.id) : [])]
        : prev.documents,
      hotels: isEditingHotel
        ? (Array.isArray(prev.hotels) ? prev.hotels : []).map((hotel: any) =>
            hotel.id === savedHotel.id
              ? { ...hotel, ...savedHotel, image: hotel.image ?? null, amenities: hotel.amenities || [] }
              : hotel,
          )
        : [
            ...(Array.isArray(prev.hotels) ? prev.hotels : []),
            {
              ...savedHotel,
              image: null,
              amenities: [],
            },
          ],
      hotel:
        isEditingHotel
          ? ((Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === savedHotel.id)
              ? { ...(Array.isArray(prev.hotels) ? prev.hotels : []).find((hotel: any) => hotel.id === savedHotel.id), ...savedHotel, image: null, amenities: [] }
              : { ...savedHotel, image: null, amenities: [] })
          : (prev.hotel ?? { ...savedHotel, image: null, amenities: [] }),
    }))
    showToast("Hospedagem salva com sucesso.", "success")
    return true
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
      showToast(resolveProtectedWriteError(result.error || "Não foi possível excluir a hospedagem."), "error")
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
      showToast(resolveProtectedWriteError(result.error || "Não foi possível salvar o roteiro simples."), "error")
      return
    }

    syncTripItineraryRecord(nextItineraryRecord)
    showToast("Roteiro simples salvo com sucesso.", "success")
  }

  const handleGenerateItinerary = async (mode: "simple" | "complete_pdf") => {
    if (blockOfflineMutation()) return

    const travelerTrip = !isAgencyTrip && !profile?.agencyId
    const premiumLocked =
      travelerTrip &&
      ((mode === "simple" && !travelerPlan.definition.limits.simpleItinerary) ||
        (mode === "complete_pdf" && !travelerPlan.definition.limits.completeItineraryPdf))

    if (premiumLocked) {
      setPremiumGateModalOpen(true)
      return
    }

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
      showToast(resolveProtectedWriteError(result.error || result.data?.error || `Não foi possível gerar o ${label}.`), "error")
      return
    }

    const nextItinerary = result.data.itinerary as TripItineraryRecord
    if (mode === "complete_pdf" && nextItinerary.status === "completed" && !nextItinerary.documentId && !result.data.document) {
      console.error("[ITINERARY] complete pdf missing document", nextItinerary)
      showToast("O roteiro foi marcado como concluído, mas nenhum documento válido foi retornado pelo backend.", "error")
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
        showToast(resolveProtectedWriteError(deleteResult.error || "Não foi possível excluir o roteiro."), "error")
        return
      }
    } else {
      if (linkedDocument?.filePath) {
        const storageResult = await deleteDocumentFile(linkedDocument.filePath)
        if (!storageResult.success) {
          console.error("[ITINERARY] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Não foi possível remover o arquivo do storage."
        }
      }

      const itineraryResult = await deleteTripItinerary(record.id)
      if (!itineraryResult.success) {
        console.error("[ITINERARY] delete error", itineraryResult.error)
        showToast(resolveProtectedWriteError(itineraryResult.error || "Não foi possível excluir o roteiro."), "error")
        return
      }

      if (linkedDocument?.id) {
        const documentResult = await deleteDocument(linkedDocument.id)
        if (!documentResult.success) {
          console.error("[ITINERARY] linked document delete error", documentResult.error)
          showToast(resolveProtectedWriteError(documentResult.error || "O roteiro foi removido, mas o documento vinculado não foi excluído."), "error")
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

    showToast(storageWarning ? `Roteiro excluído. Aviso do storage: ${storageWarning}` : "Roteiro excluído com sucesso.", storageWarning ? "info" : "success")
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
      showToast("Passagem não encontrada para exclusão.", "error")
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
        showToast(resolveProtectedWriteError(deleteResult.error || "Não foi possível excluir a passagem."), "error")
        return
      }
    } else {
      if (flight.document?.filePath) {
        const storageResult = await deleteDocumentFile(flight.document.filePath)
        if (!storageResult.success) {
          console.error("[TICKET] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Não foi possível remover o arquivo do storage."
        }
      }

      const flightResult = await deleteTripFlight(flightId)
      if (!flightResult.success) {
        console.error("[TICKET] flight delete error", flightResult.error)
        showToast(resolveProtectedWriteError(flightResult.error || "Não foi possível excluir a passagem."), "error")
        return
      }

      if (flight.document?.id) {
        const documentResult = await deleteDocument(flight.document.id)
        if (!documentResult.success) {
          console.error("[TICKET] document delete error", documentResult.error)
          showToast(resolveProtectedWriteError(documentResult.error || "A passagem foi removida, mas o documento vinculado não foi excluído."), "error")
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

    showToast(storageWarning ? `Passagem excluída. Aviso do storage: ${storageWarning}` : "Passagem excluída com sucesso.", storageWarning ? "info" : "success")
  }

  const handleDeleteDocument = async (documentId: string) => {
    if (blockOfflineMutation()) return
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleDeleteDocument(documentId) })
      return
    }

    const document = (Array.isArray(tripData.documents) ? tripData.documents : []).find((entry: any) => entry.id === documentId)
    if (!document) {
      showToast("Arquivo não encontrado para exclusão.", "error")
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
        showToast(resolveProtectedWriteError(deleteResult.error || "Não foi possível excluir o arquivo."), "error")
        return
      }
    } else {
      if (document.filePath) {
        const storageResult = await deleteDocumentFile(document.filePath)
        if (!storageResult.success) {
          console.error("[DOCUMENT] storage delete error", storageResult.error)
          storageWarning = storageResult.error || "Não foi possível remover o arquivo do storage."
        }
      }

      if (linkedFlight) {
        const flightResult = await deleteTripFlight(linkedFlight.id)
        if (!flightResult.success) {
          console.error("[DOCUMENT] linked flight delete error", flightResult.error)
          showToast(resolveProtectedWriteError(flightResult.error || "Não foi possível excluir a passagem vinculada."), "error")
          return
        }
      }

      const documentResult = await deleteDocument(documentId)
      if (!documentResult.success) {
        console.error("[DOCUMENT] delete error", documentResult.error)
        showToast(resolveProtectedWriteError(documentResult.error || "Não foi possível excluir o arquivo."), "error")
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

    showToast(storageWarning ? `Arquivo excluído. Aviso do storage: ${storageWarning}` : "Arquivo excluído com sucesso.", storageWarning ? "info" : "success")
  }

  const handleOpenTravelers = async () => {
    if (canWrite) {
      const ready = await ensurePersistedTripTravelers()
      if (!ready) return
    }

    setTravelersOpen(true)
  }

  const handleAddTraveler = async (payload: { name: string; role: "principal" | "acompanhante" }) => {
    if (blockOfflineMutation()) return false
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleOpenTravelers() })
      return false
    }
    if (!canWrite) {
      showToast("Este modo de viagem ainda não permite salvar viajantes reais.", "info")
      return false
    }

    setTravelersLoading(true)
    try {
      const result = await callTripAdminApi<{ travelers?: PersistedTravelerPayload[] }>({
        action: "createTraveler",
        name: payload.name,
        role: payload.role === "principal" ? "primary" : "companion",
        travelersCount: resolveTripTravelersCount(tripData),
      })

      if (result.error) {
        showToast(resolveProtectedWriteError(result.error || "Não foi possível adicionar o viajante."), "error")
        return false
      }

      applyPersistedTravelers(Array.isArray(result.data?.travelers) ? result.data.travelers : [], "persisted")
      return true
    } finally {
      setTravelersLoading(false)
    }
  }

  const handleEditTraveler = async (travelerId: string, payload: { name: string; role: "principal" | "acompanhante" }) => {
    if (blockOfflineMutation()) return false
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleOpenTravelers() })
      return false
    }
    if (!canWrite) {
      showToast("Este modo de viagem ainda não permite salvar viajantes reais.", "info")
      return false
    }

    if (!travelerId?.trim()) {
      showToast("Não foi possível identificar este viajante para edição.", "error")
      return false
    }

    setTravelersLoading(true)
    try {
      const result = await callTripAdminApi<{ travelers?: PersistedTravelerPayload[] }>({
        action: "updateTraveler",
        travelerId,
        name: payload.name,
        role: payload.role === "principal" ? "primary" : "companion",
      })

      if (result.error) {
        showToast(resolveProtectedWriteError(result.error || "Não foi possível atualizar o viajante."), "error")
        return false
      }

      applyPersistedTravelers(Array.isArray(result.data?.travelers) ? result.data.travelers : [], "persisted")
      return true
    } finally {
      setTravelersLoading(false)
    }
  }

  const handleRemoveTraveler = async (travelerId: string) => {
    if (blockOfflineMutation()) return false
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleOpenTravelers() })
      return false
    }
    if (!canWrite) {
      showToast("Este modo de viagem ainda não permite salvar viajantes reais.", "info")
      return false
    }

    if (!travelerId?.trim()) {
      showToast("Não foi possível identificar este viajante para exclusão.", "error")
      return false
    }

    const confirmed = window.confirm("Excluir este viajante?")
    if (!confirmed) return false

    setTravelersLoading(true)
    try {
      const result = await callTripAdminApi<{ travelers?: PersistedTravelerPayload[] }>({
        action: "deleteTraveler",
        travelerId,
      })

      if (result.error) {
        showToast(resolveProtectedWriteError(result.error || "Não foi possível remover o viajante."), "error")
        return false
      }

      applyPersistedTravelers(Array.isArray(result.data?.travelers) ? result.data.travelers : [], "persisted")
      return true
    } finally {
      setTravelersLoading(false)
    }
  }

  const handleSetPrimaryTraveler = async (travelerId: string) => {
    if (blockOfflineMutation()) return false
    if (!sensitiveAccessGranted) {
      requireSensitiveAccess(() => { void handleOpenTravelers() })
      return false
    }
    if (!canWrite) {
      showToast("Este modo de viagem ainda não permite salvar viajantes reais.", "info")
      return false
    }

    if (!travelerId?.trim()) {
      showToast("Não foi possível identificar este viajante principal.", "error")
      return false
    }

    setTravelersLoading(true)
    try {
      const result = await callTripAdminApi<{ travelers?: PersistedTravelerPayload[] }>({
        action: "setPrimaryTraveler",
        travelerId,
      })

      if (result.error) {
        showToast(resolveProtectedWriteError(result.error || "Não foi possível definir o viajante principal."), "error")
        return false
      }

      applyPersistedTravelers(Array.isArray(result.data?.travelers) ? result.data.travelers : [], "persisted")
      return true
    } finally {
      setTravelersLoading(false)
    }
  }

  const handleSaveTripSettings = (data: { privacy: string; permissions: string; status: string; preferences: string }) => {
    if (blockOfflineMutation()) return
    requireSensitiveAccess(() => {
      setTripData(prev => ({ ...prev, status: data.status, tripPreferences: data }))
      setTripSettingsOpen(false)
      showToast("Configurações da viagem atualizadas.", "success")
    })
  }

  if (adminRouteActive && !sensitiveAccessGranted) {
    return (
      <main className="trip-link-page flex min-h-screen items-center justify-center px-4" data-theme={tripLinkTheme}>
        <TripLinkThemeStyles />
        <PortalPinUnlockModal
          open
          onClose={handleDismissAdminUnlockModal}
          tripId={tripData.id}
          tripSlug={routeSlug}
          adminToken={tripAdminToken}
          publicToken={tripPublicToken}
          accessMode="admin"
          title="Desbloquear viagem"
          configuredDescription="Digite o PIN de 4 dígitos para acessar e editar esta viagem."
          tone={tripLinkTheme}
          onSuccess={(status) => {
            if (status?.adminToken) {
              setTripAdminToken(status.adminToken)
            }
            setSensitiveAccessGranted(true)
            setIsAdmin(true)
            setCanWrite(true)
            setAdminLinkMutationMode(true)
            const pendingAction = pendingSensitiveActionRef.current
            pendingSensitiveActionRef.current = null
            setToast({ message: "Acesso liberado para esta viagem.", type: "success" })
            pendingAction?.()
          }}
          onLogin={handleRequireAuthenticatedAdmin}
        />
      </main>
    )
  }

  if (isLoadingTrip) {
    return (
      <main className={cn("min-h-screen flex items-center justify-center px-4", isTripLinkRoute ? "bg-[#f4f1ea] text-slate-900" : "bg-black text-white")}>
        <div className={cn("rounded-3xl px-6 py-5 text-sm", isTripLinkRoute ? "border border-slate-200 bg-white/92 text-slate-500 shadow-[0_24px_60px_rgba(148,163,184,0.16)]" : "border border-white/[0.06] bg-white/[0.02] text-white/60")}>
          Carregando viagem...
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className={cn("min-h-screen flex items-center justify-center px-4", isTripLinkRoute ? "bg-[#f4f1ea] text-slate-900" : "bg-black text-white")}>
        <div className={cn("max-w-md rounded-3xl p-8 text-center", isTripLinkRoute ? "border border-slate-200 bg-white/92 shadow-[0_24px_60px_rgba(148,163,184,0.16)]" : "border border-white/[0.06] bg-white/[0.02]")}>
          <div className={cn("mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl", isTripLinkRoute ? "bg-[#eef4ff]" : "bg-white/[0.04]")}>
            <AlertCircle className="h-6 w-6 text-[#5de0e6]" />
          </div>
          <h1 className={cn("text-xl font-semibold", isTripLinkRoute ? "text-slate-950" : "text-white")}>{loadError}</h1>
          <p className={cn("mt-3 text-sm", isTripLinkRoute ? "text-slate-500" : "text-white/50")}>
            {loadError === "Você não tem permissão para editar esta viagem."
              ? "Entre com a conta proprietária da viagem para acessar o modo administrador."
              : "Confira se o link está correto ou peça um novo compartilhamento."}
          </p>
        </div>
      </main>
    )
  }

  if (!adminRouteActive) {
    return (
        <PermissionContext.Provider value={{ isAdmin, canWrite, setIsAdmin }}>
          <ToastContext.Provider value={{ showToast }}>
            <main className="trip-link-page min-h-screen" data-theme={tripLinkTheme}>
              <TripLinkThemeStyles />
            {hasTemporaryClaimAccess && !temporaryClaimNoticeDismissed && !tripOwnerUserId ? (
              <div className="px-4 pt-4 sm:px-6">
                <div className="trip-claim-notice mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-[#0b56d8]/10 bg-[#f8fbff] p-4 shadow-[0_18px_40px_-28px_rgba(16,26,44,0.35)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">Rascunho privado neste navegador.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Entre ou crie sua conta para vincular o rascunho à Bolsa e ativar a viagem. Nenhum Link é consumido antes da ativação.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <Button
                      size="sm"
                      className="h-10 rounded-full bg-[#0f172a] px-4 text-white hover:bg-[#111f35]"
                      onClick={() => router.push(`/signup?redirect=${encodeURIComponent("/")}`)}
                    >
                      Criar conta para ativar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-full border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
                      onClick={() => router.push(`/login?redirect=${encodeURIComponent("/")}`)}
                    >
                      Entrar para ativar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-10 rounded-full px-4 text-slate-600 hover:text-slate-950"
                      onClick={() => setTemporaryClaimNoticeDismissed(true)}
                    >
                      Agora não
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            {hasTemporaryClaimAccess && !temporaryClaimNoticeDismissed && !tripOwnerUserId && false ? (
              <div className="px-4 pt-4 sm:px-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 rounded-[28px] border border-[#0b56d8]/10 bg-[#f8fbff] p-5 shadow-[0_18px_40px_-28px_rgba(16,26,44,0.35)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-950">Você já pode usar e compartilhar este link.</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Crie seu acesso para proteger documentos, editar em outros dispositivos e configurar um PIN de segurança.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
                    <Button
                      size="sm"
                      className="rounded-full bg-[#0f172a] px-5 text-white hover:bg-[#111f35]"
                      onClick={() => router.push(`/signup?redirect=${encodeURIComponent("/portal")}`)}
                    >
                      Criar acesso e proteger viagem
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full px-5 text-slate-600 hover:text-slate-950"
                      onClick={() => setTemporaryClaimNoticeDismissed(true)}
                    >
                      Agora não
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            <TravelerPublicShell
              tripData={tripData}
              itineraryRecords={tripItineraryRecords}
              agencyBranding={agencyBranding}
              offlineModeEnabled={offlineModeEnabled}
              offlinePackageStatus={offlinePackageStatus}
              theme={tripLinkTheme}
              onToggleTheme={handleToggleTripLinkTheme}
              canShare={!hasTemporaryClaimAccess}
              onOpenShare={() => setShareOpen(true)}
              onOpenMenu={() => setMenuOpen(true)}
              onOpenPanel={handleOpenTravelerPanel}
            />

            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "flights"} onClose={() => setTravelerPanel(null)} title="Passagens">
              {travelerPanel === "flights" ? (
                <FlightsSection
                  loading={sectionsLoading.flights}
                  tripData={tripData}
                  onUpdateFlight={handleUpdateFlight}
                  onAddFlight={handleAddFlight}
                  onDeleteFlight={handleDeleteFlight}
                  onDeleteDocument={handleDeleteDocument}
                  tripId={tripData.id}
                  ownerUserId={tripOwnerUserId}
                  agencyId={profile?.agencyId ?? null}
                  routeSlug={routeSlug}
                  tripAdminToken={tripAdminToken}
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onTrackExtraction={startFlightExtractionPolling}
                  offlineReadOnly={offlineModeEnabled}
                  offlineDocumentContext={offlineDocumentContext}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "hotel"} onClose={() => setTravelerPanel(null)} title="Hospedagem">
              {travelerPanel === "hotel" ? <HotelSection loading={sectionsLoading.hotels} tripData={tripData} onSaveHotel={handleSaveHotel} onDeleteHotel={handleDeleteHotel} routeSlug={routeSlug} tripAdminToken={tripAdminToken} tripPublicToken={tripPublicToken} /> : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "itinerary"} onClose={() => setTravelerPanel(null)} title="Roteiro">
              {travelerPanel === "itinerary" ? (
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
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onUpdateItinerary={handleUpdateItinerary}
                  onGenerateSimple={() => handleGenerateItinerary("simple")}
                  onGenerateComplete={() => handleGenerateItinerary("complete_pdf")}
                  onSaveUploadedItinerary={handleSaveUploadedItinerary}
                  onDeleteItinerary={handleDeleteItinerary}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "documents"} onClose={() => setTravelerPanel(null)} title="Documentos">
              {travelerPanel === "documents" ? (
                <DocumentsSection
                  loading={sectionsLoading.documents}
                  tripData={tripData}
                  onAddDocument={handleAddDocument}
                  onDeleteDocument={handleDeleteDocument}
                  tripId={tripData.id}
                  ownerUserId={tripOwnerUserId}
                  agencyId={profile?.agencyId ?? null}
                  routeSlug={routeSlug}
                  tripAdminToken={tripAdminToken}
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onSensitiveAccessGranted={() => setSensitiveAccessGranted(true)}
                  offlineReadOnly={offlineModeEnabled}
                  offlineDocumentContext={offlineDocumentContext}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "concierge"} onClose={() => setTravelerPanel(null)} title="Concierge">
              {travelerPanel === "concierge" ? (
                <ConciergeSection
                  tripData={tripData}
                  onOpenCredits={() => {
                    if (isAgencyTrip) return
                    setCreditsOpen(true)
                  }}
                  showCredits={!isAgencyTrip}
                  creditsBalance={travelerCredits?.balance ?? null}
                  offlineReadOnly={offlineModeEnabled}
                  tripSlug={routeSlug}
                  adminToken={tripAdminToken}
                  publicToken={tripPublicToken}
                  accessMode="public"
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "offline"} onClose={() => setTravelerPanel(null)} title="Offline">
              {travelerPanel === "offline" ? (
                <OfflineSection
                  tripData={tripData}
                  tripItineraryRecords={tripItineraryRecords}
                  isAdmin={isAdmin}
                  sensitiveAccessGranted={sensitiveAccessGranted}
                  agencyBranding={agencyBranding}
                  routeSlug={routeSlug}
                  currentPathname={pathname || `/viagem/${routeSlug}`}
                />
              ) : null}
            </BottomSheet>

            <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} tripData={tripData} />
            <PortalPinUnlockModal
              open={securityModalOpen}
              onClose={handleCloseSensitiveAccessModal}
              tripId={tripData.id}
              tripSlug={routeSlug}
              adminToken={tripAdminToken}
              publicToken={tripPublicToken}
              accessMode={securityAccessMode}
              title="Desbloquear viagem"
              configuredDescription="Digite o PIN de 4 dígitos para acessar e editar esta viagem."
              tone={tripLinkTheme}
              onSuccess={(status) => {
                if (status?.adminToken) {
                  setTripAdminToken(status.adminToken)
                }
                setSensitiveAccessGranted(true)
                if (securityAccessMode === "admin" && (authenticatedAdminEligible || adminRouteActive)) {
                  setIsAdmin(true)
                  setCanWrite(true)
                  setAdminLinkMutationMode(Boolean(adminRouteActive && (status?.adminToken ?? tripAdminToken)))
                }
                setSecurityModalOpen(false)
                const pendingAction = pendingSensitiveActionRef.current
                pendingSensitiveActionRef.current = null
                setToast({ message: "Acesso liberado", type: "success" })
                pendingAction?.()
              }}
              onLogin={handleRequireAuthenticatedAdmin}
            />
            <MenuModal
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              publicView
              tone={tripLinkTheme}
              showCredits={!isAgencyTrip}
              onOpenTravelers={() => {
                setMenuOpen(false)
                void handleOpenTravelers()
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
                if (isAgencyTrip) return
                setCreditsOpen(true)
              }}
            />
            <EditTripModal open={editTripOpen} onClose={() => setEditTripOpen(false)} tripData={tripData} onSave={handleUpdateTrip} />
            <TravelersModal
              open={travelersOpen}
              onClose={() => setTravelersOpen(false)}
              travelers={Array.isArray(tripData.travelers) ? tripData.travelers : []}
              loading={travelersLoading}
              onAddTraveler={handleAddTraveler}
              onUpdateTraveler={handleEditTraveler}
              onRemoveTraveler={handleRemoveTraveler}
              onSetPrimaryTraveler={handleSetPrimaryTraveler}
            />
            <TripSettingsModal open={tripSettingsOpen} onClose={() => setTripSettingsOpen(false)} tripData={tripData} onSave={handleSaveTripSettings} />
            <LinkSecurityInfoModal open={securitySettingsOpen} onClose={() => setSecuritySettingsOpen(false)} tripId={tripData.id} tripSlug={routeSlug} adminToken={tripAdminToken} publicToken={tripPublicToken} accessMode={authenticatedAdminEligible ? "admin" : "public"} />
            {!isAgencyTrip ? <TravelerPublicCreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} credits={travelerCredits} tone={tripLinkTheme} /> : null}
            <Modal open={premiumGateModalOpen} onClose={() => setPremiumGateModalOpen(false)} title="Disponível no Premium">
              <div className="space-y-5">
                <p className="text-sm text-white/60">
                  Assine o Premium para gerar roteiros inteligentes, criar viagens ilimitadas e receber créditos mensais inclusos.
                </p>
                <Button
                  className="w-full rounded-2xl border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                  onClick={() => {
                    setPremiumGateModalOpen(false)
                    router.push("/portal/planos")
                  }}
                >
                  Conhecer Premium
                </Button>
              </div>
            </Modal>

            <AnimatePresence>
              {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>
          </main>
        </ToastContext.Provider>
      </PermissionContext.Provider>
    )
  }

  if (adminRouteActive) {
    return (
      <PermissionContext.Provider value={{ isAdmin, canWrite, setIsAdmin }}>
        <ToastContext.Provider value={{ showToast }}>
          <main className="trip-link-page min-h-screen" data-theme={tripLinkTheme}>
            <TripLinkThemeStyles />
            <TravelerPublicShell
              tripData={tripData}
              itineraryRecords={tripItineraryRecords}
              agencyBranding={agencyBranding}
              offlineModeEnabled={offlineModeEnabled}
              offlinePackageStatus={offlinePackageStatus}
              theme={tripLinkTheme}
              onToggleTheme={handleToggleTripLinkTheme}
              onOpenShare={() => setShareOpen(true)}
              onOpenMenu={() => setMenuOpen(true)}
              onOpenPanel={handleOpenTravelerPanel}
            />

            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "flights"} onClose={() => setTravelerPanel(null)} title="Passagens">
              {travelerPanel === "flights" ? (
                <FlightsSection
                  loading={sectionsLoading.flights}
                  tripData={tripData}
                  onUpdateFlight={handleUpdateFlight}
                  onAddFlight={handleAddFlight}
                  onDeleteFlight={handleDeleteFlight}
                  onDeleteDocument={handleDeleteDocument}
                  tripId={tripData.id}
                  ownerUserId={tripOwnerUserId}
                  agencyId={profile?.agencyId ?? null}
                  routeSlug={routeSlug}
                  tripAdminToken={tripAdminToken}
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onTrackExtraction={startFlightExtractionPolling}
                  offlineReadOnly={offlineModeEnabled}
                  offlineDocumentContext={offlineDocumentContext}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "hotel"} onClose={() => setTravelerPanel(null)} title="Hospedagem">
              {travelerPanel === "hotel" ? <HotelSection loading={sectionsLoading.hotels} tripData={tripData} onSaveHotel={handleSaveHotel} onDeleteHotel={handleDeleteHotel} routeSlug={routeSlug} tripAdminToken={tripAdminToken} tripPublicToken={tripPublicToken} /> : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "itinerary"} onClose={() => setTravelerPanel(null)} title="Roteiro">
              {travelerPanel === "itinerary" ? (
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
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onUpdateItinerary={handleUpdateItinerary}
                  onGenerateSimple={() => handleGenerateItinerary("simple")}
                  onGenerateComplete={() => handleGenerateItinerary("complete_pdf")}
                  onSaveUploadedItinerary={handleSaveUploadedItinerary}
                  onDeleteItinerary={handleDeleteItinerary}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "documents"} onClose={() => setTravelerPanel(null)} title="Documentos">
              {travelerPanel === "documents" ? (
                <DocumentsSection
                  loading={sectionsLoading.documents}
                  tripData={tripData}
                  onAddDocument={handleAddDocument}
                  onDeleteDocument={handleDeleteDocument}
                  tripId={tripData.id}
                  ownerUserId={tripOwnerUserId}
                  agencyId={profile?.agencyId ?? null}
                  routeSlug={routeSlug}
                  tripAdminToken={tripAdminToken}
                  tripPublicToken={tripPublicToken}
                  adminLinkMutationMode={adminLinkMutationMode}
                  ensureSensitiveAccess={ensureSensitiveAccess}
                  onSensitiveAccessGranted={() => setSensitiveAccessGranted(true)}
                  offlineReadOnly={offlineModeEnabled}
                  offlineDocumentContext={offlineDocumentContext}
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "concierge"} onClose={() => setTravelerPanel(null)} title="Concierge">
              {travelerPanel === "concierge" ? (
                <ConciergeSection
                  tripData={tripData}
                  onOpenCredits={() => {
                    if (isAgencyTrip) return
                    setCreditsOpen(true)
                  }}
                  showCredits={!isAgencyTrip}
                  creditsBalance={travelerCredits?.balance ?? null}
                  offlineReadOnly={offlineModeEnabled}
                  tripSlug={routeSlug}
                  adminToken={tripAdminToken}
                  publicToken={tripPublicToken}
                  accessMode="admin"
                />
              ) : null}
            </BottomSheet>
            <BottomSheet tone={tripLinkTheme} open={travelerPanel === "offline"} onClose={() => setTravelerPanel(null)} title="Offline">
              {travelerPanel === "offline" ? (
                <OfflineSection
                  tripData={tripData}
                  tripItineraryRecords={tripItineraryRecords}
                  isAdmin={isAdmin}
                  sensitiveAccessGranted={sensitiveAccessGranted}
                  agencyBranding={agencyBranding}
                  routeSlug={routeSlug}
                  currentPathname={pathname || `/viagem/${routeSlug}/admin`}
                />
              ) : null}
            </BottomSheet>

            <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} tripData={tripData} />
            <PortalPinUnlockModal
              open={securityModalOpen}
              onClose={handleCloseSensitiveAccessModal}
              tripId={tripData.id}
              tripSlug={routeSlug}
              adminToken={tripAdminToken}
              publicToken={tripPublicToken}
              accessMode="admin"
              title="Desbloquear viagem"
              configuredDescription="Digite o PIN de 4 dígitos para acessar e editar esta viagem."
              tone={tripLinkTheme}
              onSuccess={(status) => {
                if (status?.adminToken) {
                  setTripAdminToken(status.adminToken)
                }
                setSensitiveAccessGranted(true)
                setSecurityModalOpen(false)
                const pendingAction = pendingSensitiveActionRef.current
                pendingSensitiveActionRef.current = null
                setToast({ message: "Acesso liberado", type: "success" })
                pendingAction?.()
              }}
              onLogin={handleRequireAuthenticatedAdmin}
            />
            <MenuModal
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              publicView
              tone={tripLinkTheme}
              showCredits={!isAgencyTrip}
              onOpenEditTrip={() => {
                setMenuOpen(false)
                setEditTripOpen(true)
              }}
              onOpenShare={() => {
                setMenuOpen(false)
                setShareOpen(true)
              }}
              onOpenOffline={() => {
                setMenuOpen(false)
                setTravelerPanel("offline")
              }}
              onOpenTravelers={() => {
                setMenuOpen(false)
                void handleOpenTravelers()
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
                if (isAgencyTrip) return
                setCreditsOpen(true)
              }}
            />
            <EditTripModal open={editTripOpen} onClose={() => setEditTripOpen(false)} tripData={tripData} onSave={handleUpdateTrip} />
            <TravelersModal
              open={travelersOpen}
              onClose={() => setTravelersOpen(false)}
              travelers={Array.isArray(tripData.travelers) ? tripData.travelers : []}
              loading={travelersLoading}
              onAddTraveler={handleAddTraveler}
              onUpdateTraveler={handleEditTraveler}
              onRemoveTraveler={handleRemoveTraveler}
              onSetPrimaryTraveler={handleSetPrimaryTraveler}
            />
            <TripSettingsModal open={tripSettingsOpen} onClose={() => setTripSettingsOpen(false)} tripData={tripData} onSave={handleSaveTripSettings} />
            <LinkSecurityInfoModal open={securitySettingsOpen} onClose={() => setSecuritySettingsOpen(false)} tripId={tripData.id} tripSlug={routeSlug} adminToken={tripAdminToken} publicToken={tripPublicToken} accessMode="admin" />
            {!isAgencyTrip ? <LinkCreditsSummaryModal open={creditsOpen} onClose={() => setCreditsOpen(false)} credits={travelerCredits} tone={tripLinkTheme} /> : null}
            <Modal open={premiumGateModalOpen} onClose={() => setPremiumGateModalOpen(false)} title="Disponível no Premium">
              <div className="space-y-5">
                <p className="text-sm text-slate-600">
                  Assine o Premium para gerar roteiros inteligentes, criar viagens ilimitadas e receber créditos mensais inclusos.
                </p>
                <Button
                  className="w-full rounded-2xl border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                  onClick={() => {
                    setPremiumGateModalOpen(false)
                    router.push("/portal/planos")
                  }}
                >
                  Conhecer Premium
                </Button>
              </div>
            </Modal>

            <AnimatePresence>
              {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            </AnimatePresence>
          </main>
        </ToastContext.Provider>
      </PermissionContext.Provider>
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
          <QuickAccessCards tripData={tripData} itineraryRecords={tripItineraryRecords} onNavigate={handleNavigate} />
          <FlightsSection loading={sectionsLoading.flights} tripData={tripData} onUpdateFlight={handleUpdateFlight} onAddFlight={handleAddFlight} onDeleteFlight={handleDeleteFlight} onDeleteDocument={handleDeleteDocument} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} routeSlug={routeSlug} tripAdminToken={tripAdminToken} tripPublicToken={tripPublicToken} adminLinkMutationMode={adminLinkMutationMode} ensureSensitiveAccess={ensureSensitiveAccess} onTrackExtraction={startFlightExtractionPolling} offlineReadOnly={offlineModeEnabled} offlineDocumentContext={offlineDocumentContext} />
          <HotelSection loading={sectionsLoading.hotels} tripData={tripData} onSaveHotel={handleSaveHotel} onDeleteHotel={handleDeleteHotel} routeSlug={routeSlug} tripAdminToken={tripAdminToken} tripPublicToken={tripPublicToken} />
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
            tripPublicToken={tripPublicToken}
            adminLinkMutationMode={adminLinkMutationMode}
            ensureSensitiveAccess={ensureSensitiveAccess}
            onUpdateItinerary={handleUpdateItinerary}
            onGenerateSimple={() => handleGenerateItinerary("simple")}
            onGenerateComplete={() => handleGenerateItinerary("complete_pdf")}
            onSaveUploadedItinerary={handleSaveUploadedItinerary}
            onDeleteItinerary={handleDeleteItinerary}
          />
          <DocumentsSection loading={sectionsLoading.documents} tripData={tripData} onAddDocument={handleAddDocument} onDeleteDocument={handleDeleteDocument} tripId={tripData.id} ownerUserId={tripOwnerUserId} agencyId={profile?.agencyId ?? null} routeSlug={routeSlug} tripAdminToken={tripAdminToken} tripPublicToken={tripPublicToken} adminLinkMutationMode={adminLinkMutationMode} ensureSensitiveAccess={ensureSensitiveAccess} onSensitiveAccessGranted={() => setSensitiveAccessGranted(true)} offlineReadOnly={offlineModeEnabled} offlineDocumentContext={offlineDocumentContext} />
          <ConciergeSection
            tripData={tripData}
            onOpenCredits={() => {
              if (isAgencyTrip) return
              setCreditsOpen(true)
            }}
            showCredits={!isAgencyTrip}
            creditsBalance={travelerCredits?.balance ?? null}
            offlineReadOnly={offlineModeEnabled}
            tripSlug={routeSlug}
            adminToken={tripAdminToken}
            publicToken={tripPublicToken}
            accessMode={adminRouteActive ? "admin" : "public"}
          />
          <OfflineSection tripData={tripData} tripItineraryRecords={tripItineraryRecords} isAdmin={isAdmin} sensitiveAccessGranted={sensitiveAccessGranted} agencyBranding={agencyBranding} routeSlug={routeSlug} currentPathname={pathname || `/viagem/${routeSlug}`} />
          <QuickInfoSection tripData={tripData} />
          <TripFooter agencyBranding={agencyBranding} />

          <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} tripData={tripData} />
          <PortalPinUnlockModal
            open={securityModalOpen}
            onClose={handleCloseSensitiveAccessModal}
            tripId={tripData.id}
            tripSlug={routeSlug}
            adminToken={tripAdminToken}
            publicToken={tripPublicToken}
            accessMode={adminRouteActive ? "admin" : "public"}
            title="Desbloquear viagem"
            configuredDescription="Digite o PIN de 4 dígitos para acessar e editar esta viagem."
            onSuccess={() => {
              setSensitiveAccessGranted(true)
              setSecurityModalOpen(false)
              const pendingAction = pendingSensitiveActionRef.current
              pendingSensitiveActionRef.current = null
              setToast({ message: "Acesso liberado para áreas protegidas.", type: "success" })
              pendingAction?.()
            }}
            onLogin={handleRequireAuthenticatedAdmin}
          />
          <MenuModal
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            showCredits={!isAgencyTrip}
            onOpenTravelers={() => {
              setMenuOpen(false)
              void handleOpenTravelers()
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
              if (isAgencyTrip) return
              setCreditsOpen(true)
            }}
          />
          <EditTripModal open={editTripOpen} onClose={() => setEditTripOpen(false)} tripData={tripData} onSave={handleUpdateTrip} />
          <TravelersModal
            open={travelersOpen}
            onClose={() => setTravelersOpen(false)}
            travelers={Array.isArray(tripData.travelers) ? tripData.travelers : []}
            loading={travelersLoading}
            onAddTraveler={handleAddTraveler}
            onUpdateTraveler={handleEditTraveler}
            onRemoveTraveler={handleRemoveTraveler}
            onSetPrimaryTraveler={handleSetPrimaryTraveler}
          />
          <TripSettingsModal open={tripSettingsOpen} onClose={() => setTripSettingsOpen(false)} tripData={tripData} onSave={handleSaveTripSettings} />
          <LinkSecurityInfoModal open={securitySettingsOpen} onClose={() => setSecuritySettingsOpen(false)} tripId={tripData.id} tripSlug={routeSlug} adminToken={tripAdminToken} publicToken={tripPublicToken} accessMode={canWrite || adminRouteActive || authenticatedAdminEligible ? "admin" : "public"} />
          {!isAgencyTrip ? <LinkCreditsSummaryModal open={creditsOpen} onClose={() => setCreditsOpen(false)} credits={travelerCredits} /> : null}
          <Modal open={premiumGateModalOpen} onClose={() => setPremiumGateModalOpen(false)} title="Disponível no Premium">
            <div className="space-y-5">
              <p className="text-sm text-white/60">
                Assine o Premium para gerar roteiros inteligentes, criar viagens ilimitadas e receber créditos mensais inclusos.
              </p>
              <Button
                className="w-full rounded-2xl border-0 bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white"
                onClick={() => {
                  setPremiumGateModalOpen(false)
                  router.push("/portal/planos")
                }}
              >
                Conhecer Premium
              </Button>
            </div>
          </Modal>

          <AnimatePresence>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </AnimatePresence>
        </main>
      </ToastContext.Provider>
    </PermissionContext.Provider>
  )
}
