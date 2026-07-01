import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/admin"

type CountMetric = {
  total: number
}

type StatusCountMetric<TStatus extends string> = CountMetric & {
  byStatus: Partial<Record<TStatus, number>>
}

export interface MFMetrics {
  generatedAt: string
  users: StatusCountMetric<"traveler" | "agency_owner" | "agency_member" | "master">
  agencies: StatusCountMetric<"pending" | "active" | "suspended" | "archived">
  agencyMembers: StatusCountMetric<"pending" | "active" | "inactive">
  clients: StatusCountMetric<"lead" | "active" | "inactive" | "archived">
  trips: StatusCountMetric<"draft" | "upcoming" | "ongoing" | "completed" | "cancelled"> & {
    travelersTotal: number
  }
  documents: CountMetric
  support: {
    tickets: StatusCountMetric<"open" | "in_progress" | "resolved">
    messages: CountMetric
  }
  ai: {
    conversations: StatusCountMetric<"open" | "closed" | "archived">
    messages: CountMetric
    usageLogs: StatusCountMetric<"completed" | "failed" | "skipped"> & {
      totalTokens: number
      totalCreditsCharged: number
    }
  }
  credits: {
    balances: {
      profiles: number
      agencies: number
      clients: number
      total: number
    }
    transactions: CountMetric
  }
}

