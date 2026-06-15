import "server-only"

import Stripe from "stripe"

let stripeClient: Stripe | null = null

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }

  return value
}

export function getStripeSecretKey() {
  return getRequiredEnv("STRIPE_SECRET_KEY")
}

export function getStripeWebhookSecret() {
  return getRequiredEnv("STRIPE_WEBHOOK_SECRET")
}

export function getStripePriceIdForTravelerPremium() {
  return getRequiredEnv("STRIPE_PRICE_TRAVELER_PREMIUM_MONTHLY")
}

export function getStripePriceIdForCreditPackage(code: "starter" | "popular" | "pro") {
  if (code === "starter") return getRequiredEnv("STRIPE_PRICE_CREDITS_STARTER")
  if (code === "popular") return getRequiredEnv("STRIPE_PRICE_CREDITS_POPULAR")
  return getRequiredEnv("STRIPE_PRICE_CREDITS_PRO")
}

export function getStripePriceIdForAgencyPlan(code: "start" | "pro" | "business") {
  if (code === "start") return getRequiredEnv("STRIPE_PRICE_AGENCY_START_MONTHLY")
  if (code === "pro") return getRequiredEnv("STRIPE_PRICE_AGENCY_PRO_MONTHLY")
  return getRequiredEnv("STRIPE_PRICE_AGENCY_BUSINESS_MONTHLY")
}

export function getStripePriceIdForAgencyCreditPackage(code: "starter" | "popular" | "pro") {
  if (code === "starter") return getRequiredEnv("STRIPE_PRICE_AGENCY_CREDITS_STARTER")
  if (code === "popular") return getRequiredEnv("STRIPE_PRICE_AGENCY_CREDITS_POPULAR")
  return getRequiredEnv("STRIPE_PRICE_AGENCY_CREDITS_PRO")
}

export function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-05-27.dahlia",
    })
  }

  return stripeClient
}
