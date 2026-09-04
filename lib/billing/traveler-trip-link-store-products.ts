import "server-only"

import { getStripeClient } from "@/lib/billing/stripe"
import {
  TRAVELER_TRIP_LINK_PRODUCTS,
  getTravelerTripLinkProduct,
} from "@/lib/billing/traveler-trip-link-catalog"
import {
  getTravelerTripLinkPriceMap,
} from "@/lib/billing/traveler-trip-link-products"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createWalletService } from "@/lib/wallet"
import type { TravelerTripLinkStoreProduct } from "@/types"

function formatCatalogPrice(unitAmount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(unitAmount / 100)
}

function buildStoreProduct(
  definition: (typeof TRAVELER_TRIP_LINK_PRODUCTS)[number],
  configured: boolean,
): TravelerTripLinkStoreProduct {
  return {
    code: definition.code,
    name: definition.name,
    quantity: definition.quantity,
    configured,
    priceLabel: formatCatalogPrice(definition.unitAmount, definition.currency),
    unitAmount: definition.unitAmount,
    currency: definition.currency,
    validityLabel: definition.validityLabel,
    validityShortLabel: definition.validityShortLabel,
    description: definition.description,
    featured: definition.featured,
  }
}

export function getTravelerTripLinkProductPlaceholders(): TravelerTripLinkStoreProduct[] {
  return TRAVELER_TRIP_LINK_PRODUCTS.map((definition) => buildStoreProduct(definition, false))
}

export async function listTravelerTripLinkStoreProducts(): Promise<TravelerTripLinkStoreProduct[]> {
  const adminClient = createSupabaseAdminClient()
  const walletService = createWalletService(adminClient)
  const databaseProducts = await walletService.listProducts("trip_link")
  const databaseProductsByCode = new Map(databaseProducts.map((product) => [product.code, product]))
  const configuredPrices = getTravelerTripLinkPriceMap()
  const hasConfiguredPrice = Object.values(configuredPrices).some(Boolean)
  const stripe = hasConfiguredPrice
    ? (() => {
        try {
          return getStripeClient()
        } catch {
          return null
        }
      })()
    : null

  return Promise.all(TRAVELER_TRIP_LINK_PRODUCTS.map(async (definition) => {
    const databaseProduct = databaseProductsByCode.get(definition.code)
    const priceId = configuredPrices[definition.code]?.trim() || null
    const isDatabaseProductValid = Boolean(
      databaseProduct?.active &&
      databaseProduct.assetType === "trip_link" &&
      databaseProduct.quantity === definition.quantity &&
      getTravelerTripLinkProduct(databaseProduct.code),
    )

    if (!priceId || !isDatabaseProductValid || !stripe) {
      return buildStoreProduct(definition, false)
    }

    try {
      const price = await stripe.prices.retrieve(priceId)
      const matchesOffer = price.active &&
        price.type === "one_time" &&
        price.unit_amount === definition.unitAmount &&
        price.currency.toLowerCase() === definition.currency
      return matchesOffer ? buildStoreProduct(definition, true) : buildStoreProduct(definition, false)
    } catch {
      return buildStoreProduct(definition, false)
    }
  }))
}
