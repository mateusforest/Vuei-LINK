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
  trip_link_5: "price_trip_5",
  trip_link_10: "price_trip_10",
} as const

test("catalogo fixa os pacotes de viagens em 1, 5 e 10", () => {
  assert.deepEqual(
    TRAVELER_TRIP_LINK_PRODUCTS.map(({ code, quantity }) => ({ code, quantity })),
    [
      { code: "trip_link_1", quantity: 1 },
      { code: "trip_link_5", quantity: 5 },
      { code: "trip_link_10", quantity: 10 },
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
    priceId: "price_trip_10",
    metadataProductCode: "trip_link_10",
  }, prices), { status: "not_paid" })
})

test("quantidade arbitraria na line item e rejeitada", () => {
  const result = resolveTravelerTripLinkFulfillment({
    paymentStatus: "paid",
    lineItemCount: 1,
    lineItemQuantity: 10,
    priceId: "price_trip_10",
    metadataProductCode: "trip_link_10",
  }, prices)

  assert.equal(result.status, "invalid")
})

test("pagamento confirmado concede a quantidade fixa do produto", () => {
  const result = resolveTravelerTripLinkFulfillment({
    paymentStatus: "paid",
    lineItemCount: 1,
    lineItemQuantity: 1,
    priceId: "price_trip_10",
    metadataProductCode: "trip_link_10",
  }, prices)

  assert.equal(result.status, "grant")
  if (result.status === "grant") assert.equal(result.product.quantity, 10)
})

test("Price duplicado na configuracao e rejeitado", () => {
  assert.throws(() => resolveTravelerTripLinkProductByPriceId("price_repetido", {
    trip_link_1: "price_repetido",
    trip_link_5: "price_repetido",
  }), /duplicado/)
})
