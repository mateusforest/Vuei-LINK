export type TripLinkLifecycleStatus = "draft" | "active" | "post_trip" | "ended"

export interface TripLinkLifecycleSnapshot {
  ownerType: "traveler" | "agency"
  visibility: "private" | "public"
  status?: string | null
  endDate?: string | null
  linkActivatedAt: string | null
  linkAccessUntil: string | null
}

const BUSINESS_TIME_ZONE = "America/Sao_Paulo"

function parseTimestamp(value: string | null) {
  if (!value) return null
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? null : timestamp
}

function dateKeyInBusinessTimeZone(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

export function resolveTripLinkLifecycle(
  snapshot: TripLinkLifecycleSnapshot,
  now = new Date(),
): TripLinkLifecycleStatus {
  if (snapshot.ownerType === "agency") {
    return snapshot.visibility === "public" ? "active" : "draft"
  }

  if (!snapshot.linkActivatedAt) return "draft"
  if (snapshot.status === "cancelled") return "ended"

  const accessUntil = parseTimestamp(snapshot.linkAccessUntil)
  if (!accessUntil || now.getTime() > accessUntil.getTime()) return "ended"

  const currentDateKey = dateKeyInBusinessTimeZone(now)
  if (snapshot.endDate && currentDateKey && currentDateKey > snapshot.endDate.slice(0, 10)) {
    return "post_trip"
  }

  return "active"
}

export function isTripPublicLinkActive(
  snapshot: TripLinkLifecycleSnapshot,
  now = new Date(),
) {
  const lifecycle = resolveTripLinkLifecycle(snapshot, now)
  return snapshot.visibility === "public" && (lifecycle === "active" || lifecycle === "post_trip")
}

export function getTripLinkAccessDaysRemaining(
  linkAccessUntil: string | null,
  now = new Date(),
) {
  const accessUntil = parseTimestamp(linkAccessUntil)
  if (!accessUntil || accessUntil.getTime() < now.getTime()) return 0

  return Math.max(1, Math.ceil((accessUntil.getTime() - now.getTime()) / 86_400_000))
}
