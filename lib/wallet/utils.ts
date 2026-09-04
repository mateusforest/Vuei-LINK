import type {
  WalletAssetType,
  WalletBalance,
  WalletBalanceLookup,
  WalletOwnerReference,
  WalletOwnerType,
  WalletTransactionType,
} from "@/types"

export const WALLET_TRIP_LINK_ASSET_TYPE: WalletAssetType = "trip_link"

export const SUPPORTED_WALLET_ASSET_TYPES: WalletAssetType[] = [WALLET_TRIP_LINK_ASSET_TYPE]

export const SUPPORTED_WALLET_TRANSACTION_TYPES: WalletTransactionType[] = [
  "starter_grant",
  "purchase",
  "consume",
  "refund",
  "adjustment",
  "migration_grant",
]

export function isWalletAssetType(value: string | null | undefined): value is WalletAssetType {
  return SUPPORTED_WALLET_ASSET_TYPES.includes(value as WalletAssetType)
}

export function isWalletTransactionType(value: string | null | undefined): value is WalletTransactionType {
  return SUPPORTED_WALLET_TRANSACTION_TYPES.includes(value as WalletTransactionType)
}

export function getWalletOwnerId(reference: WalletOwnerReference) {
  return reference.ownerType === "agency" ? reference.agencyId ?? null : reference.ownerUserId ?? null
}

export function assertWalletOwnerReference(reference: WalletOwnerReference) {
  if (reference.ownerType === "traveler") {
    if (!reference.ownerUserId || reference.agencyId) {
      throw new Error("Wallet traveler exige owner_user_id e nao aceita agency_id.")
    }
    return
  }

  if (!reference.agencyId || reference.ownerUserId) {
    throw new Error("Wallet agency exige agency_id e nao aceita owner_user_id.")
  }
}

export function buildWalletOwnerFilter(reference: WalletOwnerReference) {
  assertWalletOwnerReference(reference)
  return reference.ownerType === "agency"
    ? { owner_type: reference.ownerType, agency_id: reference.agencyId!, owner_user_id: null }
    : { owner_type: reference.ownerType, owner_user_id: reference.ownerUserId!, agency_id: null }
}

export function buildWalletBalanceLookup(reference: WalletOwnerReference, assetType: WalletAssetType): WalletBalanceLookup {
  return {
    ...reference,
    assetType,
  }
}

export function getWalletDisplayAssetName(assetType: WalletAssetType) {
  if (assetType === "trip_link") return "Viagens disponíveis"
  return assetType
}

export function resolveWalletBalanceAfter(currentBalance: WalletBalance, amount: number) {
  const nextBalance = currentBalance.balance + amount
  if (nextBalance < 0) {
    throw new Error("Saldo insuficiente para esta operacao na wallet.")
  }
  return nextBalance
}
