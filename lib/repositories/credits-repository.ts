import type {
  CreditBalance,
  CreditOwnerType,
  CreditPackage,
  CreditTransaction,
  CreditTransactionType,
  Plan,
} from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

interface CreditMutationPayload {
  ownerType: CreditOwnerType
  ownerId: string
  amount: number
  type: CreditTransactionType
  reason: string
  source?: string | null
  metadata?: Record<string, unknown>
  createdBy?: string | null
}

interface CreditOwnerInput {
  ownerType: CreditOwnerType
  ownerId: string
}

interface CreditsOverview {
  totalAvailable: number
  totalConsumed: number
  monthlyUsage: number
  transactionsCount: number
}

type CreditTransactionRow = Database["public"]["Tables"]["credit_transactions"]["Row"]

const DEFAULT_PACKAGES: CreditPackage[] = [
  {
    id: "credits-basic",
    name: "Pacote 500",
    credits: 500,
    price: 79,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "credits-pro",
    name: "Pacote 1500",
    credits: 1500,
    price: 199,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const DEFAULT_PLANS: Plan[] = [
  {
    id: "plan-traveler-premium",
    code: "traveler-premium",
    name: "Premium",
    ownerType: "profile",
    monthlyCredits: 150,
    price: 0,
    isActive: true,
    limits: { trips: true, concierge: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "plan-agency-pro",
    code: "agency-pro",
    name: "Pro",
    ownerType: "agency",
    monthlyCredits: 1000,
    price: 199,
    isActive: true,
    limits: { members: 5, concierge: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function mapOwnerTypeToRow(ownerType: CreditOwnerType) {
  return ownerType === "agency" ? "agency" : "traveler"
}

function mapRowTypeToTransactionType(type: CreditTransactionRow["type"]): CreditTransactionType {
  if (type === "consume") return "consume"
  return type
}

function mapTransactionRow(row: CreditTransactionRow): CreditTransaction {
  const ownerType: CreditOwnerType = row.owner_type === "agency" ? "agency" : "profile"
  const ownerId = ownerType === "agency" ? row.agency_id ?? "" : row.owner_user_id ?? ""

  return {
    id: row.id,
    ownerType,
    ownerId,
    amount: row.amount,
    type: mapRowTypeToTransactionType(row.type),
    reason: row.reason ?? "",
    relatedTripId: null,
    relatedDocumentId: null,
    source: row.source ?? null,
    createdAt: row.created_at,
    balanceAfter: row.balance_after,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: row.created_by ?? null,
  }
}

async function getSupabaseClientOrError() {
  const client = createSupabaseBrowserClient()
  if (client) {
    return { client, error: null }
  }

  return {
    client: null,
    error: "Supabase browser client indisponivel.",
    config: createSupabaseBrowserClientPlaceholder(),
  }
}

async function readBalanceFromSource({ ownerType, ownerId }: CreditOwnerInput) {
  const { client, error, config } = await getSupabaseClientOrError()
  if (!client) {
    return {
      source: "supabase-placeholder" as const,
      config,
      data: null as CreditBalance | null,
      error,
    }
  }

  if (ownerType === "agency") {
    const { data, error: balanceError } = await client
      .from("agencies")
      .select("id, credits_balance, updated_at")
      .eq("id", ownerId)
      .maybeSingle()

    if (balanceError) {
      console.error("[CREDITS] balance error", balanceError.message)
      return { source: "supabase" as const, data: null as CreditBalance | null, error: balanceError.message }
    }

    return {
      source: "supabase" as const,
      data: data
        ? {
            ownerType,
            ownerId: data.id,
            balance: data.credits_balance ?? 0,
            updatedAt: data.updated_at,
          }
        : null,
      error: null,
    }
  }

  const { data, error: balanceError } = await client
    .from("profiles")
    .select("id, credits_balance, updated_at")
    .eq("id", ownerId)
    .maybeSingle()

  if (balanceError) {
    console.error("[CREDITS] balance error", balanceError.message)
    return { source: "supabase" as const, data: null as CreditBalance | null, error: balanceError.message }
  }

  return {
    source: "supabase" as const,
    data: data
      ? {
          ownerType,
          ownerId: data.id,
          balance: data.credits_balance ?? 0,
          updatedAt: data.updated_at,
        }
      : null,
    error: null,
  }
}

export async function getCreditBalance(ownerType: CreditOwnerType, ownerId: string) {
  if (!shouldUseSupabase()) {
    return {
      source: "local" as const,
      data: {
        ownerType,
        ownerId,
        balance: 0,
        updatedAt: new Date().toISOString(),
      },
      error: null,
    }
  }

  return readBalanceFromSource({ ownerType, ownerId })
}

export async function listCreditTransactions(ownerType: CreditOwnerType, ownerId: string) {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: [] as CreditTransaction[], error: null }
  }

  const { client, error, config } = await getSupabaseClientOrError()
  if (!client) {
    return {
      source: "supabase-placeholder" as const,
      config,
      data: [] as CreditTransaction[],
      error,
    }
  }

  let query = client
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })

  if (ownerType === "agency") {
    query = query.eq("owner_type", "agency").eq("agency_id", ownerId)
  } else {
    query = query.eq("owner_type", "traveler").eq("owner_user_id", ownerId)
  }

  const { data, error: transactionsError } = await query
  if (transactionsError) {
    console.error("[CREDITS] transactions error", transactionsError.message)
    return { source: "supabase" as const, data: [] as CreditTransaction[], error: transactionsError.message }
  }

  return {
    source: "supabase" as const,
    data: (data ?? []).map(mapTransactionRow),
    error: null,
  }
}

export async function listAllCreditTransactions(limit = 20) {
  if (!shouldUseSupabase()) {
    return { source: "local" as const, data: [] as CreditTransaction[], error: null }
  }

  const { client, error, config } = await getSupabaseClientOrError()
  if (!client) {
    return {
      source: "supabase-placeholder" as const,
      config,
      data: [] as CreditTransaction[],
      error,
    }
  }

  const { data, error: transactionsError } = await client
    .from("credit_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (transactionsError) {
    console.error("[CREDITS] all transactions error", transactionsError.message)
    return { source: "supabase" as const, data: [] as CreditTransaction[], error: transactionsError.message }
  }

  return {
    source: "supabase" as const,
    data: (data ?? []).map(mapTransactionRow),
    error: null,
  }
}

export async function getCreditsOverview() {
  if (!shouldUseSupabase()) {
    return {
      source: "local" as const,
      data: {
        totalAvailable: 0,
        totalConsumed: 0,
        monthlyUsage: 0,
        transactionsCount: 0,
      } satisfies CreditsOverview,
      error: null,
    }
  }

  const { client, error, config } = await getSupabaseClientOrError()
  if (!client) {
    return {
      source: "supabase-placeholder" as const,
      config,
      data: null as CreditsOverview | null,
      error,
    }
  }

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const [profilesResult, agenciesResult, transactionsResult, monthlyUsageResult] = await Promise.all([
    client.from("profiles").select("credits_balance"),
    client.from("agencies").select("credits_balance"),
    client.from("credit_transactions").select("amount"),
    client
      .from("credit_transactions")
      .select("amount")
      .lt("amount", 0)
      .gte("created_at", startOfMonth.toISOString()),
  ])

  const firstError =
    profilesResult.error?.message ??
    agenciesResult.error?.message ??
    transactionsResult.error?.message ??
    monthlyUsageResult.error?.message ??
    null

  if (firstError) {
    console.error("[CREDITS] overview error", firstError)
    return { source: "supabase" as const, data: null as CreditsOverview | null, error: firstError }
  }

  const totalProfiles = (profilesResult.data ?? []).reduce((sum, row) => sum + (row.credits_balance ?? 0), 0)
  const totalAgencies = (agenciesResult.data ?? []).reduce((sum, row) => sum + (row.credits_balance ?? 0), 0)
  const totalConsumed = (transactionsResult.data ?? []).reduce((sum, row) => {
    return row.amount < 0 ? sum + Math.abs(row.amount) : sum
  }, 0)
  const monthlyUsage = (monthlyUsageResult.data ?? []).reduce((sum, row) => sum + Math.abs(row.amount), 0)

  return {
    source: "supabase" as const,
    data: {
      totalAvailable: totalProfiles + totalAgencies,
      totalConsumed,
      monthlyUsage,
      transactionsCount: (transactionsResult.data ?? []).length,
    } satisfies CreditsOverview,
    error: null,
  }
}

export async function listCreditPackages(ownerType?: CreditOwnerType) {
  const data = ownerType ? DEFAULT_PACKAGES : DEFAULT_PACKAGES

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
      error: null,
    }
  }

  return { source: "local" as const, data, error: null }
}

