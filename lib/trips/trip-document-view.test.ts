import assert from "node:assert/strict"
import test from "node:test"
// @ts-ignore Node executa este teste TypeScript diretamente com type stripping.
import * as tripDocumentView from "./trip-document-view.ts"

const {
  buildTripDocumentAccessHref,
  buildTripSectionsAccessHref,
  getContentTripDocuments,
  getPublicTripDocuments,
  getTripDocumentCounts,
} = tripDocumentView

test("usa o mesmo filtro de documentos nas contagens e na lista", () => {
  const documents = [
    { id: "voucher", type: "voucher", visibility: "public_trip", isPrivate: false },
    { id: "ticket", type: "ticket", visibility: "public_trip", is_private: false },
    { id: "private", type: "passport", visibility: "private", private: true },
    { id: "agency", type: "insurance", visibility: "agency_only" },
    { id: "itinerary", type: "itinerary", visibility: "public_trip", isPrivate: false },
  ]

  const contentDocuments = getContentTripDocuments(documents)
  const publicDocuments = getPublicTripDocuments(contentDocuments)
  const counts = getTripDocumentCounts(documents)

  assert.deepEqual(publicDocuments.map((document) => document.id), ["voucher", "ticket"])
  assert.equal(counts.content, contentDocuments.length)
  assert.equal(counts.public, publicDocuments.length)
  assert.equal(counts.private, 2)
  assert.equal(counts.tickets, 1)
  assert.equal(counts.itineraries, 1)
})

test("gera URL interna para abrir roteiro sem depender de popup ou URL assinada", () => {
  const href = buildTripDocumentAccessHref({
    tripId: "trip-1",
    tripSlug: "europa 2026",
    itineraryId: "itinerary-1",
    publicToken: "token/seguro",
    accessMode: "public",
  })
  const url = new URL(href, "https://www.meuvuei.com")

  assert.equal(url.pathname, "/api/trip-documents")
  assert.equal(url.searchParams.get("itineraryId"), "itinerary-1")
  assert.equal(url.searchParams.get("documentId"), null)
  assert.equal(url.searchParams.get("publicToken"), "token/seguro")
  assert.equal(url.searchParams.get("disposition"), "inline")
})

test("gera uma única fonte de seções para os mesmos parâmetros de acesso", () => {
  const href = buildTripSectionsAccessHref({
    tripId: "trip-1",
    tripSlug: "europa",
    accessMode: "public",
    publicToken: "public-token",
  })
  const url = new URL(href, "https://www.meuvuei.com")

  assert.equal(url.pathname, "/api/trip-sections")
  assert.equal(url.searchParams.get("tripId"), "trip-1")
  assert.equal(url.searchParams.get("tripSlug"), "europa")
  assert.equal(url.searchParams.get("accessMode"), "public")
  assert.equal(url.searchParams.get("publicToken"), "public-token")
})
