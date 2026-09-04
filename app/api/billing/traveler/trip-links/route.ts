import { NextResponse } from "next/server"
import { ensureProfile } from "@/lib/auth/ensure-profile"
import { shouldUseSupabase } from "@/lib/data-source"
import { getStripeClient } from "@/lib/billing/stripe"
import {
  TRAVELER_TRIP_LINK_PRODUCTS,
  getTravelerTripLinkProduct,
} from "@/lib/billing/traveler-trip-link-catalog"
import {
  formatStripePrice,
  getTravelerTripLinkPriceMap,
} from "@/lib/billing/traveler-trip-link-products"
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createWalletService } from "@/lib/wallet"
import type { TravelerTripLinkStoreSummary } from "@/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!shouldUseSupabase() || !hasSupabaseAdminEnv()) {
      return NextResponse.json({ error: "A carteira de viagens nao esta disponivel." }, { status: 503 })
    }

    const supabase = await createSupabaseServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Supabase indisponivel." }, { status: 503 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Entre para consultar suas viagens disponiveis." }, { status: 401 })
    }

    const profile = await ensureProfile(user, supabase)
    if (!profile || profile.role !== "traveler") {
      return NextResponse.json({ error: "Esta carteira esta disponivel apenas para viajantes." }, { status: 403 })
    }

    const adminClient = createSupabaseAdminClient()
    const walletService = createWalletService(adminClient)
    const wallet = await walletService.getOrCreateWallet({ ownerType: "traveler", ownerUserId: user.id })
    const [balance, transactions, databaseProducts] = await Promise.all([
      walletService.getBalance({ ownerType: "traveler", ownerUserId: user.id, assetType: "trip_link" }),
      walletService.listTransactions({ walletId: wallet.id, assetType: "trip_link", limit: 30 }),
      walletService.listProducts("trip_link"),
    ])

    const databaseProductsByCode = new Map(databaseProducts.map((product) => [product.code, product]))
    const configuredPrices = getTravelerTripLinkPriceMap()
    const hasConfiguredPrice = Object.values(configuredPrices).some(Boolean)
    const stripe = hasConfiguredPrice
      ? (() => {
          try {
            return getStripeClient()
          } catch {
            return null
          }
        })()
      : null

    const products = await Promise.all(TRAVELER_TRIP_LINK_PRODUCTS.map(async (definition) => {
      const databaseProduct = databaseProductsByCode.get(definition.code)
      const priceId = configuredPrices[definition.code]?.trim() || null
      const isDatabaseProductValid = Boolean(
        databaseProduct?.active &&
        databaseProduct.assetType === "trip_link" &&
        databaseProduct.quantity === definition.quantity &&
        getTravelerTripLinkProduct(databaseProduct.code),
      )

      if (!priceId || !isDatabaseProductValid || !stripe) {
        return {
          code: definition.code,
          name: definition.name,
          quantity: definition.quantity,
          configured: false,
          priceLabel: null,
        }
      }

      try {
        const price = await stripe.prices.retrieve(priceId)
        const priceLabel = price.active && price.type === "one_time" ? formatStripePrice(price) : null
        return {
          code: definition.code,
          name: definition.name,
          quantity: definition.quantity,
          configured: Boolean(priceLabel),
          priceLabel,
        }
      } catch {
        return {
          code: definition.code,
          name: definition.name,
          quantity: definition.quantity,
          configured: false,
          priceLabel: null,
        }
      }
    }))

    const response: TravelerTripLinkStoreSummary = {
      balance: balance.balance,
      products,
      transactions: transactions.map((transaction) => ({
        id: transaction.id,
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        reason: transaction.reason,
        tripId: transaction.tripId,
        createdAt: transaction.createdAt,
      })),
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    console.error("[TRAVELER TRIP LINK] store summary error", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Nao foi possivel carregar a carteira de viagens." }, { status: 500 })
  }
}
