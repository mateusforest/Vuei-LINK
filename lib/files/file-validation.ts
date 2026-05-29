import type { DocumentType } from "@/types"

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
] as const

export interface FileValidationResult {
  valid: boolean
  error: string | null
  documentType: DocumentType
}

export function getDocumentTypeFromMime(mimeType: string): DocumentType {
  if (mimeType === "application/pdf") return "other"
  if (mimeType === "image/png" || mimeType === "image/jpg" || mimeType === "image/jpeg") return "other"
  return "other"
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateDocumentFile(file: File): FileValidationResult {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: "Formato invalido. Envie PDF, PNG, JPG ou JPEG.",
      documentType: getDocumentTypeFromMime(file.type),
    }
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo acima do limite de 10MB (${formatFileSize(file.size)}).`,
      documentType: getDocumentTypeFromMime(file.type),
    }
  }

  return {
    valid: true,
    error: null,
    documentType: getDocumentTypeFromMime(file.type),
  }
}
