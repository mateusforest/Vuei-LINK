export const TRAVELER_TRIP_LINK_BILLING_SCOPE = "traveler_trip_link" as const
export const TRAVELER_TRIP_LINK_CHECKOUT_TYPE = "trip_link_package" as const

export const TRAVELER_TRIP_LINK_PRODUCTS = [
  {
    code: "trip_link_1",
    name: "1 viagem",
    quantity: 1,
    priceEnv: "STRIPE_PRICE_TRAVELER_TRIP_LINK_1",
    unitAmount: 2490,
    currency: "brl",
    validityLabel: "Use em até 90 dias",
    validityShortLabel: "Válida por 90 dias",
    description: "Ideal para sua próxima viagem.",
    featured: false,
  },
  {
    code: "trip_link_3",
    name: "3 viagens",
    quantity: 3,
    priceEnv: "STRIPE_PRICE_TRAVELER_TRIP_LINK_3",
    unitAmount: 5990,
    currency: "brl",
    validityLabel: "Use em até 6 meses",
    validityShortLabel: "Válidas por 6 meses",
    description: "Para quem já tem mais viagens nos planos.",
    featured: true,
  },
  {
    code: "trip_link_5",
    name: "5 viagens",
    quantity: 5,
    priceEnv: "STRIPE_PRICE_TRAVELER_TRIP_LINK_5",
    unitAmount: 8990,
    currency: "brl",
    validityLabel: "Use em até 12 meses",
    validityShortLabel: "Válidas por 12 meses",
    description: "Melhor custo para quem viaja mais.",
    featured: false,
  },
] as const

export type TravelerTripLinkProductCode = (typeof TRAVELER_TRIP_LINK_PRODUCTS)[number]["code"]
export type TravelerTripLinkProductDefinition = (typeof TRAVELER_TRIP_LINK_PRODUCTS)[number]
export type TravelerTripLinkPriceMap = Partial<Record<TravelerTripLinkProductCode, string | null | undefined>>

export type TravelerTripLinkFulfillmentResolution =
  | { status: "not_paid" }
  | { status: "invalid"; reason: string }
  | { status: "grant"; product: TravelerTripLinkProductDefinition }

export function getTravelerTripLinkProduct(code: string | null | undefined) {
  return TRAVELER_TRIP_LINK_PRODUCTS.find((product) => product.code === code) ?? null
}

export function resolveTravelerTripLinkProductByPriceId(
  priceId: string | null | undefined,
  prices: TravelerTripLinkPriceMap,
) {
  if (!priceId) return null

  const matches = TRAVELER_TRIP_LINK_PRODUCTS.filter((product) => prices[product.code]?.trim() === priceId)
  if (matches.length > 1) {
    throw new Error("Stripe Price ID duplicado na configuracao dos pacotes de viagem.")
  }

  return matches[0] ?? null
}

export function resolveTravelerTripLinkFulfillment(
  input: {
    paymentStatus: string | null | undefined
    lineItemCount: number
    lineItemQuantity: number | null | undefined
    priceId: string | null | undefined
    metadataProductCode: string | null | undefined
    unitAmount: number | null | undefined
    currency: string | null | undefined
  },
  prices: TravelerTripLinkPriceMap,
): TravelerTripLinkFulfillmentResolution {
  if (input.paymentStatus !== "paid") return { status: "not_paid" }
  if (input.lineItemCount !== 1) {
    return { status: "invalid", reason: "A compra deve conter exatamente um Price." }
  }
  if (input.lineItemQuantity !== 1) {
    return { status: "invalid", reason: "A quantidade da line item deve ser exatamente 1." }
  }

  const product = resolveTravelerTripLinkProductByPriceId(input.priceId, prices)
  if (!product || input.metadataProductCode !== product.code) {
    return { status: "invalid", reason: "Price ou pacote nao reconhecido." }
  }
  if (input.unitAmount !== product.unitAmount || input.currency?.toLowerCase() !== product.currency) {
    return { status: "invalid", reason: "Valor ou moeda do pacote nao reconhecido." }
  }

  return { status: "grant", product }
}
