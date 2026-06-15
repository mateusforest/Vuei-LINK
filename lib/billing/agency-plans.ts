import type {
  Agency,
  AgencyBillingStatusSummary,
  AgencyCommercialPlanCode,
  AgencyLimitDialogState,
  AgencyPlanDefinition,
  AgencyPlanSnapshot,
  AgencyPlan,
  AgencySubscriptionStatus,
} from "@/types"

export const AGENCY_PLAN_DEFINITIONS: Record<AgencyCommercialPlanCode, AgencyPlanDefinition> = {
  free: {
    code: "free",
    name: "Free",
    priceLabel: "R$ 0",
    monthlyCredits: 40,
    maxUsers: 1,
    maxActiveTrips: 1,
    features: [
      "Portal Agencia completo",
      "Dashboard",
      "Clientes",
      "Viagens",
      "Documentos",
      "Passagens IA",
      "Hospedagens",
      "Roteiros IA",
      "Concierge IA",
      "Analytics",
      "Compartilhamento",
      "Offline",
      "1 usuario",
      "1 viagem ativa",
      "40 creditos por mes",
    ],
  },
  start: {
    code: "start",
    name: "Start",
    priceLabel: "R$ 69,90/mes",
    monthlyCredits: 350,
    maxUsers: 3,
    maxActiveTrips: 20,
    features: [
      "Portal Agencia",
      "Dashboard",
      "Clientes",
      "Viagens",
      "Documentos",
      "Passagens IA",
      "Hospedagens",
      "Roteiros IA",
      "Concierge IA",
      "Analytics",
      "Compartilhamento ilimitado",
      "Offline",
      "3 usuarios",
      "20 viagens ativas",
      "350 creditos por mes",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceLabel: "R$ 109,90/mes",
    monthlyCredits: 600,
    maxUsers: 5,
    maxActiveTrips: 100,
    badge: "Mais popular",
    features: [
      "Tudo do Start",
      "5 usuarios",
      "100 viagens ativas",
      "600 creditos por mes",
      "Analytics igual ao Start",
    ],
  },
  business: {
    code: "business",
    name: "Business",
    priceLabel: "R$ 249,90/mes",
    monthlyCredits: 1500,
    maxUsers: 15,
    maxActiveTrips: 220,
    features: [
      "Tudo do Pro",
      "15 usuarios",
      "220 viagens ativas",
      "1.500 creditos por mes",
      "Atendimento prioritario",
    ],
  },
}

export const AGENCY_PLAN_LIMIT_ERROR = "AGENCY_PLAN_LIMIT_REACHED"
export const AGENCY_TEAM_LIMIT_ERROR = "AGENCY_TEAM_LIMIT_REACHED"

export function normalizeAgencyCommercialPlanCode(value: string | null | undefined): AgencyCommercialPlanCode {
  if (value === "free") return "free"
  if (value === "pro") return "pro"
  if (value === "business" || value === "enterprise") return "business"
  return "free"
}

export function mapLegacyAgencyPlanToCommercialPlan(plan: AgencyPlan | string | null | undefined): AgencyCommercialPlanCode {
  if (plan === "free") return "free"
  if (plan === "pro") return "pro"
  if (plan === "enterprise" || plan === "business") return "business"
  return "free"
}

export function mapCommercialPlanToLegacyAgencyPlan(planCode: AgencyCommercialPlanCode): AgencyPlan {
  if (planCode === "pro") return "pro"
  if (planCode === "business") return "enterprise"
  return "starter"
}

export function resolveAgencyPlanSnapshot(input?: {
  agency?: Agency | null
  billingStatus?: AgencyBillingStatusSummary | null
  status?: AgencySubscriptionStatus | null
  planCode?: AgencyCommercialPlanCode | string | null
  startedAt?: string | null
  expiresAt?: string | null
}): AgencyPlanSnapshot {
  const billingStatus = input?.billingStatus ?? null
  const code = billingStatus?.planCode
    ?? normalizeAgencyCommercialPlanCode(input?.planCode ?? (input?.agency ? mapLegacyAgencyPlanToCommercialPlan(input.agency.plan) : null))
  const definition = AGENCY_PLAN_DEFINITIONS[code]

  return {
    code,
    definition,
    status: billingStatus?.status ?? input?.status ?? "active",
    startedAt: billingStatus?.startedAt ?? input?.startedAt ?? null,
    expiresAt: billingStatus?.expiresAt ?? input?.expiresAt ?? null,
  }
}

export function getAgencyPlanLimitDialog(
  planCode: AgencyCommercialPlanCode,
  kind: "trip_limit" | "team_limit",
): AgencyLimitDialogState {
  const definition = AGENCY_PLAN_DEFINITIONS[planCode]

  if (kind === "trip_limit") {
    if (planCode === "free") {
      return {
        kind,
        title: "Limite do plano gratuito atingido",
        description: "O plano gratuito da agencia permite 1 viagem ativa para testar o Vuei. Faca upgrade para criar mais viagens e ampliar sua operacao.",
        actionLabel: "Conhecer planos",
        actionHref: "/agencia/planos",
      }
    }

    if (planCode === "business") {
      return {
        kind,
        title: "Limite operacional atingido",
        description: "Seu plano permite ate 220 viagens ativas. Finalize ou arquive viagens concluidas para liberar espaco.",
        actionLabel: "Entendi",
      }
    }

    return {
      kind,
      title: "Limite do plano atingido",
      description: `Seu plano atual permite ate ${definition.maxActiveTrips} viagens ativas. Faca upgrade para aumentar sua capacidade operacional.`,
      actionLabel: "Conhecer planos",
      actionHref: "/agencia/planos",
    }
  }

  if (planCode === "free") {
    return {
      kind,
      title: "Limite de usuarios atingido",
      description: "O plano gratuito permite 1 usuario. Faca upgrade para adicionar mais pessoas a equipe.",
      actionLabel: "Conhecer planos",
      actionHref: "/agencia/planos",
    }
  }

  if (planCode === "business") {
    return {
      kind,
      title: "Limite operacional atingido",
      description: `Seu plano permite ate ${definition.maxUsers} usuarios ativos na operacao. Revise membros inativos para liberar espaco.`,
      actionLabel: "Entendi",
    }
  }

  return {
    kind,
    title: "Limite do plano atingido",
    description: `Seu plano atual permite ate ${definition.maxUsers} usuarios ativos na equipe. Faca upgrade para ampliar sua capacidade operacional.`,
    actionLabel: "Conhecer planos",
    actionHref: "/agencia/planos",
  }
}

export function isAgencyActiveTripStatus(status: string | null | undefined) {
  return status === "draft" || status === "upcoming" || status === "ongoing"
}
