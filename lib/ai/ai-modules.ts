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
    description: "Geracao e refinamento de roteiros da viagem.",
  },
  documents: {
    code: "documents",
    label: "Leitura de documentos",
    description: "Extracao futura de dados de documentos anexados.",
  },
  ticket_reader: {
    code: "ticket_reader",
    label: "Leitura de passagens",
    description: "Interpretacao futura de tickets e bilhetes.",
  },
  accommodation_reader: {
    code: "accommodation_reader",
    label: "Leitura de hospedagem",
    description: "Extracao futura de reservas e comprovantes de hotel.",
  },
  flight_reader: {
    code: "flight_reader",
    label: "Leitura de voo",
    description: "Extracao futura de trechos, horarios e aeroportos.",
  },
}

export function getAiModuleConfig(module: AiModule) {
  return AI_MODULES[module]
}
