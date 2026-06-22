import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type {
  AgencyBillingApiStatus,
  AgencyBillingStatusSummary,
  AgencyCommercialPlanCode,
  AgencySubscriptionStatus,
  CreditTransaction,
} from "@/types"
import { AGENCY_PLAN_DEFINITIONS, normalizeAgencyCommercialPlanCode } from "@/lib/billing/agency-plans"
import { getAccountLimitOverrideQuantity } from "@/lib/billing/account-limit-overrides"

type SupabaseDbClient = SupabaseClient<Database>
type AgencySubscriptionRow = Database["public"]["Tables"]["agency_subscriptions"]["Row"]
type AgencyPlanCycleRow = Database["public"]["Tables"]["agency_plan_credit_cycles"]["Row"]
type AgencyRow = Database["public"]["Tables"]["agencies"]["Row"]

const ACTIVE_PAID_STATUSES = new Set<AgencySubscriptionStatus>(["active", "trialing"])

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime())
  next.setMonth(next.getMonth() + months)
  return next
}

function clampToIso(date: Date) {
  return date.toISOString()
}

function buildCurrentCycleWindow(anchorIso: string | null | undefined, reference = new Date()) {
  const fallbackStart = new Date()
  const anchor = anchorIso ? new Date(anchorIso) : fallbackStart

  if (Number.isNaN(anchor.getTime())) {
    return {
      periodStart: clampToIso(fallbackStart),
      periodEnd: clampToIso(addMonths(fallbackStart, 1)),
    }
  }

  let periodStart = new Date(anchor.getTime())
  let periodEnd = addMonths(periodStart, 1)

  while (reference >= periodEnd) {
    periodStart = periodEnd
    periodEnd = addMonths(periodStart, 1)
  }

  while (reference < periodStart) {
    periodEnd = periodStart
    periodStart = addMonths(periodStart, -1)
  }

  return {
    periodStart: clampToIso(periodStart),
    periodEnd: clampToIso(periodEnd),
  }
}

function getAgencyPlanCredits(planCode: AgencyCommercialPlanCode) {
  return AGENCY_PLAN_DEFINITIONS[planCode].monthlyCredits
}

function getEffectiveAgencyPlan(row: AgencySubscriptionRow | null | undefined): AgencyCommercialPlanCode {
  if (!row) {
    return "free"
  }

  const normalizedPlanCode = normalizeAgencyCommercialPlanCode(row.plan_code)
  if (normalizedPlanCode === "free") {
    return "free"
  }

  return ACTIVE_PAID_STATUSES.has(row.status) ? normalizedPlanCode : "free"
}

export function resolveAgencyAvailableCredits(params: {
  persistedBalance: number | null | undefined
  planMonthlyCredits: number
  transactions?: Array<Pick<CreditTransaction, "amount"> | { amount: number | null }>
}) {
  const persistedBalance = Math.max(params.persistedBalance ?? 0, 0)
  const transactions = params.transactions ?? []

  if (persistedBalance > 0) {
    return persistedBalance
  }

  if (transactions.length === 0) {
    return params.planMonthlyCredits
  }

  const additionalCredits = transactions.reduce((sum, transaction) => {
    return transaction.amount && transaction.amount > 0 ? sum + transaction.amount : sum
  }, 0)

  const consumedCredits = transactions.reduce((sum, transaction) => {
    return transaction.amount && transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum
  }, 0)

  return Math.max(params.planMonthlyCredits + additionalCredits - consumedCredits, 0)
}

function buildAgencyBillingStatus(
  agencyId: string | null,
  planCode: AgencyCommercialPlanCode,
  status: AgencySubscriptionStatus,
  startedAt: string | null,
  expiresAt: string | null,
  limitOverrides?: {
    maxClients?: number | null
    maxActiveTrips?: number
  },
  extras?: {
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
  },
): AgencyBillingStatusSummary {
  const definition = AGENCY_PLAN_DEFINITIONS[planCode]

  return {
    agencyId,
    planCode,
    status,
    startedAt,
    expiresAt,
    maxUsers: definition.maxUsers,
    maxClients: limitOverrides?.maxClients ?? definition.maxClients,
    maxActiveTrips: limitOverrides?.maxActiveTrips ?? definition.maxActiveTrips,
    monthlyCredits: definition.monthlyCredits,
    features: definition.features,
    stripeCustomerId: extras?.stripeCustomerId ?? null,
    stripeSubscriptionId: extras?.stripeSubscriptionId ?? null,
    stripePriceId: extras?.stripePriceId ?? null,
    currentPeriodStart: extras?.currentPeriodStart ?? null,
    currentPeriodEnd: extras?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: extras?.cancelAtPeriodEnd ?? false,
  }
}

