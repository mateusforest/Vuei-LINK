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
    maxClients: 1,
    maxActiveTrips: 1,
    features: [
      "Portal Ag\u00eancia completo",
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
      "1 usu\u00e1rio",
      "1 cliente",
      "1 viagem ativa",
      "40 cr\u00e9ditos por m\u00eas",
    ],
  },
  start: {
    code: "start",
    name: "Start",
    priceLabel: "R$ 69,90/m\u00eas",
    monthlyCredits: 350,
    maxUsers: 3,
    maxClients: null,
    maxActiveTrips: 20,
    features: [
      "Portal Ag\u00eancia",
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
      "3 usu\u00e1rios",
      "20 viagens ativas",
      "350 cr\u00e9ditos por m\u00eas",
    ],
  },
  pro: {
    code: "pro",
    name: "Pro",
    priceLabel: "R$ 109,90/m\u00eas",
    monthlyCredits: 600,
    maxUsers: 5,
    maxClients: null,
    maxActiveTrips: 100,
    badge: "Mais popular",
    features: [
      "Tudo do Start",
      "5 usu\u00e1rios",
      "100 viagens ativas",
      "600 cr\u00e9ditos por m\u00eas",
      "Analytics igual ao Start",
    ],
  },
  business: {
    code: "business",
    name: "Business",
    priceLabel: "R$ 249,90/m\u00eas",
    monthlyCredits: 1500,
    maxUsers: 15,
    maxClients: null,
    maxActiveTrips: 220,
    features: [
      "Tudo do Pro",
      "15 usu\u00e1rios",
      "220 viagens ativas",
      "1.500 cr\u00e9ditos por m\u00eas",
      "Atendimento priorit\u00e1rio",
    ],
  },
}

export const AGENCY_PLAN_LIMIT_ERROR = "AGENCY_PLAN_LIMIT_REACHED"
export const AGENCY_TEAM_LIMIT_ERROR = "AGENCY_TEAM_LIMIT_REACHED"
export const AGENCY_CLIENT_LIMIT_ERROR = "AGENCY_CLIENT_LIMIT_REACHED"

export function normalizeAgencyCommercialPlanCode(value: string | null | undefined): AgencyCommercialPlanCode {
  if (value === "free") return "free"
  if (value === "start") return "start"
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
  kind: "trip_limit" | "team_limit" | "client_limit",
): AgencyLimitDialogState {
  const definition = AGENCY_PLAN_DEFINITIONS[planCode]

  if (kind === "client_limit") {
    if (planCode === "free") {
      return {
        kind,
        title: "Limite do plano Free atingido",
        description: "Seu plano Free permite 1 cliente. Para adicionar mais clientes, fa\u00e7a upgrade.",
        actionLabel: "Conhecer planos",
        actionHref: "/agencia/planos",
      }
    }

    if (definition.maxClients === null) {
      return {
        kind,
        title: "Limite de clientes indispon\u00edvel",
        description: "Seu plano atual n\u00e3o possui limite fixo de clientes nesta tela.",
        actionLabel: "Entendi",
      }
    }

    return {
      kind,
      title: "Limite do plano atingido",
      description: `Seu plano atual permite at\u00e9 ${definition.maxClients} clientes. Fa\u00e7a upgrade para ampliar sua base.`,
      actionLabel: "Conhecer planos",
      actionHref: "/agencia/planos",
    }
  }

  if (kind === "trip_limit") {
    if (planCode === "free") {
      return {
        kind,
        title: "Limite do plano gratuito atingido",
        description: "Seu plano Free permite 1 viagem ativa. Para criar novas viagens, finalize uma viagem existente ou fa\u00e7a upgrade.",
        actionLabel: "Conhecer planos",
        actionHref: "/agencia/planos",
      }
    }

    if (planCode === "business") {
      return {
        kind,
        title: "Limite operacional atingido",
        description: "Seu plano permite at\u00e9 220 viagens ativas. Finalize ou arquive viagens conclu\u00eddas para liberar espa\u00e7o.",
        actionLabel: "Entendi",
      }
    }

    return {
      kind,
      title: "Limite do plano atingido",
      description: `Seu plano atual permite at\u00e9 ${definition.maxActiveTrips} viagens ativas. Fa\u00e7a upgrade para aumentar sua capacidade operacional.`,
      actionLabel: "Conhecer planos",
      actionHref: "/agencia/planos",
    }
  }

  if (planCode === "free") {
    return {
      kind,
      title: "Limite de usu\u00e1rios atingido",
      description: "O plano gratuito permite 1 usu\u00e1rio. Fa\u00e7a upgrade para adicionar mais pessoas \u00e0 equipe.",
      actionLabel: "Conhecer planos",
      actionHref: "/agencia/planos",
    }
  }

  if (planCode === "business") {
    return {
      kind,
      title: "Limite operacional atingido",
      description: `Seu plano permite at\u00e9 ${definition.maxUsers} usu\u00e1rios ativos na opera\u00e7\u00e3o. Revise membros inativos para liberar espa\u00e7o.`,
      actionLabel: "Entendi",
    }
  }

  return {
    kind,
    title: "Limite do plano atingido",
    description: `Seu plano atual permite at\u00e9 ${definition.maxUsers} usu\u00e1rios ativos na equipe. Fa\u00e7a upgrade para ampliar sua capacidade operacional.`,
    actionLabel: "Conhecer planos",
    actionHref: "/agencia/planos",
  }
}

export function isAgencyActiveTripStatus(status: string | null | undefined) {
  return status === "draft" || status === "upcoming" || status === "ongoing"
}
