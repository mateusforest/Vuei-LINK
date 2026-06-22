import type { AiModule } from "@/types"

export const AI_MODULES: Record<AiModule, { code: AiModule; label: string; description: string }> = {
  concierge: {
    code: "concierge",
    label: "Concierge IA",
    description: "Atendimento conversacional e suporte ao viajante.",
  },
  itinerary: {
    code: "itinerary",
    label: "Roteiro IA",
    description: "Geração e refinamento de roteiros da viagem.",
  },
  documents: {
    code: "documents",
    label: "Leitura de documentos",
    description: "Extração futura de dados de documentos anexados.",
  },
  ticket_reader: {
    code: "ticket_reader",
    label: "Leitura de passagens",
    description: "Interpretação futura de tickets e bilhetes.",
  },
  accommodation_reader: {
    code: "accommodation_reader",
    label: "Leitura de hospedagem",
    description: "Extração futura de reservas e comprovantes de hotel.",
  },
  flight_reader: {
    code: "flight_reader",
    label: "Leitura de voo",
    description: "Extração futura de trechos, horários e aeroportos.",
  },
}

export function getAiModuleConfig(module: AiModule) {
  return AI_MODULES[module]
}
