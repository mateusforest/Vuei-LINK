import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"
import type {
  TravelerBillingStatusSummary,
  TravelerMembershipStatusSummary,
  TravelerPlanCode,
  TravelerSubscriptionStatus,
  VueiPlusSubscriptionStatus,
} from "@/types"
import { TRAVELER_PLAN_DEFINITIONS } from "@/lib/billing/traveler-plans"
import { getAccountLimitOverrideQuantity } from "@/lib/billing/account-limit-overrides"
import { resolveTravelerMembership } from "@/lib/billing/traveler-membership"

type SupabaseDbClient = SupabaseClient<Database>
type TravelerSubscriptionRow = Database["public"]["Tables"]["traveler_subscriptions"]["Row"]
type TravelerPlanCycleRow = Database["public"]["Tables"]["traveler_plan_credit_cycles"]["Row"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]

const PREMIUM_ACTIVE_STATUSES = new Set<TravelerSubscriptionStatus>(["active", "trialing"])
const FREE_PLAN_CODE: TravelerPlanCode = "free"

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime())
  next.setMonth(next.getMonth() + months)
  return next
}

function clampToIso(date: Date) {
  return date.toISOString()
}

function getEffectiveTravelerPlan(row: TravelerSubscriptionRow | null | undefined): TravelerPlanCode {
  if (row?.plan_code === "premium" && PREMIUM_ACTIVE_STATUSES.has(row.status)) {
    return "premium"
  }

  return FREE_PLAN_CODE
}

function getPlanCreditsForCode(planCode: TravelerPlanCode) {
  return TRAVELER_PLAN_DEFINITIONS[planCode].monthlyCredits
}

