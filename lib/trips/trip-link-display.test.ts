import assert from "node:assert/strict"
import test from "node:test"
// @ts-ignore Node's strip-types test runner requires the explicit TypeScript extension.
import { formatTripLinkPreview, getTripPublicLinkCopyHint } from "./trip-link-display.ts"

test("trip link preview never exposes the complete URL", () => {
  const rawLink = "https://www.meuvuei.com/viagem/lisboa-em-familia"
  const preview = formatTripLinkPreview(rawLink)

  assert.notEqual(preview, rawLink)
  assert.equal(preview.startsWith("https://www.meuvuei.com/viagem/"), true)
  assert.equal(preview.endsWith("..."), true)
  assert.equal(preview.includes("lisboa-em-familia"), false)
})

test("trip link preview also masks short slugs", () => {
  assert.equal(formatTripLinkPreview("https://www.meuvuei.com/viagem/rio"), "https://www.meuvuei.com/viagem/ri...")
})

test("copy hints match lifecycle states", () => {
  assert.equal(getTripPublicLinkCopyHint("draft"), "Rascunho privado")
  assert.equal(getTripPublicLinkCopyHint("ended"), "Link encerrado")
  assert.equal(getTripPublicLinkCopyHint("active"), null)
  assert.equal(getTripPublicLinkCopyHint("post_trip"), null)
})
