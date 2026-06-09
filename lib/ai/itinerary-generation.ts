const OPENAI_ITINERARY_MODEL = process.env.OPENAI_ITINERARY_MODEL ?? process.env.OPENAI_CONCIERGE_MODEL ?? "gpt-4.1-mini"

export interface ItineraryGenerationRequest {
  mode: "simple" | "complete_pdf"
  tripTitle: string
  destination: string
  startDate?: string | null
  endDate?: string | null
  expectedDays?: number | null
  travelContext: string
}

export interface GeneratedItineraryActivity {
  id: string
  time: string | null
  title: string
  location: string | null
  description: string | null
  period: "morning" | "afternoon" | "evening" | "flexible"
  type: "attraction" | "food" | "transport" | "hotel" | "experience" | "flight" | "other"
  highlight: boolean
}

export interface GeneratedItineraryDay {
  id: string
  day: number
  date: string | null
  title: string
  summary: string | null
  activities: GeneratedItineraryActivity[]
  tips: string | null
  important: string | null
}

export interface GeneratedItineraryContent {
  title: string
  summary: string | null
  travelStyle: string | null
  usefulTips: string[]
  observations: string[]
  contacts: Array<{ label: string; value: string }>
  days: GeneratedItineraryDay[]
}

export interface GeneratedItineraryResult {
  ok: boolean
  calledModel: boolean
  model: string | null
  error: string | null
  rawText: string | null
  data: GeneratedItineraryContent | null
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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim())
}

function normalizeContacts(value: unknown) {
  if (!Array.isArray(value)) return [] as Array<{ label: string; value: string }>

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const contact = entry as Record<string, unknown>
      const label = normalizeString(contact.label)
      const contactValue = normalizeString(contact.value)
      if (!label || !contactValue) return null
      return { label, value: contactValue }
    })
    .filter((entry): entry is { label: string; value: string } => Boolean(entry))
}

function normalizeActivities(value: unknown): GeneratedItineraryActivity[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null
      const activity = entry as Record<string, unknown>
      return {
        id: normalizeString(activity.id) ?? `activity-${index + 1}`,
        time: normalizeString(activity.time),
        title: normalizeString(activity.title) ?? "Atividade sem titulo",
        location: normalizeString(activity.location),
        description: normalizeString(activity.description),
        period:
          activity.period === "morning" ||
          activity.period === "afternoon" ||
          activity.period === "evening" ||
          activity.period === "flexible"
            ? activity.period
            : "flexible",
        type:
          activity.type === "attraction" ||
          activity.type === "food" ||
          activity.type === "transport" ||
          activity.type === "hotel" ||
          activity.type === "experience" ||
          activity.type === "flight" ||
          activity.type === "other"
            ? activity.type
            : "other",
        highlight: activity.highlight === true,
      }
    })
    .filter((entry): entry is GeneratedItineraryActivity => Boolean(entry))
}

function parseStructuredContent(payload: unknown): GeneratedItineraryContent | null {
  if (!payload || typeof payload !== "object") return null

  const candidate = payload as Record<string, unknown>
  const days = Array.isArray(candidate.days)
    ? candidate.days
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null
          const day = entry as Record<string, unknown>
          return {
            id: normalizeString(day.id) ?? `day-${index + 1}`,
            day: typeof day.day === "number" ? day.day : index + 1,
            date: normalizeString(day.date),
            title: normalizeString(day.title) ?? `Dia ${index + 1}`,
            summary: normalizeString(day.summary),
            activities: normalizeActivities(day.activities),
            tips: normalizeString(day.tips),
            important: normalizeString(day.important),
          }
        })
        .filter((entry): entry is GeneratedItineraryDay => Boolean(entry))
    : []

  return {
    title: normalizeString(candidate.title) ?? "Roteiro da viagem",
    summary: normalizeString(candidate.summary),
    travelStyle: normalizeString(candidate.travelStyle),
    usefulTips: normalizeStringArray(candidate.usefulTips),
    observations: normalizeStringArray(candidate.observations),
    contacts: normalizeContacts(candidate.contacts),
    days,
  }
}

function getSystemPrompt(mode: "simple" | "complete_pdf") {
  if (mode === "simple") {
    return "Voce gera roteiros simples, mas comercialmente fortes, para o Vuei. Use apenas o contexto real fornecido. Nao invente reservas, documentos, horarios obrigatorios ou contatos criticos. Para cada dia, entregue titulo, resumo, observacoes uteis e atividades suficientes para manha, tarde e noite. Cada dia deve ter de 2 a 4 atividades, com horarios sugeridos quando possivel, locais/regioes e descricoes curtas. Quando algo nao existir, deixe null ou trate como sugestao geral. Responda apenas com JSON valido."
  }

  return "Voce gera roteiros completos para PDF no Vuei. Use apenas o contexto real fornecido. Nao invente reservas, horarios obrigatorios, documentos criticos ou contatos oficiais. Pode sugerir atividades e dicas gerais quando forem apresentadas como sugestoes. Responda apenas com JSON valido."
}

