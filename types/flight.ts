export type FlightExtractionStatus = "pending" | "processing" | "completed" | "failed" | "manual"

export interface FlightExtractionData {
  airline: string | null
  flightNumber: string | null
  bookingReference: string | null
  originAirport: string | null
  destinationAirport: string | null
  departureAt: string | null
  arrivalAt: string | null
  passengerName: string | null
  qrCodePayload: string | null
  baggageInfo: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
}

export interface TripFlightRecord {
  id: string
  tripId: string
  documentId: string | null
  airline: string | null
  flightNumber: string | null
  bookingReference: string | null
  originAirport: string | null
  destinationAirport: string | null
  departureAt: string | null
  arrivalAt: string | null
  passengerName: string | null
  qrCodePayload: string | null
  baggageInfo: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
  extractedData: FlightExtractionData | Record<string, unknown> | null
  extractionStatus: FlightExtractionStatus
  createdAt: string
  updatedAt: string
}

export interface TripFlightUpsertPayload {
  id?: string
  tripId: string
  documentId?: string | null
  airline?: string | null
  flightNumber?: string | null
  bookingReference?: string | null
  originAirport?: string | null
  destinationAirport?: string | null
  departureAt?: string | null
  arrivalAt?: string | null
  passengerName?: string | null
  qrCodePayload?: string | null
  baggageInfo?: string | null
  terminal?: string | null
  gate?: string | null
  seat?: string | null
  extractedData?: FlightExtractionData | Record<string, unknown> | null
  extractionStatus?: FlightExtractionStatus
}
