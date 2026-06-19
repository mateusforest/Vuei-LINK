import "server-only"

import { DEFAULT_TRIP_HERO_IMAGE, normalizeImageUrl } from "@/lib/trip-destination"

type ResolveDestinationImageParams = {
  destination?: string | null
  city?: string | null
  country?: string | null
}

type ResolvedDestinationImage = {
  imageUrl: string | null
  source: "wikimedia" | "unsplash" | "fallback"
}

type WikidataSearchResponse = {
  search?: Array<{
    id?: string
    label?: string
    description?: string
    match?: {
      text?: string
      language?: string
      type?: string
    }
  }>
}

type WikidataEntityResponse = {
  entities?: Record<string, WikidataEntity>
}

type WikidataEntity = {
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: {
          value?: string
        }
      }
    }>
  >
}

type UnsplashSearchResponse = {
  results?: Array<{
    urls?: {
      regular?: string
      full?: string
    }
  }>
}

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php"
const UNSPLASH_API_URL = "https://api.unsplash.com/search/photos"
const RUNTIME_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const runtimeCache = new Map<string, { value: ResolvedDestinationImage; expiresAt: number }>()

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function buildLocationQuery(params: ResolveDestinationImageParams) {
  const city = params.city?.trim() || ""
  const country = params.country?.trim() || ""
  const destination = params.destination?.trim() || ""

  if (city && country) return `${city}, ${country}`
  if (destination && country && !normalizeText(destination).includes(normalizeText(country))) {
    return `${destination}, ${country}`
  }
  return destination || city || country
}

function buildCacheKey(params: ResolveDestinationImageParams) {
  return [params.destination, params.city, params.country].map(normalizeText).join("::")
}

function getCachedResult(key: string) {
  const cached = runtimeCache.get(key)
  if (!cached) return null

  if (cached.expiresAt < Date.now()) {
    runtimeCache.delete(key)
    return null
  }

  return cached.value
}

function setCachedResult(key: string, value: ResolvedDestinationImage) {
  runtimeCache.set(key, {
    value,
    expiresAt: Date.now() + RUNTIME_CACHE_TTL_MS,
  })
}

function extractCommonsFileName(entity: WikidataEntity | undefined) {
  const mediaClaims = entity?.claims?.P18
  if (!Array.isArray(mediaClaims) || mediaClaims.length === 0) return null

  for (const claim of mediaClaims) {
    const value = claim?.mainsnak?.datavalue?.value
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function buildCommonsImageUrl(fileName: string) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1600`
}

function scoreWikidataCandidate(candidate: NonNullable<WikidataSearchResponse["search"]>[number], query: string, country?: string | null) {
  const haystack = [candidate.label, candidate.description, candidate.match?.text].map(normalizeText).join(" ")
  let score = 0

  if (!haystack) return score

  const normalizedQuery = normalizeText(query)
  const normalizedCountry = normalizeText(country)

  if (candidate.match?.type === "label") score += 5
  if (haystack.includes(normalizedQuery)) score += 4
  if (normalizedCountry && haystack.includes(normalizedCountry)) score += 2
  if (haystack.includes("city")) score += 2
  if (haystack.includes("capital")) score += 1
  if (haystack.includes("municipality")) score += 1

  return score
}

async function searchWikidataEntity(params: ResolveDestinationImageParams) {
  const query = buildLocationQuery(params)
  if (!query) return null

  const searchUrl = new URL(WIKIDATA_API_URL)
  searchUrl.searchParams.set("action", "wbsearchentities")
  searchUrl.searchParams.set("format", "json")
  searchUrl.searchParams.set("language", "pt")
  searchUrl.searchParams.set("uselang", "pt")
  searchUrl.searchParams.set("type", "item")
  searchUrl.searchParams.set("limit", "5")
  searchUrl.searchParams.set("search", query)

  const searchResponse = await fetch(searchUrl, {
    headers: {
      "User-Agent": "VueiLink/1.0 (destination image resolver)",
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!searchResponse.ok) return null

  const searchPayload = (await searchResponse.json()) as WikidataSearchResponse
  const candidates = (searchPayload.search ?? [])
    .map((candidate) => ({
      candidate,
      score: scoreWikidataCandidate(candidate, query, params.country),
    }))
    .filter((entry) => typeof entry.candidate.id === "string" && entry.score > 0)
    .sort((left, right) => right.score - left.score)

  return candidates[0]?.candidate?.id ?? null
}

async function resolveWikimediaImage(params: ResolveDestinationImageParams) {
  const entityId = await searchWikidataEntity(params)
  if (!entityId) return null

  const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${entityId}.json`
  const entityResponse = await fetch(entityUrl, {
    headers: {
      "User-Agent": "VueiLink/1.0 (destination image resolver)",
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!entityResponse.ok) return null

  const entityPayload = (await entityResponse.json()) as WikidataEntityResponse
  const entity = entityPayload.entities?.[entityId]
  const fileName = extractCommonsFileName(entity)
  if (!fileName) return null

  return buildCommonsImageUrl(fileName)
}

async function resolveUnsplashImage(params: ResolveDestinationImageParams) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY_VUEI || null
  if (!accessKey) return null

  const query = buildLocationQuery(params)
  if (!query) return null

  const searchUrl = new URL(UNSPLASH_API_URL)
  searchUrl.searchParams.set("query", query)
  searchUrl.searchParams.set("page", "1")
  searchUrl.searchParams.set("per_page", "1")
  searchUrl.searchParams.set("orientation", "landscape")

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) return null

  const payload = (await response.json()) as UnsplashSearchResponse
  const imageUrl = payload.results?.[0]?.urls?.regular ?? payload.results?.[0]?.urls?.full ?? null
  return normalizeImageUrl(imageUrl)
}

export async function resolveDestinationImage(params: ResolveDestinationImageParams): Promise<ResolvedDestinationImage> {
  const cacheKey = buildCacheKey(params)
  if (cacheKey) {
    const cached = getCachedResult(cacheKey)
    if (cached) return cached
  }

  const wikimediaImage = await resolveWikimediaImage(params)
  if (wikimediaImage) {
    const result = { imageUrl: wikimediaImage, source: "wikimedia" as const }
    if (cacheKey) setCachedResult(cacheKey, result)
    return result
  }

  const unsplashImage = await resolveUnsplashImage(params)
  if (unsplashImage) {
    const result = { imageUrl: unsplashImage, source: "unsplash" as const }
    if (cacheKey) setCachedResult(cacheKey, result)
    return result
  }

  const fallback = { imageUrl: DEFAULT_TRIP_HERO_IMAGE, source: "fallback" as const }
  if (cacheKey) setCachedResult(cacheKey, fallback)
  return fallback
}
