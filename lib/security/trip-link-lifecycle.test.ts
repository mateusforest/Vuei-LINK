import assert from "node:assert/strict"
import test from "node:test"
// @ts-ignore Node executa este teste TypeScript diretamente com type stripping.
import { isTripPublicLinkActive } from "./trip-link-lifecycle.ts"

test("viajante precisa ativar o link antes do acesso publico", () => {
  assert.equal(isTripPublicLinkActive({
    ownerType: "traveler",
    visibility: "public",
    linkActivatedAt: null,
    linkAccessUntil: null,
  }), false)

  assert.equal(isTripPublicLinkActive({
    ownerType: "traveler",
    visibility: "public",
    linkActivatedAt: "2026-09-04T12:00:00.000Z",
    linkAccessUntil: null,
  }), true)
})

test("agencia preserva o acesso publico sem lifecycle de viajante", () => {
  assert.equal(isTripPublicLinkActive({
    ownerType: "agency",
    visibility: "public",
    linkActivatedAt: null,
    linkAccessUntil: null,
  }), true)
})

test("etapa inicial nao aplica expiracao por linkAccessUntil", () => {
  assert.equal(isTripPublicLinkActive({
    ownerType: "traveler",
    visibility: "public",
    linkActivatedAt: "2026-09-04T12:00:00.000Z",
    linkAccessUntil: "2020-01-01T00:00:00.000Z",
  }), true)
})

test("visibilidade privada bloqueia viajante e agencia", () => {
  assert.equal(isTripPublicLinkActive({
    ownerType: "traveler",
    visibility: "private",
    linkActivatedAt: "2026-09-04T12:00:00.000Z",
    linkAccessUntil: null,
  }), false)

  assert.equal(isTripPublicLinkActive({
    ownerType: "agency",
    visibility: "private",
    linkActivatedAt: null,
    linkAccessUntil: null,
  }), false)
})
