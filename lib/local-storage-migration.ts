import type { CreditBalance, CreditTransaction, Trip } from "@/types"
import {
  extractAgencyStorageState,
  type AgencyStorageState,
  type LegacyAgencyClient,
} from "@/lib/mappers/agency-mappers"
import {
  extractCreditsStoragePayload,
  mapCreditHistoryToTransactions,
  mapLegacyCreditsToCreditBalance,
  type LegacyCreditsState,
} from "@/lib/mappers/credit-mappers"
import {
  extractTripsStoragePayload,
  mapAgencyTripToTrip,
  mapStoredTripToTrip,
  type LegacyAgencyTrip,
  type LegacyStoredTrip,
} from "@/lib/mappers/trip-mappers"

export const LOCAL_SCHEMA_VERSION_KEY = "vuei_local_schema_version"
export const TRIPS_STORAGE_KEY = "vuei_trips"
export const AGENCY_STORAGE_KEY = "vuei_agency"
export const CREDITS_STORAGE_KEY = "vuei_credits"

function readLocalValue(key: string) {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(key)
}

export function getLocalSchemaVersion(defaultVersion = 1) {
  if (typeof window === "undefined") return defaultVersion

  const raw = window.localStorage.getItem(LOCAL_SCHEMA_VERSION_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultVersion
}

export function setLocalSchemaVersion(version: number) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOCAL_SCHEMA_VERSION_KEY, String(version))
}

export function readLegacyTrips(): LegacyStoredTrip[] {
  return extractTripsStoragePayload(readLocalValue(TRIPS_STORAGE_KEY)).trips
}

export function readLegacyAgencyData<
  TTrip = LegacyAgencyTrip,
  TDocument = unknown,
  TConcierge = unknown,
  TTeam = unknown,
  TActivity = unknown,
  TCredits = unknown,
>(): AgencyStorageState<TTrip, TDocument, TConcierge, TTeam, TActivity, TCredits> {
  return extractAgencyStorageState<TTrip, TDocument, TConcierge, TTeam, TActivity, TCredits>(
    readLocalValue(AGENCY_STORAGE_KEY)
  )
}

export function readLegacyCredits(fallback?: LegacyCreditsState) {
  return extractCreditsStoragePayload(readLocalValue(CREDITS_STORAGE_KEY), fallback ?? { balance: 0, history: [] }).credits
}

export function normalizeLegacyTrips(trips: LegacyStoredTrip[] = readLegacyTrips()): Trip[] {
  return trips.map((trip) => mapStoredTripToTrip({ ...trip, ownerType: trip.ownerType ?? "traveler" }))
}

export function normalizeLegacyAgencyTrips(
  agencyTrips: LegacyAgencyTrip[] = readLegacyAgencyData<LegacyAgencyTrip>().trips ?? []
): Trip[] {
  return agencyTrips.map((trip) => mapAgencyTripToTrip(trip))
}

export function normalizeLegacyCredits(
  ownerType: "profile" | "agency",
  ownerId: string,
  fallback?: LegacyCreditsState
): { balance: CreditBalance; transactions: CreditTransaction[] } {
  const credits = readLegacyCredits(fallback)

  return {
    balance: mapLegacyCreditsToCreditBalance(credits, ownerType, ownerId),
    transactions: mapCreditHistoryToTransactions(credits.history, ownerType, ownerId),
  }
}

export function normalizeLegacyAgencyClients(clients: LegacyAgencyClient[] = readLegacyAgencyData().clients) {
  return clients
}
