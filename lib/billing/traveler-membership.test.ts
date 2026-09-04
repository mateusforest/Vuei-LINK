import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's native TypeScript runner requires the explicit extension.
import { TRAVELER_VUEI_PLUS_OFFER, resolveTravelerMembership } from "./traveler-membership.ts"

const base = {
  planCode: "free" as const,
  legacyStatus: "free" as const,
  legacyCurrentPeriodEnd: null,
  vueiPlusStatus: "none" as const,
  vueiPlusCurrentPeriodEnd: null,
  vueiPlusCancelAtPeriodEnd: false,
  vueiPlusStripeSubscriptionId: null,
  stripeCustomerId: null,
}

test("fixes the Vuei+ commercial offer at R$ 14,90 monthly", () => {
  assert.deepEqual(TRAVELER_VUEI_PLUS_OFFER, {
    unitAmount: 1490,
    currency: "brl",
    priceLabel: "R$ 14,90/mês",
  })
})

test("keeps travel and AI balances outside membership capabilities", () => {
  const result = resolveTravelerMembership(base, new Date("2026-09-04T12:00:00Z"))
  assert.equal(result.state, "NONE")
  assert.equal(result.canAccessArchivedTrips, false)
  assert.equal("tripLinkBalance" in result, false)
  assert.equal("creditsBalance" in result, false)
})

test("grants archive access to an active Vuei+ membership", () => {
  const result = resolveTravelerMembership({
    ...base,
    vueiPlusStatus: "active",
    vueiPlusCurrentPeriodEnd: "2026-10-04T12:00:00Z",
  }, new Date("2026-09-04T12:00:00Z"))

  assert.equal(result.state, "VUEI_PLUS_ACTIVE")
  assert.equal(result.hasVueiPlus, true)
  assert.equal(result.canAccessArchivedDocuments, true)
})

test("keeps access through the paid cancellation period and blocks afterwards", () => {
  const snapshot = {
    ...base,
    vueiPlusStatus: "canceled" as const,
    vueiPlusCurrentPeriodEnd: "2026-09-10T12:00:00Z",
  }

  assert.equal(resolveTravelerMembership(snapshot, new Date("2026-09-09T12:00:00Z")).hasVueiPlus, true)
  assert.equal(resolveTravelerMembership(snapshot, new Date("2026-09-11T12:00:00Z")).hasVueiPlus, false)
})

test("preserves Premium legacy as a distinct archive entitlement", () => {
  const result = resolveTravelerMembership({
    ...base,
    planCode: "premium",
    legacyStatus: "active",
    legacyCurrentPeriodEnd: "2026-10-04T12:00:00Z",
    vueiPlusStatus: "active",
    vueiPlusCurrentPeriodEnd: "2026-10-04T12:00:00Z",
  }, new Date("2026-09-04T12:00:00Z"))

  assert.equal(result.state, "PREMIUM_LEGACY")
  assert.equal(result.isPremiumLegacy, true)
  assert.equal(result.hasVueiPlus, true)
  assert.equal(result.canAccessArchivedTrips, true)
})
