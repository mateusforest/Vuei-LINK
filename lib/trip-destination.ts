type DestinationProfile = {
  matches: string[]
  image: string
  country: string
  language: string
  timezone: string
  currency: { name: string; symbol: string; rate: string }
  emergency: string
}

const destinationCoverMap: DestinationProfile[] = [
  {
    matches: ["new york", "nova york", "orlando", "eua", "usa", "estados unidos"],
    image: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80",
    country: "Estados Unidos",
    language: "Ingles",
    timezone: "America/New_York",
    currency: { name: "Dolar americano", symbol: "USD", rate: "Nao informado" },
    emergency: "911",
  },
  {
    matches: ["paris", "franca", "france"],
    image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80",
    country: "Franca",
    language: "Frances",
    timezone: "Europe/Paris",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    matches: ["roma", "rome", "italia", "italy"],
    image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=80",
    country: "Italia",
    language: "Italiano",
    timezone: "Europe/Rome",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    matches: ["tokyo", "toquio", "tóquio", "japao", "japan"],
    image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80",
    country: "Japao",
    language: "Japones",
    timezone: "Asia/Tokyo",
    currency: { name: "Iene", symbol: "JPY", rate: "Nao informado" },
    emergency: "110 / 119",
  },
  {
    matches: ["bali"],
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80",
    country: "Indonesia",
    language: "Indonesio",
    timezone: "Asia/Makassar",
    currency: { name: "Rupia indonesa", symbol: "IDR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    matches: ["dubai", "emirados arabes", "emirados", "uae", "united arab emirates"],
    image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=80",
    country: "Emirados Arabes Unidos",
    language: "Arabe",
    timezone: "Asia/Dubai",
    currency: { name: "Dirham dos Emirados", symbol: "AED", rate: "Nao informado" },
    emergency: "999 / 998",
  },
  {
    matches: ["londres", "london"],
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80",
    country: "Reino Unido",
    language: "Ingles",
    timezone: "Europe/London",
    currency: { name: "Libra esterlina", symbol: "GBP", rate: "Nao informado" },
    emergency: "999",
  },
  {
    matches: ["gramado"],
    image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80",
    country: "Brasil",
    language: "Portugues",
    timezone: "America/Sao_Paulo",
    currency: { name: "Real", symbol: "BRL", rate: "Nao informado" },
    emergency: "190 / 192 / 193",
  },
  {
    matches: ["cancun", "cancún"],
    image: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=1920&q=80",
    country: "Mexico",
    language: "Espanhol",
    timezone: "America/Cancun",
    currency: { name: "Peso mexicano", symbol: "MXN", rate: "Nao informado" },
    emergency: "911",
  },
  {
    matches: ["lisboa", "lisbon", "portugal"],
    image: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&q=80",
    country: "Portugal",
    language: "Portugues",
    timezone: "Europe/Lisbon",
    currency: { name: "Euro", symbol: "EUR", rate: "Nao informado" },
    emergency: "112",
  },
  {
    matches: ["buenos aires"],
    image: "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80",
    country: "Argentina",
    language: "Espanhol",
    timezone: "America/Argentina/Buenos_Aires",
    currency: { name: "Peso argentino", symbol: "ARS", rate: "Nao informado" },
    emergency: "911",
  },
]

const neutralCover = "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1920&q=80"

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function resolveDestinationEntry(destination?: string | null, city?: string | null, country?: string | null) {
  const target = `${normalizeText(destination)} ${normalizeText(city)} ${normalizeText(country)}`.trim()
  return destinationCoverMap.find((entry) => entry.matches.some((match) => target.includes(normalizeText(match)))) ?? null
}

function resolveCountryEntry(country?: string | null) {
  const normalizedCountry = normalizeText(country)
  if (!normalizedCountry) return null

  return (
    destinationCoverMap.find((entry) => normalizeText(entry.country) === normalizedCountry) ??
    destinationCoverMap.find((entry) => entry.matches.some((match) => normalizeText(match) === normalizedCountry)) ??
    null
  )
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
  return resolveDestinationEntry(destination, city, country)?.image ?? neutralCover
}

export function getDestinationMetadata(destination?: string | null, country?: string | null, city?: string | null) {
  const entry = resolveDestinationEntry(destination, city, country) ?? resolveCountryEntry(country)

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
