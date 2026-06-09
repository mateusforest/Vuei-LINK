export interface FlightExtractionData {
  airline: string | null
  recordLocator: string | null
  flightNumber: string | null
  origin: string | null
  destination: string | null
  originCode: string | null
  destinationCode: string | null
  departureDateTime: string | null
  arrivalDateTime: string | null
  terminal: string | null
  gate: string | null
  baggage: string | null
  passengers: string[]
  qrCode: string | null
}

export interface TripFlightRecord {
  id: string
  tripId: string
  documentId: string | null
  airline: string | null
  recordLocator: string | null
  flightNumber: string | null
  originCode: string | null
  originCity: string | null
  destinationCode: string | null
  destinationCity: string | null
  departureDateTime: string | null
  arrivalDateTime: string | null
  terminal: string | null
  gate: string | null
  baggage: string | null
  extractionStatus: "pending" | "processing" | "completed" | "failed"
  extractedData: FlightExtractionData | Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}
