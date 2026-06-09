export type AiModule =
  | "concierge"
  | "itinerary"
  | "documents"
  | "ticket_reader"
  | "accommodation_reader"
  | "flight_reader"
  | "support_assistant"

export type AiRole = "user" | "assistant" | "agent" | "system"

export type AiUsageFeature = "concierge" | "flight_extraction" | "itinerary_generation" | "document_extraction"

export type AiUsageStatus = "completed" | "failed" | "skipped"

export interface AiStructuredResult<TData = Record<string, unknown>> {
  success: boolean
  module: AiModule
  data: TData | null
  confidence: number | null
  warnings: string[]
}

export interface ExtractedFlightData {
  airline: string | null
  flightNumber: string | null
  originCode: string | null
  destinationCode: string | null
  departureDateTime: string | null
  arrivalDateTime: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
}

export interface ExtractedAccommodationData {
  name: string | null
  address: string | null
  checkInDateTime: string | null
  checkOutDateTime: string | null
  roomType: string | null
  confirmationCode: string | null
}

export interface ExtractedDocumentData {
  documentType: string | null
  holderName: string | null
  documentNumber: string | null
  issuingCountry: string | null
  expiryDate: string | null
}

export interface GeneratedItineraryData {
  title: string | null
  destination: string | null
  days: Array<{
    day: number
    title: string
    items: Array<{
      time: string | null
      title: string
      type: string
      notes: string | null
    }>
  }>
}

export interface AiConversation {
  id: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  channel: Extract<AiModule, "concierge" | "itinerary" | "documents" | "ticket_reader">
  status: "open" | "closed" | "archived"
  title?: string | null
  lastMessage?: string | null
  lastMessageAt?: string | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface AiMessage {
  id: string
  conversationId: string
  tripId: string | null
  userId: string | null
  agencyId: string | null
  clientId: string | null
  role: AiRole
  content: string
  creditsUsed: number
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AiPrompt {
  id: string
  code: string
  name: string
  module: AiModule
  systemPrompt: string
  userPromptTemplate: string | null
  isActive: boolean
  version: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface AiUsageLog {
  id: string
  ownerUserId: string | null
  tripId: string | null
  agencyId: string | null
  conversationId: string | null
  messageId: string | null
  feature: AiUsageFeature
  model: string | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  creditAmount: number
  status: AiUsageStatus
  metadata: Record<string, unknown> | null
  createdAt: string
}
