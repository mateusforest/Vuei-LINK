"use client"

import { downloadBlobForOffline } from "@/lib/offline/blob-download"
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
  OfflinePackagePersistenceResult,
  OfflineTripPackageStatus,
  OfflineTripPayload,
  OfflineTripStats,
} from "@/lib/offline/types"
import { getSignedDocumentUrl } from "@/lib/repositories/documents-repository"

const LEGACY_OFFLINE_STORAGE_KEY = "vuei_offline_trips"
const LEGACY_MIGRATION_SESSION_KEY = "vuei_offline_legacy_migration_v1"
const OFFLINE_PACKAGE_VERSION = 1
const OFFLINE_WARNING = "Voce esta vendo uma versao salva offline. Algumas informacoes podem estar desatualizadas."
export const OFFLINE_PACKAGE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024

let legacyMigrationPromise: Promise<{ migrated: number; skipped: number }> | null = null

export interface SaveOfflineTripPackageInput {
  tripData: any
  status?: OfflineTripPackageStatus
}

export interface PersistOfflineTripPackageInput {
  tripData: any
  allowPrivateDocuments?: boolean
  sizeLimitBytes?: number
}

function computeBytes(value: unknown) {
  return new Blob([JSON.stringify(value ?? null)]).size
}

function computeFinalPackageSize(payload: OfflineTripPayload, persistedBlobBytes: number) {
  return computeBytes(payload) + persistedBlobBytes
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
    offlineMeta: null,
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

function buildStoredPackage(
  payload: OfflineTripPayload,
  status: OfflineTripPackageStatus,
  overrides?: Partial<Pick<OfflineStoredTripPackage, "savedAt" | "totalSizeBytes" | "documentCount" | "imageCount" | "lastValidatedAt">>,
): OfflineStoredTripPackage {
  const { tripId, slug, destination, country } = getPackageIdentity(payload)
  const documents = Array.isArray(payload.documents) ? payload.documents : []
  const savedAt = overrides?.savedAt ?? new Date().toISOString()
  const lastValidatedAt = overrides?.lastValidatedAt ?? savedAt

  return {
    tripId,
    slug,
    savedAt,
    version: OFFLINE_PACKAGE_VERSION,
    status,
    destination,
    country,
    totalSizeBytes: overrides?.totalSizeBytes ?? computeBytes(payload),
    documentCount: overrides?.documentCount ?? documents.length,
    imageCount: overrides?.imageCount ?? 0,
    lastValidatedAt,
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

async function deleteObsoleteTripBlobs(params: { tripId: string; documentIds: string[]; imageIds: string[] }) {
  const [documentBlobs, imageBlobs] = await Promise.all([
    getOfflineRecordsByIndex(DOCUMENT_BLOBS_STORE, "tripId", params.tripId),
    getOfflineRecordsByIndex(IMAGE_BLOBS_STORE, "tripId", params.tripId),
  ])

  const validDocumentIds = new Set(params.documentIds)
  const validImageIds = new Set(params.imageIds)

  for (const documentBlob of documentBlobs) {
    if (!validDocumentIds.has(documentBlob.documentId)) {
      await deleteOfflineRecord(DOCUMENT_BLOBS_STORE, documentBlob.documentId)
    }
  }

  for (const imageBlob of imageBlobs) {
    if (!validImageIds.has(imageBlob.imageId)) {
      await deleteOfflineRecord(IMAGE_BLOBS_STORE, imageBlob.imageId)
    }
  }
}

function isPrivateDocument(document: any) {
  return document?.private === true || document?.isPrivate === true || document?.is_private === true || document?.visibility === "private"
}

function filterPermittedDocuments(documents: any[], allowPrivateDocuments: boolean) {
  if (allowPrivateDocuments) return documents
  return documents.filter((document) => !isPrivateDocument(document) && document?.visibility !== "agency_only")
}

async function resolveOfflineDocumentUrl(document: any) {
  if (typeof document?.fileUrl === "string" && document.fileUrl) return document.fileUrl
  if (typeof document?.file_url === "string" && document.file_url) return document.file_url

  const filePath =
    typeof document?.filePath === "string"
      ? document.filePath
      : typeof document?.file_path === "string"
        ? document.file_path
        : null

  if (!filePath) {
    throw new Error("Documento sem URL ou caminho de arquivo.")
  }

  const signedUrlResult = await getSignedDocumentUrl(filePath)
  if (signedUrlResult.error || !signedUrlResult.data) {
    throw new Error(signedUrlResult.error || "Nao foi possivel gerar a URL do documento offline.")
  }

  return signedUrlResult.data
}

function normalizeAssetError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return "Falha ao salvar ativo offline."
}

function collectOfflineImages(tripData: any) {
  const assets: Array<{ imageId: string; url: string }> = []

  if (typeof tripData?.heroImage === "string" && tripData.heroImage) {
    assets.push({
      imageId: `hero:${tripData?.id ?? "trip"}`,
      url: tripData.heroImage,
    })
  }

  const brandingLogoUrl =
    typeof tripData?.agencyBranding?.logoUrl === "string"
      ? tripData.agencyBranding.logoUrl
      : typeof tripData?.agencyBranding?.linkLogoUrl === "string"
        ? tripData.agencyBranding.linkLogoUrl
        : null

  if (brandingLogoUrl) {
    assets.push({
      imageId: `branding:${tripData?.id ?? "trip"}`,
      url: brandingLogoUrl,
    })
  }

  return assets.filter((asset, index, list) => list.findIndex((entry) => entry.url === asset.url) === index)
}

export async function persistOfflineTripPackage(input: PersistOfflineTripPackageInput): Promise<OfflinePackagePersistenceResult> {
  const sizeLimitBytes = input.sizeLimitBytes ?? OFFLINE_PACKAGE_SIZE_LIMIT_BYTES
  const basePayload = sanitizeTripPayload(input.tripData)
  const permittedDocuments = filterPermittedDocuments(Array.isArray(input.tripData?.documents) ? input.tripData.documents : [], input.allowPrivateDocuments === true)
  const payload: OfflineTripPayload = {
    ...basePayload,
    documents: permittedDocuments.map((document: any) => ({
      id: document?.id ?? null,
      tripId: document?.tripId ?? document?.trip_id ?? basePayload.trip.id ?? null,
      name: document?.name ?? null,
      type: document?.type ?? null,
      mimeType: document?.mimeType ?? document?.mime_type ?? null,
      size: document?.size ?? document?.size_bytes ?? null,
      visibility: document?.visibility ?? null,
      isPrivate: document?.isPrivate ?? document?.is_private ?? document?.private ?? null,
      createdAt: document?.createdAt ?? document?.created_at ?? null,
      updatedAt: document?.updatedAt ?? document?.updated_at ?? null,
      filePath: document?.filePath ?? document?.file_path ?? null,
      fileUrl: document?.fileUrl ?? document?.file_url ?? null,
    })),
  }
  const { tripId } = getPackageIdentity(payload)
  const savedAt = new Date().toISOString()
  const savedDocumentIds: string[] = []
  const savedImageIds: string[] = []
  const failures: OfflinePackagePersistenceResult["failures"] = []
  let persistedBlobBytes = 0
  let limitReached = false

  for (const document of permittedDocuments) {
    const documentId = typeof document?.id === "string" ? document.id : null
    if (!documentId) {
      failures.push({ assetId: "document:unknown", assetType: "document", reason: "Documento sem identificador." })
      continue
    }

    try {
      const documentUrl = await resolveOfflineDocumentUrl(document)
      const downloaded = await downloadBlobForOffline(documentUrl)
      const nextSavedDocumentIds = [...savedDocumentIds, documentId]
      const predictedPayload: OfflineTripPayload = {
        ...payload,
        offlineMeta: {
          sizeLimitBytes,
          savedDocumentIds: nextSavedDocumentIds,
          savedImageIds,
          failures,
        },
      }
      const predictedTotalSize = computeFinalPackageSize(predictedPayload, persistedBlobBytes + downloaded.sizeBytes)

      if (predictedTotalSize > sizeLimitBytes) {
        limitReached = true
        failures.push({ assetId: documentId, assetType: "document", reason: "Limite offline de 50 MB excedido." })
        continue
      }

      await saveOfflineDocumentBlob({
        documentId,
        tripId,
        mimeType: downloaded.mimeType,
        fileName: document?.name ?? null,
        blob: downloaded.blob,
        sizeBytes: downloaded.sizeBytes,
        savedAt,
      })

      persistedBlobBytes += downloaded.sizeBytes
      savedDocumentIds.push(documentId)
    } catch (error) {
      failures.push({ assetId: documentId, assetType: "document", reason: normalizeAssetError(error) })
    }
  }

  for (const asset of collectOfflineImages(input.tripData)) {
    try {
      const downloaded = await downloadBlobForOffline(asset.url)
      const nextSavedImageIds = [...savedImageIds, asset.imageId]
      const predictedPayload: OfflineTripPayload = {
        ...payload,
        offlineMeta: {
          sizeLimitBytes,
          savedDocumentIds,
          savedImageIds: nextSavedImageIds,
          failures,
        },
      }
      const predictedTotalSize = computeFinalPackageSize(predictedPayload, persistedBlobBytes + downloaded.sizeBytes)

      if (predictedTotalSize > sizeLimitBytes) {
        limitReached = true
        failures.push({ assetId: asset.imageId, assetType: "image", reason: "Limite offline de 50 MB excedido." })
        continue
      }

      await saveOfflineImageBlob({
        imageId: asset.imageId,
        tripId,
        blob: downloaded.blob,
        sizeBytes: downloaded.sizeBytes,
        savedAt,
      })

      persistedBlobBytes += downloaded.sizeBytes
      savedImageIds.push(asset.imageId)
    } catch (error) {
      failures.push({ assetId: asset.imageId, assetType: "image", reason: normalizeAssetError(error) })
    }
  }

  payload.offlineMeta = {
    sizeLimitBytes,
    savedDocumentIds,
    savedImageIds,
    failures,
  }
  const totalSizeBytes = computeFinalPackageSize(payload, persistedBlobBytes)

  const packageRecord = buildStoredPackage(payload, failures.length > 0 ? "partial" : "ready", {
    savedAt,
    lastValidatedAt: savedAt,
    totalSizeBytes,
    documentCount: savedDocumentIds.length,
    imageCount: savedImageIds.length,
  })

  await putOfflineRecord(TRIP_PACKAGES_STORE, packageRecord)
  await deleteObsoleteTripBlobs({
    tripId,
    documentIds: savedDocumentIds,
    imageIds: savedImageIds,
  })

  return {
    packageRecord,
    savedDocumentIds,
    savedImageIds,
    failures,
    limitReached,
  }
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

    return {
      tripId: existingPackage.tripId,
      packageCount: 1,
      totalSizeBytes: existingPackage.totalSizeBytes,
      documentCount: existingPackage.documentCount,
      imageCount: existingPackage.imageCount,
      savedAt: existingPackage.savedAt,
    }
  }

  const packages = await getAllOfflineRecords(TRIP_PACKAGES_STORE)

  return {
    tripId: null,
    packageCount: packages.length,
    totalSizeBytes: packages.reduce((total, item) => total + item.totalSizeBytes, 0),
    documentCount: packages.reduce((total, item) => total + item.documentCount, 0),
    imageCount: packages.reduce((total, item) => total + item.imageCount, 0),
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
