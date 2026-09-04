"use client"

export const PENDING_TRIP_CLAIM_STORAGE_KEY = "vuei_pending_trip_claim"
export const PENDING_TRIP_CLAIMS_STORAGE_KEY = "vuei_pending_trip_claims_v2"
export const PENDING_TRIP_CREATE_REQUEST_STORAGE_KEY = "vuei_pending_trip_create_request"
export const PENDING_TRIP_CLAIMS_CHANGED_EVENT = "vuei:pending-trip-claims-changed"
export const PENDING_TRIP_CLAIM_TTL_MS = 24 * 60 * 60 * 1000
const CLAIMED_TRIP_BAG_FOCUS_STORAGE_KEY = "vuei_claimed_trip_bag_focus"
const MAX_PENDING_TRIPS_IN_BAG = 20

export interface PendingTripClaimSession {
  tripId: string
  tripSlug: string
  claimToken: string
  shareLink: string
  createdAt: string
  expiresAt: string
  title?: string
  destination?: string
  startDate?: string | null
  endDate?: string | null
  travelersCount?: number | null
}

interface PendingTripClaimCollection {
  version: 2
  sessions: PendingTripClaimSession[]
}

interface PendingTripCreateRequest {
  fingerprint: string
  requestToken: string
  createdAt: string
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

function normalizePendingTripClaimSession(value: unknown): PendingTripClaimSession | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const candidate = value as Partial<PendingTripClaimSession>
  if (
    typeof candidate.tripId !== "string" ||
    typeof candidate.tripSlug !== "string" ||
    typeof candidate.claimToken !== "string" ||
    typeof candidate.shareLink !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.expiresAt !== "string"
  ) {
    return null
  }

  return {
    tripId: candidate.tripId,
    tripSlug: candidate.tripSlug,
    claimToken: candidate.claimToken,
    shareLink: candidate.shareLink,
    createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt,
    title: typeof candidate.title === "string" ? candidate.title : undefined,
    destination: typeof candidate.destination === "string" ? candidate.destination : undefined,
    startDate: typeof candidate.startDate === "string" || candidate.startDate === null ? candidate.startDate : undefined,
    endDate: typeof candidate.endDate === "string" || candidate.endDate === null ? candidate.endDate : undefined,
    travelersCount:
      typeof candidate.travelersCount === "number" && Number.isFinite(candidate.travelersCount)
        ? Math.max(1, Math.trunc(candidate.travelersCount))
        : candidate.travelersCount === null
          ? null
          : undefined,
  }
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
    return normalizePendingTripClaimSession(JSON.parse(decodeURIComponent(rawValue)))
  } catch {
    return null
  }
}

function readCurrentPendingTripClaimSession() {
  if (typeof window === "undefined") return null

  const localValue = window.localStorage.getItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
  if (localValue) {
    try {
      const parsed = normalizePendingTripClaimSession(JSON.parse(localValue))
      if (parsed) return parsed
    } catch {
      // Usa o cookie como fallback.
    }
  }

  return readPendingTripClaimCookie()
}

function readPendingTripClaimCollection() {
  if (typeof window === "undefined") return [] as PendingTripClaimSession[]

  const raw = window.localStorage.getItem(PENDING_TRIP_CLAIMS_STORAGE_KEY)
  if (!raw) return [] as PendingTripClaimSession[]

  try {
    const parsed = JSON.parse(raw) as Partial<PendingTripClaimCollection> | PendingTripClaimSession[]
    const rawSessions = Array.isArray(parsed) ? parsed : Array.isArray(parsed.sessions) ? parsed.sessions : []
    return rawSessions
      .map(normalizePendingTripClaimSession)
      .filter((session): session is PendingTripClaimSession => Boolean(session))
  } catch {
    return [] as PendingTripClaimSession[]
  }
}

function writePendingTripClaimCollection(sessions: PendingTripClaimSession[]) {
  if (typeof window === "undefined") return

  const payload: PendingTripClaimCollection = {
    version: 2,
    sessions: sessions.slice(0, MAX_PENDING_TRIPS_IN_BAG),
  }
  window.localStorage.setItem(PENDING_TRIP_CLAIMS_STORAGE_KEY, JSON.stringify(payload))
}

function writePendingTripClaimCookie(payload: PendingTripClaimSession) {
  if (typeof document === "undefined" || typeof window === "undefined") return

  const encoded = encodeURIComponent(JSON.stringify(payload))
  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  const domain = resolveCookieDomain(window.location.hostname)
  const domainPart = domain ? `; Domain=${domain}` : ""
  document.cookie = `${buildCookieName()}=${encoded}; Path=/; SameSite=Lax${domainPart}${secure}; Expires=${new Date(payload.expiresAt).toUTCString()}`
}

