import type { Database } from "@/lib/supabase/types"

type TripRow = Database["public"]["Tables"]["trips"]["Row"]
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"]
type HotelRow = Database["public"]["Tables"]["trip_hotels"]["Row"]
type FlightRow = Database["public"]["Tables"]["trip_flights"]["Row"]
type TripItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]

export interface TripContextSummaryInput {
  trip: TripRow
  documents: DocumentRow[]
  hotels: HotelRow[]
  flights: FlightRow[]
  itineraries: TripItineraryRow[]
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

function summarizeFlights(flights: FlightRow[], documents: DocumentRow[]) {
  const prioritizedFlights = flights
    .filter((flight) => flight.extraction_status === "completed" || flight.extraction_status === "manual")
    .sort((left, right) => {
      const leftTime = left.departure_at ? new Date(left.departure_at).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.departure_at ? new Date(right.departure_at).getTime() : Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })

  if (prioritizedFlights.length > 0) {
    return prioritizedFlights
      .map((flight) => {
        const route = [flight.origin_airport, flight.destination_airport].filter(Boolean).join(" -> ")
        return [
          `companhia=${flight.airline ?? "nao informada"}`,
          `voo=${flight.flight_number ?? "nao informado"}`,
          `localizador=${flight.booking_reference ?? "nao informado"}`,
          route ? `rota=${route}` : null,
          flight.departure_at ? `saida=${flight.departure_at}` : null,
          flight.arrival_at ? `chegada=${flight.arrival_at}` : null,
          flight.passenger_name ? `passageiro=${flight.passenger_name}` : null,
          flight.terminal ? `terminal=${flight.terminal}` : null,
          flight.gate ? `portao=${flight.gate}` : null,
          flight.seat ? `assento=${flight.seat}` : null,
          flight.baggage_info ? `bagagem=${flight.baggage_info}` : null,
          `status_extracao=${flight.extraction_status}`,
        ]
          .filter(Boolean)
          .join(", ")
      })
      .join("; ")
  }

  const ticketDocuments = documents.filter((document) => document.type === "ticket")
  if (!ticketDocuments.length) return "Nenhuma passagem processada."

  return ticketDocuments
    .map((document) => `${document.name} [ticket] sem voo estruturado confirmado`)
    .join("; ")
}

function summarizeItineraries(itineraries: TripItineraryRow[]) {
  if (!itineraries.length) return "Nenhum roteiro real adicionado."

  return itineraries
    .map((itinerary) => {
      const content = itinerary.content && typeof itinerary.content === "object"
        ? (itinerary.content as { days?: unknown[] })
        : null
      const daysCount = Array.isArray(content?.days) ? content.days.length : 0
      const parts = [
        itinerary.title || "Roteiro da viagem",
        `[${itinerary.mode}]`,
        `status=${itinerary.status}`,
        daysCount > 0 ? `${daysCount} dia(s)` : null,
        itinerary.pdf_url ? "com PDF" : null,
      ]

      return parts.filter(Boolean).join(" ")
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
  const { trip, documents, hotels, flights, itineraries, audience, recentMessages } = input
  const travelWindow = [trip.start_date, trip.end_date].filter(Boolean).join(" ate ")

  return [
    `Viagem: ${trip.title}`,
    `Destino: ${trip.destination}${trip.city ? `, ${trip.city}` : ""}${trip.country ? `, ${trip.country}` : ""}`,
    `Periodo: ${travelWindow || "Nao informado"}`,
    `Status: ${trip.status}`,
    `Estilo: ${trip.style || "Nao informado"}`,
    `Viajantes: ${trip.travelers_count}`,
    `Hospedagens: ${summarizeHotels(hotels)}`,
    `Passagens estruturadas: ${summarizeFlights(flights, documents)}`,
    `Roteiros: ${summarizeItineraries(itineraries)}`,
    `Documentos visiveis para este contexto (${audience}): ${summarizeDocuments(documents)}`,
    `Historico recente:\n${summarizeRecentMessages(recentMessages)}`,
  ].join("\n")
}
