import { NextResponse } from "next/server"
import { shouldUseSupabase } from "@/lib/data-source"
import {
  getTravelerTripLinkProductPlaceholders,
  listTravelerTripLinkStoreProducts,
} from "@/lib/billing/traveler-trip-link-store-products"
import { hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import type { TravelerTripLinkProductsSummary } from "@/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const products = shouldUseSupabase() && hasSupabaseAdminEnv()
      ? await listTravelerTripLinkStoreProducts()
      : getTravelerTripLinkProductPlaceholders()
    const response: TravelerTripLinkProductsSummary = { products }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    })
  } catch (error) {
    console.error("[TRAVELER TRIP LINK] public products error", error instanceof Error ? error.message : error)
    const response: TravelerTripLinkProductsSummary = {
      products: getTravelerTripLinkProductPlaceholders(),
    }
    return NextResponse.json(response, { status: 200 })
  }
}
