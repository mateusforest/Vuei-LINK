import type { Document, DocumentVisibility, DocumentType } from "@/types"
import { createSupabaseBrowserClient, createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"
import type { Database } from "@/lib/supabase/types"

const DOCUMENTS_STORAGE_KEY = "vuei_documents_repository"
const DOCUMENTS_BUCKET = "vuei-documents"

export interface DocumentMetadataPayload {
  tripId: string | null
  clientId: string | null
  agencyId: string | null
  ownerUserId: string | null
  name: string
  type: DocumentType | string
  fileUrl?: string | null
  filePath?: string | null
  mimeType?: string | null
  size?: number | null
  isPrivate?: boolean
  visibility?: DocumentVisibility
  aiExtractedData?: Record<string, unknown> | null
}

interface UploadDocumentFilePayload {
  file: File
  path: string
}

interface DocumentsRepositoryPayload {
  schemaVersion: number
  documents: Document[]
}

const DOCUMENTS_SCHEMA_VERSION = 1

function mapDocumentRowToDocument(row: Database["public"]["Tables"]["documents"]["Row"]): Document {
  return {
    id: row.id,
    tripId: row.trip_id,
    clientId: row.client_id,
    agencyId: row.agency_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    type: row.type,
    fileUrl: row.file_url,
    filePath: row.file_path,
    mimeType: row.mime_type,
    size: row.size_bytes,
    isPrivate: row.is_private,
    visibility: row.visibility,
    aiExtractedData: (row.ai_extracted_data ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildInsertPayload(payload: DocumentMetadataPayload): Database["public"]["Tables"]["documents"]["Insert"] {
  return {
    trip_id: payload.tripId,
    client_id: payload.clientId,
    agency_id: payload.agencyId,
    owner_user_id: payload.ownerUserId,
    name: payload.name,
    type: payload.type,
    file_url: payload.fileUrl ?? null,
    file_path: payload.filePath ?? null,
    mime_type: payload.mimeType ?? null,
    size_bytes: payload.size ?? null,
    is_private: payload.isPrivate ?? true,
    visibility: payload.visibility ?? "private",
    ai_extracted_data: payload.aiExtractedData ?? {},
  }
}

function readLocalDocuments(): Document[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(DOCUMENTS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as DocumentsRepositoryPayload | Document[]
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.documents)) return parsed.documents
  } catch {
    // fallback silencioso
  }

  return []
}

function writeLocalDocuments(documents: Document[]) {
  if (typeof window === "undefined") return

  const payload: DocumentsRepositoryPayload = {
    schemaVersion: DOCUMENTS_SCHEMA_VERSION,
    documents,
  }

  window.localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(payload))
}

function buildLocalDocument(payload: DocumentMetadataPayload): Document {
  const now = new Date().toISOString()
  return {
    id: `document-${Date.now()}`,
    tripId: payload.tripId,
    clientId: payload.clientId,
    agencyId: payload.agencyId,
    ownerUserId: payload.ownerUserId,
    name: payload.name,
    type: payload.type,
    fileUrl: payload.fileUrl ?? null,
    filePath: payload.filePath ?? null,
    mimeType: payload.mimeType ?? null,
    size: payload.size ?? null,
    isPrivate: payload.isPrivate ?? true,
    visibility: payload.visibility ?? "private",
    aiExtractedData: payload.aiExtractedData ?? {},
    createdAt: now,
    updatedAt: now,
  }
}

export async function listDocumentsByTrip(tripId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("documents")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })

      if (error) {
        return { source: "supabase" as const, data: [] as Document[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapDocumentRowToDocument), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter((document) => document.tripId === tripId),
    error: null,
  }
}

export async function listDocuments(params?: { tripId?: string; clientId?: string; agencyId?: string; ownerUserId?: string }) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      let query = client.from("documents").select("*").order("created_at", { ascending: false })

      if (params?.tripId) query = query.eq("trip_id", params.tripId)
      if (params?.clientId) query = query.eq("client_id", params.clientId)
      if (params?.agencyId) query = query.eq("agency_id", params.agencyId)
      if (params?.ownerUserId) query = query.eq("owner_user_id", params.ownerUserId)

      const { data, error } = await query

      if (error) {
        return { source: "supabase" as const, data: [] as Document[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapDocumentRowToDocument), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter((document) => {
      if (params?.tripId && document.tripId !== params.tripId) return false
      if (params?.clientId && document.clientId !== params.clientId) return false
      if (params?.agencyId && document.agencyId !== params.agencyId) return false
      if (params?.ownerUserId && document.ownerUserId !== params.ownerUserId) return false
      return true
    }),
    error: null,
  }
}

export async function listDocumentsByClient(clientId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })

      if (error) {
        return { source: "supabase" as const, data: [] as Document[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapDocumentRowToDocument), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter((document) => document.clientId === clientId),
    error: null,
  }
}

