import type { DocumentType } from "@/types"

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/heic",
  "image/heif",
] as const

const ALLOWED_DOCUMENT_FILE_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".heif",
] as const

export interface FileValidationResult {
  valid: boolean
  error: string | null
  documentType: DocumentType
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const match = normalized.match(/\.[^.]+$/)
  return match?.[0] ?? ""
}

export function resolveDocumentMimeType(file: Pick<File, "type" | "name">) {
  const normalizedType = typeof file.type === "string" ? file.type.trim().toLowerCase() : ""
  if (normalizedType) {
    return normalizedType
  }

  switch (getFileExtension(file.name)) {
    case ".pdf":
      return "application/pdf"
    case ".png":
      return "image/png"
    case ".jpg":
      return "image/jpg"
    case ".jpeg":
      return "image/jpeg"
    case ".heic":
      return "image/heic"
    case ".heif":
      return "image/heif"
    default:
      return ""
  }
}

export function getDocumentTypeFromMime(mimeType: string): DocumentType {
  if (mimeType === "application/pdf") return "other"
  if (
    mimeType === "image/png" ||
    mimeType === "image/jpg" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/heic" ||
    mimeType === "image/heif"
  ) {
    return "other"
  }
  return "other"
}

export function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateDocumentFile(file: File): FileValidationResult {
  const resolvedMimeType = resolveDocumentMimeType(file)
  const resolvedExtension = getFileExtension(file.name)

  if (
    !ALLOWED_DOCUMENT_MIME_TYPES.includes(resolvedMimeType as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number]) &&
    !ALLOWED_DOCUMENT_FILE_EXTENSIONS.includes(resolvedExtension as (typeof ALLOWED_DOCUMENT_FILE_EXTENSIONS)[number])
  ) {
    return {
      valid: false,
      error: "Formato invalido. Envie PDF, PNG, JPG, JPEG, HEIC ou HEIF.",
      documentType: getDocumentTypeFromMime(resolvedMimeType),
    }
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Arquivo acima do limite de 10MB (${formatFileSize(file.size)}).`,
      documentType: getDocumentTypeFromMime(resolvedMimeType),
    }
  }

  return {
    valid: true,
    error: null,
    documentType: getDocumentTypeFromMime(resolvedMimeType),
  }
}
