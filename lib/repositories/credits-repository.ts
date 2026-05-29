import type { CreditBalance, CreditOwnerType, CreditPackage, CreditTransaction, Plan } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"
import { normalizeLegacyCredits, readLegacyAgencyData } from "@/lib/local-storage-migration"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"

interface CreditMutationPayload {
  ownerType: CreditOwnerType
  ownerId: string
  amount: number
  type: CreditTransaction["type"]
  reason: string
  relatedTripId?: string | null
  relatedDocumentId?: string | null
  source?: string | null
}

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

function readTravelerCreditsState() {
  return normalizeLegacyCredits("profile", "local-traveler", { balance: 150, history: [] })
}

function readAgencyCreditsState() {
  const agencyState = readLegacyAgencyData<unknown, unknown, unknown, unknown, unknown, { balance?: number; history?: Array<{ action: string; amount: number; date: string; source: string }> }>()
  const credits = agencyState.credits ?? { balance: 0, history: [] }
  const balance: CreditBalance = {
    ownerType: "agency",
    ownerId: "agency-frontend",
    balance: typeof credits.balance === "number" ? credits.balance : 0,
    updatedAt: new Date().toISOString(),
  }
  const transactions: CreditTransaction[] = Array.isArray(credits.history)
    ? credits.history.map((entry, index) => ({
        id: `agency-credit-${index}`,
        ownerType: "agency",
        ownerId: "agency-frontend",
        amount: entry.amount,
        type: entry.amount >= 0 ? "grant" : "usage_ai",
        reason: entry.action,
        relatedTripId: null,
        relatedDocumentId: null,
        source: entry.source,
        createdAt: entry.date,
      }))
    : []

  return { balance, transactions }
}

function resolveCredits(ownerType: CreditOwnerType, ownerId: string) {
  if (ownerType === "agency") {
    const agencyCredits = readAgencyCreditsState()
    return {
      balance: { ...agencyCredits.balance, ownerId },
      transactions: agencyCredits.transactions.map((transaction) => ({ ...transaction, ownerId })),
    }
  }

  const travelerCredits = readTravelerCreditsState()
  return {
    balance: { ...travelerCredits.balance, ownerId },
    transactions: travelerCredits.transactions.map((transaction) => ({ ...transaction, ownerId })),
  }
}

export async function getCreditBalance(ownerType: CreditOwnerType, ownerId: string) {
  const data = resolveCredits(ownerType, ownerId).balance

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
    }
  }

  return { source: "local" as const, data }
}

export async function listCreditTransactions(ownerType: CreditOwnerType, ownerId: string) {
  const data = resolveCredits(ownerType, ownerId).transactions

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
    }
  }

  return { source: "local" as const, data }
}

export async function listCreditPackages(ownerType?: CreditOwnerType) {
  const data = ownerType ? DEFAULT_PACKAGES : DEFAULT_PACKAGES

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
    }
  }

  return { source: "local" as const, data }
}

export async function listPlans(ownerType?: CreditOwnerType) {
  const data = ownerType ? DEFAULT_PLANS.filter((plan) => plan.ownerType === ownerType) : DEFAULT_PLANS

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data,
    }
  }

  return { source: "local" as const, data }
}

export async function addCreditTransaction(payload: CreditMutationPayload) {
  const transaction: CreditTransaction = {
    id: `credit-tx-${Date.now()}`,
    ownerType: payload.ownerType,
    ownerId: payload.ownerId,
    amount: payload.amount,
    type: payload.type,
    reason: payload.reason,
    relatedTripId: payload.relatedTripId ?? null,
    relatedDocumentId: payload.relatedDocumentId ?? null,
    source: payload.source ?? "repository",
    createdAt: new Date().toISOString(),
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: transaction,
    }
  }

  return { source: "local" as const, data: transaction }
}

export async function consumeCredits(payload: Omit<CreditMutationPayload, "type">) {
  return addCreditTransaction({ ...payload, amount: -Math.abs(payload.amount), type: "usage_ai" })
}

export async function grantCredits(payload: Omit<CreditMutationPayload, "type">) {
  return addCreditTransaction({ ...payload, amount: Math.abs(payload.amount), type: "grant" })
}
