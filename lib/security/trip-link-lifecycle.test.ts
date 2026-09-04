import assert from "node:assert/strict"
import test from "node:test"
import {
  getTripLinkAccessDaysRemaining,
  isTripPublicLinkActive,
  resolveTripLinkLifecycle,
} from "./trip-link-lifecycle.ts"

const activeTravelerTrip = {
  ownerType: "traveler" as const,
  visibility: "public" as const,
  status: "upcoming",
  endDate: "2026-09-10",
  linkActivatedAt: "2026-09-01T12:00:00.000Z",
  linkAccessUntil: "2026-09-18T02:59:59.999999Z",
}

test("traveler draft is never public", () => {
  assert.equal(resolveTripLinkLifecycle({
    ...activeTravelerTrip,
    visibility: "private",
    linkActivatedAt: null,
    linkAccessUntil: null,
  }), "draft")
})

test("private visibility blocks a valid activated lifecycle", () => {
  const privateTrip = { ...activeTravelerTrip, visibility: "private" as const }
  assert.equal(resolveTripLinkLifecycle(privateTrip, new Date("2026-09-05T12:00:00.000Z")), "active")
  assert.equal(isTripPublicLinkActive(privateTrip, new Date("2026-09-05T12:00:00.000Z")), false)
})

test("traveler link is active through the end date", () => {
  const now = new Date("2026-09-11T02:59:59.000Z")
  assert.equal(resolveTripLinkLifecycle(activeTravelerTrip, now), "active")
  assert.equal(isTripPublicLinkActive(activeTravelerTrip, now), true)
})

test("traveler link enters post-trip during the grace period", () => {
  const now = new Date("2026-09-11T03:00:00.000Z")
  assert.equal(resolveTripLinkLifecycle(activeTravelerTrip, now), "post_trip")
  assert.equal(isTripPublicLinkActive(activeTravelerTrip, now), true)
})

test("traveler link ends immediately after its inclusive deadline", () => {
  const now = new Date("2026-09-18T03:00:00.000Z")
  assert.equal(isTripPublicLinkActive(activeTravelerTrip, now), false)
  assert.equal(resolveTripLinkLifecycle(activeTravelerTrip, now), "ended")
})

test("activated traveler link without a deadline fails closed", () => {
  assert.equal(resolveTripLinkLifecycle({
    ...activeTravelerTrip,
    linkAccessUntil: null,
  }), "ended")
})

test("cancelled traveler link is ended even before its deadline", () => {
  assert.equal(resolveTripLinkLifecycle({
    ...activeTravelerTrip,
    status: "cancelled",
  }), "ended")
})

test("agency public-link behavior remains independent from traveler deadlines", () => {
  assert.equal(resolveTripLinkLifecycle({
    ownerType: "agency",
    visibility: "public",
    status: "cancelled",
    endDate: "2020-01-01",
    linkActivatedAt: null,
    linkAccessUntil: null,
  }), "active")
})

test("remaining-days helper never returns a negative value", () => {
  assert.equal(getTripLinkAccessDaysRemaining(
    "2026-09-18T02:59:59.999Z",
    new Date("2026-09-17T12:00:00.000Z"),
  ), 1)
  assert.equal(getTripLinkAccessDaysRemaining(
    "2026-09-18T02:59:59.999Z",
    new Date("2026-09-19T12:00:00.000Z"),
  ), 0)
})
