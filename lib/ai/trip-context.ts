import type { Database } from "@/lib/supabase/types"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]

export interface TripContextSummaryInput {
  trip: TripRow
  documents: DocumentRow[]
  hotels: HotelRow[]
  audience: "traveler" | "agency"
  recentMessages?: Array<{ role: string; content: string }>
}

function summarizeHotels(hotels: HotelRow[]) {
  if (!hotels.length) return "Nenhuma hospedagem real adicionada."

  return hotels
    .map((hotel) => {
      const hotelName = hotel.name ?? hotel.hotel_name ?? "Hospedagem sem nome"
      return `${hotelName} (${hotel.check_in ?? "check-in nao informado"} -> ${hotel.check_out ?? "check-out nao informado"})`
    })
    .join("; ")
}

function summarizeDocuments(documents: DocumentRow[]) {
  if (!documents.length) return "Nenhum documento real anexado."

  return documents
    .map((document) => {
      const extraction = document.ai_extracted_data && Object.keys(document.ai_extracted_data).length > 0 ? " com dados extraidos" : ""
      return `${document.name} [${document.type}]${document.is_private ? " (privado)" : ""}${extraction}`
    })
    .join("; ")
}

function summarizeFlights(documents: DocumentRow[]) {
  const ticketDocuments = documents.filter((document) => document.type === "ticket")
  if (!ticketDocuments.length) return "Nenhuma passagem processada."

  return ticketDocuments
    .map((document) => {
      const extracted = (document.ai_extracted_data ?? {}) as Record<string, unknown>
      const airline = typeof extracted.airline === "string" ? extracted.airline : "Companhia nao identificada"
      const flightNumber = typeof extracted.flightNumber === "string" ? extracted.flightNumber : "voo nao identificado"
      const route = [extracted.originCode, extracted.destinationCode].filter((value) => typeof value === "string").join(" -> ")
      return `${airline} ${flightNumber}${route ? ` (${route})` : ""}`
    })
    .join("; ")
}

function summarizeRecentMessages(messages: Array<{ role: string; content: string }> | undefined) {
  if (!messages?.length) return "Sem historico recente."

  return messages
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n")
}

export function buildTripContextSummary(input: TripContextSummaryInput) {
  const { trip, documents, hotels, audience, recentMessages } = input
  const travelWindow = [trip.start_date, trip.end_date].filter(Boolean).join(" ate ")

  return [
    `Viagem: ${trip.title}`,
    `Destino: ${trip.destination}${trip.city ? `, ${trip.city}` : ""}${trip.country ? `, ${trip.country}` : ""}`,
    `Periodo: ${travelWindow || "Nao informado"}`,
    `Status: ${trip.status}`,
    `Estilo: ${trip.style || "Nao informado"}`,
    `Viajantes: ${trip.travelers_count}`,
    `Hospedagens: ${summarizeHotels(hotels)}`,
    `Passagens: ${summarizeFlights(documents)}`,
    `Documentos visiveis para este contexto (${audience}): ${summarizeDocuments(documents)}`,
    `Historico recente:\n${summarizeRecentMessages(recentMessages)}`,
  ].join("\n")
}
