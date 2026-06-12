"use client"

export function isOfflineModeSupported() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined"
}

export function isOfflineModeActive() {
  if (typeof navigator === "undefined") return false
  return navigator.onLine === false
}

export function supportsServiceWorkerOfflineShell() {
  return typeof window !== "undefined" && "serviceWorker" in navigator
}

export function getOfflineModeSnapshot() {
  return {
    supported: isOfflineModeSupported(),
    active: isOfflineModeActive(),
    hasServiceWorkerSupport: supportsServiceWorkerOfflineShell(),
  }
}
