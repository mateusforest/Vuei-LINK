import type { CreditTransaction } from "@/types"

const AI_FEATURE_LABELS: Record<string, string> = {
  concierge: "Concierge IA",
  flight_extraction: "Leitura de passagem",
  itinerary_generation: "Geracao de roteiro",
  document_extraction: "Leitura de documentos",
}

const AI_STATUS_LABELS: Record<string, string> = {
  completed: "Concluido",
  failed: "Falhou",
  skipped: "Ignorado",
  processing: "Em processamento",
  pending: "Pendente",
}

const CREDIT_TYPE_LABELS: Record<string, string> = {
  grant: "Credito concedido",
  purchase: "Compra de creditos",
  consume: "Consumo de creditos",
  refund: "Reembolso de creditos",
  adjustment: "Ajuste de creditos",
  usage_ai: "Consumo de IA",
  usage_concierge: "Consumo do concierge",
  usage_document: "Consumo de documentos",
  usage_itinerary: "Consumo de roteiro",
  plan_included: "Credito do plano",
}

const CREDIT_SOURCE_LABELS: Record<string, string> = {
  ai_flight_extraction: "Consumo de leitura de passagem",
  flight_extraction: "Leitura de passagem",
  ai_itinerary_generation: "Geracao de roteiro",
  ai_itinerary_generation_failed: "Geracao de roteiro falhou",
  itinerary_generation: "Geracao de roteiro",
  concierge: "Concierge IA",
  admin_grant: "Credito concedido",
  manual_grant: "Credito concedido",
  grant: "Credito concedido",
  purchase: "Compra de creditos",
  refund: "Reembolso de creditos",
}

export function formatMasterAiFeatureLabel(feature?: string | null) {
  if (!feature) return "IA"
  return AI_FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ")
}

export function formatMasterAiStatusLabel(status?: string | null) {
  if (!status) return "Nao informado"
  return AI_STATUS_LABELS[status] ?? status
}

function looksTechnicalLabel(value?: string | null) {
  if (!value) return false
  return /^[a-z0-9_:-]+$/i.test(value)
}

export function formatMasterCreditOwnerLabel(transaction: CreditTransaction) {
  if (transaction.ownerType === "agency") return "Agencia"
  if (transaction.ownerType === "client") return "Cliente"
  return "Usuario"
}

export function formatMasterCreditTransactionLabel(transaction: CreditTransaction) {
  const reason = transaction.reason?.trim()
  if (reason && !looksTechnicalLabel(reason)) return reason

  const sourceLabel = transaction.source ? CREDIT_SOURCE_LABELS[transaction.source] : null
  if (sourceLabel) return sourceLabel

  return CREDIT_TYPE_LABELS[transaction.type] ?? `${formatMasterCreditOwnerLabel(transaction)} - ${transaction.type}`
}

export function formatMasterCreditTransactionDetail(transaction: CreditTransaction) {
  const sourceLabel = transaction.source ? CREDIT_SOURCE_LABELS[transaction.source] : null
  if (sourceLabel) return sourceLabel
  return CREDIT_TYPE_LABELS[transaction.type] ?? transaction.type
}
