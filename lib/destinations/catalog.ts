export type DestinationOption = {
  id: string
  city: string
  country: string
  countryCode: string
  label: string
  aliases: string[]
  coverImageUrl?: string
  timezone?: string
  currency?: string
  language?: string
}

export type ResolvedDestinationInput = {
  id: string | null
  label: string
  city: string | null
  country: string | null
  countryCode: string | null
  coverImageUrl: string | null
  timezone: string | null
  currency: string | null
  language: string | null
  matchedCatalog: boolean
}

export const DESTINATION_CATALOG: DestinationOption[] = [
  {
    id: "rio-de-janeiro-br",
    city: "Rio de Janeiro",
    country: "Brasil",
    countryCode: "BR",
    label: "Rio de Janeiro, Brasil",
    aliases: ["rio", "rio de", "rj"],
    coverImageUrl: "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1920&q=80",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "sao-paulo-br",
    city: "Sao Paulo",
    country: "Brasil",
    countryCode: "BR",
    label: "Sao Paulo, Brasil",
    aliases: ["sao paulo", "sp"],
    coverImageUrl: "https://images.unsplash.com/photo-1543059080-f9b1272213d5?w=1920&q=80",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "gramado-br",
    city: "Gramado",
    country: "Brasil",
    countryCode: "BR",
    label: "Gramado, Brasil",
    aliases: ["gramado serra gaucha"],
    coverImageUrl: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1920&q=80",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "florianopolis-br",
    city: "Florianopolis",
    country: "Brasil",
    countryCode: "BR",
    label: "Florianopolis, Brasil",
    aliases: ["floripa", "florianopolis", "florianopolis sc"],
    coverImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "salvador-br",
    city: "Salvador",
    country: "Brasil",
    countryCode: "BR",
    label: "Salvador, Brasil",
    aliases: ["salvador bahia", "ssa"],
    coverImageUrl: "https://images.unsplash.com/photo-1520637836862-4d197d17c93a?w=1920&q=80",
    timezone: "America/Bahia",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "foz-do-iguacu-br",
    city: "Foz do Iguacu",
    country: "Brasil",
    countryCode: "BR",
    label: "Foz do Iguacu, Brasil",
    aliases: ["foz", "iguacu", "cataratas"],
    coverImageUrl: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    language: "pt-BR",
  },
  {
    id: "buenos-aires-ar",
    city: "Buenos Aires",
    country: "Argentina",
    countryCode: "AR",
    label: "Buenos Aires, Argentina",
    aliases: ["buenos aires"],
    coverImageUrl: "https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=1920&q=80",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
    language: "es-AR",
  },
  {
    id: "santiago-cl",
    city: "Santiago",
    country: "Chile",
    countryCode: "CL",
    label: "Santiago, Chile",
    aliases: ["santiago do chile", "scl"],
    coverImageUrl: "https://images.unsplash.com/photo-1544989164-22ad3f104515?w=1920&q=80",
    timezone: "America/Santiago",
    currency: "CLP",
    language: "es-CL",
  },
  {
    id: "paris-fr",
    city: "Paris",
    country: "Franca",
    countryCode: "FR",
    label: "Paris, Franca",
    aliases: ["paris france"],
    coverImageUrl: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80",
    timezone: "Europe/Paris",
    currency: "EUR",
    language: "fr-FR",
  },
  {
    id: "londres-gb",
    city: "Londres",
    country: "Reino Unido",
    countryCode: "GB",
    label: "Londres, Reino Unido",
    aliases: ["london", "londres uk"],
    coverImageUrl: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80",
    timezone: "Europe/London",
    currency: "GBP",
    language: "en-GB",
  },
  {
    id: "lisboa-pt",
    city: "Lisboa",
    country: "Portugal",
    countryCode: "PT",
    label: "Lisboa, Portugal",
    aliases: ["lisbon", "lisboa pt"],
    coverImageUrl: "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1920&q=80",
    timezone: "Europe/Lisbon",
    currency: "EUR",
    language: "pt-PT",
  },
  {
    id: "roma-it",
    city: "Roma",
    country: "Italia",
    countryCode: "IT",
    label: "Roma, Italia",
    aliases: ["rome", "roma italia"],
    coverImageUrl: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&q=80",
    timezone: "Europe/Rome",
    currency: "EUR",
    language: "it-IT",
  },
  {
    id: "madrid-es",
    city: "Madrid",
    country: "Espanha",
    countryCode: "ES",
    label: "Madrid, Espanha",
    aliases: ["madrid espana"],
    coverImageUrl: "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1920&q=80",
    timezone: "Europe/Madrid",
    currency: "EUR",
    language: "es-ES",
  },
  {
    id: "nova-york-us",
    city: "Nova York",
    country: "Estados Unidos",
    countryCode: "US",
    label: "Nova York, Estados Unidos",
    aliases: ["new york", "nyc", "nova iorque"],
    coverImageUrl: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80",
    timezone: "America/New_York",
    currency: "USD",
    language: "en-US",
  },
  {
    id: "orlando-us",
    city: "Orlando",
    country: "Estados Unidos",
    countryCode: "US",
    label: "Orlando, Estados Unidos",
    aliases: ["orlando florida"],
    coverImageUrl: "https://images.unsplash.com/photo-1515260268569-9271009adfdb?w=1920&q=80",
    timezone: "America/New_York",
    currency: "USD",
    language: "en-US",
  },
  {
    id: "miami-us",
    city: "Miami",
    country: "Estados Unidos",
    countryCode: "US",
    label: "Miami, Estados Unidos",
    aliases: ["miami florida"],
    coverImageUrl: "https://images.unsplash.com/photo-1514214246283-d427a95c5d2f?w=1920&q=80",
    timezone: "America/New_York",
    currency: "USD",
    language: "en-US",
  },
  {
    id: "cancun-mx",
    city: "Cancun",
    country: "Mexico",
    countryCode: "MX",
    label: "Cancun, Mexico",
    aliases: ["cancun mexico"],
    coverImageUrl: "https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=1920&q=80",
    timezone: "America/Cancun",
    currency: "MXN",
    language: "es-MX",
  },
  {
    id: "dubai-ae",
    city: "Dubai",
    country: "Emirados Arabes Unidos",
    countryCode: "AE",
    label: "Dubai, Emirados Arabes Unidos",
    aliases: ["dubai uae", "emirados", "eau"],
    coverImageUrl: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&q=80",
    timezone: "Asia/Dubai",
    currency: "AED",
    language: "ar-AE",
  },
  {
    id: "tokyo-jp",
    city: "Tokyo",
    country: "Japao",
    countryCode: "JP",
    label: "Tokyo, Japao",
    aliases: ["toquio", "tokio", "tokyo japan"],
    coverImageUrl: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80",
    timezone: "Asia/Tokyo",
    currency: "JPY",
    language: "ja-JP",
  },
]

