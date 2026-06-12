import type { TripItineraryRecord, TripItineraryContent, TripItineraryMode, TripItineraryStatus } from "@/types"
import type { Document } from "@/types/document"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

const STORAGE_KEY = "vuei_trip_itineraries_repository"

type TripItineraryRow = Database["public"]["Tables"]["trip_itineraries"]["Row"]
type TripItineraryInsert = Database["public"]["Tables"]["trip_itineraries"]["Insert"]
type TripItineraryUpdate = Database["public"]["Tables"]["trip_itineraries"]["Update"]

interface LocalState {
  itineraries: TripItineraryRecord[]
}

export interface TripItineraryUpsertPayload {
  id?: string
  tripId: string
  documentId?: string | null
  title: string
  mode: TripItineraryMode
  status?: TripItineraryStatus
  content?: TripItineraryContent | null
  pdfUrl?: string | null
  createdBy?: string | null
}

function readLocalState(): TripItineraryRecord[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as LocalState | TripItineraryRecord[]) : []
    return Array.isArray(parsed) ? parsed : parsed.itineraries ?? []
  } catch {
    return []
  }
}

function writeLocalState(itineraries: TripItineraryRecord[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ itineraries }))
}

function mapRow(row: TripItineraryRow): TripItineraryRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    documentId: row.document_id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    content: (row.content ?? null) as TripItineraryContent | null,
    pdfUrl: row.pdf_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapApiItineraryRecord(value: unknown): TripItineraryRecord | null {
  if (!value || typeof value !== "object") return null

  const row = value as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id : null
  const tripId = typeof row.tripId === "string" ? row.tripId : typeof row.trip_id === "string" ? row.trip_id : null
  if (!id || !tripId) return null

  return {
    id,
    tripId,
    documentId:
      typeof row.documentId === "string"
        ? row.documentId
        : typeof row.document_id === "string"
          ? row.document_id
          : null,
    title: typeof row.title === "string" ? row.title : "Roteiro da viagem",
    mode: (row.mode as TripItineraryMode) ?? "simple",
    status: (row.status as TripItineraryStatus) ?? "draft",
    content: (row.content ?? null) as TripItineraryContent | null,
    pdfUrl:
      typeof row.pdfUrl === "string"
        ? row.pdfUrl
        : typeof row.pdf_url === "string"
          ? row.pdf_url
          : null,
    createdBy:
      typeof row.createdBy === "string"
        ? row.createdBy
        : typeof row.created_by === "string"
          ? row.created_by
          : null,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : typeof row.created_at === "string"
          ? row.created_at
          : new Date().toISOString(),
    updatedAt:
      typeof row.updatedAt === "string"
        ? row.updatedAt
        : typeof row.updated_at === "string"
          ? row.updated_at
          : new Date().toISOString(),
  }
}

function mapApiDocument(value: unknown): Document | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id : null
  if (!id) return null

  return {
    id,
    tripId: typeof row.tripId === "string" ? row.tripId : typeof row.trip_id === "string" ? row.trip_id : null,
    clientId: typeof row.clientId === "string" ? row.clientId : typeof row.client_id === "string" ? row.client_id : null,
    agencyId: typeof row.agencyId === "string" ? row.agencyId : typeof row.agency_id === "string" ? row.agency_id : null,
    ownerUserId: typeof row.ownerUserId === "string" ? row.ownerUserId : typeof row.owner_user_id === "string" ? row.owner_user_id : null,
    name: typeof row.name === "string" ? row.name : "Documento",
    type: typeof row.type === "string" ? row.type : "itinerary",
    fileUrl: typeof row.fileUrl === "string" ? row.fileUrl : typeof row.file_url === "string" ? row.file_url : null,
    filePath: typeof row.filePath === "string" ? row.filePath : typeof row.file_path === "string" ? row.file_path : null,
    mimeType: typeof row.mimeType === "string" ? row.mimeType : typeof row.mime_type === "string" ? row.mime_type : null,
    size: typeof row.size === "number" ? row.size : typeof row.size_bytes === "number" ? row.size_bytes : null,
    isPrivate: row.isPrivate === true || row.is_private === true,
    visibility: (row.visibility as Document["visibility"]) ?? "private",
    aiExtractedData: (row.aiExtractedData ?? row.ai_extracted_data ?? {}) as Record<string, unknown>,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  }
}

