export type CreditOwnerType = "profile" | "agency" | "client"

export type CreditTransactionType =
  | "grant"
  | "purchase"
  | "consume"
  | "usage_ai"
  | "usage_concierge"
  | "usage_document"
  | "usage_itinerary"
  | "refund"
  | "adjustment"
  | "plan_included"

export interface CreditBalance {
  ownerType: CreditOwnerType
  ownerId: string
  balance: number
  updatedAt: string
}

export interface CreditTransaction {
  id: string
  ownerType: CreditOwnerType
  ownerId: string
  amount: number
  type: CreditTransactionType
  reason: string
  relatedTripId: string | null
  relatedDocumentId: string | null
  source: string | null
  createdAt: string
  balanceAfter?: number | null
  metadata?: Record<string, unknown>
  createdBy?: string | null
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  code: string
  name: string
  ownerType: CreditOwnerType
  monthlyCredits: number
  price: number
  isActive: boolean
  limits: Record<string, number | boolean>
  createdAt: string
  updatedAt: string
}
