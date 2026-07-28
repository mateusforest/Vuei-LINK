import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type {
  Wallet,
  WalletAssetType,
  WalletBalance,
  WalletBalanceLookup,
  WalletCanConsumeResult,
  WalletClaimPendingTripResult,
  WalletCreateAuthenticatedTravelerTripParams,
  WalletConsumeTripLinkParams,
  WalletGrantPurchaseParams,
  WalletOwnerReference,
  WalletProduct,
  WalletRefundParams,
  WalletStarterGrantResult,
  WalletSummary,
  WalletTransaction,
  WalletTransactionListParams,
} from "@/types"
import {
  createWallet,
  findWalletBalance,
  findWalletByOwner,
  findWalletProductByCode,
  findWalletTransactionByIdempotencyKey,
  listWalletBalances,
  listWalletProducts,
  listWalletTransactions,
} from "@/lib/wallet/repository"
import { WALLET_TRIP_LINK_ASSET_TYPE, assertWalletOwnerReference, buildWalletBalanceLookup, isWalletAssetType } from "@/lib/wallet/utils"

type SupabaseDbClient = SupabaseClient<Database>
type UntypedSupabaseClient = SupabaseDbClient & {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

interface WalletRpcStatusPayload {
  wallet_id: string
  balance_id: string
  asset_type: WalletAssetType
  balance: number
  starter_grant_applied: boolean
  applied?: boolean
  transaction_id?: string | null
}

type TripRow = Database["public"]["Tables"]["trips"]["Row"]

function mapRpcBalancePayload(payload: WalletRpcStatusPayload): WalletBalance {
  const nowIso = new Date().toISOString()
  return {
    id: payload.balance_id,
    walletId: payload.wallet_id,
    assetType: payload.asset_type,
    balance: payload.balance,
    starterGrantApplied: payload.starter_grant_applied,
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export class WalletService {
  constructor(private readonly client: SupabaseDbClient) {}

  async getOrCreateWallet(owner: WalletOwnerReference): Promise<Wallet> {
    assertWalletOwnerReference(owner)

    const existing = await findWalletByOwner(this.client, owner)
    if (existing.error) {
      throw new Error(existing.error)
    }
    if (existing.data) {
      return existing.data
    }

    const created = await createWallet(this.client, owner)
    if (created.error || !created.data) {
      throw new Error(created.error ?? "Nao foi possivel criar a wallet.")
    }

    return created.data
  }

  async getBalance(input: WalletBalanceLookup): Promise<WalletBalance> {
    const db = this.client as UntypedSupabaseClient
    const wallet = await this.getOrCreateWallet(input)
    const ensured = await db.rpc("ensure_wallet_balance", {
      p_wallet_id: wallet.id,
      p_asset_type: input.assetType,
    })

    if (ensured.error || !ensured.data) {
      throw new Error(ensured.error?.message ?? "Nao foi possivel garantir o saldo da wallet.")
    }

    return mapRpcBalancePayload(ensured.data as WalletRpcStatusPayload)
  }

  async getWalletSummary(owner: WalletOwnerReference): Promise<WalletSummary> {
    const wallet = await this.getOrCreateWallet(owner)
    const balancesResult = await listWalletBalances(this.client, wallet.id)
    if (balancesResult.error) {
      throw new Error(balancesResult.error)
    }

    return {
      wallet,
      balances: balancesResult.data,
    }
  }

  async listTransactions(params: WalletTransactionListParams): Promise<WalletTransaction[]> {
    const transactionsResult = await listWalletTransactions(this.client, params)
    if (transactionsResult.error) {
      throw new Error(transactionsResult.error)
    }
    return transactionsResult.data
  }

  async ensureStarterGrant(params: WalletBalanceLookup & { createdBy?: string | null }): Promise<WalletStarterGrantResult> {
    const db = this.client as UntypedSupabaseClient
    const wallet = await this.getOrCreateWallet(params)
    const result = await db.rpc("apply_wallet_starter_grant_if_needed", {
      p_wallet_id: wallet.id,
      p_asset_type: params.assetType,
      p_created_by: params.createdBy ?? null,
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel aplicar o starter grant.")
    }

    const payload = result.data as WalletRpcStatusPayload
    return {
      applied: payload.applied === true,
      balance: mapRpcBalancePayload(payload),
    }
  }

  async canConsumeTripLink(owner: WalletOwnerReference): Promise<WalletCanConsumeResult> {
    const balance = await this.getBalance(buildWalletBalanceLookup(owner, WALLET_TRIP_LINK_ASSET_TYPE))
    return {
      allowed: balance.balance > 0,
      balance,
      reasonCode: balance.balance > 0 ? null : "insufficient_balance",
    }
  }

  async consumeTripLinkForTrip(params: WalletConsumeTripLinkParams): Promise<WalletTransaction> {
    const db = this.client as UntypedSupabaseClient
    if (params.idempotencyKey) {
      const existing = await findWalletTransactionByIdempotencyKey(this.client, params.idempotencyKey)
      if (existing.error) {
        throw new Error(existing.error)
      }
      if (existing.data) {
        return existing.data
      }
    }

    const result = await db.rpc("consume_wallet_asset_for_trip", {
      p_wallet_id: params.walletId,
      p_asset_type: WALLET_TRIP_LINK_ASSET_TYPE,
      p_trip_id: params.tripId,
      p_created_by: params.createdBy ?? null,
      p_reason: params.reason ?? "Consumo de Link da Viagem",
      p_source: params.source ?? "wallet_service",
      p_idempotency_key: params.idempotencyKey ?? null,
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel consumir o ativo da wallet.")
    }

    const transactionResult = await findWalletTransactionByIdempotencyKey(this.client, params.idempotencyKey ?? "")
    if (!params.idempotencyKey || transactionResult.error || !transactionResult.data) {
      throw new Error(transactionResult.error ?? "Transacao de consumo nao encontrada apos o RPC.")
    }

    return transactionResult.data
  }

  async createAuthenticatedTravelerTripWithWallet(
    params: WalletCreateAuthenticatedTravelerTripParams,
  ): Promise<TripRow> {
    const db = this.client as UntypedSupabaseClient
    const result = await db.rpc("create_authenticated_traveler_trip_with_wallet", {
      p_owner_user_id: params.ownerUserId,
      p_title: params.title,
      p_slug: params.slug,
      p_destination: params.destination,
      p_country: params.country ?? null,
      p_city: params.city ?? null,
      p_start_date: params.startDate ?? null,
      p_end_date: params.endDate ?? null,
      p_status: params.status ?? "draft",
      p_style: params.style ?? null,
      p_admin_token: params.adminToken,
      p_public_token: params.publicToken,
      p_admin_link: params.adminLink,
      p_public_link: params.publicLink,
      p_cover_image: params.coverImage ?? null,
      p_visibility: params.visibility ?? "public",
      p_travelers_count: params.travelersCount ?? 1,
      p_permissions: params.permissions ?? {},
      p_credits_summary: params.creditsSummary ?? {},
      p_offline_enabled: params.offlineEnabled ?? false,
      p_source: params.source ?? "manual",
      p_idempotency_key: params.idempotencyKey ?? null,
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel criar a viagem com a wallet.")
    }

    return result.data as TripRow
  }

  async claimPendingTripWithWallet(params: {
    claimTokenHash: string
    userId: string
  }): Promise<WalletClaimPendingTripResult> {
    const db = this.client as UntypedSupabaseClient
    const result = await db.rpc("claim_pending_trip_with_wallet", {
      p_claim_token_hash: params.claimTokenHash,
      p_user_id: params.userId,
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel concluir o claim com a wallet.")
    }

    const payload = result.data as { status?: string; trip_id?: string | null }
    return {
      status:
        payload.status === "claimed" ||
        payload.status === "invalid" ||
        payload.status === "expired" ||
        payload.status === "already_claimed" ||
        payload.status === "insufficient_balance"
          ? payload.status
          : "invalid",
      tripId: typeof payload.trip_id === "string" ? payload.trip_id : null,
    }
  }

  async grantPurchase(params: WalletGrantPurchaseParams): Promise<WalletTransaction> {
    const db = this.client as UntypedSupabaseClient
    const result = await db.rpc("grant_wallet_purchase", {
      p_wallet_id: params.walletId,
      p_asset_type: params.assetType,
      p_quantity: params.quantity,
      p_wallet_product_id: params.walletProductId ?? null,
      p_stripe_checkout_session_id: params.stripeCheckoutSessionId ?? null,
      p_stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
      p_created_by: params.createdBy ?? null,
      p_reason: params.reason ?? "Compra de saldo da wallet",
      p_source: params.source ?? "wallet_service",
      p_idempotency_key: params.idempotencyKey ?? null,
      p_metadata: params.metadata ?? {},
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel registrar a compra da wallet.")
    }

    if (params.idempotencyKey) {
      const transactionResult = await findWalletTransactionByIdempotencyKey(this.client, params.idempotencyKey)
      if (transactionResult.error || !transactionResult.data) {
        throw new Error(transactionResult.error ?? "Transacao de compra nao encontrada apos o RPC.")
      }
      return transactionResult.data
    }

    throw new Error("Compra da wallet exige idempotency_key para leitura consistente da transacao.")
  }

  async refund(params: WalletRefundParams): Promise<WalletTransaction> {
    const db = this.client as UntypedSupabaseClient
    const result = await db.rpc("refund_wallet_asset", {
      p_wallet_id: params.walletId,
      p_asset_type: params.assetType,
      p_quantity: params.quantity,
      p_trip_id: params.tripId ?? null,
      p_created_by: params.createdBy ?? null,
      p_reason: params.reason ?? "Estorno de saldo da wallet",
      p_source: params.source ?? "wallet_service",
      p_idempotency_key: params.idempotencyKey ?? null,
      p_metadata: params.metadata ?? {},
    })

    if (result.error || !result.data) {
      throw new Error(result.error?.message ?? "Nao foi possivel estornar o saldo da wallet.")
    }

    if (params.idempotencyKey) {
      const transactionResult = await findWalletTransactionByIdempotencyKey(this.client, params.idempotencyKey)
      if (transactionResult.error || !transactionResult.data) {
        throw new Error(transactionResult.error ?? "Transacao de estorno nao encontrada apos o RPC.")
      }
      return transactionResult.data
    }

    throw new Error("Estorno da wallet exige idempotency_key para leitura consistente da transacao.")
  }

  async listProducts(assetType?: WalletAssetType): Promise<WalletProduct[]> {
    const productsResult = await listWalletProducts(this.client, assetType)
    if (productsResult.error) {
      throw new Error(productsResult.error)
    }
    return productsResult.data
  }

  async getProductByCode(code: string): Promise<WalletProduct | null> {
    const productResult = await findWalletProductByCode(this.client, code)
    if (productResult.error) {
      throw new Error(productResult.error)
    }
    return productResult.data
  }
}

export function createWalletService(client: SupabaseDbClient) {
  return new WalletService(client)
}

export async function getWalletBalanceWithService(
  client: SupabaseDbClient,
  owner: WalletOwnerReference,
  assetType: WalletAssetType,
) {
  if (!isWalletAssetType(assetType)) {
    throw new Error("Tipo de ativo de wallet invalido.")
  }

  const service = createWalletService(client)
  return service.getBalance(buildWalletBalanceLookup(owner, assetType))
}
