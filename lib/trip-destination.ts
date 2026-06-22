type DestinationProfile = {
  locationAliases: string[]
  countryAliases: string[]
  image: string
  country: string
  language: string
  timezone: string
  currency: { name: string; symbol: string; rate: string }
  emergency: string
}

const destinationCoverMap: DestinationProfile[] = [
  {
    locationAliases: ["new york", "nova york"],
    countryAliases: ["estados unidos", "usa", "eua", "united states", "united states of america"],
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80",
    country: "Estados Unidos",
    language: "Ingles",
    timezone: "America/New_York",
    currency: { name: "Dolar americano", symbol: "USD", rate: "Nao informado" },
    emergency: "911",
  },
  {
    locationAliases: ["orlando"],
    countryAliases: ["estados unidos", "usa", "eua", "united states", "united states of america"],
    image: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=1920&q=80",
    country: "Estados Unidos",
    language: "Ingles",
    timezone: "America/New_York",
    currency: { name: "Dolar americano", symbol: "USD", rate: "Nao informado" },
    emergency: "911",
  },
  {
    locationAliases: ["paris"],
    countryAliases: ["franca", "france"],
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80",
    country: "Franca",
    language: "Frances",
    timezone: "Europe/Paris",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    locationAliases: ["roma", "rome"],
    countryAliases: ["italia", "italy"],
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=80",
    country: "Italia",
    language: "Italiano",
    timezone: "Europe/Rome",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    locationAliases: ["tokyo", "toquio"],
    countryAliases: ["japao", "japan"],
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80",
    country: "Japao",
    language: "Japones",
    timezone: "Asia/Tokyo",
    currency: { name: "Iene", symbol: "JPY", rate: "Nao informado" },
    emergency: "110 / 119",
  },
  {
    locationAliases: ["bali"],
    countryAliases: ["indonesia"],
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80",
    country: "Indonesia",
    language: "Indonesio",
    timezone: "Asia/Makassar",
    currency: { name: "Rupia indonesa", symbol: "IDR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    locationAliases: ["dubai"],
    countryAliases: ["emirados arabes", "emirados", "uae", "united arab emirates", "emirados arabes unidos"],
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=80",
    country: "Emirados Arabes Unidos",
    language: "Arabe",
    timezone: "Asia/Dubai",
    currency: { name: "Dirham dos Emirados", symbol: "AED", rate: "Nao informado" },
    emergency: "999 / 998",
  },
  {
    locationAliases: ["londres", "london"],
    countryAliases: ["reino unido", "united kingdom", "inglaterra", "england", "uk"],
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80",
    country: "Reino Unido",
    language: "Ingles",
    timezone: "Europe/London",
    currency: { name: "Libra esterlina", symbol: "GBP", rate: "Nao informado" },
    emergency: "999",
  },
  {
    locationAliases: ["gramado"],
    countryAliases: ["brasil", "brazil"],
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80",
    country: "Brasil",
    language: "Portugues",
    timezone: "America/Sao_Paulo",
    currency: { name: "Real", symbol: "BRL", rate: "Nao informado" },
    emergency: "190 / 192 / 193",
  },
  {
    locationAliases: ["cancun"],
    countryAliases: ["mexico"],
    image: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=1920&q=80",
    country: "Mexico",
    language: "Espanhol",
    timezone: "America/Cancun",
    currency: { name: "Peso mexicano", symbol: "MXN", rate: "Nao informado" },
    emergency: "911",
  },
  {
    locationAliases: ["lisboa", "lisbon"],
    countryAliases: ["portugal"],
    image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&q=80",
    country: "Portugal",
    language: "Portugues",
    timezone: "Europe/Lisbon",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    locationAliases: ["buenos aires"],
    countryAliases: ["argentina"],
    image: "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80",
    country: "Argentina",
    language: "Espanhol",
    timezone: "America/Argentina/Buenos_Aires",
    currency: { name: "Peso argentino", symbol: "ARS", rate: "Nao informado" },
    emergency: "911",
  },
  {
    locationAliases: ["cusco", "cuzco"],
    countryAliases: ["peru"],
    image: "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1920&q=80",
    country: "Peru",
    language: "Espanhol",
    timezone: "America/Lima",
    currency: { name: "Sol peruano", symbol: "PEN", rate: "Nao informado" },
    emergency: "105 / 116",
  },
]

const countryCoverMap: Array<{ aliases: string[]; image: string }> = [
  {
    aliases: ["estados unidos", "usa", "eua", "united states", "united states of america"],
    image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80",
  },
  {
    aliases: ["franca", "france"],
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80",
  },
  {
    aliases: ["italia", "italy"],
    image: "https://images.unsplash.com/photo-1525874684015-58379d421a52?w=1920&q=80",
  },
  {
    aliases: ["brasil", "brazil"],
    image: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1920&q=80",
  },
  {
    aliases: ["mexico"],
    image: "https://images.unsplash.com/photo-1512813195386-6cf811ad3542?w=1920&q=80",
  },
  {
    aliases: ["peru"],
    image: "https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1920&q=80",
  },
  {
    aliases: ["argentina"],
    image: "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=1920&q=80",
  },
  {
    aliases: ["portugal"],
    image: "https://images.unsplash.com/photo-1513735492246-483525079686?w=1920&q=80",
  },
  {
    aliases: ["japao", "japan"],
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80",
  },
  {
    aliases: ["reino unido", "united kingdom", "inglaterra", "england", "uk"],
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80",
  },
  {
    aliases: ["emirados arabes", "emirados", "uae", "united arab emirates", "emirados arabes unidos"],
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=80",
  },
  {
    aliases: ["indonesia"],
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80",
  },
]

const neutralCover = "/travel/default-trip-cover.png"

export const DEFAULT_TRIP_HERO_IMAGE = neutralCover

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function normalizeImageUrl(value?: string | null) {
  if (typeof value !== "string") return null

  const normalized = value.trim()
  if (!normalized) return null

  const lowered = normalized.toLowerCase()
  if (lowered === "null" || lowered === "undefined" || lowered === "nan") {
    return null
  }

  return normalized
}

function extractNormalizedParts(value?: string | null) {
  const raw = (value ?? "").trim()
  if (!raw) return []

  const parts = raw
    .split(",")
    .map((part) => normalizeText(part))
    .filter(Boolean)

  const direct = normalizeText(raw)
  return Array.from(new Set([direct, ...parts]))
}

function buildLocationCandidates(destination?: string | null, city?: string | null) {
  return Array.from(new Set([...extractNormalizedParts(city), ...extractNormalizedParts(destination)]))
}

function buildCountryCandidates(destination?: string | null, country?: string | null) {
  const explicitCountry = extractNormalizedParts(country)
  const destinationParts = extractNormalizedParts(destination)
  const destinationTail = destinationParts.length > 1 ? destinationParts[destinationParts.length - 1] : null

  return Array.from(new Set([...explicitCountry, ...(destinationTail ? [destinationTail] : [])]))
}

function locationAliasMatches(entry: DestinationProfile, locationCandidates: string[]) {
  return locationCandidates.some((candidate) => entry.locationAliases.some((alias) => normalizeText(alias) === candidate))
}

function countryAliasMatches(countryAliases: string[], countryCandidates: string[]) {
  return countryCandidates.some((candidate) => countryAliases.some((alias) => normalizeText(alias) === candidate))
}

function resolveDestinationEntry(destination?: string | null, city?: string | null, country?: string | null) {
  const locationCandidates = buildLocationCandidates(destination, city)
  const countryCandidates = buildCountryCandidates(destination, country)

  return (
    destinationCoverMap.find((entry) => {
      const locationMatch = locationAliasMatches(entry, locationCandidates)
      const countryMatch = countryCandidates.length === 0 || countryAliasMatches(entry.countryAliases, countryCandidates)
      return locationMatch && countryMatch
    }) ?? null
  )
}

function resolveDestinationCoverEntry(destination?: string | null, city?: string | null, country?: string | null) {
  const locationCandidates = buildLocationCandidates(destination, city)
  const countryCandidates = buildCountryCandidates(destination, country)

  if (countryCandidates.length > 0) {
    return (
      destinationCoverMap.find(
        (entry) => locationAliasMatches(entry, locationCandidates) && countryAliasMatches(entry.countryAliases, countryCandidates)
      ) ?? null
    )
  }

  return destinationCoverMap.find((entry) => locationAliasMatches(entry, locationCandidates)) ?? null
}

function resolveCountryEntry(country?: string | null, destination?: string | null) {
  const countryCandidates = buildCountryCandidates(destination, country)
  if (countryCandidates.length === 0) return null

  return countryCoverMap.find((entry) => countryAliasMatches(entry.aliases, countryCandidates)) ?? null
}

function resolveCountryMetadataEntry(country?: string | null, destination?: string | null) {
  const countryCandidates = buildCountryCandidates(destination, country)
  if (countryCandidates.length === 0) return null

  return destinationCoverMap.find((entry) => countryAliasMatches(entry.countryAliases, countryCandidates)) ?? null
}

function buildEmbassyFallback(country?: string | null) {
  const normalizedCountry = normalizeText(country)
  if (!normalizedCountry) return "Nao informado"
  if (normalizedCountry === "brasil" || normalizedCountry === "brazil") {
    return "Nao se aplica para viagens nacionais."
  }

  return `Consulado/embaixada brasileira em ${country}`
}

export function getDestinationCoverImage(destination?: string | null, city?: string | null, country?: string | null) {
  void destination
  void city
  void country
  return neutralCover
}

export function resolveTripHeroImage(params: {
  coverImage?: string | null
  destination?: string | null
  city?: string | null
  country?: string | null
}) {
  return normalizeImageUrl(params.coverImage) ?? neutralCover
}

export function resolveAgencyBrandLogo(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate)
    if (normalized) return normalized
  }

  return null
}

export function getDestinationMetadata(destination?: string | null, country?: string | null, city?: string | null) {
  const entry = resolveDestinationEntry(destination, city, country) ?? resolveCountryMetadataEntry(country, destination)

  const resolvedCountry = country?.trim() || entry?.country || "Nao informado"

  return {
    currency: entry?.currency ?? { name: "Nao informado", symbol: "-", rate: "Nao informado" },
    language: entry?.language ?? "Nao informado",
    timezone: entry?.timezone ?? "Nao informado",
    emergency: entry?.emergency ?? "Nao informado",
    embassy: buildEmbassyFallback(resolvedCountry !== "Nao informado" ? resolvedCountry : null),
    country: resolvedCountry,
  }
}