export function getDefaultAgencyBillingStatus(agencyId: string | null): AgencyBillingStatusSummary {
  return buildAgencyBillingStatus(agencyId, "free", "active", null, null)
}

export function mapAgencySubscriptionRowToBillingStatus(row: AgencySubscriptionRow | null | undefined): AgencyBillingStatusSummary {
  if (!row) {
    return getDefaultAgencyBillingStatus(null)
  }

  return buildAgencyBillingStatus(
    row.agency_id,
    normalizeAgencyCommercialPlanCode(row.plan_code),
    row.status,
    row.started_at,
    row.expires_at,
    {
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripePriceId: row.stripe_price_id,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
    },
  )
}

export async function getAgencyBillingStatusForClient(client: SupabaseDbClient, agencyId: string) {
  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle()

  if (error) {
    return { data: null as AgencyBillingStatusSummary | null, error: error.message }
  }

  const effectivePlan = getEffectiveAgencyPlan((data as AgencySubscriptionRow | null | undefined) ?? null)
  const definition = AGENCY_PLAN_DEFINITIONS[effectivePlan]
  const [clientOverrideResult, activeTripsOverrideResult] = await Promise.all([
    definition.maxClients === null
      ? Promise.resolve({ data: 0, error: null })
      : getAccountLimitOverrideQuantity(client, {
          ownerType: "agency",
          ownerId: agencyId,
          limitType: "clients",
        }),
    getAccountLimitOverrideQuantity(client, {
      ownerType: "agency",
      ownerId: agencyId,
      limitType: "active_trips",
    }),
  ])

  if (clientOverrideResult.error || activeTripsOverrideResult.error) {
    return {
      data: null as AgencyBillingStatusSummary | null,
      error: clientOverrideResult.error ?? activeTripsOverrideResult.error ?? "Nao foi possivel carregar os limites extras da agencia.",
    }
  }

  return {
    data: buildAgencyBillingStatus(
      agencyId,
      data ? normalizeAgencyCommercialPlanCode((data as AgencySubscriptionRow).plan_code) : "free",
      data ? (data as AgencySubscriptionRow).status : "active",
      data ? (data as AgencySubscriptionRow).started_at : null,
      data ? (data as AgencySubscriptionRow).expires_at : null,
      {
        maxClients:
          definition.maxClients === null ? null : definition.maxClients + Math.max(clientOverrideResult.data, 0),
        maxActiveTrips: definition.maxActiveTrips + Math.max(activeTripsOverrideResult.data, 0),
      },
      data
        ? {
            stripeCustomerId: (data as AgencySubscriptionRow).stripe_customer_id,
            stripeSubscriptionId: (data as AgencySubscriptionRow).stripe_subscription_id,
            stripePriceId: (data as AgencySubscriptionRow).stripe_price_id,
            currentPeriodStart: (data as AgencySubscriptionRow).current_period_start,
            currentPeriodEnd: (data as AgencySubscriptionRow).current_period_end,
            cancelAtPeriodEnd: (data as AgencySubscriptionRow).cancel_at_period_end,
          }
        : undefined,
    ),
    error: null,
  }
}

export async function ensureAgencySubscriptionRow(client: SupabaseDbClient, agencyId: string) {
  const existing = await (client.from("agency_subscriptions" as any) as any)
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle()

  if (existing.error) {
    return { data: null as AgencySubscriptionRow | null, error: existing.error.message }
  }

  if (existing.data) {
    return { data: existing.data as AgencySubscriptionRow, error: null }
  }

  const nowIso = new Date().toISOString()
  const inserted = await (client.from("agency_subscriptions" as any) as any)
    .insert({
      agency_id: agencyId,
      plan_code: "free",
      status: "active",
      started_at: nowIso,
      updated_at: nowIso,
    } as any)
    .select("*")
    .single()

  return { data: (inserted.data as AgencySubscriptionRow | null) ?? null, error: inserted.error?.message ?? null }
}

