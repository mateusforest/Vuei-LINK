import type { CreateTripPayload } from "@/lib/repositories/trips-repository"

export const PENDING_TRIP_STORAGE_KEY = "vuei_pending_trip"

export type PendingTripPayload = Pick<
  CreateTripPayload,
  "title" | "destination" | "startDate" | "endDate" | "style" | "travelersCount"
> & {
  createdAt: string
}

export function readPendingTrip(): PendingTripPayload | null {
  if (typeof window === "undefined") return null

  try {
    const raw = window.localStorage.getItem(PENDING_TRIP_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingTripPayload
  } catch {
    return null
  }
}

export function writePendingTrip(payload: Omit<PendingTripPayload, "createdAt">) {
  if (typeof window === "undefined") return

  const pendingTrip: PendingTripPayload = {
    ...payload,
    createdAt: new Date().toISOString(),
  }

  window.localStorage.setItem(PENDING_TRIP_STORAGE_KEY, JSON.stringify(pendingTrip))
}

export function clearPendingTrip() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PENDING_TRIP_STORAGE_KEY)
}
