export type WalletOwnerType = "traveler" | "agency"

export type WalletAssetType = "trip_link"

export type WalletTransactionType =
  | "starter_grant"
  | "purchase"
  | "consume"
  | "refund"
  | "adjustment"
  | "migration_grant"

export type WalletStatus = "active" | "archived"

export interface Wallet {
  id: string
  ownerType: WalletOwnerType
  ownerUserId: string | null
  agencyId: string | null
  status: WalletStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface WalletBalance {
  id: string
  walletId: string
  assetType: WalletAssetType
  balance: number
  starterGrantApplied: boolean
  createdAt: string
  updatedAt: string
}

export interface WalletTransaction {
  id: string
  walletId: string
  assetType: WalletAssetType
  transactionType: WalletTransactionType
  amount: number
  balanceAfter: number
  reason: string
  source: string
  tripId: string | null
  walletProductId: string | null
  stripeCheckoutSessionId: string | null
  stripePaymentIntentId: string | null
  idempotencyKey: string | null
  metadata: Record<string, unknown>
  createdBy: string | null
  createdAt: string
}

export interface WalletProduct {
  id: string
  code: string
  name: string
  assetType: WalletAssetType
  quantity: number
  active: boolean
  stripePriceId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface WalletSummary {
  wallet: Wallet
  balances: WalletBalance[]
}

export interface WalletOwnerReference {
  ownerType: WalletOwnerType
  ownerUserId?: string | null
  agencyId?: string | null
}

export interface WalletBalanceLookup extends WalletOwnerReference {
  assetType: WalletAssetType
}

export interface WalletTransactionListParams {
  walletId: string
  assetType?: WalletAssetType
  limit?: number
}

export interface WalletConsumeTripLinkParams {
  walletId: string
  tripId: string
  createdBy?: string | null
  reason?: string
  source?: string
  idempotencyKey?: string | null
}

export interface WalletGrantPurchaseParams {
  walletId: string
  assetType: WalletAssetType
  quantity: number
  walletProductId?: string | null
  stripeCheckoutSessionId?: string | null
  stripePaymentIntentId?: string | null
  createdBy?: string | null
  reason?: string
  source?: string
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export interface WalletRefundParams {
  walletId: string
  assetType: WalletAssetType
  quantity: number
  tripId?: string | null
  createdBy?: string | null
  reason?: string
  source?: string
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export interface WalletStarterGrantResult {
  applied: boolean
  balance: WalletBalance
}

export interface WalletCanConsumeResult {
  allowed: boolean
  balance: WalletBalance
  reasonCode: "insufficient_balance" | null
}
