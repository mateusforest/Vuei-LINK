import "server-only"

import { DEFAULT_TRIP_HERO_IMAGE, normalizeImageUrl } from "@/lib/trip-destination"

type ResolveDestinationImageParams = {
  destination?: string | null
  city?: string | null
  country?: string | null
}

type ResolveStrategy = "cover_image_existing" | "fallback"

type ResolvedDestinationImage = {
  imageUrl: string | null
  source: "fallback"
  strategy: ResolveStrategy
}

export async function resolveDestinationImage(params: ResolveDestinationImageParams): Promise<ResolvedDestinationImage> {
  console.info("[DESTINATION IMAGE] resolved institutional fallback", {
    destination: params.destination ?? null,
    country: params.country ?? null,
    strategy: "fallback",
  })

  return {
    imageUrl: normalizeImageUrl(DEFAULT_TRIP_HERO_IMAGE),
    source: "fallback",
    strategy: "fallback",
  }
}
