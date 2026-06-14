"use client"

import {
  deleteOfflineRecord,
  deleteOfflineRecordsByIndex,
  DOCUMENT_BLOBS_STORE,
  getAllOfflineRecords,
  getOfflineRecord,
  getOfflineRecordsByIndex,
  IMAGE_BLOBS_STORE,
  putOfflineRecord,
  TRIP_PACKAGES_STORE,
} from "@/lib/offline/indexeddb"
import type {
  OfflineDocumentBlobRecord,
  OfflineImageBlobRecord,
  OfflineStoredTripPackage,
  OfflineTripPackage,
  OfflineTripPackageItem,
  OfflineTripPackageStatus,
  OfflineTripPayload,
  OfflineTripStats,
} from "@/lib/offline/types"

const LEGACY_OFFLINE_STORAGE_KEY = "vuei_offline_trips"
const LEGACY_MIGRATION_SESSION_KEY = "vuei_offline_legacy_migration_v1"
const OFFLINE_PACKAGE_VERSION = 1
const OFFLINE_WARNING = "Voce esta vendo uma versao salva offline. Algumas informacoes podem estar desatualizadas."

let legacyMigrationPromise: Promise<{ migrated: number; skipped: number }> | null = null

export interface SaveOfflineTripPackageInput {
  tripData: any
  status?: OfflineTripPackageStatus
}

function computeBytes(value: unknown) {
  return new Blob([JSON.stringify(value ?? null)]).size
}

