export type OfflineTripPackageStatus = "ready" | "partial" | "legacy_snapshot"
export type OfflineTripPackageAudience = "public" | "restricted_public" | "admin"

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
  audience?: OfflineTripPackageAudience
  status?: OfflineTripPackageStatus
  totalSizeBytes?: number
  documentCount?: number
  imageCount?: number
  snapshot: Record<string, unknown>
  items: OfflineTripPackageItem[]
}

export interface OfflineTripPayload {
  trip: Record<string, unknown>
  travelers: unknown[]
  hotels: unknown[]
  flights: unknown[]
  itineraries: unknown[]
  documents: unknown[]
  quickInfo: Record<string, unknown> | null
  offlineMeta?: {
    sizeLimitBytes: number
    savedDocumentIds: string[]
    savedImageIds: string[]
    failures: Array<{
      assetId: string
      assetType: "document" | "image"
      reason: string
    }>
  } | null
}

export interface OfflineStoredTripPackage {
  packageKey: string
  tripId: string
  slug: string | null
  audience: OfflineTripPackageAudience
  savedAt: string
  version: number
  status: OfflineTripPackageStatus
  destination: string | null
  country: string | null
  totalSizeBytes: number
  documentCount: number
  imageCount: number
  lastValidatedAt: string
  payload: OfflineTripPayload
}

export interface OfflineDocumentBlobRecord {
  documentId: string
  tripId: string
  mimeType: string | null
  fileName: string | null
  blob: Blob
  sizeBytes: number
  savedAt: string
}

export interface OfflineImageBlobRecord {
  imageId: string
  tripId: string
  blob: Blob
  sizeBytes: number
  savedAt: string
}

export interface OfflineTripStats {
  tripId: string | null
  packageCount: number
  totalSizeBytes: number
  documentCount: number
  imageCount: number
  savedAt: string | null
}

export interface OfflinePackagePersistenceResult {
  packageRecord: OfflineStoredTripPackage
  savedDocumentIds: string[]
  savedImageIds: string[]
  failures: Array<{
    assetId: string
    assetType: "document" | "image"
    reason: string
  }>
  limitReached: boolean
}