function buildInsertPayload(payload: TripItineraryUpsertPayload): TripItineraryInsert {
  return {
    trip_id: payload.tripId,
    document_id: payload.documentId ?? null,
    title: payload.title,
    mode: payload.mode,
    status: payload.status ?? "draft",
    content: payload.content ?? { days: [] },
    pdf_url: payload.pdfUrl ?? null,
    created_by: payload.createdBy ?? null,
  }
}

function buildUpdatePayload(payload: TripItineraryUpsertPayload): TripItineraryUpdate {
  return {
    document_id: payload.documentId ?? null,
    title: payload.title,
    mode: payload.mode,
    status: payload.status ?? "draft",
    content: payload.content ?? { days: [] },
    pdf_url: payload.pdfUrl ?? null,
    created_by: payload.createdBy ?? null,
    updated_at: new Date().toISOString(),
  }
}

export async function listTripItineraries(tripId: string) {
  const client = createSupabaseBrowserClient()

  if (shouldUseSupabase() && client) {
    const { data, error } = await client
      .from("trip_itineraries")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })

    if (error) {
      return { source: "supabase" as const, data: [] as TripItineraryRecord[], error: error.message }
    }

    return { source: "supabase" as const, data: (data ?? []).map(mapRow), error: null }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as TripItineraryRecord[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalState().filter((record) => record.tripId === tripId),
    error: null,
  }
}

export async function upsertTripItinerary(payload: TripItineraryUpsertPayload) {
  const client = createSupabaseBrowserClient()

  if (shouldUseSupabase() && client) {
    if (payload.id) {
      const { data, error } = await client
        .from("trip_itineraries")
        .update(buildUpdatePayload(payload))
        .eq("id", payload.id)
        .select("*")
        .single()

      return { source: "supabase" as const, data: data ? mapRow(data) : null, error: error?.message ?? null }
    }

    const { data, error } = await client
      .from("trip_itineraries")
      .insert(buildInsertPayload(payload))
      .select("*")
      .single()

    return { source: "supabase" as const, data: data ? mapRow(data) : null, error: error?.message ?? null }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const now = new Date().toISOString()
  const current = readLocalState()
  const nextRecord: TripItineraryRecord = {
    id: payload.id ?? `itinerary-${Date.now()}`,
    tripId: payload.tripId,
    documentId: payload.documentId ?? null,
    title: payload.title,
    mode: payload.mode,
    status: payload.status ?? "draft",
    content: payload.content ?? { days: [] },
    pdfUrl: payload.pdfUrl ?? null,
    createdBy: payload.createdBy ?? null,
    createdAt: payload.id ? current.find((entry) => entry.id === payload.id)?.createdAt ?? now : now,
    updatedAt: now,
  }

  writeLocalState([nextRecord, ...current.filter((entry) => entry.id !== nextRecord.id)])
  return { source: "local" as const, data: nextRecord, error: null }
}

export async function deleteTripItinerary(id: string) {
  const client = createSupabaseBrowserClient()

  if (shouldUseSupabase() && client) {
    const { error } = await client.from("trip_itineraries").delete().eq("id", id)
    return { source: "supabase" as const, success: !error, error: error?.message ?? null }
  }

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: false,
      error: "Supabase browser client indisponivel.",
    }
  }

  writeLocalState(readLocalState().filter((entry) => entry.id !== id))
  return { source: "local" as const, success: true, error: null }
}

export async function requestAiItineraryGeneration(payload: { tripId: string; mode: "simple" | "complete_pdf"; tripSlug?: string | null; adminToken?: string | null }) {
  if (!shouldUseSupabase()) {
    return {
      source: "local" as const,
      data: null,
      error: "A geracao operacional de roteiros so fica disponivel com Supabase ativo.",
    }
  }

  const response = await fetch("/api/ai/itineraries/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  return {
    source: "api" as const,
    data: data
      ? {
          ...data,
          itinerary: mapApiItineraryRecord(data.itinerary) ?? null,
          document: mapApiDocument(data.document) ?? null,
        }
      : null,
    error: response.ok ? null : data?.error || "Nao foi possivel gerar o roteiro.",
  }
}
