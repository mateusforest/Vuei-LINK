import type { Profile } from "@/types"

export type TravelerPlanCode = "free" | "premium"

export interface TravelerPlanDefinition {
  code: TravelerPlanCode
  name: string
  priceLabel: string
  monthlyPriceCents: number
  monthlyCredits: number
  badge?: string
  highlighted?: boolean
  features: string[]
  limitations: string[]
  limits: {
    maxActiveTrips: number | null
    simpleItinerary: boolean
    completeItineraryPdf: boolean
    conciergePriority: "standard" | "priority"
    unlimitedSharing: boolean
  }
}

export interface TravelerCreditPackageDefinition {
  code: "starter" | "popular" | "pro"
  name: string
  credits: number
  priceLabel: string
  priceCents: number
}

export const TRAVELER_PLAN_DEFINITIONS: Record<TravelerPlanCode, TravelerPlanDefinition> = {
  free: {
    code: "free",
    name: "Free",
    priceLabel: "R$ 0",
    monthlyPriceCents: 0,
    monthlyCredits: 30,
    features: [
      "1 viagem ativa",
      "Concierge IA completo",
      "30 créditos por mês",
      "Compartilhamento da viagem",
      "Offline",
      "Passagens",
      "Hospedagens",
      "Documentos",
    ],
    limitations: [
      "Roteiro simples IA",
      "Roteiro completo IA",
      "Mais de uma viagem ativa",
    ],
    limits: {
      maxActiveTrips: 1,
      simpleItinerary: false,
      completeItineraryPdf: false,
      conciergePriority: "standard",
      unlimitedSharing: false,
    },
  },
  premium: {
    code: "premium",
    name: "Premium",
    priceLabel: "R$ 29,90/mês",
    monthlyPriceCents: 2990,
    monthlyCredits: 150,
    badge: "Mais popular",
    highlighted: true,
    features: [
      "Viagens ilimitadas",
      "Concierge IA completo",
      "Prioridade no Concierge",
      "Roteiro simples IA",
      "Roteiro completo PDF IA",
      "150 créditos por mês",
      "Compartilhamento ilimitado",
      "Offline",
      "Passagens",
      "Hospedagens",
      "Documentos",
    ],
    limitations: [],
    limits: {
      maxActiveTrips: null,
      simpleItinerary: true,
      completeItineraryPdf: true,
      conciergePriority: "priority",
      unlimitedSharing: true,
    },
  },
}

export const TRAVELER_CREDIT_PACKAGES: TravelerCreditPackageDefinition[] = [
  {
    code: "starter",
    name: "Starter",
    credits: 100,
    priceLabel: "R$ 19,90",
    priceCents: 1990,
  },
  {
    code: "popular",
    name: "Popular",
    credits: 300,
    priceLabel: "R$ 49,90",
    priceCents: 4990,
  },
  {
    code: "pro",
    name: "Pro",
    credits: 500,
    priceLabel: "R$ 79,90",
    priceCents: 7990,
  },
]

export const TRAVELER_AI_CREDIT_COSTS = {
  concierge_message: 1,
  itinerary_generation_simple: 5,
  itinerary_generation_complete_pdf: 20,
  ticket_extraction: 10,
  documents: 0,
  accommodations: 0,
  offline: 0,
  sharing: 0,
} as const

export type TravelerAiCreditCostCode = keyof typeof TRAVELER_AI_CREDIT_COSTS

export interface TravelerPlanSnapshot {
  code: TravelerPlanCode
  definition: TravelerPlanDefinition
  isPremium: boolean
}

export function getTravelerPlanDefinition(code: TravelerPlanCode) {
  return TRAVELER_PLAN_DEFINITIONS[code]
}

export function getTravelerAiCreditCost(code: TravelerAiCreditCostCode) {
  return TRAVELER_AI_CREDIT_COSTS[code]
}

export function resolveTravelerPlan(profile: Profile | null | undefined): TravelerPlanSnapshot {
  // Billing traveler ainda nao esta conectado a Stripe/assinaturas nesta fase.
  // Centralizamos a decisao aqui para trocar a fonte depois sem espalhar condicao pela UI.
  let code: TravelerPlanCode = "free"

  if (profile?.role !== "traveler") {
    code = "free"
  }

  const definition = getTravelerPlanDefinition(code)

  return {
    code,
    definition,
    isPremium: definition.code === "premium",
  }
}
