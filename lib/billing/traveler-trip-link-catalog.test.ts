import assert from "node:assert/strict"
import test from "node:test"
// @ts-ignore Node executa este teste TypeScript diretamente com type stripping.
import * as catalog from "./traveler-trip-link-catalog.ts"

const {
  TRAVELER_TRIP_LINK_PRODUCTS,
  resolveTravelerTripLinkFulfillment,
  resolveTravelerTripLinkProductByPriceId,
} = catalog

const prices = {
  trip_link_1: "price_trip_1",
  trip_link_3: "price_trip_3",
  trip_link_5: "price_trip_5",
} as const

test("catalogo fixa os pacotes de viagens em 1, 3 e 5 com preco e validade", () => {
  assert.deepEqual(
    TRAVELER_TRIP_LINK_PRODUCTS.map(({ code, quantity, unitAmount, validityLabel }) => ({ code, quantity, unitAmount, validityLabel })),
    [
      { code: "trip_link_1", quantity: 1, unitAmount: 2490, validityLabel: "Use em até 90 dias" },
      { code: "trip_link_3", quantity: 3, unitAmount: 5990, validityLabel: "Use em até 6 meses" },
      { code: "trip_link_5", quantity: 5, unitAmount: 8990, validityLabel: "Use em até 12 meses" },
    ],
  )
})

test("resolve a quantidade somente pelo Price configurado", () => {
  assert.equal(resolveTravelerTripLinkProductByPriceId("price_trip_5", prices)?.quantity, 5)
  assert.equal(resolveTravelerTripLinkProductByPriceId("price_desconhecido", prices), null)
})

test("pagamento nao confirmado nunca autoriza grant", () => {
  assert.deepEqual(resolveTravelerTripLinkFulfillment({
    paymentStatus: "unpaid",
    lineItemCount: 1,
    lineItemQuantity: 1,
    priceId: "price_trip_5",
    metadataProductCode: "trip_link_5",
    unitAmount: 8990,
    currency: "brl",
  }, prices), { status: "not_paid" })
})

test("quantidade arbitraria na line item e rejeitada", () => {
  const result = resolveTravelerTripLinkFulfillment({
    paymentStatus: "paid",
    lineItemCount: 1,
    lineItemQuantity: 10,
    priceId: "price_trip_5",
    metadataProductCode: "trip_link_5",
    unitAmount: 8990,
    currency: "brl",
  }, prices)

  assert.equal(result.status, "invalid")
})

test("pagamento confirmado concede a quantidade fixa do produto", () => {
  const result = resolveTravelerTripLinkFulfillment({
    paymentStatus: "paid",
    lineItemCount: 1,
    lineItemQuantity: 1,
    priceId: "price_trip_5",
    metadataProductCode: "trip_link_5",
    unitAmount: 8990,
    currency: "brl",
  }, prices)

  assert.equal(result.status, "grant")
  if (result.status === "grant") assert.equal(result.product.quantity, 5)
})

test("valor Stripe divergente da oferta e rejeitado", () => {
  const result = resolveTravelerTripLinkFulfillment({
    paymentStatus: "paid",
    lineItemCount: 1,
    lineItemQuantity: 1,
    priceId: "price_trip_3",
    metadataProductCode: "trip_link_3",
    unitAmount: 6000,
    currency: "brl",
  }, prices)

  assert.equal(result.status, "invalid")
})

test("Price duplicado na configuracao e rejeitado", () => {
  assert.throws(() => resolveTravelerTripLinkProductByPriceId("price_repetido", {
    trip_link_1: "price_repetido",
    trip_link_3: "price_repetido",
  }), /duplicado/)
})