function clearPendingTripClaimCookie() {
  if (typeof document === "undefined" || typeof window === "undefined") return

  const secure = window.location.protocol === "https:" ? "; Secure" : ""
  const domain = resolveCookieDomain(window.location.hostname)
  const domainPart = domain ? `; Domain=${domain}` : ""
  document.cookie = `${buildCookieName()}=; Path=/; SameSite=Lax${domainPart}${secure}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

function notifyPendingTripClaimsChanged() {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return
  window.dispatchEvent(new Event(PENDING_TRIP_CLAIMS_CHANGED_EVENT))
}

function sortNewestFirst(sessions: PendingTripClaimSession[]) {
  return [...sessions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime()
    const rightTime = new Date(right.createdAt).getTime()
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
  })
}

export function isPendingTripClaimSessionActive(session: PendingTripClaimSession | null | undefined) {
  if (!session) return false

  const expiresAt = new Date(session.expiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false

  return expiresAt > Date.now()
}

export function readPendingTripClaimSessions() {
  if (typeof window === "undefined") return [] as PendingTripClaimSession[]

  const collection = readPendingTripClaimCollection()
  const legacyCurrent = readCurrentPendingTripClaimSession()
  const merged = legacyCurrent
    ? [legacyCurrent, ...collection.filter((session) => session.tripId !== legacyCurrent.tripId)]
    : collection
  const activeSessions = sortNewestFirst(merged.filter(isPendingTripClaimSessionActive))

  if (
    activeSessions.length !== collection.length ||
    activeSessions.some((session, index) => session.tripId !== collection[index]?.tripId)
  ) {
    writePendingTripClaimCollection(activeSessions)
  }

  return activeSessions
}

export function readPendingTripClaimSession() {
  const current = readCurrentPendingTripClaimSession()
  if (isPendingTripClaimSessionActive(current)) return current

  if (current && typeof window !== "undefined") {
    window.localStorage.removeItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
    clearPendingTripClaimCookie()
  }
  return readPendingTripClaimSessions()[0] ?? null
}

export function findPendingTripClaimSession(params: { tripId?: string | null; tripSlug?: string | null }) {
  const tripId = params.tripId?.trim()
  const tripSlug = params.tripSlug?.trim()

  return readPendingTripClaimSessions().find((session) =>
    (tripId && session.tripId === tripId) || (tripSlug && session.tripSlug === tripSlug)
  ) ?? null
}

export function writePendingTripClaimSession(payload: PendingTripClaimSession) {
  if (typeof window === "undefined") return

  const normalized = normalizePendingTripClaimSession(payload)
  if (!normalized || !isPendingTripClaimSessionActive(normalized)) return

  const nextSessions = sortNewestFirst([
    normalized,
    ...readPendingTripClaimCollection().filter((session) => session.tripId !== normalized.tripId),
  ]).slice(0, MAX_PENDING_TRIPS_IN_BAG)

  writePendingTripClaimCollection(nextSessions)
  window.localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(normalized))
  writePendingTripClaimCookie(normalized)
  notifyPendingTripClaimsChanged()
}

export function selectPendingTripClaimSession(identifier: string) {
  if (typeof window === "undefined") return null

  const session = readPendingTripClaimSessions().find((candidate) =>
    candidate.tripId === identifier || candidate.tripSlug === identifier || candidate.claimToken === identifier
  )
  if (!session) return null

  window.localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(session))
  writePendingTripClaimCookie(session)
  return session
}

export function clearPendingTripClaimSession(identifier?: string | null) {
  if (typeof window === "undefined") return

  const current = readCurrentPendingTripClaimSession()
  const target = identifier?.trim() || current?.tripId || null
  const nextSessions = target
    ? readPendingTripClaimCollection().filter((session) =>
        session.tripId !== target && session.tripSlug !== target && session.claimToken !== target
      )
    : []

  writePendingTripClaimCollection(nextSessions)
  window.localStorage.removeItem(PENDING_TRIP_CLAIM_STORAGE_KEY)
  clearPendingTripClaimCookie()

  const nextCurrent = nextSessions.find(isPendingTripClaimSessionActive)
  if (nextCurrent) {
    window.localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(nextCurrent))
    writePendingTripClaimCookie(nextCurrent)
  }

  notifyPendingTripClaimsChanged()
}

function generatePendingTripRequestToken() {
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("Gerador seguro indisponivel para criar a viagem.")
  }

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function getOrCreatePendingTripRequestToken(fingerprint: string) {
  if (typeof window === "undefined") return generatePendingTripRequestToken()

  const stored = window.sessionStorage.getItem(PENDING_TRIP_CREATE_REQUEST_STORAGE_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<PendingTripCreateRequest>
      const createdAt = typeof parsed.createdAt === "string" ? new Date(parsed.createdAt).getTime() : Number.NaN
      if (
        parsed.fingerprint === fingerprint &&
        typeof parsed.requestToken === "string" &&
        /^[a-f0-9]{64}$/.test(parsed.requestToken) &&
        !Number.isNaN(createdAt) &&
        createdAt + PENDING_TRIP_CLAIM_TTL_MS > Date.now()
      ) {
        return parsed.requestToken
      }
    } catch {
      // Gera uma nova chave abaixo.
    }
  }

  const requestToken = generatePendingTripRequestToken()
  const nextRequest: PendingTripCreateRequest = {
    fingerprint,
    requestToken,
    createdAt: new Date().toISOString(),
  }
  window.sessionStorage.setItem(PENDING_TRIP_CREATE_REQUEST_STORAGE_KEY, JSON.stringify(nextRequest))
  return requestToken
}

export function clearPendingTripCreateRequest(requestToken?: string | null) {
  if (typeof window === "undefined") return

  if (requestToken) {
    const stored = window.sessionStorage.getItem(PENDING_TRIP_CREATE_REQUEST_STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<PendingTripCreateRequest>
        if (parsed.requestToken !== requestToken) return
      } catch {
        // Remove o registro corrompido abaixo.
      }
    }
  }

  window.sessionStorage.removeItem(PENDING_TRIP_CREATE_REQUEST_STORAGE_KEY)
}

export function writeClaimedTripBagFocus(tripId: string) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(CLAIMED_TRIP_BAG_FOCUS_STORAGE_KEY, tripId)
}

export function readClaimedTripBagFocus() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(CLAIMED_TRIP_BAG_FOCUS_STORAGE_KEY)
}

export function clearClaimedTripBagFocus() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(CLAIMED_TRIP_BAG_FOCUS_STORAGE_KEY)
}
