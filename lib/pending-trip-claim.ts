"use client"

export const PENDING_TRIP_CLAIM_STORAGE_KEY = "vuei_pending_trip_claim"

export interface PendingTripClaimSession {
  tripId: string
  claimToken: string
  shareLink: string
  createdAt: string
}

export function writePendingTripClaimSession(payload: PendingTripClaimSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(payload))
}

export function readPendingTripClaimSession() {
  if (typeof window === "undefined") return null

  const rawValue = window.localStorage.getItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
  if (!rawValue) return null

  try {
    const parsed = JSON.parse(rawValue) as Partial<PendingTripClaimSession>
    if (
      typeof parsed.tripId !== "string" ||
      typeof parsed.claimToken !== "string" ||
      typeof parsed.shareLink !== "string" ||
      typeof parsed.createdAt !== "string"
    ) {
      return null
    }

    return parsed as PendingTripClaimSession
  } catch {
    return null
  }
}

export function clearPendingTripClaimSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
}
