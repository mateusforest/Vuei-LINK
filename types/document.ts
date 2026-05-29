export type DocumentVisibility = "private" | "public_trip" | "agency_only"
export type DocumentType =
  | "voucher"
  | "ticket"
  | "passport"
  | "visa"
  | "insurance"
  | "itinerary"
  | "contract"
  | "receipt"
  | "other"

export interface DocumentAiExtraction {
  documentId: string
  module: "concierge" | "itinerary" | "documents" | "ticket_reader"
  status: "pending" | "processing" | "completed" | "failed"
  extractedData: Record<string, unknown> | null
  confidence: number | null
  createdAt: string
}

export interface Document {
  id: string
  tripId: string | null
  clientId: string | null
  agencyId: string | null
  ownerUserId: string | null
  name: string
  type: DocumentType | string
  fileUrl: string | null
  filePath: string | null
  mimeType: string | null
  size: number | null
  isPrivate: boolean
  visibility: DocumentVisibility
  aiExtractedData: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
