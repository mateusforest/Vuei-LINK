import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type {
  Wallet,
  WalletAssetType,
  WalletBalance,
  WalletOwnerReference,
  WalletProduct,
  WalletTransaction,
  WalletTransactionListParams,
  WalletTransactionType,
} from "@/types"
import { assertWalletOwnerReference, buildWalletOwnerFilter } from "@/lib/wallet/utils"

type SupabaseDbClient = SupabaseClient<Database>
type WalletRow = Database["public"]["Tables"]["wallets"]["Row"]
type WalletInsert = Database["public"]["Tables"]["wallets"]["Insert"]
type WalletBalanceRow = Database["public"]["Tables"]["wallet_balances"]["Row"]
type WalletTransactionRow = Database["public"]["Tables"]["wallet_transactions"]["Row"]
type WalletProductRow = Database["public"]["Tables"]["wallet_products"]["Row"]
type UntypedSupabaseClient = {
  from: (table: string) => any
  rpc: (functionName: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>
}

function mapWalletRow(row: WalletRow): Wallet {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerUserId: row.owner_user_id,
    agencyId: row.agency_id,
    status: row.status,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWalletBalanceRow(row: WalletBalanceRow): WalletBalance {
  return {
    id: row.id,
    walletId: row.wallet_id,
    assetType: row.asset_type,
    balance: row.balance,
    starterGrantApplied: row.starter_grant_applied,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWalletTransactionRow(row: WalletTransactionRow): WalletTransaction {
  return {
    id: row.id,
    walletId: row.wallet_id,
    assetType: row.asset_type,
    transactionType: row.transaction_type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    reason: row.reason,
    source: row.source,
    tripId: row.trip_id,
    walletProductId: row.wallet_product_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    idempotencyKey: row.idempotency_key,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

function mapWalletProductRow(row: WalletProductRow): WalletProduct {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    assetType: row.asset_type,
    quantity: row.quantity,
    active: row.active,
    stripePriceId: row.stripe_price_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findWalletByOwner(client: SupabaseDbClient, owner: WalletOwnerReference) {
  assertWalletOwnerReference(owner)
  const db = client as unknown as UntypedSupabaseClient

  let query = db.from("wallets").select("*").eq("owner_type", owner.ownerType)
  query = owner.ownerType === "agency"
    ? query.eq("agency_id", owner.agencyId!)
    : query.eq("owner_user_id", owner.ownerUserId!)

  const { data, error } = await query.maybeSingle()

  return {
    data: data ? mapWalletRow(data as WalletRow) : null,
    error: error?.message ?? null,
  }
}

export async function createWallet(client: SupabaseDbClient, owner: WalletOwnerReference) {
  assertWalletOwnerReference(owner)
  const db = client as unknown as UntypedSupabaseClient
  const insertPayload: WalletInsert = {
    ...buildWalletOwnerFilter(owner),
    status: "active",
    metadata: {},
  }

  const { data, error } = await db.from("wallets").insert(insertPayload).select("*").single()
  return {
    data: data ? mapWalletRow(data as WalletRow) : null,
    error: error?.message ?? null,
  }
}

export async function findWalletBalance(client: SupabaseDbClient, walletId: string, assetType: WalletAssetType) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db
    .from("wallet_balances")
    .select("*")
    .eq("wallet_id", walletId)
    .eq("asset_type", assetType)
    .maybeSingle()

  return {
    data: data ? mapWalletBalanceRow(data as WalletBalanceRow) : null,
    error: error?.message ?? null,
  }
}

export async function listWalletBalances(client: SupabaseDbClient, walletId: string) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db
    .from("wallet_balances")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: true })

  return {
    data: (data ?? []).map((row: unknown) => mapWalletBalanceRow(row as WalletBalanceRow)),
    error: error?.message ?? null,
  }
}

export async function listWalletTransactions(client: SupabaseDbClient, params: WalletTransactionListParams) {
  const db = client as unknown as UntypedSupabaseClient
  let query = db
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", params.walletId)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 50)

  if (params.assetType) {
    query = query.eq("asset_type", params.assetType)
  }

  const { data, error } = await query
  return {
    data: (data ?? []).map((row: unknown) => mapWalletTransactionRow(row as WalletTransactionRow)),
    error: error?.message ?? null,
  }
}

export async function findWalletTransactionByTripAndType(
  client: SupabaseDbClient,
  params: { tripId: string; assetType: WalletAssetType; transactionType: WalletTransactionType },
) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db
    .from("wallet_transactions")
    .select("*")
    .eq("trip_id", params.tripId)
    .eq("asset_type", params.assetType)
    .eq("transaction_type", params.transactionType)
    .maybeSingle()

  return {
    data: data ? mapWalletTransactionRow(data as WalletTransactionRow) : null,
    error: error?.message ?? null,
  }
}

export async function findWalletTransactionByIdempotencyKey(client: SupabaseDbClient, idempotencyKey: string) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db
    .from("wallet_transactions")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  return {
    data: data ? mapWalletTransactionRow(data as WalletTransactionRow) : null,
    error: error?.message ?? null,
  }
}

export async function activateTravelerTripWithWalletRpc(client: SupabaseDbClient, tripId: string) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db.rpc("activate_traveler_trip_with_wallet", {
    p_trip_id: tripId,
  })

  return {
    data,
    error: error?.message ?? null,
  }
}

export async function listWalletProducts(client: SupabaseDbClient, assetType?: WalletAssetType) {
  const db = client as unknown as UntypedSupabaseClient
  let query = db
    .from("wallet_products")
    .select("*")
    .order("created_at", { ascending: true })

  if (assetType) {
    query = query.eq("asset_type", assetType)
  }

  const { data, error } = await query
  return {
    data: (data ?? []).map((row: unknown) => mapWalletProductRow(row as WalletProductRow)),
    error: error?.message ?? null,
  }
}

export async function findWalletProductByCode(client: SupabaseDbClient, code: string) {
  const db = client as unknown as UntypedSupabaseClient
  const { data, error } = await db
    .from("wallet_products")
    .select("*")
    .eq("code", code)
    .maybeSingle()

  return {
    data: data ? mapWalletProductRow(data as WalletProductRow) : null,
    error: error?.message ?? null,
  }
}
