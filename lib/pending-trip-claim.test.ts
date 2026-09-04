import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
// @ts-ignore Node executa este teste TypeScript diretamente com type stripping.
import * as pendingTripClaim from "./pending-trip-claim.ts"

const {
  PENDING_TRIP_CLAIM_STORAGE_KEY,
  PENDING_TRIP_CLAIMS_STORAGE_KEY,
  clearPendingTripClaimSession,
  findPendingTripClaimSession,
  getOrCreatePendingTripRequestToken,
  readPendingTripClaimSession,
  readPendingTripClaimSessions,
  selectPendingTripClaimSession,
  writePendingTripClaimSession,
} = pendingTripClaim

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

const localStorage = new MemoryStorage()
const sessionStorage = new MemoryStorage()
const cookies = new Map<string, string>()
const browserWindow = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage
  sessionStorage: MemoryStorage
  location: { protocol: string; hostname: string }
}

browserWindow.localStorage = localStorage
browserWindow.sessionStorage = sessionStorage
browserWindow.location = { protocol: "https:", hostname: "www.meuvuei.com" }

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: browserWindow,
})
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    get cookie() {
      return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ")
    },
    set cookie(value: string) {
      const [pair, ...attributes] = value.split(";").map((part) => part.trim())
      const separator = pair.indexOf("=")
      const key = pair.slice(0, separator)
      const cookieValue = pair.slice(separator + 1)
      const expired = attributes.some((attribute) =>
        attribute.toLowerCase().startsWith("expires=thu, 01 jan 1970")
      )
      if (expired || !cookieValue) {
        cookies.delete(key)
      } else {
        cookies.set(key, cookieValue)
      }
    },
  },
})

function buildSession(id: string, createdAt: string) {
  return {
    tripId: id,
    tripSlug: `viagem-${id}`,
    claimToken: id.padEnd(64, "a").slice(0, 64),
    shareLink: `https://www.meuvuei.com/viagem/viagem-${id}`,
    createdAt,
    expiresAt: "2099-01-01T00:00:00.000Z",
    title: `Viagem ${id}`,
    destination: `Destino ${id}`,
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    travelersCount: 2,
  }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  cookies.clear()
})

test("a Bolsa preserva e lista varios rascunhos anonimos apos nova leitura", () => {
  const first = buildSession("1", "2026-09-04T10:00:00.000Z")
  const second = buildSession("2", "2026-09-04T11:00:00.000Z")

  writePendingTripClaimSession(first)
  writePendingTripClaimSession(second)

  assert.deepEqual(readPendingTripClaimSessions().map((session) => session.tripId), ["2", "1"])
  assert.equal(findPendingTripClaimSession({ tripSlug: first.tripSlug })?.destination, "Destino 1")
  assert.ok(localStorage.getItem(PENDING_TRIP_CLAIMS_STORAGE_KEY))
})

test("selecionar e remover um rascunho nao remove os demais da Bolsa", () => {
  const first = buildSession("1", "2026-09-04T10:00:00.000Z")
  const second = buildSession("2", "2026-09-04T11:00:00.000Z")

  writePendingTripClaimSession(first)
  writePendingTripClaimSession(second)
  assert.equal(selectPendingTripClaimSession(first.tripId)?.tripId, first.tripId)
  assert.equal(readPendingTripClaimSession()?.tripId, first.tripId)

  clearPendingTripClaimSession(first.tripId)

  assert.deepEqual(readPendingTripClaimSessions().map((session) => session.tripId), [second.tripId])
  assert.equal(readPendingTripClaimSession()?.tripId, second.tripId)
})

test("sessao legada unica migra para a colecao sem duplicar", () => {
  const legacy = buildSession("legacy", "2026-09-04T10:00:00.000Z")
  localStorage.setItem(PENDING_TRIP_CLAIM_STORAGE_KEY, JSON.stringify(legacy))

  assert.deepEqual(readPendingTripClaimSessions().map((session) => session.tripId), [legacy.tripId])
  assert.deepEqual(readPendingTripClaimSessions().map((session) => session.tripId), [legacy.tripId])
})

test("retry da mesma criacao reutiliza uma chave forte e outra carga recebe nova chave", () => {
  const first = getOrCreatePendingTripRequestToken("mesma-carga")
  const retry = getOrCreatePendingTripRequestToken("mesma-carga")
  const changed = getOrCreatePendingTripRequestToken("carga-alterada")

  assert.match(first, /^[a-f0-9]{64}$/)
  assert.equal(retry, first)
  assert.notEqual(changed, first)
})
