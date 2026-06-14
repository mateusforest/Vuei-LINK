"use client"

import type {
  OfflineDocumentBlobRecord,
  OfflineImageBlobRecord,
  OfflineStoredTripPackage,
} from "@/lib/offline/types"

export const OFFLINE_DB_NAME = "vuei-offline"
export const OFFLINE_DB_VERSION = 3
export const LEGACY_TRIP_PACKAGES_STORE = "trip_packages"
export const TRIP_PACKAGES_STORE = "trip_packages_v2"
export const LEGACY_DOCUMENT_BLOBS_STORE = "document_blobs"
export const DOCUMENT_BLOBS_STORE = "document_blobs_v2"
export const LEGACY_IMAGE_BLOBS_STORE = "image_blobs"
export const IMAGE_BLOBS_STORE = "image_blobs_v2"

type OfflineStoreMap = {
  [TRIP_PACKAGES_STORE]: OfflineStoredTripPackage
  [LEGACY_TRIP_PACKAGES_STORE]: Partial<OfflineStoredTripPackage> & { tripId: string; slug: string | null }
  [DOCUMENT_BLOBS_STORE]: OfflineDocumentBlobRecord
  [LEGACY_DOCUMENT_BLOBS_STORE]: Partial<OfflineDocumentBlobRecord> & { documentId: string; tripId: string }
  [IMAGE_BLOBS_STORE]: OfflineImageBlobRecord
  [LEGACY_IMAGE_BLOBS_STORE]: Partial<OfflineImageBlobRecord> & { imageId: string; tripId: string }
}

let openPromise: Promise<IDBDatabase> | null = null
let currentDatabase: IDBDatabase | null = null

function isIndexedDbSupported() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Falha na operacao IndexedDB."))
  })
}

export function openOfflineDatabase() {
  if (!isIndexedDbSupported()) {
    return Promise.reject(new Error("IndexedDB nao esta disponivel neste dispositivo."))
  }

  if (currentDatabase) {
    return Promise.resolve(currentDatabase)
  }

  if (!openPromise) {
    openPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result

        if (!database.objectStoreNames.contains(LEGACY_TRIP_PACKAGES_STORE)) {
          const legacyPackagesStore = database.createObjectStore(LEGACY_TRIP_PACKAGES_STORE, { keyPath: "tripId" })
          legacyPackagesStore.createIndex("slug", "slug", { unique: false })
          legacyPackagesStore.createIndex("savedAt", "savedAt", { unique: false })
        }

        if (!database.objectStoreNames.contains(TRIP_PACKAGES_STORE)) {
          const packagesStore = database.createObjectStore(TRIP_PACKAGES_STORE, { keyPath: "packageKey" })
          packagesStore.createIndex("tripId", "tripId", { unique: false })
          packagesStore.createIndex("slug", "slug", { unique: false })
          packagesStore.createIndex("audience", "audience", { unique: false })
          packagesStore.createIndex("savedAt", "savedAt", { unique: false })
        }

        if (!database.objectStoreNames.contains(LEGACY_DOCUMENT_BLOBS_STORE)) {
          const legacyDocumentsStore = database.createObjectStore(LEGACY_DOCUMENT_BLOBS_STORE, { keyPath: "documentId" })
          legacyDocumentsStore.createIndex("tripId", "tripId", { unique: false })
          legacyDocumentsStore.createIndex("savedAt", "savedAt", { unique: false })
        }

        if (!database.objectStoreNames.contains(DOCUMENT_BLOBS_STORE)) {
          const documentsStore = database.createObjectStore(DOCUMENT_BLOBS_STORE, { keyPath: "blobKey" })
          documentsStore.createIndex("documentId", "documentId", { unique: false })
          documentsStore.createIndex("tripId", "tripId", { unique: false })
          documentsStore.createIndex("packageKey", "packageKey", { unique: false })
          documentsStore.createIndex("audience", "audience", { unique: false })
          documentsStore.createIndex("savedAt", "savedAt", { unique: false })
        }

        if (!database.objectStoreNames.contains(LEGACY_IMAGE_BLOBS_STORE)) {
          const legacyImagesStore = database.createObjectStore(LEGACY_IMAGE_BLOBS_STORE, { keyPath: "imageId" })
          legacyImagesStore.createIndex("tripId", "tripId", { unique: false })
          legacyImagesStore.createIndex("savedAt", "savedAt", { unique: false })
        }

        if (!database.objectStoreNames.contains(IMAGE_BLOBS_STORE)) {
          const imagesStore = database.createObjectStore(IMAGE_BLOBS_STORE, { keyPath: "blobKey" })
          imagesStore.createIndex("imageId", "imageId", { unique: false })
          imagesStore.createIndex("tripId", "tripId", { unique: false })
          imagesStore.createIndex("packageKey", "packageKey", { unique: false })
          imagesStore.createIndex("audience", "audience", { unique: false })
          imagesStore.createIndex("savedAt", "savedAt", { unique: false })
        }
      }

      request.onsuccess = () => {
        const database = request.result
        database.onversionchange = () => {
          database.close()
          if (currentDatabase === database) {
            currentDatabase = null
          }
          openPromise = null
        }

        currentDatabase = database
        resolve(database)
      }
      request.onerror = () => {
        openPromise = null
        reject(request.error ?? new Error("Nao foi possivel abrir o banco offline."))
      }
      request.onblocked = () => {
        openPromise = null
        reject(new Error("O banco offline esta bloqueado por outra aba ativa."))
      }
    })
  }

  return openPromise
}

