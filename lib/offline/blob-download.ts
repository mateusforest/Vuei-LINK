"use client"

export interface OfflineDownloadedBlob {
  blob: Blob
  mimeType: string | null
  sizeBytes: number
}

export async function downloadBlobForOffline(url: string, init?: RequestInit): Promise<OfflineDownloadedBlob> {
  const response = await fetch(url, init)

  if (!response.ok) {
    throw new Error(`Nao foi possivel baixar o arquivo offline (${response.status}).`)
  }

  const blob = await response.blob()

  return {
    blob,
    mimeType: blob.type || response.headers.get("content-type"),
    sizeBytes: blob.size,
  }
}
