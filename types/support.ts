export type SupportTicketCategory =
  | "vuei_help"
  | "technical_issue"
  | "billing"
  | "credits"
  | "trip_link"
  | "other"

export type SupportTicketPriority = "normal" | "urgent"
export type SupportTicketStatus = "open" | "in_progress" | "resolved"
export type SupportPortalType = "traveler" | "agency"
export type SupportSenderRole = "traveler" | "agency" | "master" | "system"
export type SupportBonusTargetType = "agency" | "traveler"
export type SupportBonusType = "credits" | "client_extra" | "trip_extra"

export interface SupportTicketContext {
  userId: string | null
  email: string | null
  name: string | null
  portalType: SupportPortalType
  agencyId: string | null
  agencyName?: string | null
  currentRoute: string | null
  timestamp: string
  deletionRequest?: boolean
  source?: string | null
}

export interface SupportTicket {
  id: string
  userId: string | null
  agencyId: string | null
  title: string
  category: SupportTicketCategory
  priority: SupportTicketPriority
  status: SupportTicketStatus
  message: string
  context: SupportTicketContext
  createdAt: string
  updatedAt: string
}

export interface SupportMessage {
  id: string
  ticketId: string
  senderId: string | null
  senderRole: SupportSenderRole
  body: string
  createdAt: string
}

export interface SupportBonusPayload {
  targetType: SupportBonusTargetType
  targetId: string
  bonusType: SupportBonusType
  quantity: number
  reason: string
  relatedClientName?: string | null
  relatedTripTitle?: string | null
}
