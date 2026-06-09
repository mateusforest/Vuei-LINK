import { getAiCreditCost } from "@/lib/ai/credit-costs"

export function getConciergeCreditCost() {
  return getAiCreditCost("concierge_message")
}

export function getTicketExtractionCreditCost() {
  return getAiCreditCost("ticket_reading")
}

export function estimateCostUsd(inputTokens: number, outputTokens: number) {
  const inputRate = Number(process.env.OPENAI_PRICE_INPUT_PER_1M_USD ?? "")
  const outputRate = Number(process.env.OPENAI_PRICE_OUTPUT_PER_1M_USD ?? "")

  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate) || inputRate < 0 || outputRate < 0) {
    return null
  }

  return Number((((inputTokens / 1_000_000) * inputRate) + ((outputTokens / 1_000_000) * outputRate)).toFixed(6))
}
