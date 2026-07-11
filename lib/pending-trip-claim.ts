"use client"

export const PENDING_TRIP_CLAIM_STORAGE_KEY = "vuei_pending_trip_claim"
export const PENDING_TRIP_CLAIM_TTL_MS = 24 * 60 * 60 * 1000

export interface PendingTripClaimSession {
  tripId: string
  tripSlug: string
  claimToken: string
  shareLink: string
  createdAt: string
  expiresAt: string
}

function buildCookieName() {
  return PENDING_TRIP_CLAIM_STORAGE_KEY
}

function resolveCookieDomain(hostname: string) {
  const trimmed = hostname.trim().toLowerCase()
  if (!trimmed || trimmed === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(trimmed)) {
    return null
  }

  const parts = trimmed.split(".").filter(Boolean)
  if (parts.length < 2) return null

  return `.${parts.slice(-2).join(".")}`
}

function writePendingTripClaimCookie(payload: PendingTripClaimSession) {
  if (typeof document === "undefined" || typeof window === "undefined") return

  const encoded = encodeURIComponent(JSON.stringify(payload))
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  const domain = resolveCookieDomain(window.location.hostname)
  const domainPart = domain ? `; Domain=${domain}` : ""
  document.cookie = `${buildCookieName()}=${encoded}; Path=/; SameSite=Lax${domainPart}${secure}; Expires=${new Date(payload.expiresAt).toUTCString()}`
}

function readPendingTripClaimCookie() {
  if (typeof document === "undefined") return null

  const cookiePrefix = `${buildCookieName()}=`
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(cookiePrefix))

  if (!match) return null

  const rawValue = match.slice(cookiePrefix.length)
  try {
    return JSON.parse(decodeURIComponent(rawValue)) as Partial<PendingTripClaimSession>
  } catch {
    return null
  }
}

function clearPendingTripClaimCookie() {
  if (typeof document === "undefined" || typeof window === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  const domain = resolveCookieDomain(window.location.hostname)
  const domainPart = domain ? `; Domain=${domain}` : ""
  document.cookie = `${buildCookieName()}=; Path=/; SameSite=Lax${domainPart}${secure}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function writePendingTripClaimSession(payload: PendingTripClaimSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(payload))
  writePendingTripClaimCookie(payload)
}

export function readPendingTripClaimSession() {
  if (typeof window === "undefined") return null

  const localValue = window.localStorage.getItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
  const cookieValue = readPendingTripClaimCookie()

  try {
    const parsed = (localValue ? JSON.parse(localValue) : cookieValue) as Partial<PendingTripClaimSession> | null
    if (!parsed) return null
    if (
      typeof parsed.tripId !== "string" ||
      typeof parsed.tripSlug !== "string" ||
      typeof parsed.claimToken !== "string" ||
      typeof parsed.shareLink !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string"
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
  clearPendingTripClaimCookie()
}

export function isPendingTripClaimSessionActive(session: PendingTripClaimSession | null | undefined) {
  if (!session) return false

  const expiresAt = new Date(session.expiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false

  return expiresAt > Date.now()
}
