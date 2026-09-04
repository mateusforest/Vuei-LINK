import "server-only"

import { getStripeClient } from "@/lib/billing/stripe"
import {
  TRAVELER_TRIP_LINK_PRODUCTS,
  getTravelerTripLinkProduct,
} from "@/lib/billing/traveler-trip-link-catalog"
import {
  formatStripePrice,
  getTravelerTripLinkPriceMap,
} from "@/lib/billing/traveler-trip-link-products"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createWalletService } from "@/lib/wallet"
import type { TravelerTripLinkStoreProduct } from "@/types"

export function getTravelerTripLinkProductPlaceholders(): TravelerTripLinkStoreProduct[] {
  return TRAVELER_TRIP_LINK_PRODUCTS.map((definition) => ({
    code: definition.code,
    name: definition.name,
    quantity: definition.quantity,
    configured: false,
    priceLabel: null,
    unitAmount: null,
    currency: null,
  }))
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
      return {
        code: definition.code,
        name: definition.name,
        quantity: definition.quantity,
        configured: false,
        priceLabel: null,
        unitAmount: null,
        currency: null,
      }
    }

    try {
      const price = await stripe.prices.retrieve(priceId)
      const priceLabel = price.active && price.type === "one_time" ? formatStripePrice(price) : null
      return {
        code: definition.code,
        name: definition.name,
        quantity: definition.quantity,
        configured: Boolean(priceLabel),
        priceLabel,
        unitAmount: priceLabel ? price.unit_amount : null,
        currency: priceLabel ? price.currency : null,
      }
    } catch {
      return {
        code: definition.code,
        name: definition.name,
        quantity: definition.quantity,
        configured: false,
        priceLabel: null,
        unitAmount: null,
        currency: null,
      }
    }
  }))
}
