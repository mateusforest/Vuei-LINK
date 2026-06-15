import { getTravelerAiCreditCost } from "@/lib/billing/traveler-plans"

export const AI_CREDIT_COSTS = {
  concierge_message: getTravelerAiCreditCost("concierge_message"),
  itinerary_generation: getTravelerAiCreditCost("itinerary_generation_complete_pdf"),
  itinerary_generation_simple: getTravelerAiCreditCost("itinerary_generation_simple"),
  itinerary_generation_complete: getTravelerAiCreditCost("itinerary_generation_complete_pdf"),
  document_reading: getTravelerAiCreditCost("documents"),
  ticket_reading: getTravelerAiCreditCost("ticket_extraction"),
  accommodation_reading: getTravelerAiCreditCost("accommodations"),
  offline: getTravelerAiCreditCost("offline"),
  sharing: getTravelerAiCreditCost("sharing"),
} as const

export type AiCreditCostCode = keyof typeof AI_CREDIT_COSTS

export function getAiCreditCost(code: AiCreditCostCode) {
  return AI_CREDIT_COSTS[code]
}
