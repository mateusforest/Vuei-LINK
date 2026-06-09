const OPENAI_TICKET_MODEL = process.env.OPENAI_TICKET_MODEL ?? process.env.OPENAI_CONCIERGE_MODEL ?? "gpt-4.1-mini"

export interface FlightExtractionRequest {
  documentName: string
  mimeType: string | null
  signedUrl: string
}

export interface FlightExtractionStructuredData {
  is_ticket: boolean
  failure_reason: string | null
  airline: string | null
  flight_number: string | null
  booking_reference: string | null
  origin_airport: string | null
  destination_airport: string | null
  departure_at: string | null
  arrival_at: string | null
  passenger_name: string | null
  terminal: string | null
  gate: string | null
  seat: string | null
  baggage_info: string | null
  qr_code_payload: string | null
  raw_departure_text: string | null
  raw_arrival_text: string | null
  confidence: "high" | "medium" | "low" | null
  notes: string[]
}

export interface FlightExtractionResult {
  ok: boolean
  calledModel: boolean
  model: string | null
  error: string | null
  data: FlightExtractionStructuredData | null
  rawText: string | null
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

function extractJsonObject(content: string) {
  const trimmed = content.trim()

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]+?)```/i) ?? trimmed.match(/```([\s\S]+?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return null
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeNotes(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
}

function parseStructuredData(payload: unknown): FlightExtractionStructuredData | null {
  if (!payload || typeof payload !== "object") return null

  const candidate = payload as Record<string, unknown>

  return {
    is_ticket: candidate.is_ticket === true,
    failure_reason: normalizeString(candidate.failure_reason),
    airline: normalizeString(candidate.airline),
    flight_number: normalizeString(candidate.flight_number),
    booking_reference: normalizeString(candidate.booking_reference),
    origin_airport: normalizeString(candidate.origin_airport),
    destination_airport: normalizeString(candidate.destination_airport),
    departure_at: normalizeString(candidate.departure_at),
    arrival_at: normalizeString(candidate.arrival_at),
    passenger_name: normalizeString(candidate.passenger_name),
    terminal: normalizeString(candidate.terminal),
    gate: normalizeString(candidate.gate),
    seat: normalizeString(candidate.seat),
    baggage_info: normalizeString(candidate.baggage_info),
    qr_code_payload: normalizeString(candidate.qr_code_payload),
    raw_departure_text: normalizeString(candidate.raw_departure_text),
    raw_arrival_text: normalizeString(candidate.raw_arrival_text),
    confidence:
      candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low"
        ? candidate.confidence
        : null,
    notes: normalizeNotes(candidate.notes),
  }
}

export function countUsefulFlightFields(data: FlightExtractionStructuredData | null) {
  if (!data) return 0

  const values = [
    data.airline,
    data.flight_number,
    data.booking_reference,
    data.origin_airport,
    data.destination_airport,
    data.departure_at,
    data.arrival_at,
    data.passenger_name,
    data.terminal,
    data.gate,
    data.seat,
    data.baggage_info,
    data.qr_code_payload,
  ]

  return values.filter((value) => typeof value === "string" && value.trim().length > 0).length
}

export async function requestFlightExtraction({ documentName, mimeType, signedUrl }: FlightExtractionRequest): Promise<FlightExtractionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      calledModel: false,
      model: null,
      error: "A extracao operacional de passagens ainda nao esta configurada no servidor. Defina OPENAI_API_KEY para habilitar esta leitura.",
      data: null,
      rawText: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    }
  }

  if (!mimeType?.startsWith("image/")) {
    return {
      ok: false,
      calledModel: false,
      model: null,
      error: `O arquivo ${documentName} ainda nao pode ser enviado para a leitura de passagens neste formato (${mimeType || "desconhecido"}).`,
      data: null,
      rawText: null,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    }
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_TICKET_MODEL,
      temperature: 0,
      max_completion_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "flight_ticket_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              is_ticket: { type: "boolean" },
              failure_reason: { type: ["string", "null"] },
              airline: { type: ["string", "null"] },
              flight_number: { type: ["string", "null"] },
              booking_reference: { type: ["string", "null"] },
              origin_airport: { type: ["string", "null"] },
              destination_airport: { type: ["string", "null"] },
              departure_at: { type: ["string", "null"] },
              arrival_at: { type: ["string", "null"] },
              passenger_name: { type: ["string", "null"] },
              terminal: { type: ["string", "null"] },
              gate: { type: ["string", "null"] },
              seat: { type: ["string", "null"] },
              baggage_info: { type: ["string", "null"] },
              qr_code_payload: { type: ["string", "null"] },
              raw_departure_text: { type: ["string", "null"] },
              raw_arrival_text: { type: ["string", "null"] },
              confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
              notes: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: [
              "is_ticket",
              "failure_reason",
              "airline",
              "flight_number",
              "booking_reference",
              "origin_airport",
              "destination_airport",
              "departure_at",
              "arrival_at",
              "passenger_name",
              "terminal",
              "gate",
              "seat",
              "baggage_info",
              "qr_code_payload",
              "raw_departure_text",
              "raw_arrival_text",
              "confidence",
              "notes",
            ],
          },
        },
      },
      messages: [
        {
          role: "system",
          content:
            "Voce extrai dados de passagens aereas sem inventar informacoes. Responda apenas com JSON valido. Marque is_ticket=false quando a imagem nao parecer uma passagem aerea real. Preencha campos ausentes com null. So retorne departure_at e arrival_at em RFC3339 com timezone quando a data e horario estiverem claramente visiveis; caso contrario, deixe null e use raw_departure_text/raw_arrival_text quando houver texto parcial.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Analise este arquivo chamado "${documentName}". Extraia apenas dados realmente visiveis na passagem aerea. ` +
                "Se nao for uma passagem, explique brevemente em failure_reason. " +
                "Nao invente companhia, localizador, aeroportos, horarios, passageiro, terminal, portao, assento, bagagem ou QR code.",
            },
            {
              type: "image_url",
              image_url: {
                url: signedUrl,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_TICKET_MODEL,
      error: payload?.error?.message || "A chamada real de IA para leitura da passagem falhou no servidor.",
      data: null,
      rawText: null,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens ?? 0,
        outputTokens: payload?.usage?.completion_tokens ?? 0,
        totalTokens: payload?.usage?.total_tokens ?? 0,
      },
    }
  }

  const content = payload?.choices?.[0]?.message?.content?.trim?.()
  const rawText = typeof content === "string" ? content : null
  const jsonText = rawText ? extractJsonObject(rawText) : null

  let parsed: FlightExtractionStructuredData | null = null
  if (jsonText) {
    try {
      parsed = parseStructuredData(JSON.parse(jsonText))
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_TICKET_MODEL,
      error: "A IA nao retornou um JSON valido para a leitura da passagem.",
      data: null,
      rawText,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens ?? 0,
        outputTokens: payload?.usage?.completion_tokens ?? 0,
        totalTokens: payload?.usage?.total_tokens ?? 0,
      },
    }
  }

  return {
    ok: true,
    calledModel: true,
    model: OPENAI_TICKET_MODEL,
    error: null,
    data: parsed,
    rawText,
    usage: {
      inputTokens: payload?.usage?.prompt_tokens ?? 0,
      outputTokens: payload?.usage?.completion_tokens ?? 0,
      totalTokens: payload?.usage?.total_tokens ?? 0,
    },
  }
}