export async function requestItineraryGeneration({
  mode,
  tripTitle,
  destination,
  startDate,
  endDate,
  expectedDays,
  travelContext,
}: ItineraryGenerationRequest): Promise<GeneratedItineraryResult> {
  const completionBudget = mode === "simple"
    ? Math.min(12_000, Math.max(2_200, 600 + (expectedDays ?? 3) * 260))
    : Math.min(18_000, Math.max(3_600, 1_000 + (expectedDays ?? 3) * 420))

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      calledModel: false,
      model: null,
      error: "A geracao operacional de roteiros ainda nao esta configurada no servidor. Defina OPENAI_API_KEY para habilitar este recurso.",
      rawText: null,
      data: null,
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
      model: OPENAI_ITINERARY_MODEL,
      temperature: mode === "simple" ? 0.3 : 0.4,
      max_completion_tokens: completionBudget,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "trip_itinerary_generation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              summary: { type: ["string", "null"] },
              travelStyle: { type: ["string", "null"] },
              usefulTips: { type: "array", items: { type: "string" } },
              observations: { type: "array", items: { type: "string" } },
              contacts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    label: { type: "string" },
                    value: { type: "string" },
                  },
                  required: ["label", "value"],
                },
              },
              days: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    day: { type: "number" },
                    date: { type: ["string", "null"] },
                    title: { type: "string" },
                    summary: { type: ["string", "null"] },
                    tips: { type: ["string", "null"] },
                    important: { type: ["string", "null"] },
                    activities: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          id: { type: "string" },
                          time: { type: ["string", "null"] },
                          title: { type: "string" },
                          location: { type: ["string", "null"] },
                          description: { type: ["string", "null"] },
                          period: {
                            type: "string",
                            enum: ["morning", "afternoon", "evening", "flexible"],
                          },
                          type: {
                            type: "string",
                            enum: ["attraction", "food", "transport", "hotel", "experience", "flight", "other"],
                          },
                          highlight: { type: "boolean" },
                        },
                        required: ["id", "time", "title", "location", "description", "period", "type", "highlight"],
                      },
                    },
                  },
                  required: ["id", "day", "date", "title", "summary", "tips", "important", "activities"],
                },
              },
            },
            required: ["title", "summary", "travelStyle", "usefulTips", "observations", "contacts", "days"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: getSystemPrompt(mode),
        },
        {
          role: "user",
          content:
            `Crie um roteiro em modo ${mode} para a viagem "${tripTitle}" em ${destination}. ` +
            `Periodo real: ${startDate ?? "nao informado"} ate ${endDate ?? "nao informado"}. ` +
            `${expectedDays ? `Gere exatamente ${expectedDays} dia(s), um para cada dia real do periodo. ` : ""}` +
            (mode === "simple"
              ? "No modo simples, cada dia precisa refletir manha, tarde e noite por meio do campo period das atividades, com 2 a 4 atividades no total por dia. "
              : "No modo completo, mantenha profundidade maior, mas ainda respeitando exatamente o periodo real. ") +
            "Use o contexto real abaixo. Quando nao houver dado critico confirmado, mantenha a informacao ausente ou identifique como sugestao geral sem inventar reservas.\n\n" +
            travelContext,
        },
      ],
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_ITINERARY_MODEL,
      error: payload?.error?.message || "A chamada real de IA para gerar o roteiro falhou no servidor.",
      rawText: null,
      data: null,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens ?? 0,
        outputTokens: payload?.usage?.completion_tokens ?? 0,
        totalTokens: payload?.usage?.total_tokens ?? 0,
      },
    }
  }

  const rawText = payload?.choices?.[0]?.message?.content ?? null
  const jsonContent = typeof rawText === "string" ? extractJsonObject(rawText) : null

  if (!jsonContent) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_ITINERARY_MODEL,
      error: "A IA respondeu sem JSON estruturado para o roteiro.",
      rawText,
      data: null,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens ?? 0,
        outputTokens: payload?.usage?.completion_tokens ?? 0,
        totalTokens: payload?.usage?.total_tokens ?? 0,
      },
    }
  }

  const parsed = parseStructuredContent(JSON.parse(jsonContent))
  if (!parsed || parsed.days.length === 0) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_ITINERARY_MODEL,
      error: "A IA nao retornou um roteiro utilizavel para esta viagem.",
      rawText,
      data: parsed,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens ?? 0,
        outputTokens: payload?.usage?.completion_tokens ?? 0,
        totalTokens: payload?.usage?.total_tokens ?? 0,
      },
    }
  }

  if (expectedDays && parsed.days.length !== expectedDays) {
    return {
      ok: false,
      calledModel: true,
      model: OPENAI_ITINERARY_MODEL,
      error: `A IA retornou ${parsed.days.length} dia(s), mas a viagem exige ${expectedDays} dia(s) no periodo informado.`,
      rawText,
      data: parsed,
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
    model: OPENAI_ITINERARY_MODEL,
    error: null,
    rawText,
    data: parsed,
    usage: {
      inputTokens: payload?.usage?.prompt_tokens ?? 0,
      outputTokens: payload?.usage?.completion_tokens ?? 0,
      totalTokens: payload?.usage?.total_tokens ?? 0,
    },
  }
}
