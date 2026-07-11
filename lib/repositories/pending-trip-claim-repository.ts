import type { Trip } from "@/types"
import { shouldUseSupabase } from "@/lib/data-source"

interface CreatePendingTripPayload {
  title?: string
  destination: string
  startDate?: string | null
  endDate?: string | null
  style?: string | null
  travelersCount?: number
}

interface PendingTripCreationSnapshot {
  id: string
  slug: string
  title: string
  destination: string
  publicLink: string
}

interface PendingTripApiResponse {
  trip?: Trip | PendingTripCreationSnapshot | null
  claimToken?: string | null
  error?: string | null
  code?: string | null
}

async function parseJson<T>(response: Response) {
  return (await response.json().catch(() => null)) as T | null
}

export async function createPendingTripClaim(payload: CreatePendingTripPayload) {
  if (!shouldUseSupabase()) {
    return { data: null, error: "Criacao pendente exige Supabase configurado." }
  }

  const response = await fetch("/api/trips/pending", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await parseJson<PendingTripApiResponse>(response)

  return {
    data: response.ok && data?.trip && data?.claimToken
      ? { trip: data.trip as PendingTripCreationSnapshot, claimToken: data.claimToken }
      : null,
    error: response.ok ? null : data?.error ?? "Nao foi possivel criar a viagem agora.",
    code: data?.code ?? null,
  }
}

export async function claimPendingTrip(claimToken: string) {
  if (!shouldUseSupabase()) {
    return { data: null, error: "Claim de viagem exige Supabase configurado." }
  }

  const response = await fetch("/api/trips/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ claimToken }),
  })

  const data = await parseJson<PendingTripApiResponse>(response)

  return {
    data: response.ok && data?.trip ? data.trip : null,
    error: response.ok ? null : data?.error ?? "Nao foi possivel assumir a viagem agora.",
    code: data?.code ?? null,
    status: response.status,
  }
}
