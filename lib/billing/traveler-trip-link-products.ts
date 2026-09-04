import "server-only"

import type Stripe from "stripe"
import {
  TRAVELER_TRIP_LINK_PRODUCTS,
  type TravelerTripLinkPriceMap,
  type TravelerTripLinkProductCode,
  resolveTravelerTripLinkProductByPriceId,
} from "@/lib/billing/traveler-trip-link-catalog"

function readPriceEnv(name: string) {
  const value = process.env[name]?.trim()
  return value || null
}

export function getTravelerTripLinkPriceMap(): TravelerTripLinkPriceMap {
  return Object.fromEntries(
    TRAVELER_TRIP_LINK_PRODUCTS.map((product) => [product.code, readPriceEnv(product.priceEnv)]),
  ) as TravelerTripLinkPriceMap
}

export function getTravelerTripLinkPriceId(code: TravelerTripLinkProductCode) {
  const product = TRAVELER_TRIP_LINK_PRODUCTS.find((candidate) => candidate.code === code)
  const priceId = product ? readPriceEnv(product.priceEnv) : null

  if (!product || !priceId) {
    throw new Error(`Missing required env: ${product?.priceEnv ?? "traveler trip link price"}`)
  }

  if (!priceId.startsWith("price_")) {
    throw new Error(`Invalid Stripe Price ID in env: ${product.priceEnv}`)
  }

  return priceId
}

export function resolveConfiguredTravelerTripLinkProductByPriceId(priceId: string | null | undefined) {
  return resolveTravelerTripLinkProductByPriceId(priceId, getTravelerTripLinkPriceMap())
}

export function formatStripePrice(price: Stripe.Price) {
  if (typeof price.unit_amount !== "number" || !price.currency) return null

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: price.currency.toUpperCase(),
  }).format(price.unit_amount / 100)
}