export async function listPlans(ownerType?: CreditOwnerType) {
  const data = ownerType ? DEFAULT_PLANS.filter((plan) => plan.ownerType === ownerType) : DEFAULT_PLANS

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
      error: null,
    }
  }

  return { source: "local" as const, data, error: null }
}

export async function addTransaction(payload: CreditMutationPayload) {
  if (!shouldUseSupabase()) {
    const transaction: CreditTransaction = {
      id: `credit-tx-${Date.now()}`,
      ownerType: payload.ownerType,
      ownerId: payload.ownerId,
      amount: payload.amount,
      type: payload.type,
      reason: payload.reason,
      relatedTripId: null,
      relatedDocumentId: null,
      source: payload.source ?? "repository",
      createdAt: new Date().toISOString(),
      balanceAfter: null,
      metadata: payload.metadata ?? {},
      createdBy: payload.createdBy ?? null,
    }

    return { source: "local" as const, data: transaction, error: null }
  }

  const { client, error, config } = await getSupabaseClientOrError()
  if (!client) {
    return {
      source: "supabase-placeholder" as const,
      config,
      data: null as CreditTransaction | null,
      error,
    }
  }

  const insertPayload: Database["public"]["Tables"]["credit_transactions"]["Insert"] = {
    owner_type: mapOwnerTypeToRow(payload.ownerType),
    owner_user_id: payload.ownerType === "agency" ? null : payload.ownerId,
    agency_id: payload.ownerType === "agency" ? payload.ownerId : null,
    type: payload.type === "usage_ai" ||
      payload.type === "usage_concierge" ||
      payload.type === "usage_document" ||
      payload.type === "usage_itinerary"
      ? "consume"
      : payload.type,
    amount: payload.amount,
    reason: payload.reason || null,
    source: payload.source ?? null,
    metadata: (payload.metadata ?? {}) as Database["public"]["Tables"]["credit_transactions"]["Insert"]["metadata"],
    created_by: payload.createdBy ?? null,
  }

  const { data, error: insertError } = await client
    .from("credit_transactions")
    .insert(insertPayload)
    .select("*")
    .single()

  if (insertError) {
    console.error("[CREDITS] add transaction error", insertError.message)
    return { source: "supabase" as const, data: null as CreditTransaction | null, error: insertError.message }
  }

  return { source: "supabase" as const, data: mapTransactionRow(data), error: null }
}

export async function consumeCredits(payload: Omit<CreditMutationPayload, "type">) {
  return addTransaction({
    ...payload,
    amount: -Math.abs(payload.amount),
    type: "consume",
  })
}

export async function grantCredits(payload: Omit<CreditMutationPayload, "type">) {
  return addTransaction({
    ...payload,
    amount: Math.abs(payload.amount),
    type: "grant",
  })
}
