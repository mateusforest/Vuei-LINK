export interface OfflineTripPackageItem {
  id: string
  name: string
  type: "summary" | "flight" | "hotel" | "document" | "itinerary" | "quick_info"
  sizeLabel: string
  saved: boolean
}

export interface OfflineTripPackage {
  tripId: string
  tripSlug?: string | null
  tripName: string
  savedAt: string
  warning: string
  snapshot: Record<string, unknown>
  items: OfflineTripPackageItem[]
}

const OFFLINE_STORAGE_KEY = "vuei_offline_trips"
const OFFLINE_WARNING = "Voce esta vendo uma versao salva offline. Algumas informacoes podem estar desatualizadas."

function safeStringifySize(value: unknown) {
  const json = JSON.stringify(value ?? {})
  const bytes = new Blob([json]).size
  const sizeMb = bytes / (1024 * 1024)
  return sizeMb >= 0.1 ? `${sizeMb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function buildOfflineItems(tripData: any): OfflineTripPackageItem[] {
  const hotels = Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const documents = Array.isArray(tripData?.documents) ? tripData.documents : []
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []

  return [
    { id: "summary", name: "Resumo da viagem", type: "summary", sizeLabel: safeStringifySize({ destination: tripData?.destination, dates: tripData?.dates, travelers: tripData?.travelers }), saved: true },
    { id: "flight", name: "Passagens extraidas", type: "flight", sizeLabel: safeStringifySize(flights), saved: flights.length > 0 },
    { id: "hotel", name: "Hospedagem", type: "hotel", sizeLabel: safeStringifySize(hotels), saved: hotels.length > 0 },
    { id: "itinerary", name: "Roteiro", type: "itinerary", sizeLabel: safeStringifySize(itinerary), saved: itinerary.length > 0 },
    { id: "quick_info", name: "Informacoes rapidas", type: "quick_info", sizeLabel: safeStringifySize(tripData?.quickInfo), saved: Boolean(tripData?.quickInfo) },
    { id: "document", name: "Documentos cacheados", type: "document", sizeLabel: safeStringifySize(documents), saved: documents.length > 0 },
  ]
}

function readPackages() {
  if (typeof window === "undefined") return [] as OfflineTripPackage[]

  try {
    const raw = window.localStorage.getItem(OFFLINE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OfflineTripPackage[]) : []
  } catch {
    return []
  }
}

function writePackages(packages: OfflineTripPackage[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(packages))
}

export function saveTripOfflinePackage(tripData: any) {
  const nextPackage: OfflineTripPackage = {
    tripId: tripData?.id || `trip-${Date.now()}`,
    tripSlug: tripData?.slug ?? null,
    tripName: tripData?.destination || tripData?.title || "Viagem",
    savedAt: new Date().toISOString(),
    warning: OFFLINE_WARNING,
    snapshot: {
      destination: tripData?.destination,
      country: tripData?.country,
      dates: tripData?.dates,
      travelers: tripData?.travelers,
      flights: tripData?.flights,
      hotels: tripData?.hotels ?? (tripData?.hotel ? [tripData.hotel] : []),
      documents: tripData?.documents,
      itinerary: tripData?.itinerary,
      quickInfo: tripData?.quickInfo,
    },
    items: buildOfflineItems(tripData),
  }

  const packages = readPackages()
  const nextPackages = [nextPackage, ...packages.filter((item) => item.tripId !== nextPackage.tripId)]
  writePackages(nextPackages)
  return nextPackage
}

export function listOfflineTripPackages() {
  return readPackages()
}

export function getOfflineTripPackage(tripIdOrSlug: string) {
  return readPackages().find((item) => item.tripId === tripIdOrSlug || item.tripSlug === tripIdOrSlug) ?? null
}

export function getOfflineWarningMessage() {
  return OFFLINE_WARNING
}
