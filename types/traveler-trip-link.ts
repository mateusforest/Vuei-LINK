import type { TravelerTripLinkProductCode } from "@/lib/billing/traveler-trip-link-catalog"
import type { WalletTransactionType } from "@/types/wallet"

export interface TravelerTripLinkStoreProduct {
  code: TravelerTripLinkProductCode
  name: string
  quantity: number
  configured: boolean
  priceLabel: string | null
}

export interface TravelerTripLinkHistoryItem {
  id: string
  transactionType: WalletTransactionType
  amount: number
  balanceAfter: number
  reason: string
  tripId: string | null
  createdAt: string
}

export interface TravelerTripLinkStoreSummary {
  balance: number
  products: TravelerTripLinkStoreProduct[]
  transactions: TravelerTripLinkHistoryItem[]
}
