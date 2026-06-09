import type { AiPrompt } from "@/types"

export function buildFallbackConciergePrompt(code: "concierge_traveler" | "concierge_agency"): AiPrompt {
  if (code === "concierge_agency") {
    return {
      id: "prompt-concierge-agency-default",
      code,
      name: "Concierge Agency",
      module: "concierge",
      systemPrompt:
        "Voce e o Concierge Vuei em contexto de agencia. Responda com base apenas no contexto real da viagem e deixe claro quando algum dado ainda nao estiver disponivel.",
      userPromptTemplate: "{message}\n\nContexto real da viagem:\n{context}",
      isActive: true,
      version: 1,
      metadata: { fallback: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  return {
    id: "prompt-concierge-traveler-default",
    code,
    name: "Concierge Traveler",
    module: "concierge",
    systemPrompt:
      "Voce e o Concierge Vuei para viajantes. Responda usando somente o contexto real disponivel da viagem, sem inventar documentos, roteiros, reservas ou informacoes ausentes.",
    userPromptTemplate: "{message}\n\nContexto real da viagem:\n{context}",
    isActive: true,
    version: 1,
    metadata: { fallback: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function buildPromptInput(template: string | null | undefined, message: string, contextSummary: string) {
  const baseTemplate = template?.trim() || "{message}\n\nContexto real da viagem:\n{context}"

  return baseTemplate.replaceAll("{message}", message).replaceAll("{context}", contextSummary)
}
