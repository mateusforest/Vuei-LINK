import "server-only"

import { createHash, randomBytes } from "node:crypto"

export const PENDING_TRIP_CLAIM_TTL_HOURS = 24

export function generatePendingTripClaimToken() {
  return randomBytes(32).toString("hex")
}

export function hashPendingTripClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function buildPendingTripClaimExpiresAt(hours = PENDING_TRIP_CLAIM_TTL_HOURS) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export function isPendingTripClaimExpired(expiresAt?: string | null) {
  if (!expiresAt) return true
  const expiresTime = new Date(expiresAt).getTime()
  if (Number.isNaN(expiresTime)) return true
  return expiresTime <= Date.now()
}