function getCurrentFreeCycleWindow(anchorIso: string, reference = new Date()) {
  const anchor = new Date(anchorIso)
  if (Number.isNaN(anchor.getTime())) {
    const now = new Date()
    return {
      periodStart: clampToIso(now),
      periodEnd: clampToIso(addMonths(now, 1)),
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

async function getProfileRow(client: SupabaseDbClient, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, created_at, credits_balance")
    .eq("id", userId)
    .maybeSingle()

  return { data: (data as ProfileRow | null) ?? null, error: error?.message ?? null }
}

export async function ensureTravelerSubscriptionRow(client: SupabaseDbClient, userId: string) {
  const existing = await (client
    .from("traveler_subscriptions" as any) as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing.error) {
    return { data: null as TravelerSubscriptionRow | null, error: existing.error.message }
  }

  if (existing.data) {
    return { data: existing.data as TravelerSubscriptionRow, error: null }
  }

  const inserted = await (client
    .from("traveler_subscriptions" as any) as any)
    .insert({
      user_id: userId,
      plan_code: "free",
      status: "free",
    } as any)
    .select("*")
    .single()

  return { data: (inserted.data as TravelerSubscriptionRow | null) ?? null, error: inserted.error?.message ?? null }
}

async function listTravelerPlanCycles(client: SupabaseDbClient, userId: string) {
  const { data, error } = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("user_id", userId)
    .order("period_start", { ascending: false })

  return { data: (data as TravelerPlanCycleRow[] | null) ?? [], error: error?.message ?? null }
}

async function getCurrentTravelerPlanCycle(client: SupabaseDbClient, userId: string, atIso: string) {
  const { data, error } = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("user_id", userId)
    .lte("period_start", atIso)
    .gt("period_end", atIso)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle()

  return { data: (data as TravelerPlanCycleRow | null) ?? null, error: error?.message ?? null }
}

async function getTravelerTransactionsCount(client: SupabaseDbClient, userId: string) {
  const { count, error } = await client
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", "traveler")
    .eq("owner_user_id", userId)

  return { count: count ?? 0, error: error?.message ?? null }
}

async function normalizeLegacyTravelerBalanceIfNeeded(client: SupabaseDbClient, profile: ProfileRow, userId: string) {
  const cyclesResult = await listTravelerPlanCycles(client, userId)
  if (cyclesResult.error) return cyclesResult.error

  const txCountResult = await getTravelerTransactionsCount(client, userId)
  if (txCountResult.error) return txCountResult.error

  if (cyclesResult.data.length === 0 && txCountResult.count === 0 && (profile.credits_balance ?? 0) !== 0) {
    const { error } = await (client
      .from("profiles") as any)
      .update({ credits_balance: 0, updated_at: new Date().toISOString() } as any)
      .eq("id", profile.id)

    if (error) return error.message
  }

  return null
}

async function expireRemainingPlanCycles(
  client: SupabaseDbClient,
  userId: string,
  createdBy: string | null,
  excludeWindow?: { planCode: TravelerPlanCode; periodStart: string; periodEnd: string },
) {
  const cyclesResult = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("user_id", userId)
    .gt("granted_credits", 0)

  if (cyclesResult.error) {
    return cyclesResult.error.message
  }

  const cycles = (cyclesResult.data as TravelerPlanCycleRow[] | null) ?? []

  for (const cycle of cycles) {
    if (
      excludeWindow &&
      cycle.plan_code === excludeWindow.planCode &&
      cycle.period_start === excludeWindow.periodStart &&
      cycle.period_end === excludeWindow.periodEnd
    ) {
      continue
    }

    const remaining = Math.max(cycle.granted_credits - cycle.used_credits - cycle.expired_credits, 0)
    if (remaining <= 0) continue

    const alreadyExpired = await (client
      .from("credit_transactions") as any)
      .select("id")
      .eq("owner_type", "traveler")
      .eq("owner_user_id", userId)
      .eq("source", "plan_cycle")
      .contains("metadata", { kind: "plan_cycle_expiration", traveler_plan_cycle_id: cycle.id })
      .maybeSingle()

    if (alreadyExpired.error && alreadyExpired.error.code !== "PGRST116") {
      return alreadyExpired.error.message
    }

    if (!alreadyExpired.data) {
      const expirationInsert = await (client
        .from("credit_transactions") as any)
        .insert({
          owner_type: "traveler",
          owner_user_id: userId,
          type: "adjustment",
          amount: -remaining,
          reason: `Expiracao dos creditos do plano ${cycle.plan_code}`,
          source: "plan_cycle",
          metadata: {
            kind: "plan_cycle_expiration",
            traveler_plan_cycle_id: cycle.id,
            plan_code: cycle.plan_code,
            period_start: cycle.period_start,
            period_end: cycle.period_end,
          },
          created_by: createdBy,
        } as any)

      if (expirationInsert.error) {
        return expirationInsert.error.message
      }
    }

    const updateCycle = await (client
      .from("traveler_plan_credit_cycles" as any) as any)
      .update({
        expired_credits: cycle.expired_credits + remaining,
      } as any)
      .eq("id", cycle.id)

    if (updateCycle.error) {
      return updateCycle.error.message
    }
  }

  return null
}

export async function ensureTravelerFreePlanCycle(client: SupabaseDbClient, userId: string) {
  const profileResult = await getProfileRow(client, userId)
  if (profileResult.error || !profileResult.data) {
    return { data: null as TravelerPlanCycleRow | null, error: profileResult.error ?? "Perfil do traveler nao encontrado." }
  }

  const normalizeError = await normalizeLegacyTravelerBalanceIfNeeded(client, profileResult.data, userId)
  if (normalizeError) {
    return { data: null as TravelerPlanCycleRow | null, error: normalizeError }
  }

  const nowIso = new Date().toISOString()
  const currentCycleResult = await getCurrentTravelerPlanCycle(client, userId, nowIso)
  if (currentCycleResult.error) {
    return { data: null as TravelerPlanCycleRow | null, error: currentCycleResult.error }
  }
  if (currentCycleResult.data?.plan_code === "free") {
    return { data: currentCycleResult.data, error: null }
  }

  const { periodStart, periodEnd } = getCurrentFreeCycleWindow(profileResult.data.created_at, new Date())

  const expirationError = await expireRemainingPlanCycles(client, userId, userId, {
    planCode: "free",
    periodStart,
    periodEnd,
  })
  if (expirationError) {
    return { data: null as TravelerPlanCycleRow | null, error: expirationError }
  }

  const existingForWindow = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("user_id", userId)
    .eq("plan_code", "free")
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle()

  if (existingForWindow.error) {
    return { data: null as TravelerPlanCycleRow | null, error: existingForWindow.error.message }
  }

  if (existingForWindow.data) {
    return { data: existingForWindow.data as TravelerPlanCycleRow, error: null }
  }

  const subscriptionResult = await ensureTravelerSubscriptionRow(client, userId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { data: null as TravelerPlanCycleRow | null, error: subscriptionResult.error ?? "Nao foi possivel garantir a assinatura free do traveler." }
  }

  const grantedCredits = getPlanCreditsForCode("free")
  const insertedCycle = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .insert({
      user_id: userId,
      subscription_id: subscriptionResult.data.id,
      plan_code: "free",
      period_start: periodStart,
      period_end: periodEnd,
      granted_credits: grantedCredits,
    } as any)
    .select("*")
    .single()

  if (insertedCycle.error || !insertedCycle.data) {
    return { data: null as TravelerPlanCycleRow | null, error: insertedCycle.error?.message ?? "Nao foi possivel criar o ciclo free do traveler." }
  }

  const grantTransaction = await (client
    .from("credit_transactions") as any)
    .insert({
      owner_type: "traveler",
      owner_user_id: userId,
      type: "grant",
      amount: grantedCredits,
      reason: "Créditos de IA incluídos neste ciclo",
      source: "plan_cycle",
      metadata: {
        kind: "plan_cycle_grant",
        traveler_plan_cycle_id: insertedCycle.data.id,
        plan_code: "free",
        period_start: periodStart,
        period_end: periodEnd,
      },
      created_by: userId,
    } as any)

  if (grantTransaction.error) {
    return { data: null as TravelerPlanCycleRow | null, error: grantTransaction.error.message }
  }

  return { data: insertedCycle.data as TravelerPlanCycleRow, error: null }
}

export async function grantTravelerPlanCycleFromInvoice(
  client: SupabaseDbClient,
  params: {
    userId: string
    subscriptionId: string
    planCode: TravelerPlanCode
    periodStart: string
    periodEnd: string
    stripeInvoiceId: string
    createdBy?: string | null
  },
) {
  const existing = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .select("*")
    .eq("stripe_invoice_id", params.stripeInvoiceId)
    .maybeSingle()

  if (existing.error) {
    return { data: null as TravelerPlanCycleRow | null, error: existing.error.message }
  }

  if (existing.data) {
    return { data: existing.data as TravelerPlanCycleRow, error: null }
  }

  const expirationError = await expireRemainingPlanCycles(client, params.userId, params.createdBy ?? params.userId, {
    planCode: params.planCode,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  })
  if (expirationError) {
    return { data: null as TravelerPlanCycleRow | null, error: expirationError }
  }

  const grantedCredits = getPlanCreditsForCode(params.planCode)
  const insertedCycle = await (client
    .from("traveler_plan_credit_cycles" as any) as any)
    .insert({
      user_id: params.userId,
      subscription_id: params.subscriptionId,
      plan_code: params.planCode,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      granted_credits: grantedCredits,
      stripe_invoice_id: params.stripeInvoiceId,
    } as any)
    .select("*")
    .single()

  if (insertedCycle.error || !insertedCycle.data) {
    return { data: null as TravelerPlanCycleRow | null, error: insertedCycle.error?.message ?? "Nao foi possivel criar o ciclo de creditos do traveler." }
  }

  const grantTransaction = await (client
    .from("credit_transactions") as any)
    .insert({
      owner_type: "traveler",
      owner_user_id: params.userId,
      type: "grant",
      amount: grantedCredits,
      reason: params.planCode === "premium"
        ? "Créditos de IA incluídos — Premium legado"
        : "Créditos de IA incluídos neste ciclo",
      source: "plan_cycle",
      metadata: {
        kind: "plan_cycle_grant",
        traveler_plan_cycle_id: insertedCycle.data.id,
        plan_code: params.planCode,
        stripe_invoice_id: params.stripeInvoiceId,
        period_start: params.periodStart,
        period_end: params.periodEnd,
      },
      created_by: params.createdBy ?? params.userId,
    } as any)

  if (grantTransaction.error) {
    return { data: null as TravelerPlanCycleRow | null, error: grantTransaction.error.message }
  }

  return { data: insertedCycle.data as TravelerPlanCycleRow, error: null }
}

export async function getTravelerCreditBalance(client: SupabaseDbClient, userId: string): Promise<{ data: TravelerBillingStatusSummary | null; error: string | null }> {
  const subscriptionResult = await ensureTravelerSubscriptionRow(client, userId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { data: null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura do traveler." }
  }

  const effectivePlan = getEffectiveTravelerPlan(subscriptionResult.data)
  let currentCycle: TravelerPlanCycleRow | null = null

  if (effectivePlan === "free") {
    const freeCycleResult = await ensureTravelerFreePlanCycle(client, userId)
    if (freeCycleResult.error) {
      return { data: null, error: freeCycleResult.error }
    }
    currentCycle = freeCycleResult.data
  } else if (subscriptionResult.data.current_period_start && subscriptionResult.data.current_period_end) {
    const cycleResult = await getCurrentTravelerPlanCycle(client, userId, new Date().toISOString())
    if (cycleResult.error) {
      return { data: null, error: cycleResult.error }
    }
    currentCycle = cycleResult.data
  }

  const profileResult = await getProfileRow(client, userId)
  if (profileResult.error || !profileResult.data) {
    return { data: null, error: profileResult.error ?? "Perfil do traveler nao encontrado." }
  }

  const planCreditsAvailable = currentCycle
    ? Math.max(currentCycle.granted_credits - currentCycle.used_credits - currentCycle.expired_credits, 0)
    : 0

  const totalAvailable = Math.max(profileResult.data.credits_balance ?? 0, 0)
  const purchasedCreditsAvailable = Math.max(totalAvailable - planCreditsAvailable, 0)
  const tripOverrideResult = await getAccountLimitOverrideQuantity(client, {
    ownerType: "traveler",
    ownerId: userId,
    limitType: "active_trips",
  })
  if (tripOverrideResult.error) {
    return { data: null, error: tripOverrideResult.error }
  }
  const baseMaxActiveTrips = TRAVELER_PLAN_DEFINITIONS[effectivePlan].limits.maxActiveTrips
  const maxActiveTrips = baseMaxActiveTrips === null ? null : baseMaxActiveTrips + Math.max(tripOverrideResult.data, 0)

  return {
    data: {
      planCreditsAvailable,
      purchasedCreditsAvailable,
      totalAvailable,
      currentPlan: effectivePlan,
      currentPeriodEnd: currentCycle?.period_end ?? subscriptionResult.data.current_period_end ?? null,
      subscriptionStatus: subscriptionResult.data.status,
      stripeCustomerId: subscriptionResult.data.stripe_customer_id,
      stripeSubscriptionId: subscriptionResult.data.stripe_subscription_id,
      cancelAtPeriodEnd: subscriptionResult.data.cancel_at_period_end,
      maxActiveTrips,
    },
    error: null,
  }
}

export async function consumeTravelerCredits(
  client: SupabaseDbClient,
  params: {
    userId: string
    amount: number
    reason: string
    source: string
    metadata?: Record<string, unknown>
    createdBy?: string | null
  },
) {
  const balanceResult = await getTravelerCreditBalance(client, params.userId)
  if (balanceResult.error || !balanceResult.data) {
    return { success: false, error: balanceResult.error ?? "Nao foi possivel calcular o saldo do traveler." }
  }

  const amount = Math.abs(params.amount)
  if (balanceResult.data.totalAvailable < amount) {
    return { success: false, error: "Saldo insuficiente." }
  }

  const appliedFromPlan = Math.min(balanceResult.data.planCreditsAvailable, amount)
  const currentCycleResult = await getCurrentTravelerPlanCycle(client, params.userId, new Date().toISOString())
  if (currentCycleResult.error) {
    return { success: false, error: currentCycleResult.error }
  }

  const transactionInsert = await (client
    .from("credit_transactions") as any)
    .insert({
      owner_type: "traveler",
      owner_user_id: params.userId,
      type: "consume",
      amount: -amount,
      balance_after: Math.max(balanceResult.data.totalAvailable - amount, 0),
      reason: params.reason,
      source: params.source,
      metadata: {
        ...(params.metadata ?? {}),
        billing_scope: "traveler",
        applied_from_plan: appliedFromPlan,
        applied_from_purchased: amount - appliedFromPlan,
      },
      created_by: params.createdBy ?? params.userId,
    } as any)

  if (transactionInsert.error) {
    return { success: false, error: transactionInsert.error.message }
  }

  if (appliedFromPlan > 0 && currentCycleResult.data) {
    const nextUsedCredits = currentCycleResult.data.used_credits + appliedFromPlan
    const cycleUpdate = await (client
      .from("traveler_plan_credit_cycles" as any) as any)
      .update({ used_credits: nextUsedCredits } as any)
      .eq("id", currentCycleResult.data.id)

    if (cycleUpdate.error) {
      return { success: false, error: cycleUpdate.error.message }
    }
  }

  return {
    success: true,
    error: null,
    appliedFromPlan,
    appliedFromPurchased: amount - appliedFromPlan,
  }
}

export async function upsertTravelerSubscriptionFromStripe(
  client: SupabaseDbClient,
  payload: {
    userId: string
    planCode: TravelerPlanCode
    status: TravelerSubscriptionStatus
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
  },
) {
  const existing = await ensureTravelerSubscriptionRow(client, payload.userId)
  if (existing.error || !existing.data) {
    return { data: null as TravelerSubscriptionRow | null, error: existing.error ?? "Nao foi possivel carregar a assinatura traveler." }
  }

  const updateResult = await (client
    .from("traveler_subscriptions" as any) as any)
    .update({
      plan_code: payload.planCode,
      status: payload.status,
      stripe_customer_id: payload.stripeCustomerId ?? existing.data.stripe_customer_id,
      stripe_subscription_id: payload.stripeSubscriptionId ?? existing.data.stripe_subscription_id,
      stripe_price_id: payload.stripePriceId ?? existing.data.stripe_price_id,
      current_period_start: payload.currentPeriodStart ?? existing.data.current_period_start,
      current_period_end: payload.currentPeriodEnd ?? existing.data.current_period_end,
      cancel_at_period_end: payload.cancelAtPeriodEnd ?? existing.data.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", existing.data.id)
    .select("*")
    .single()

  return { data: (updateResult.data as TravelerSubscriptionRow | null) ?? null, error: updateResult.error?.message ?? null }
}

export async function getTravelerMembershipStatus(
  client: SupabaseDbClient,
  userId: string,
): Promise<{ data: TravelerMembershipStatusSummary | null; error: string | null }> {
  const subscriptionResult = await ensureTravelerSubscriptionRow(client, userId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return {
      data: null,
      error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura do traveler.",
    }
  }

  const row = subscriptionResult.data
  return {
    data: resolveTravelerMembership({
      planCode: row.plan_code,
      legacyStatus: row.status,
      legacyCurrentPeriodEnd: row.current_period_end,
      vueiPlusStatus: row.vuei_plus_status,
      vueiPlusCurrentPeriodEnd: row.vuei_plus_current_period_end,
      vueiPlusCancelAtPeriodEnd: row.vuei_plus_cancel_at_period_end,
      vueiPlusStripeSubscriptionId: row.vuei_plus_stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
    }),
    error: null,
  }
}

export async function upsertTravelerVueiPlusSubscriptionFromStripe(
  client: SupabaseDbClient,
  payload: {
    userId: string
    status: VueiPlusSubscriptionStatus
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    stripePriceId?: string | null
    currentPeriodStart?: string | null
    currentPeriodEnd?: string | null
    cancelAtPeriodEnd?: boolean
  },
) {
  const existing = await ensureTravelerSubscriptionRow(client, payload.userId)
  if (existing.error || !existing.data) {
    return {
      data: null as TravelerSubscriptionRow | null,
      error: existing.error ?? "Nao foi possivel carregar a assinatura traveler.",
    }
  }

  const updateResult = await (client
    .from("traveler_subscriptions" as any) as any)
    .update({
      stripe_customer_id: payload.stripeCustomerId ?? existing.data.stripe_customer_id,
      vuei_plus_status: payload.status,
      vuei_plus_stripe_subscription_id:
        payload.stripeSubscriptionId ?? existing.data.vuei_plus_stripe_subscription_id,
      vuei_plus_stripe_price_id: payload.stripePriceId ?? existing.data.vuei_plus_stripe_price_id,
      vuei_plus_current_period_start:
        payload.currentPeriodStart ?? existing.data.vuei_plus_current_period_start,
      vuei_plus_current_period_end:
        payload.currentPeriodEnd ?? existing.data.vuei_plus_current_period_end,
      vuei_plus_cancel_at_period_end:
        payload.cancelAtPeriodEnd ?? existing.data.vuei_plus_cancel_at_period_end,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", existing.data.id)
    .select("*")
    .single()

  return {
    data: (updateResult.data as TravelerSubscriptionRow | null) ?? null,
    error: updateResult.error?.message ?? null,
  }
}

export async function findTravelerSubscriptionByCustomerId(client: SupabaseDbClient, stripeCustomerId: string) {
  const { data, error } = await (client
    .from("traveler_subscriptions" as any) as any)
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle()

  return { data: (data as TravelerSubscriptionRow | null) ?? null, error: error?.message ?? null }
}

export async function findTravelerSubscriptionByStripeSubscriptionId(client: SupabaseDbClient, stripeSubscriptionId: string) {
  const { data, error } = await (client
    .from("traveler_subscriptions" as any) as any)
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle()

  return { data: (data as TravelerSubscriptionRow | null) ?? null, error: error?.message ?? null }
}

export async function findTravelerSubscriptionByVueiPlusSubscriptionId(
  client: SupabaseDbClient,
  stripeSubscriptionId: string,
) {
  const { data, error } = await (client
    .from("traveler_subscriptions" as any) as any)
    .select("*")
    .eq("vuei_plus_stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle()

  return {
    data: (data as TravelerSubscriptionRow | null) ?? null,
    error: error?.message ?? null,
  }
}

export async function updateTravelerStripeCustomerId(client: SupabaseDbClient, userId: string, stripeCustomerId: string) {
  const subscriptionResult = await ensureTravelerSubscriptionRow(client, userId)
  if (subscriptionResult.error || !subscriptionResult.data) {
    return { data: null as TravelerSubscriptionRow | null, error: subscriptionResult.error ?? "Nao foi possivel carregar a assinatura traveler." }
  }

  const updateResult = await (client
    .from("traveler_subscriptions" as any) as any)
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", subscriptionResult.data.id)
    .select("*")
    .single()

  return { data: (updateResult.data as TravelerSubscriptionRow | null) ?? null, error: updateResult.error?.message ?? null }
}
