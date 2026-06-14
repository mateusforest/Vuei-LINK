import {
  buildLegacyOfflineItems,
  getOfflineWarningMessage as getIndexedDbOfflineWarningMessage,
  persistOfflineTripPackage,
} from "@/lib/offline/offline-package-manager"
import type { OfflinePackagePersistenceResult, OfflineTripPackage, OfflineTripPackageAudience, OfflineTripPackageItem } from "@/lib/offline/types"

const OFFLINE_STORAGE_KEY = "vuei_offline_trips"
const OFFLINE_WARNING = getIndexedDbOfflineWarningMessage()
const OFFLINE_SHELL_CACHE_PREFIX = "vuei-shell"
const OFFLINE_SHELL_CACHE_VERSION = "20260614b"
const OFFLINE_SHELL_CACHE_NAME = `${OFFLINE_SHELL_CACHE_PREFIX}-${OFFLINE_SHELL_CACHE_VERSION}`

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

function sanitizeLegacySnapshotDocuments(_documents: any[], _audience: OfflineTripPackageAudience) {
  return [] as any[]
}

function buildLegacyPackage(tripData: any, overrides?: Partial<OfflineTripPackage>): OfflineTripPackage {
  const audience = overrides?.audience ?? "public"

  return {
    tripId: tripData?.id || `trip-${Date.now()}`,
    tripSlug: tripData?.slug ?? null,
    tripName: tripData?.destination || tripData?.title || "Viagem",
    savedAt: overrides?.savedAt ?? new Date().toISOString(),
    warning: overrides?.warning ?? OFFLINE_WARNING,
    audience,
    status: overrides?.status,
    totalSizeBytes: overrides?.totalSizeBytes,
    documentCount: overrides?.documentCount,
    imageCount: overrides?.imageCount,
    snapshot: {
      destination: tripData?.destination,
      country: tripData?.country,
      dates: tripData?.dates,
      travelers: tripData?.travelers,
      flights: tripData?.flights,
      hotels: tripData?.hotels ?? (tripData?.hotel ? [tripData.hotel] : []),
      documents: sanitizeLegacySnapshotDocuments(tripData?.documents ?? [], audience),
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

export async function saveTripOfflinePackage(tripData: any, options?: { allowPrivateDocuments?: boolean; audience?: OfflineTripPackageAudience }) {
  const packages = readPackages()
  const audience = options?.audience ?? "public"

  let persisted: OfflinePackagePersistenceResult | null = null

  try {
    persisted = await persistOfflineTripPackage({
      tripData,
      audience,
      allowPrivateDocuments: options?.allowPrivateDocuments === true,
    })
  } catch (error) {
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
    ...buildLegacyPackage(tripData, {
      savedAt: persisted.packageRecord.savedAt,
      warning,
      audience: persisted.packageRecord.audience,
      status: persisted.packageRecord.status,
      totalSizeBytes: persisted.packageRecord.totalSizeBytes,
      documentCount: persisted.packageRecord.documentCount,
      imageCount: persisted.packageRecord.imageCount,
    }),
    savedAt: persisted.packageRecord.savedAt,
    warning,
    status: persisted.packageRecord.status,
    totalSizeBytes: persisted.packageRecord.totalSizeBytes,
    documentCount: persisted.packageRecord.documentCount,
    imageCount: persisted.packageRecord.imageCount,
    items: toLegacyItemsFromPersistence(tripData, persisted),
  }

  writePackages([
    nextPackage,
    ...packages.filter((item) => !(item.tripId === nextPackage.tripId && (item.audience ?? "public") === nextPackage.audience)),
  ])

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

export async function prepareTripRoutesForOffline(input: {
  slug: string
  currentPathname: string
  includeAdminRoute?: boolean
}) {
  const preparedPaths: string[] = []
  const skippedPaths: string[] = []

  if (typeof window === "undefined" || typeof caches === "undefined" || !("serviceWorker" in navigator)) {
    return {
      preparedPaths,
      skippedPaths: [input.currentPathname],
      controllerReady: false,
      registrationActive: false,
    }
  }

  let registration: ServiceWorkerRegistration | null = null

  try {
    registration = await navigator.serviceWorker.ready
  } catch (error) {
    console.error("[OFFLINE] service worker ready error", error)
  }

  const registrationActive = Boolean(registration?.active)
  const controllerReady = Boolean(navigator.serviceWorker.controller)
  const cache = await caches.open(OFFLINE_SHELL_CACHE_NAME)
  const paths = new Set<string>([
    input.currentPathname,
    `/v/${input.slug}`,
    `/viagem/${input.slug}`,
  ])

  if (input.includeAdminRoute || input.currentPathname.endsWith("/admin")) {
    paths.add(`/viagem/${input.slug}/admin`)
  }

  for (const path of paths) {
    try {
      const response = await fetch(path, {
        credentials: "same-origin",
        cache: "reload",
        headers: {
          Accept: "text/html",
        },
      })

      if (!response.ok) {
        skippedPaths.push(path)
        continue
      }

      await cache.put(path, response.clone())
      preparedPaths.push(path)
    } catch (error) {
      console.error("[OFFLINE] route prepare error", path, error)
      skippedPaths.push(path)
    }
  }

  return {
    preparedPaths,
    skippedPaths,
    controllerReady,
    registrationActive,
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