async function getAgencyRow(client: SupabaseDbClient, agencyId: string) {
  const { data, error } = await client
    .from("agencies")
    .select("id, owner_user_id, credits_balance, created_at")
    .eq("id", agencyId)
    .maybeSingle()

  return { data: (data as Pick<AgencyRow, "id" | "owner_user_id" | "credits_balance" | "created_at"> | null) ?? null, error: error?.message ?? null }
}

async function getCurrentAgencyPlanCycle(client: SupabaseDbClient, agencyId: string, atIso: string) {
  const { data, error } = await (client.from("agency_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("agency_id", agencyId)
    .lte("period_start", atIso)
    .gt("period_end", atIso)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  return { data: (data as AgencyPlanCycleRow | null) ?? null, error: error?.message ?? null }
}

async function ensureAgencyCurrentPlanCycle(
  client: SupabaseDbClient,
  agencyId: string,
  subscription: AgencySubscriptionRow,
  agency: Pick<AgencyRow, "id" | "created_at">,
  atIso: string,
) {
  const existing = await getCurrentAgencyPlanCycle(client, agencyId, atIso)
  if (existing.error) {
    return { data: null as AgencyPlanCycleRow | null, error: existing.error }
  }

  if (existing.data) {
    return { data: existing.data, error: null }
  }

  const effectivePlan = getEffectiveAgencyPlan(subscription)
  const definition = AGENCY_PLAN_DEFINITIONS[effectivePlan]
  const window =
    subscription.current_period_start && subscription.current_period_end
      ? {
          periodStart: subscription.current_period_start,
          periodEnd: subscription.current_period_end,
        }
      : buildCurrentCycleWindow(subscription.started_at ?? agency.created_at ?? atIso, new Date(atIso))

  const insertResult = await (client.from("agency_plan_credit_cycles" as any) as any)
    .insert({
      agency_id: agencyId,
      subscription_id: subscription.id,
      plan_code: effectivePlan,
      period_start: window.periodStart,
      period_end: window.periodEnd,
      granted_credits: definition.monthlyCredits,
      used_credits: 0,
      stripe_invoice_id: null,
    } as any)
    .select("*")
    .single()

  return {
    data: (insertResult.data as AgencyPlanCycleRow | null) ?? null,
    error: insertResult.error?.message ?? null,
  }
}

async function listAgencyCreditTransactions(client: SupabaseDbClient, agencyId: string) {
  const { data, error } = await (client.from("credit_transactions") as any)
    .select("amount, source, metadata")
    .eq("owner_type", "agency")
    .eq("agency_id", agencyId)

  return {
    data: ((data as Array<{ amount: number | null; source: string | null; metadata: Record<string, unknown> | null }> | null) ?? []),
    error: error?.message ?? null,
  }
}

function getNumericMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export async function getAgencyCreditBalance(client: SupabaseDbClient, agencyId: string): Promise<{ data: AgencyBillingApiStatus | null; error: string | null }> {
  const subscriptionResult = await ensureAgencySubscriptionRow(client, agencyId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { data: null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura da agencia." }
  }

  const agencyResult = await getAgencyRow(client, agencyId)
  if (agencyResult.error || !agencyResult.data) {
    return { data: null, error: agencyResult.error ?? "Agencia nao encontrada." }
  }

  const effectivePlan = getEffectiveAgencyPlan(subscriptionResult.data)
  const definition = AGENCY_PLAN_DEFINITIONS[effectivePlan]
  const [clientOverrideResult, activeTripsOverrideResult] = await Promise.all([
    definition.maxClients === null
      ? Promise.resolve({ data: 0, error: null })
      : getAccountLimitOverrideQuantity(client, {
          ownerType: "agency",
          ownerId: agencyId,
          limitType: "clients",
        }),
    getAccountLimitOverrideQuantity(client, {
      ownerType: "agency",
      ownerId: agencyId,
      limitType: "active_trips",
    }),
  ])
  if (clientOverrideResult.error || activeTripsOverrideResult.error) {
    return { data: null, error: clientOverrideResult.error ?? activeTripsOverrideResult.error }
  }
  const nowIso = new Date().toISOString()
  const currentCycleResult = await getCurrentAgencyPlanCycle(client, agencyId, nowIso)
  if (currentCycleResult.error) {
    return { data: null, error: currentCycleResult.error }
  }

  const transactionsResult = await listAgencyCreditTransactions(client, agencyId)
  if (transactionsResult.error) {
    return { data: null, error: transactionsResult.error }
  }

  const referenceAnchor = subscriptionResult.data.started_at ?? agencyResult.data.created_at ?? nowIso
  const fallbackFreeWindow = buildCurrentCycleWindow(referenceAnchor, new Date())
  const currentPeriodEnd = currentCycleResult.data?.period_end
    ?? subscriptionResult.data.current_period_end
    ?? (effectivePlan === "free" ? fallbackFreeWindow.periodEnd : null)

  const planCreditsAvailable = currentCycleResult.data
    ? Math.max(currentCycleResult.data.granted_credits - currentCycleResult.data.used_credits, 0)
    : effectivePlan === "free"
      ? definition.monthlyCredits
      : 0

  const usedCredits = currentCycleResult.data
    ? Math.max(currentCycleResult.data.used_credits, 0)
    : transactionsResult.data.reduce((sum, transaction) => {
        return transaction.amount && transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum
      }, 0)

  const purchasedCreditsFromTransactions = transactionsResult.data.reduce((sum, transaction) => {
    if (!transaction.amount || transaction.amount <= 0) {
      return sum
    }

    return transaction.source === "plan_cycle" ? sum : sum + transaction.amount
  }, 0)

  const purchasedConsumedFromTransactions = transactionsResult.data.reduce((sum, transaction) => {
    if (!transaction.amount || transaction.amount >= 0) {
      return sum
    }

    return sum + getNumericMetadataValue(transaction.metadata, "applied_from_purchased")
  }, 0)

  const purchasedCreditsAvailableFromTransactions = Math.max(
    purchasedCreditsFromTransactions - purchasedConsumedFromTransactions,
    0,
  )

  const persistedBalance = Math.max(agencyResult.data.credits_balance ?? 0, 0)
  const purchasedCreditsAvailable = persistedBalance > 0
    ? Math.max(persistedBalance - planCreditsAvailable, 0)
    : purchasedCreditsAvailableFromTransactions

  const totalAvailable = persistedBalance > 0
    ? persistedBalance
    : Math.max(planCreditsAvailable + purchasedCreditsAvailable, 0)

  return {
    data: {
      agencyId,
      planCode: effectivePlan,
      status: subscriptionResult.data.status,
      maxUsers: definition.maxUsers,
      maxClients: definition.maxClients === null ? null : definition.maxClients + Math.max(clientOverrideResult.data, 0),
      maxActiveTrips: definition.maxActiveTrips + Math.max(activeTripsOverrideResult.data, 0),
      monthlyCredits: definition.monthlyCredits,
      planCreditsAvailable,
      purchasedCreditsAvailable,
      totalAvailable,
      currentPlan: effectivePlan,
      currentPeriodEnd,
      usedCredits,
      stripeCustomerId: subscriptionResult.data.stripe_customer_id,
      stripeSubscriptionId: subscriptionResult.data.stripe_subscription_id,
      cancelAtPeriodEnd: subscriptionResult.data.cancel_at_period_end,
      canManageBilling: Boolean(subscriptionResult.data.stripe_customer_id || effectivePlan !== "free"),
    },
    error: null,
  }
}

export async function consumeAgencyCredits(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    amount: number
    reason: string
    source: string
    metadata?: Record<string, unknown>
    createdBy?: string | null
  },
) {
  const balanceResult = await getAgencyCreditBalance(client, params.agencyId)
  if (balanceResult.error || !balanceResult.data) {
    return { success: false, error: balanceResult.error ?? "Nao foi possivel calcular o saldo da agencia." }
  }

  const amount = Math.abs(params.amount)
  if (balanceResult.data.totalAvailable < amount) {
    return { success: false, error: "Saldo insuficiente." }
  }

  const subscriptionResult = await ensureAgencySubscriptionRow(client, params.agencyId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { success: false, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura da agencia." }
  }

  const agencyResult = await getAgencyRow(client, params.agencyId)
  if (agencyResult.error || !agencyResult.data) {
    return { success: false, error: agencyResult.error ?? "Agencia nao encontrada." }
  }

  const nowIso = new Date().toISOString()
  const currentCycleResult = await ensureAgencyCurrentPlanCycle(
    client,
    params.agencyId,
    subscriptionResult.data,
    agencyResult.data,
    nowIso,
  )
  if (currentCycleResult.error) {
    return { success: false, error: currentCycleResult.error }
  }

  const appliedFromPlan = Math.min(balanceResult.data.planCreditsAvailable, amount)
  const appliedFromPurchased = amount - appliedFromPlan
  const nextBalance = Math.max(balanceResult.data.totalAvailable - amount, 0)

  const transactionInsert = await (client.from("credit_transactions") as any).insert({
    owner_type: "agency",
    agency_id: params.agencyId,
    type: "consume",
    amount: -amount,
    balance_after: nextBalance,
    reason: params.reason,
    source: params.source,
    metadata: {
      ...(params.metadata ?? {}),
      billing_scope: "agency",
      applied_from_plan: appliedFromPlan,
      applied_from_purchased: appliedFromPurchased,
    },
    created_by: params.createdBy ?? agencyResult.data.owner_user_id,
  } as any)

  if (transactionInsert.error) {
    return { success: false, error: transactionInsert.error.message }
  }

  if (appliedFromPlan > 0 && currentCycleResult.data) {
    const cycleUpdate = await (client.from("agency_plan_credit_cycles" as any) as any)
      .update({ used_credits: currentCycleResult.data.used_credits + appliedFromPlan } as any)
      .eq("id", currentCycleResult.data.id)

    if (cycleUpdate.error) {
      return { success: false, error: cycleUpdate.error.message }
    }
  }

  return {
    success: true,
    error: null,
    appliedFromPlan,
    appliedFromPurchased,
    remainingBalance: nextBalance,
  }
}

export async function createAgencyPlanCreditCycleFromInvoice(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    subscriptionId: string
    planCode: AgencyCommercialPlanCode
    periodStart: string
    periodEnd: string
    stripeInvoiceId: string
  },
) {
  const existing = await (client.from("agency_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("stripe_invoice_id", params.stripeInvoiceId)
    .maybeSingle()

  if (existing.error) {
    return { data: null as AgencyPlanCycleRow | null, error: existing.error.message }
  }

  if (existing.data) {
    return { data: existing.data as AgencyPlanCycleRow, error: null }
  }

  const inserted = await (client.from("agency_plan_credit_cycles" as any) as any)
    .insert({
      agency_id: params.agencyId,
      subscription_id: params.subscriptionId,
      plan_code: params.planCode,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      granted_credits: getAgencyPlanCredits(params.planCode),
      stripe_invoice_id: params.stripeInvoiceId,
    } as any)
    .select("*")
    .single()

  return { data: (inserted.data as AgencyPlanCycleRow | null) ?? null, error: inserted.error?.message ?? null }
}

export async function grantAgencyPurchasedCredits(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    userId: string
    packageCode: "starter" | "popular" | "pro"
    packageName: string
    credits: number
    stripeCheckoutSessionId: string
    stripePaymentIntentId?: string | null
  },
) {
  const existing = await (client.from("credit_transactions") as any)
    .select("id")
    .eq("owner_type", "agency")
    .eq("agency_id", params.agencyId)
    .eq("type", "purchase")
    .contains("metadata", { stripe_checkout_session_id: params.stripeCheckoutSessionId })
    .maybeSingle()

  if (existing.error) {
    return { error: existing.error.message }
  }

  if (existing.data) {
    return { error: null }
  }

  const insertResult = await (client.from("credit_transactions") as any).insert({
    owner_type: "agency",
    agency_id: params.agencyId,
    type: "purchase",
    amount: params.credits,
    reason: `Compra do pacote ${params.packageName}`,
    source: "stripe_checkout",
    metadata: {
      billing_scope: "agency",
      checkout_type: "credit_package",
      package_code: params.packageCode,
      credits: params.credits,
      stripe_checkout_session_id: params.stripeCheckoutSessionId,
      stripe_payment_intent_id: params.stripePaymentIntentId ?? null,
    },
    created_by: params.userId,
  } as any)

  return { error: insertResult.error?.message ?? null }
}

export async function upsertAgencySubscriptionForClient(
  client: SupabaseDbClient,
  params: {
    agencyId: string
    planCode: AgencyCommercialPlanCode
    status?: AgencySubscriptionStatus
    startedAt?: string | null
    expiresAt?: string | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
  },
) {
  const existing = await ensureAgencySubscriptionRow(client, params.agencyId)
  if (existing.error || !existing.data) {
    return { data: null as AgencyBillingStatusSummary | null, error: existing.error ?? "Nao foi possivel carregar a assinatura da agencia." }
  }

  const nowIso = new Date().toISOString()
  const payload = {
    agency_id: params.agencyId,
    plan_code: params.planCode,
    status: params.status ?? existing.data.status,
    started_at: params.startedAt ?? existing.data.started_at ?? nowIso,
    expires_at: params.expiresAt ?? existing.data.expires_at ?? null,
    stripe_customer_id: params.stripeCustomerId ?? existing.data.stripe_customer_id,
    stripe_subscription_id: params.stripeSubscriptionId ?? existing.data.stripe_subscription_id,
    stripe_price_id: params.stripePriceId ?? existing.data.stripe_price_id,
    current_period_start: params.currentPeriodStart ?? existing.data.current_period_start,
    current_period_end: params.currentPeriodEnd ?? existing.data.current_period_end,
    cancel_at_period_end: params.cancelAtPeriodEnd ?? existing.data.cancel_at_period_end ?? false,
    updated_at: nowIso,
  }

  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .upsert(payload, { onConflict: "agency_id" })
    .select("*")
    .single()

  if (error) {
    return { data: null as AgencyBillingStatusSummary | null, error: error.message }
  }

  return {
    data: mapAgencySubscriptionRowToBillingStatus(data as AgencySubscriptionRow),
    error: null,
  }
}

export async function updateAgencySubscriptionFromStripe(
  client: SupabaseDbClient,
  payload: {
    agencyId: string
    planCode: AgencyCommercialPlanCode
    status: AgencySubscriptionStatus
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
  },
) {
  return upsertAgencySubscriptionForClient(client, {
    agencyId: payload.agencyId,
    planCode: payload.planCode,
    status: payload.status,
    startedAt: payload.currentPeriodStart ?? undefined,
    expiresAt: payload.currentPeriodEnd ?? undefined,
    stripeCustomerId: payload.stripeCustomerId,
    stripeSubscriptionId: payload.stripeSubscriptionId,
    stripePriceId: payload.stripePriceId,
    currentPeriodStart: payload.currentPeriodStart,
    currentPeriodEnd: payload.currentPeriodEnd,
    cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
  })
}

export async function findAgencySubscriptionByCustomerId(client: SupabaseDbClient, stripeCustomerId: string) {
  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle()

  return { data: (data as AgencySubscriptionRow | null) ?? null, error: error?.message ?? null }
}

export async function findAgencySubscriptionByStripeSubscriptionId(client: SupabaseDbClient, stripeSubscriptionId: string) {
  const { data, error } = await (client.from("agency_subscriptions" as any) as any)
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle()

  return { data: (data as AgencySubscriptionRow | null) ?? null, error: error?.message ?? null }
}

export async function updateAgencyStripeCustomerId(client: SupabaseDbClient, agencyId: string, stripeCustomerId: string) {
  const subscriptionResult = await ensureAgencySubscriptionRow(client, agencyId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { data: null as AgencySubscriptionRow | null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura da agencia." }
  }

  const updateResult = await (client.from("agency_subscriptions" as any) as any)
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", subscriptionResult.data.id)
    .select("*")
    .single()

  return { data: (updateResult.data as AgencySubscriptionRow | null) ?? null, error: updateResult.error?.message ?? null }
}

export async function countActiveAgencyTripsForClient(client: SupabaseDbClient, agencyId: string) {
  const { count, error } = await client
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", "agency")
    .eq("agency_id", agencyId)
    .in("status", ["draft", "upcoming", "ongoing"])

  return { count: count ?? 0, error: error?.message ?? null }
}

export async function countActiveAgencyMembersForClient(client: SupabaseDbClient, agencyId: string) {
  const { count, error } = await client
    .from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("status", ["active", "pending"])

  return { count: count ?? 0, error: error?.message ?? null }
}

export async function countAgencyClientsForClient(client: SupabaseDbClient, agencyId: string) {
  const { count, error } = await client
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .neq("status", "archived")

  return { count: count ?? 0, error: error?.message ?? null }
}
