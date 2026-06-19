import { NextRequest, NextResponse } from "next/server"
import { resolveDestinationImage } from "@/lib/destination-image-resolver"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const destination = url.searchParams.get("destination")
    const city = url.searchParams.get("city")
    const country = url.searchParams.get("country")

    const result = await resolveDestinationImage({
      destination,
      city,
      country,
    })

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
      },
    })
  } catch (error) {
    console.error("[DESTINATION IMAGE] failed to resolve image", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "N?o foi poss?vel resolver a imagem do destino." },
      { status: 500 },
    )
  }
}
