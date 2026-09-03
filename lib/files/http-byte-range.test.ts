import assert from "node:assert/strict"
import test from "node:test"
// @ts-ignore Node executa este teste TypeScript diretamente com type stripping.
import { parseHttpByteRange } from "./http-byte-range.ts"

test("interpreta os intervalos usados por visualizadores PDF mobile", () => {
  assert.deepEqual(parseHttpByteRange("bytes=0-", 1000), { start: 0, end: 999 })
  assert.deepEqual(parseHttpByteRange("bytes=100-299", 1000), { start: 100, end: 299 })
  assert.deepEqual(parseHttpByteRange("bytes=-200", 1000), { start: 800, end: 999 })
})

test("recusa intervalos inválidos", () => {
  assert.equal(parseHttpByteRange("bytes=1000-1200", 1000), null)
  assert.equal(parseHttpByteRange("items=0-10", 1000), null)
  assert.equal(parseHttpByteRange("bytes=0-10,20-30", 1000), null)
})
