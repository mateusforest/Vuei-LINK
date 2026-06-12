import {
  buildLegacyOfflineItems,
  getOfflineWarningMessage as getIndexedDbOfflineWarningMessage,
  replaceTripOfflinePackage,
} from "@/lib/offline/offline-package-manager"
import type { OfflineTripPackage, OfflineTripPackageItem } from "@/lib/offline/types"

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
    items: buildLegacyOfflineItems(tripData),
  }

  const packages = readPackages()
  const nextPackages = [nextPackage, ...packages.filter((item) => item.tripId !== nextPackage.tripId)]
  writePackages(nextPackages)
  void replaceTripOfflinePackage({ tripData, status: "legacy_snapshot" }).catch((error) => {
    console.error("[OFFLINE] snapshot mirror error", error)
  })
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
