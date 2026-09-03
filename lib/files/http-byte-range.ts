export type HttpByteRange = {
  start: number
  end: number
}

export function parseHttpByteRange(header: string | null, totalBytes: number): HttpByteRange | null {
  if (!header || totalBytes <= 0 || !header.startsWith("bytes=") || header.includes(",")) return null

  const [rawStart, rawEnd] = header.slice("bytes=".length).split("-", 2)
  if (rawStart === "" && rawEnd === "") return null

  if (rawStart === "") {
    const suffixLength = Number(rawEnd)
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null
    return { start: Math.max(totalBytes - suffixLength, 0), end: totalBytes - 1 }
  }

  const start = Number(rawStart)
  const requestedEnd = rawEnd === "" ? totalBytes - 1 : Number(rawEnd)
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd) || start < 0 || requestedEnd < start || start >= totalBytes) {
    return null
  }

  return { start, end: Math.min(requestedEnd, totalBytes - 1) }
}