export function normalizeDestinationText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getSearchTokens(option: DestinationOption) {
  return [
    option.id,
    option.city,
    option.country,
    option.countryCode,
    option.label,
    ...option.aliases,
  ].map((value) => normalizeDestinationText(value))
}

export function getDestinationOptionById(id?: string | null) {
  if (!id) return null
  return DESTINATION_CATALOG.find((option) => option.id === id) ?? null
}

export function searchDestinationOptions(query: string, limit = 6) {
  const normalizedQuery = normalizeDestinationText(query)
  if (!normalizedQuery) {
    return DESTINATION_CATALOG.slice(0, limit)
  }

  return [...DESTINATION_CATALOG]
    .map((option) => {
      const tokens = getSearchTokens(option)
      const score = tokens.reduce((best, token) => {
        if (token === normalizedQuery) return Math.max(best, 100)
        if (token.startsWith(normalizedQuery)) return Math.max(best, 80)
        if (token.includes(normalizedQuery)) return Math.max(best, 60)
        if (normalizedQuery.includes(token)) return Math.max(best, 40)
        return best
      }, 0)

      return { option, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.option.label.localeCompare(right.option.label))
    .slice(0, limit)
    .map((entry) => entry.option)
}

export function resolveDestinationOption(input?: string | null, selectedId?: string | null) {
  const selected = getDestinationOptionById(selectedId)
  if (selected) return selected

  const normalizedInput = normalizeDestinationText(input)
  if (!normalizedInput) return null

  const exact = DESTINATION_CATALOG.find((option) =>
    getSearchTokens(option).some((token) => token === normalizedInput)
  )
  if (exact) return exact

  return searchDestinationOptions(normalizedInput, 1)[0] ?? null
}

export function resolveDestinationInput(input: string, selectedId?: string | null): ResolvedDestinationInput {
  const matchedOption = resolveDestinationOption(input, selectedId)
  if (matchedOption) {
    return {
      id: matchedOption.id,
      label: matchedOption.label,
      city: matchedOption.city,
      country: matchedOption.country,
      countryCode: matchedOption.countryCode,
      coverImageUrl: matchedOption.coverImageUrl ?? null,
      timezone: matchedOption.timezone ?? null,
      currency: matchedOption.currency ?? null,
      language: matchedOption.language ?? null,
      matchedCatalog: true,
    }
  }

  const normalizedLabel = input.trim()
  const parts = normalizedLabel.split(",").map((part) => part.trim()).filter(Boolean)

  return {
    id: null,
    label: normalizedLabel,
    city: parts[0] || normalizedLabel || null,
    country: parts.length > 1 ? parts[parts.length - 1] : null,
    countryCode: null,
    coverImageUrl: null,
    timezone: null,
    currency: null,
    language: null,
    matchedCatalog: false,
  }
}
