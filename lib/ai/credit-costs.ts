export const AI_CREDIT_COSTS = {
  concierge_message: 1,
  itinerary_generation: 10,
  document_reading: 4,
  ticket_reading: 3,
  accommodation_reading: 3,
} as const

export type AiCreditCostCode = keyof typeof AI_CREDIT_COSTS

export function getAiCreditCost(code: AiCreditCostCode) {
  return AI_CREDIT_COSTS[code]
}
