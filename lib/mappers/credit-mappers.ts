import type { CreditBalance, CreditOwnerType, CreditTransaction, CreditTransactionType } from "@/types"

export interface LegacyCreditHistoryEntry {
  action: string
  amount: number
  date: string
  source: string
}

export interface LegacyCreditsState {
  balance: number
  history: LegacyCreditHistoryEntry[]
}

export interface CreditsStoragePayload {
  schemaVersion: number
  credits: LegacyCreditsState
}

export const CREDITS_STORAGE_SCHEMA_VERSION = 2

function inferTransactionType(entry: LegacyCreditHistoryEntry): CreditTransactionType {
  if (entry.amount > 0 && entry.source.toLowerCase().includes("compra")) return "purchase"
  if (entry.amount > 0) return "grant"
  if (entry.source.toLowerCase().includes("concierge")) return "usage_concierge"
  if (entry.source.toLowerCase().includes("document")) return "usage_document"
  if (entry.source.toLowerCase().includes("roteiro")) return "usage_itinerary"
  return "usage_ai"
}

export function mapLegacyCreditsToCreditBalance(
  credits: LegacyCreditsState,
  ownerType: CreditOwnerType,
  ownerId: string
): CreditBalance {
  return {
    ownerType,
    ownerId,
    balance: credits.balance,
    updatedAt: new Date().toISOString(),
  }
}

export function mapCreditHistoryToTransactions(
  history: LegacyCreditHistoryEntry[],
  ownerType: CreditOwnerType,
  ownerId: string
): CreditTransaction[] {
  return history.map((entry, index) => ({
    id: `credit-tx-${ownerId}-${index}`,
    ownerType,
    ownerId,
    amount: entry.amount,
    type: inferTransactionType(entry),
    reason: entry.action,
    relatedTripId: null,
    relatedDocumentId: null,
    source: entry.source,
    createdAt: entry.date,
  }))
}

export function extractCreditsStoragePayload(rawValue: string | null, fallback: LegacyCreditsState): CreditsStoragePayload {
  if (!rawValue) {
    return { schemaVersion: CREDITS_STORAGE_SCHEMA_VERSION, credits: fallback }
  }

  try {
    const parsed = JSON.parse(rawValue) as CreditsStoragePayload | LegacyCreditsState

    if (parsed && typeof parsed.balance === "number" && Array.isArray(parsed.history)) {
      return { schemaVersion: 1, credits: parsed }
    }

    if (parsed && parsed.credits && typeof parsed.credits.balance === "number" && Array.isArray(parsed.credits.history)) {
      return {
        schemaVersion: typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : CREDITS_STORAGE_SCHEMA_VERSION,
        credits: parsed.credits,
      }
    }
  } catch {
    // fallback silencioso
  }

  return { schemaVersion: CREDITS_STORAGE_SCHEMA_VERSION, credits: fallback }
}