export async function createDocumentMetadata(payload: DocumentMetadataPayload) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("documents")
        .insert(buildInsertPayload(payload))
        .select("*")
        .single()

      if (error) {
        return { source: "supabase" as const, data: null as Document | null, error: error.message }
      }

      return { source: "supabase" as const, data: mapDocumentRowToDocument(data), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Document | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const document = buildLocalDocument(payload)
  const documents = readLocalDocuments()
  writeLocalDocuments([document, ...documents])

  return {
    source: "local" as const,
    data: document,
    error: null,
  }
}

export async function updateDocumentMetadata(id: string, payload: Partial<DocumentMetadataPayload>) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
        trip_id: payload.tripId,
        client_id: payload.clientId,
        agency_id: payload.agencyId,
        owner_user_id: payload.ownerUserId,
        name: payload.name,
        type: payload.type,
        file_url: payload.fileUrl,
        file_path: payload.filePath,
        mime_type: payload.mimeType,
        size_bytes: payload.size,
        is_private: payload.isPrivate,
        visibility: payload.visibility,
        ai_extracted_data: payload.aiExtractedData ?? undefined,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await client
        .from("documents")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .maybeSingle()

      if (error) {
        return { source: "supabase" as const, data: null as Document | null, error: error.message }
      }

      return { source: "supabase" as const, data: data ? mapDocumentRowToDocument(data) : null, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null as Document | null,
      error: "Supabase browser client indisponivel.",
    }
  }

  const documents = readLocalDocuments()
  let updatedDocument: Document | null = null
  const nextDocuments = documents.map((document) => {
    if (document.id !== id) return document
    updatedDocument = {
      ...document,
      ...payload,
      size: payload.size ?? document.size,
      updatedAt: new Date().toISOString(),
    }
    return updatedDocument
  })

  writeLocalDocuments(nextDocuments)

  return {
    source: "local" as const,
    data: updatedDocument,
    error: null,
  }
}

export async function deleteDocument(id: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { error } = await client.from("documents").delete().eq("id", id)
      if (error) {
        return { source: "supabase" as const, success: false, error: error.message }
      }

      return { source: "supabase" as const, success: true, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: false,
      error: "Supabase browser client indisponivel.",
    }
  }

  const documents = readLocalDocuments().filter((document) => document.id !== id)
  writeLocalDocuments(documents)

  return { source: "local" as const, success: true, error: null }
}

export async function uploadDocumentFile(fileOrPayload: File | UploadDocumentFilePayload, legacyPath?: string) {
  console.log("[UPLOAD] started")
  const file = fileOrPayload instanceof File ? fileOrPayload : fileOrPayload.file
  const path = fileOrPayload instanceof File ? legacyPath ?? "" : fileOrPayload.path

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      })

      if (error) {
        console.error("[UPLOAD] error", error.message)
        return {
          source: "supabase" as const,
          data: null,
          error: error.message.includes("Bucket not found")
            ? "Bucket 'vuei-documents' nao existe no Supabase Storage. Rode a configuracao do bucket antes do upload."
            : error.message,
        }
      }

      return {
        source: "supabase" as const,
        data: {
          path: data.path,
          fileUrl: null,
        },
        error: null,
      }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: {
      path,
      fileUrl: URL.createObjectURL(file),
    },
    error: null,
  }
}

export async function getSignedDocumentUrl(path: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 10)
      if (error) {
        return { source: "supabase" as const, data: null, error: error.message }
      }

      return { source: "supabase" as const, data: data.signedUrl, error: null }
    }
  }

  return {
    source: "local" as const,
    data: path,
    error: null,
  }
}

export async function deleteDocumentFile(path?: string | null) {
  if (!path) {
    return { source: "local" as const, success: true, error: null }
  }

  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { error } = await client.storage.from(DOCUMENTS_BUCKET).remove([path])
      if (error) {
        return { source: "supabase" as const, success: false, error: error.message }
      }

      return { source: "supabase" as const, success: true, error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: false,
      error: "Supabase browser client indisponivel.",
    }
  }

  return { source: "local" as const, success: true, error: null }
}

export async function listPublicTripDocuments(tripId: string) {
  if (shouldUseSupabase()) {
    const client = createSupabaseBrowserClient()
    if (client) {
      const { data, error } = await client
        .from("documents")
        .select("*")
        .eq("trip_id", tripId)
        .eq("visibility", "public_trip")
        .eq("is_private", false)
        .order("created_at", { ascending: false })

      if (error) {
        return { source: "supabase" as const, data: [] as Document[], error: error.message }
      }

      return { source: "supabase" as const, data: (data ?? []).map(mapDocumentRowToDocument), error: null }
    }

    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
      error: "Supabase browser client indisponivel.",
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter(
      (document) => document.tripId === tripId && document.visibility === "public_trip" && !document.isPrivate
    ),
    error: null,
  }
}
