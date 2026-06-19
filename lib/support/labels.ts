import type { SupportPortalType, SupportSenderRole, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from "@/types"

export const SUPPORT_WHATSAPP = "(54) 99990-2688"

export function getSupportCategoryLabel(category: SupportTicketCategory) {
  switch (category) {
    case "vuei_help":
      return "Dúvida sobre o Vuei"
    case "technical_issue":
      return "Problema técnico"
    case "billing":
      return "Plano ou cobrança"
    case "credits":
      return "Créditos"
    case "trip_link":
      return "Viagem ou link"
    default:
      return "Outro"
  }
}

export function getSupportPriorityLabel(priority: SupportTicketPriority) {
  return priority === "urgent" ? "Urgente" : "Normal"
}

export function getSupportStatusLabel(status: SupportTicketStatus) {
  switch (status) {
    case "in_progress":
      return "Em andamento"
    case "resolved":
      return "Resolvido"
    default:
      return "Aberto"
  }
}

export function getSupportPortalLabel(portalType: SupportPortalType) {
  return portalType === "agency" ? "Portal Agência" : "Portal Viajante"
}

export function getSupportSenderRoleLabel(role: SupportSenderRole) {
  switch (role) {
    case "agency":
      return "Agência"
    case "master":
      return "Master"
    case "system":
      return "Sistema"
    default:
      return "Viajante"
  }
}