async function withStore<TStoreName extends keyof OfflineStoreMap>(
  storeName: TStoreName,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => void,
) {
  const database = await openOfflineDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error(`Falha na store ${String(storeName)}.`))
    transaction.onabort = () => reject(transaction.error ?? new Error(`Transacao abortada na store ${String(storeName)}.`))

    handler(store)
  })
}

export async function putOfflineRecord<TStoreName extends keyof OfflineStoreMap>(
  storeName: TStoreName,
  value: OfflineStoreMap[TStoreName],
) {
  await withStore(storeName, "readwrite", (store) => {
    store.put(value)
  })
}

export async function getOfflineRecord<TStoreName extends keyof OfflineStoreMap>(storeName: TStoreName, key: string) {
  const database = await openOfflineDatabase()
  const transaction = database.transaction(storeName, "readonly")
  const store = transaction.objectStore(storeName)
  const result = await requestToPromise(store.get(key))
  return (result as OfflineStoreMap[TStoreName] | undefined) ?? null
}

export async function getAllOfflineRecords<TStoreName extends keyof OfflineStoreMap>(storeName: TStoreName) {
  const database = await openOfflineDatabase()
  const transaction = database.transaction(storeName, "readonly")
  const store = transaction.objectStore(storeName)
  const result = await requestToPromise(store.getAll())
  return (result as OfflineStoreMap[TStoreName][]) ?? []
}

export async function getOfflineRecordsByIndex<TStoreName extends keyof OfflineStoreMap>(
  storeName: TStoreName,
  indexName: string,
  key: string,
) {
  const database = await openOfflineDatabase()
  const transaction = database.transaction(storeName, "readonly")
  const store = transaction.objectStore(storeName)
  const index = store.index(indexName)
  const result = await requestToPromise(index.getAll(key))
  return (result as OfflineStoreMap[TStoreName][]) ?? []
}

export async function deleteOfflineRecord<TStoreName extends keyof OfflineStoreMap>(storeName: TStoreName, key: string) {
  await withStore(storeName, "readwrite", (store) => {
    store.delete(key)
  })
}

export async function deleteOfflineRecordsByIndex<TStoreName extends keyof OfflineStoreMap>(
  storeName: TStoreName,
  indexName: string,
  key: string,
) {
  const database = await openOfflineDatabase()

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite")
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)
    const cursorRequest = index.openCursor(IDBKeyRange.only(key))

    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) return
      cursor.delete()
      cursor.continue()
    }

    cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error(`Falha ao limpar a store ${String(storeName)}.`))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error(`Falha ao limpar a store ${String(storeName)}.`))
    transaction.onabort = () => reject(transaction.error ?? new Error(`Transacao abortada ao limpar a store ${String(storeName)}.`))
  })
}
