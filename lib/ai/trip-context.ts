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
  accessMode: "admin" | "public" | "authenticated"
  clientName?: string | null
  travelerName?: string | null
  recentMessages?: Array<{ role: string; content: string }>
}

export interface TripContextDebugSummary {
  destination: boolean
  trip_dates: boolean
  traveler: boolean
  client: boolean
  flights: { included: boolean; count: number }
  hotels: { included: boolean; count: number }
  documents: { included: boolean; count: number }
  itineraries: { included: boolean; count: number }
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return null
  if (normalized === "undefined" || normalized === "null") return null
  return normalized
}

function joinHuman(parts: Array<string | null | undefined>, separator = " • ") {
  return parts.map(cleanText).filter(Boolean).join(separator)
}

function formatDate(value: string | null | undefined) {
  const raw = cleanText(value)
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(value: string | null | undefined) {
  const raw = cleanText(value)
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function buildTripWindow(trip: TripRow) {
  const start = formatDate(trip.start_date)
  const end = formatDate(trip.end_date)

  if (start && end) return `${start} até ${end}`
  return start ?? end ?? "Não informado"
}

function summarizeHotels(hotels: HotelRow[]) {
  if (!hotels.length) return ["- Nenhuma hospedagem disponível neste contexto."]

  return hotels
    .map((hotel) => {
      const hotelName = cleanText(hotel.hotel_name) ?? cleanText(hotel.name) ?? "Hospedagem cadastrada"
      const location = joinHuman([hotel.address, hotel.city, hotel.country], " • ")
      const period = joinHuman(
        [
          formatDate(hotel.check_in) ? `Check-in: ${formatDate(hotel.check_in)}` : null,
          formatDate(hotel.check_out) ? `Check-out: ${formatDate(hotel.check_out)}` : null,
        ],
      )
      const reservationCode = cleanText(hotel.reservation_code)
        ?? cleanText(hotel.confirmation_number)
        ?? cleanText(hotel.confirmation_code)
        ?? cleanText(hotel.booking_code)
      const voucher = hotel.document_id ? "Voucher disponível no link." : null

      return `- ${joinHuman([
        hotelName,
        location,
        period,
        reservationCode ? `Código: ${reservationCode}` : null,
        voucher,
      ])}`
    })
    .filter(Boolean)
}

function summarizeDocuments(documents: DocumentRow[]) {
  if (!documents.length) return ["- Nenhum documento disponível neste contexto."]

  return documents.map((document) => {
    const visibility = document.visibility === "agency_only"
      ? "uso da agência"
      : document.visibility === "private"
        ? "privado"
        : "visível no link"

    return `- ${joinHuman([
      cleanText(document.name) ?? "Documento sem nome",
      cleanText(document.type) ? `tipo ${cleanText(document.type)}` : null,
      visibility,
    ])}`
  })
}

function summarizeFlights(flights: FlightRow[], documents: DocumentRow[]) {
  const prioritizedFlights = flights
    .filter((flight) => flight.extraction_status === "completed" || flight.extraction_status === "manual" || flight.extraction_status === "processing")
    .sort((left, right) => {
      const leftTime = left.departure_at ? new Date(left.departure_at).getTime() : Number.MAX_SAFE_INTEGER
      const rightTime = right.departure_at ? new Date(right.departure_at).getTime() : Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })

  if (prioritizedFlights.length > 0) {
    return prioritizedFlights.map((flight) => {
      const route = joinHuman([flight.origin_airport, flight.destination_airport], " → ")
      return `- ${joinHuman([
        cleanText(flight.airline),
        cleanText(flight.flight_number) ? `Voo ${cleanText(flight.flight_number)}` : null,
        route,
        formatDateTime(flight.departure_at) ? `Saída: ${formatDateTime(flight.departure_at)}` : null,
        formatDateTime(flight.arrival_at) ? `Chegada: ${formatDateTime(flight.arrival_at)}` : null,
        cleanText(flight.booking_reference) ? `Localizador: ${cleanText(flight.booking_reference)}` : null,
        cleanText(flight.passenger_name) ? `Passageiro: ${cleanText(flight.passenger_name)}` : null,
        cleanText(flight.terminal) ? `Terminal: ${cleanText(flight.terminal)}` : null,
        cleanText(flight.gate) ? `Portão: ${cleanText(flight.gate)}` : null,
        cleanText(flight.seat) ? `Assento: ${cleanText(flight.seat)}` : null,
      ])}`
    })
  }

  const ticketDocuments = documents.filter((document) => document.type === "ticket")
  if (!ticketDocuments.length) return ["- Nenhuma passagem disponível neste contexto."]

  return ticketDocuments.map((document) => `- ${cleanText(document.name) ?? "Documento de passagem"} disponível, mas sem voo estruturado confirmado.`)
}

function summarizeItineraryContent(itinerary: TripItineraryRow) {
  const content = itinerary.content && typeof itinerary.content === "object"
    ? (itinerary.content as { summary?: unknown; days?: Array<{ day?: unknown; title?: unknown; activities?: Array<{ title?: unknown }> }> })
    : null

  const summary = cleanText(content?.summary)
  const days = Array.isArray(content?.days) ? content.days.slice(0, 4) : []

  const dayLines = days
    .map((day) => {
      const dayIndex = typeof day?.day === "number" ? `Dia ${day.day}` : "Dia"
      const title = cleanText(day?.title)
      const highlights = Array.isArray(day?.activities)
        ? day.activities.map((activity) => cleanText(activity?.title)).filter(Boolean).slice(0, 3)
        : []

      return joinHuman([
        `${dayIndex}${title ? `: ${title}` : ""}`,
        highlights.length > 0 ? `Atividades: ${highlights.join(", ")}` : null,
      ])
    })
    .filter(Boolean)

  return {
    summary,
    dayLines,
  }
}

function summarizeItineraries(itineraries: TripItineraryRow[]) {
  if (!itineraries.length) return ["- Nenhum roteiro disponível neste contexto."]

  return itineraries.map((itinerary) => {
    const contentSummary = summarizeItineraryContent(itinerary)
    const base = joinHuman([
      cleanText(itinerary.title) ?? "Roteiro da viagem",
      cleanText(itinerary.mode) ? `modo ${cleanText(itinerary.mode)}` : null,
      cleanText(itinerary.status) ? `status ${cleanText(itinerary.status)}` : null,
      itinerary.pdf_url ? "PDF disponível" : null,
      itinerary.document_id ? "Documento vinculado no link" : null,
      contentSummary.summary,
    ])

    const compactDays = contentSummary.dayLines.slice(0, 2).join(" | ")
    return `- ${joinHuman([base, compactDays])}`
  })
}

function summarizeRecentMessages(messages: Array<{ role: string; content: string }> | undefined) {
  if (!messages?.length) return "Sem histórico recente."

  return messages
    .slice(-6)
    .map((message) => `${message.role}: ${cleanText(message.content) ?? ""}`)
    .join("\n")
}

export function buildTripContextSummary(input: TripContextSummaryInput) {
  const { trip, documents, hotels, flights, itineraries, audience, accessMode, recentMessages, clientName, travelerName } = input

  const destination = joinHuman([trip.destination, trip.city, trip.country], ", ")
  const summary = [
    "CONTEXTO REAL DA VIAGEM",
    `- Título: ${cleanText(trip.title) ?? "Viagem sem título"}`,
    `- Destino: ${destination || "Não informado"}`,
    `- Período: ${buildTripWindow(trip)}`,
    `- Status da viagem: ${cleanText(trip.status) ?? "Não informado"}`,
    `- Estilo da viagem: ${cleanText(trip.style) ?? "Não informado"}`,
    `- Viajantes cadastrados: ${typeof trip.travelers_count === "number" ? String(trip.travelers_count) : "Não informado"}`,
    clientName ? `- Cliente: ${clientName}` : "- Cliente: não informado neste contexto.",
    travelerName ? `- Viajante responsável: ${travelerName}` : "- Viajante responsável: não informado neste contexto.",
    `- Origem deste atendimento: ${accessMode === "admin" ? "link administrativo" : accessMode === "public" ? "link público" : "portal autenticado"}`,
    `- Conta responsável por este concierge: ${audience === "agency" ? "agência" : "viajante"}`,
    "",
    "PASSAGENS",
    ...summarizeFlights(flights, documents),
    "",
    "HOSPEDAGENS",
    ...summarizeHotels(hotels),
    "",
    "DOCUMENTOS DISPONÍVEIS NESTE CONTEXTO",
    ...summarizeDocuments(documents),
    "",
    "ROTEIROS DISPONÍVEIS NESTE CONTEXTO",
    ...summarizeItineraries(itineraries),
    "",
    "REGRAS DE RESPOSTA",
    "- Responda usando primeiro os dados reais acima.",
    "- Se alguma informação não estiver disponível neste contexto, diga isso claramente.",
    "- Nunca invente voo, hotel, documento, roteiro, horário, localizador ou endereço.",
    "- Se houver documento ou voucher, oriente o usuário a abrir o item no próprio link.",
    "",
    "HISTÓRICO RECENTE",
    summarizeRecentMessages(recentMessages),
  ].join("\n")

  const debug: TripContextDebugSummary = {
    destination: Boolean(destination),
    trip_dates: Boolean(trip.start_date || trip.end_date),
    traveler: Boolean(travelerName),
    client: Boolean(clientName),
    flights: { included: flights.length > 0, count: flights.length },
    hotels: { included: hotels.length > 0, count: hotels.length },
    documents: { included: documents.length > 0, count: documents.length },
    itineraries: { included: itineraries.length > 0, count: itineraries.length },
  }

  return {
    summary,
    debug,
  }
}