async function countTableRows(table: string, filters?: Array<{ column: string; value: string }>) {
  const client = createSupabaseAdminClient()
  let query = client.from(table).select("id", { count: "exact", head: true })

  for (const filter of filters ?? []) {
    query = query.eq(filter.column, filter.value)
  }

  const { count, error } = await query

  if (error) {
    throw new Error(`[MF_METRICS] Falha ao contar ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function sumNumberColumn(table: string, column: string) {
  const client = createSupabaseAdminClient()
  const { data, error } = await client.from(table).select(column)

  if (error) {
    throw new Error(`[MF_METRICS] Falha ao somar ${table}.${column}: ${error.message}`)
  }

  return (data ?? []).reduce((total, row) => {
    const value = row?.[column]
    return total + (typeof value === "number" ? value : 0)
  }, 0)
}

export async function getMFMetrics(): Promise<MFMetrics> {
  const [
    totalUsers,
    travelerUsers,
    agencyOwnerUsers,
    agencyMemberUsers,
    masterUsers,
    totalAgencies,
    pendingAgencies,
    activeAgencies,
    suspendedAgencies,
    archivedAgencies,
    totalAgencyMembers,
    pendingAgencyMembers,
    activeAgencyMembers,
    inactiveAgencyMembers,
    totalClients,
    leadClients,
    activeClients,
    inactiveClients,
    archivedClients,
    totalTrips,
    draftTrips,
    upcomingTrips,
    ongoingTrips,
    completedTrips,
    cancelledTrips,
    totalDocuments,
    totalSupportTickets,
    openSupportTickets,
    inProgressSupportTickets,
    resolvedSupportTickets,
    totalSupportMessages,
    totalAiConversations,
    openAiConversations,
    closedAiConversations,
    archivedAiConversations,
    totalAiMessages,
    totalAiUsageLogs,
    completedAiUsageLogs,
    failedAiUsageLogs,
    skippedAiUsageLogs,
    totalCreditTransactions,
    profileCreditsBalance,
    agencyCreditsBalance,
    clientCreditsBalance,
    totalTravelersCount,
    totalAiTokens,
    totalAiCreditsCharged,
  ] = await Promise.all([
    countTableRows("profiles"),
    countTableRows("profiles", [{ column: "role", value: "traveler" }]),
    countTableRows("profiles", [{ column: "role", value: "agency_owner" }]),
    countTableRows("profiles", [{ column: "role", value: "agency_member" }]),
    countTableRows("profiles", [{ column: "role", value: "master" }]),
    countTableRows("agencies"),
    countTableRows("agencies", [{ column: "status", value: "pending" }]),
    countTableRows("agencies", [{ column: "status", value: "active" }]),
    countTableRows("agencies", [{ column: "status", value: "suspended" }]),
    countTableRows("agencies", [{ column: "status", value: "archived" }]),
    countTableRows("agency_members"),
    countTableRows("agency_members", [{ column: "status", value: "pending" }]),
    countTableRows("agency_members", [{ column: "status", value: "active" }]),
    countTableRows("agency_members", [{ column: "status", value: "inactive" }]),
    countTableRows("clients"),
    countTableRows("clients", [{ column: "status", value: "lead" }]),
    countTableRows("clients", [{ column: "status", value: "active" }]),
    countTableRows("clients", [{ column: "status", value: "inactive" }]),
    countTableRows("clients", [{ column: "status", value: "archived" }]),
    countTableRows("trips"),
    countTableRows("trips", [{ column: "status", value: "draft" }]),
    countTableRows("trips", [{ column: "status", value: "upcoming" }]),
    countTableRows("trips", [{ column: "status", value: "ongoing" }]),
    countTableRows("trips", [{ column: "status", value: "completed" }]),
    countTableRows("trips", [{ column: "status", value: "cancelled" }]),
    countTableRows("documents"),
    countTableRows("support_tickets"),
    countTableRows("support_tickets", [{ column: "status", value: "open" }]),
    countTableRows("support_tickets", [{ column: "status", value: "in_progress" }]),
    countTableRows("support_tickets", [{ column: "status", value: "resolved" }]),
    countTableRows("support_messages"),
    countTableRows("ai_conversations"),
    countTableRows("ai_conversations", [{ column: "status", value: "open" }]),
    countTableRows("ai_conversations", [{ column: "status", value: "closed" }]),
    countTableRows("ai_conversations", [{ column: "status", value: "archived" }]),
    countTableRows("ai_messages"),
    countTableRows("ai_usage_logs"),
    countTableRows("ai_usage_logs", [{ column: "status", value: "completed" }]),
    countTableRows("ai_usage_logs", [{ column: "status", value: "failed" }]),
    countTableRows("ai_usage_logs", [{ column: "status", value: "skipped" }]),
    countTableRows("credit_transactions"),
    sumNumberColumn("profiles", "credits_balance"),
    sumNumberColumn("agencies", "credits_balance"),
    sumNumberColumn("clients", "credits_balance"),
    sumNumberColumn("trips", "travelers_count"),
    sumNumberColumn("ai_usage_logs", "total_tokens"),
    sumNumberColumn("ai_usage_logs", "credit_amount"),
  ])

  return {
    generatedAt: new Date().toISOString(),
    users: {
      total: totalUsers,
      byStatus: {
        traveler: travelerUsers,
        agency_owner: agencyOwnerUsers,
        agency_member: agencyMemberUsers,
        master: masterUsers,
      },
    },
    agencies: {
      total: totalAgencies,
      byStatus: {
        pending: pendingAgencies,
        active: activeAgencies,
        suspended: suspendedAgencies,
        archived: archivedAgencies,
      },
    },
    agencyMembers: {
      total: totalAgencyMembers,
      byStatus: {
        pending: pendingAgencyMembers,
        active: activeAgencyMembers,
        inactive: inactiveAgencyMembers,
      },
    },
    clients: {
      total: totalClients,
      byStatus: {
        lead: leadClients,
        active: activeClients,
        inactive: inactiveClients,
        archived: archivedClients,
      },
    },
    trips: {
      total: totalTrips,
      byStatus: {
        draft: draftTrips,
        upcoming: upcomingTrips,
        ongoing: ongoingTrips,
        completed: completedTrips,
        cancelled: cancelledTrips,
      },
      travelersTotal: totalTravelersCount,
    },
    documents: {
      total: totalDocuments,
    },
    support: {
      tickets: {
        total: totalSupportTickets,
        byStatus: {
          open: openSupportTickets,
          in_progress: inProgressSupportTickets,
          resolved: resolvedSupportTickets,
        },
      },
      messages: {
        total: totalSupportMessages,
      },
    },
    ai: {
      conversations: {
        total: totalAiConversations,
        byStatus: {
          open: openAiConversations,
          closed: closedAiConversations,
          archived: archivedAiConversations,
        },
      },
      messages: {
        total: totalAiMessages,
      },
      usageLogs: {
        total: totalAiUsageLogs,
        byStatus: {
          completed: completedAiUsageLogs,
          failed: failedAiUsageLogs,
          skipped: skippedAiUsageLogs,
        },
        totalTokens: totalAiTokens,
        totalCreditsCharged: totalAiCreditsCharged,
      },
    },
    credits: {
      balances: {
        profiles: profileCreditsBalance,
        agencies: agencyCreditsBalance,
        clients: clientCreditsBalance,
        total: profileCreditsBalance + agencyCreditsBalance + clientCreditsBalance,
      },
      transactions: {
        total: totalCreditTransactions,
      },
    },
  }
}