function formatOfflineSizeLabel(bytes: number) {
  const sizeMb = bytes / (1024 * 1024)
  if (sizeMb >= 0.1) return `${sizeMb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function sanitizeTripPayload(tripData: any): OfflineTripPayload {
  const tripId = typeof tripData?.id === "string" ? tripData.id : `trip-${Date.now()}`
  const slug = typeof tripData?.slug === "string" ? tripData.slug : null
  const travelers = Array.isArray(tripData?.travelers) ? tripData.travelers : []
  const hotels = Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const itineraries = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []
  const documents = Array.isArray(tripData?.documents)
    ? tripData.documents.map((document: any) => ({
        id: document?.id ?? null,
        tripId,
        name: document?.name ?? null,
        type: document?.type ?? null,
        mimeType: document?.mimeType ?? null,
        size: document?.size ?? null,
        visibility: document?.visibility ?? null,
        isPrivate: document?.isPrivate ?? document?.private ?? null,
        createdAt: document?.createdAt ?? null,
        updatedAt: document?.updatedAt ?? null,
      }))
    : []

  return {
    trip: {
      id: tripId,
      slug,
      title: tripData?.title ?? tripData?.destination ?? "Viagem",
      destination: tripData?.destination ?? null,
      country: tripData?.country ?? null,
      city: tripData?.city ?? null,
      status: tripData?.status ?? null,
      dates: tripData?.dates ?? null,
      startDate: tripData?.startDate ?? null,
      endDate: tripData?.endDate ?? null,
      coverImage: tripData?.heroImage ?? tripData?.coverImage ?? null,
      branding: tripData?.agencyBranding ?? null,
    },
    travelers,
    hotels,
    flights,
    itineraries,
    documents,
    quickInfo: tripData?.quickInfo ?? null,
  }
}

function getPackageIdentity(payload: OfflineTripPayload) {
  const trip = payload.trip as Record<string, unknown>
  return {
    tripId: typeof trip.id === "string" ? trip.id : `trip-${Date.now()}`,
    slug: typeof trip.slug === "string" ? trip.slug : null,
    destination: typeof trip.destination === "string" ? trip.destination : null,
    country: typeof trip.country === "string" ? trip.country : null,
  }
}

function buildStoredPackage(payload: OfflineTripPayload, status: OfflineTripPackageStatus): OfflineStoredTripPackage {
  const { tripId, slug, destination, country } = getPackageIdentity(payload)
  const documents = Array.isArray(payload.documents) ? payload.documents : []

  return {
    tripId,
    slug,
    savedAt: new Date().toISOString(),
    version: OFFLINE_PACKAGE_VERSION,
    status,
    destination,
    country,
    totalSizeBytes: computeBytes(payload),
    documentCount: documents.length,
    imageCount: 0,
    lastValidatedAt: new Date().toISOString(),
    payload,
  }
}

function parseLegacyPackages() {
  if (typeof window === "undefined") return [] as OfflineTripPackage[]

  try {
    const raw = window.localStorage.getItem(LEGACY_OFFLINE_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as OfflineTripPackage[]
  } catch {
    return []
  }
}

function shouldSkipLegacyMigration() {
  if (typeof window === "undefined") return false

  try {
    return window.sessionStorage.getItem(LEGACY_MIGRATION_SESSION_KEY) === "done"
  } catch {
    return false
  }
}

function markLegacyMigrationAttempted() {
  if (typeof window === "undefined") return

  try {
    window.sessionStorage.setItem(LEGACY_MIGRATION_SESSION_KEY, "done")
  } catch {
    // Mantem o app estavel mesmo sem sessionStorage.
  }
}

function mapLegacyPackageToPayload(legacyPackage: OfflineTripPackage): OfflineTripPayload {
  const snapshot = (legacyPackage.snapshot ?? {}) as Record<string, unknown>
  return {
    trip: {
      id: legacyPackage.tripId,
      slug: legacyPackage.tripSlug ?? null,
      title: legacyPackage.tripName,
      destination: typeof snapshot.destination === "string" ? snapshot.destination : legacyPackage.tripName,
      country: typeof snapshot.country === "string" ? snapshot.country : null,
      city: null,
      status: null,
      dates: snapshot.dates ?? null,
      startDate: null,
      endDate: null,
      coverImage: null,
      branding: null,
    },
    travelers: Array.isArray(snapshot.travelers) ? snapshot.travelers : [],
    hotels: Array.isArray(snapshot.hotels) ? snapshot.hotels : [],
    flights: Array.isArray(snapshot.flights) ? snapshot.flights : [],
    itineraries: Array.isArray(snapshot.itinerary) ? snapshot.itinerary : [],
    documents: Array.isArray(snapshot.documents) ? snapshot.documents : [],
    quickInfo: snapshot.quickInfo && typeof snapshot.quickInfo === "object" ? (snapshot.quickInfo as Record<string, unknown>) : null,
  }
}

function buildLegacyStoredPackage(legacyPackage: OfflineTripPackage) {
  const payload = mapLegacyPackageToPayload(legacyPackage)
  const storedPackage = buildStoredPackage(payload, "legacy_snapshot")

  return {
    ...storedPackage,
    savedAt: legacyPackage.savedAt || storedPackage.savedAt,
    lastValidatedAt: legacyPackage.savedAt || storedPackage.lastValidatedAt,
    totalSizeBytes: computeBytes(legacyPackage.snapshot ?? {}),
    documentCount: Array.isArray(payload.documents) ? payload.documents.length : 0,
  }
}

async function deleteOfflinePackageByTripId(tripId: string) {
  await deleteOfflineRecord(TRIP_PACKAGES_STORE, tripId)
  await deleteOfflineRecordsByIndex(DOCUMENT_BLOBS_STORE, "tripId", tripId)
  await deleteOfflineRecordsByIndex(IMAGE_BLOBS_STORE, "tripId", tripId)
}

export async function saveTripOfflinePackage(input: SaveOfflineTripPackageInput) {
  const payload = sanitizeTripPayload(input.tripData)
  const storedPackage = buildStoredPackage(payload, input.status ?? "ready")
  await putOfflineRecord(TRIP_PACKAGES_STORE, storedPackage)
  return storedPackage
}

export async function replaceTripOfflinePackage(input: SaveOfflineTripPackageInput) {
  const payload = sanitizeTripPayload(input.tripData)
  const { tripId } = getPackageIdentity(payload)
  await deleteOfflinePackageByTripId(tripId)
  const storedPackage = buildStoredPackage(payload, input.status ?? "ready")
  await putOfflineRecord(TRIP_PACKAGES_STORE, storedPackage)
  return storedPackage
}

export async function loadTripOfflinePackage(tripIdOrSlug: string) {
  const packageById = await getOfflineRecord(TRIP_PACKAGES_STORE, tripIdOrSlug)
  if (packageById) return packageById

  const packagesBySlug = await getOfflineRecordsByIndex(TRIP_PACKAGES_STORE, "slug", tripIdOrSlug)
  return packagesBySlug[0] ?? null
}

export async function deleteTripOfflinePackage(tripIdOrSlug: string) {
  const existingPackage = await loadTripOfflinePackage(tripIdOrSlug)
  if (!existingPackage) return false
  await deleteOfflinePackageByTripId(existingPackage.tripId)
  return true
}

export async function listOfflinePackages() {
  const packages = await getAllOfflineRecords(TRIP_PACKAGES_STORE)
  return packages.sort((left, right) => right.savedAt.localeCompare(left.savedAt))
}

export async function isTripAvailableOffline(tripIdOrSlug: string) {
  const existingPackage = await loadTripOfflinePackage(tripIdOrSlug)
  return Boolean(existingPackage)
}

export async function getTripOfflineStats(tripIdOrSlug?: string): Promise<OfflineTripStats> {
  if (tripIdOrSlug) {
    const existingPackage = await loadTripOfflinePackage(tripIdOrSlug)
    if (!existingPackage) {
      return {
        tripId: null,
        packageCount: 0,
        totalSizeBytes: 0,
        documentCount: 0,
        imageCount: 0,
        savedAt: null,
      }
    }

    const documentBlobs = await getOfflineRecordsByIndex(DOCUMENT_BLOBS_STORE, "tripId", existingPackage.tripId)
    const imageBlobs = await getOfflineRecordsByIndex(IMAGE_BLOBS_STORE, "tripId", existingPackage.tripId)

    return {
      tripId: existingPackage.tripId,
      packageCount: 1,
      totalSizeBytes:
        existingPackage.totalSizeBytes +
        documentBlobs.reduce((total, item) => total + item.sizeBytes, 0) +
        imageBlobs.reduce((total, item) => total + item.sizeBytes, 0),
      documentCount: documentBlobs.length || existingPackage.documentCount,
      imageCount: imageBlobs.length || existingPackage.imageCount,
      savedAt: existingPackage.savedAt,
    }
  }

  const [packages, documentBlobs, imageBlobs] = await Promise.all([
    getAllOfflineRecords(TRIP_PACKAGES_STORE),
    getAllOfflineRecords(DOCUMENT_BLOBS_STORE),
    getAllOfflineRecords(IMAGE_BLOBS_STORE),
  ])

  return {
    tripId: null,
    packageCount: packages.length,
    totalSizeBytes:
      packages.reduce((total, item) => total + item.totalSizeBytes, 0) +
      documentBlobs.reduce((total, item) => total + item.sizeBytes, 0) +
      imageBlobs.reduce((total, item) => total + item.sizeBytes, 0),
    documentCount: documentBlobs.length,
    imageCount: imageBlobs.length,
    savedAt: packages[0]?.savedAt ?? null,
  }
}

export async function clearOrphanBlobs() {
  const [packages, documentBlobs, imageBlobs] = await Promise.all([
    getAllOfflineRecords(TRIP_PACKAGES_STORE),
    getAllOfflineRecords(DOCUMENT_BLOBS_STORE),
    getAllOfflineRecords(IMAGE_BLOBS_STORE),
  ])

  const validTripIds = new Set(packages.map((item) => item.tripId))
  let deletedDocuments = 0
  let deletedImages = 0

  for (const documentBlob of documentBlobs) {
    if (!validTripIds.has(documentBlob.tripId)) {
      await deleteOfflineRecord(DOCUMENT_BLOBS_STORE, documentBlob.documentId)
      deletedDocuments += 1
    }
  }

  for (const imageBlob of imageBlobs) {
    if (!validTripIds.has(imageBlob.tripId)) {
      await deleteOfflineRecord(IMAGE_BLOBS_STORE, imageBlob.imageId)
      deletedImages += 1
    }
  }

  return {
    deletedDocuments,
    deletedImages,
  }
}

export async function migrateLegacyOfflineSnapshot() {
  if (legacyMigrationPromise) {
    return legacyMigrationPromise
  }

  if (shouldSkipLegacyMigration()) {
    return { migrated: 0, skipped: 0 }
  }

  legacyMigrationPromise = (async () => {
    markLegacyMigrationAttempted()

  const legacyPackages = parseLegacyPackages()
  if (legacyPackages.length === 0) {
      return { migrated: 0, skipped: 0 }
  }

  let migrated = 0
  let skipped = 0

  for (const legacyPackage of legacyPackages) {
    if (!legacyPackage?.tripId) {
      skipped += 1
      continue
    }

    const existingPackage = await loadTripOfflinePackage(legacyPackage.tripId)
    if (existingPackage) {
      skipped += 1
      continue
    }

    await putOfflineRecord(TRIP_PACKAGES_STORE, buildLegacyStoredPackage(legacyPackage))
    migrated += 1
  }

    return { migrated, skipped }
  })()

  try {
    return await legacyMigrationPromise
  } finally {
    legacyMigrationPromise = null
  }
}

export async function saveOfflineDocumentBlob(record: OfflineDocumentBlobRecord) {
  await putOfflineRecord(DOCUMENT_BLOBS_STORE, record)
  return record
}

export async function saveOfflineImageBlob(record: OfflineImageBlobRecord) {
  await putOfflineRecord(IMAGE_BLOBS_STORE, record)
  return record
}

export async function listOfflineDocumentBlobs(tripId: string) {
  return getOfflineRecordsByIndex(DOCUMENT_BLOBS_STORE, "tripId", tripId)
}

export async function listOfflineImageBlobs(tripId: string) {
  return getOfflineRecordsByIndex(IMAGE_BLOBS_STORE, "tripId", tripId)
}

export function buildLegacyOfflineItems(tripData: any): OfflineTripPackageItem[] {
  const hotels = Array.isArray(tripData?.hotels) ? tripData.hotels : tripData?.hotel ? [tripData.hotel] : []
  const flights = Array.isArray(tripData?.flights) ? tripData.flights : []
  const documents = Array.isArray(tripData?.documents) ? tripData.documents : []
  const itinerary = Array.isArray(tripData?.itinerary) ? tripData.itinerary : []

  const createItem = (id: OfflineTripPackageItem["id"], name: string, type: OfflineTripPackageItem["type"], value: unknown, saved: boolean) => ({
    id,
    name,
    type,
    sizeLabel: formatOfflineSizeLabel(computeBytes(value)),
    saved,
  })

  return [
    createItem("summary", "Resumo da viagem", "summary", { destination: tripData?.destination, dates: tripData?.dates, travelers: tripData?.travelers }, true),
    createItem("flight", "Passagens extraidas", "flight", flights, flights.length > 0),
    createItem("hotel", "Hospedagem", "hotel", hotels, hotels.length > 0),
    createItem("itinerary", "Roteiro", "itinerary", itinerary, itinerary.length > 0),
    createItem("quick_info", "Informacoes rapidas", "quick_info", tripData?.quickInfo, Boolean(tripData?.quickInfo)),
    createItem("document", "Documentos cacheados", "document", documents, documents.length > 0),
  ]
}

export function getOfflineWarningMessage() {
  return OFFLINE_WARNING
}
