import {
  buildLegacyOfflineItems,
  getOfflineWarningMessage as getIndexedDbOfflineWarningMessage,
  persistOfflineTripPackage,
} from "@/lib/offline/offline-package-manager"
import type { OfflinePackagePersistenceResult, OfflineTripPackage, OfflineTripPackageItem } from "@/lib/offline/types"

const OFFLINE_STORAGE_KEY = "vuei_offline_trips"
const OFFLINE_WARNING = getIndexedDbOfflineWarningMessage()

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

function buildLegacyPackage(tripData: any, overrides?: Partial<OfflineTripPackage>): OfflineTripPackage {
  return {
    tripId: tripData?.id || `trip-${Date.now()}`,
    tripSlug: tripData?.slug ?? null,
    tripName: tripData?.destination || tripData?.title || "Viagem",
    savedAt: overrides?.savedAt ?? new Date().toISOString(),
    warning: overrides?.warning ?? OFFLINE_WARNING,
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
    items: overrides?.items ?? buildLegacyOfflineItems(tripData),
  }
}

function toLegacyItemsFromPersistence(tripData: any, result: OfflinePackagePersistenceResult): OfflineTripPackageItem[] {
  const storedPayload = result.packageRecord.payload
  const documents = Array.isArray(storedPayload.documents) ? storedPayload.documents : []
  const flights = Array.isArray(storedPayload.flights) ? storedPayload.flights : []
  const hotels = Array.isArray(storedPayload.hotels) ? storedPayload.hotels : []
  const itineraries = Array.isArray(storedPayload.itineraries) ? storedPayload.itineraries : []

  return buildLegacyOfflineItems({
    ...tripData,
    documents: documents.filter((document: any) => result.savedDocumentIds.includes(document?.id)),
    flights,
    hotels,
    itinerary: itineraries,
    quickInfo: storedPayload.quickInfo,
  })
}

export async function saveTripOfflinePackage(tripData: any, options?: { allowPrivateDocuments?: boolean }) {
  const savedAt = new Date().toISOString()
  const legacyPackage = buildLegacyPackage(tripData, { savedAt })
  const packages = readPackages()
  writePackages([legacyPackage, ...packages.filter((item) => item.tripId !== legacyPackage.tripId)])

  let persisted: OfflinePackagePersistenceResult | null = null

  try {
    persisted = await persistOfflineTripPackage({
      tripData,
      allowPrivateDocuments: options?.allowPrivateDocuments === true,
    })
  } catch (error) {
    writePackages(packages)
    console.error("[OFFLINE] package persistence error", error)
    throw error
  }

  const failureCount = persisted.failures.length
  const warning =
    failureCount > 0
      ? persisted.limitReached
        ? "Pacote offline salvo parcialmente. Alguns arquivos ficaram de fora por limite de 50 MB."
        : "Pacote offline salvo parcialmente. Alguns arquivos nao puderam ser baixados neste dispositivo."
      : OFFLINE_WARNING

  const nextPackage: OfflineTripPackage = {
    ...legacyPackage,
    savedAt: persisted.packageRecord.savedAt,
    warning,
    items: toLegacyItemsFromPersistence(tripData, persisted),
  }

  writePackages([nextPackage, ...packages.filter((item) => item.tripId !== nextPackage.tripId)])

  return {
    legacyPackage: nextPackage,
    persisted,
    warning,
    message:
      failureCount > 0
        ? persisted.limitReached
          ? "Viagem salva offline com restricoes. Alguns arquivos nao entraram por limite de 50 MB."
          : "Viagem salva offline com restricoes. Alguns arquivos nao puderam ser baixados."
        : "Viagem salva offline neste dispositivo.",
  }
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
