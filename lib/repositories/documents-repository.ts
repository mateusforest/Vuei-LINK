import type { Document, DocumentVisibility, DocumentType } from "@/types"
import { createSupabaseBrowserClientPlaceholder } from "@/lib/supabase/client"
import { shouldUseSupabase } from "@/lib/data-source"

const DOCUMENTS_STORAGE_KEY = "vuei_documents_repository"

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

interface DocumentsRepositoryPayload {
  schemaVersion: number
  documents: Document[]
}

const DOCUMENTS_SCHEMA_VERSION = 1

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

function buildDocument(payload: DocumentMetadataPayload): Document {
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
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter((document) => document.tripId === tripId),
  }
}

export async function listDocumentsByClient(clientId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter((document) => document.clientId === clientId),
  }
}

export async function createDocumentMetadata(payload: DocumentMetadataPayload) {
  const document = buildDocument(payload)

  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: document,
    }
  }

  const documents = readLocalDocuments()
  writeLocalDocuments([document, ...documents])

  return {
    source: "local" as const,
    data: document,
  }
}

export async function updateDocumentMetadata(id: string, payload: Partial<DocumentMetadataPayload>) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
    }
  }

  const documents = readLocalDocuments()
  let updatedDocument: Document | null = null
  const nextDocuments = documents.map((document) => {
    if (document.id !== id) return document
    updatedDocument = {
      ...document,
      ...payload,
      updatedAt: new Date().toISOString(),
    }
    return updatedDocument
  })

  writeLocalDocuments(nextDocuments)

  return {
    source: "local" as const,
    data: updatedDocument,
  }
}

export async function deleteDocument(id: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      success: true,
    }
  }

  const documents = readLocalDocuments().filter((document) => document.id !== id)
  writeLocalDocuments(documents)

  return {
    source: "local" as const,
    success: true,
  }
}

export async function uploadDocumentFile(file: File, path: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: {
        path,
        fileUrl: null,
      },
    }
  }

  return {
    source: "local" as const,
    data: {
      path,
      fileUrl: URL.createObjectURL(file),
    },
  }
}

export async function getSignedDocumentUrl(path: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: null,
    }
  }

  return {
    source: "local" as const,
    data: path,
  }
}

export async function listPublicTripDocuments(tripId: string) {
  if (shouldUseSupabase()) {
    return {
      source: "supabase-placeholder" as const,
      config: createSupabaseBrowserClientPlaceholder(),
      data: [] as Document[],
    }
  }

  return {
    source: "local" as const,
    data: readLocalDocuments().filter(
      (document) => document.tripId === tripId && document.visibility === "public_trip" && !document.isPrivate
    ),
  }
}
