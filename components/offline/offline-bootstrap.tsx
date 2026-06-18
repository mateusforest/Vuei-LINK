"use client"

import { useEffect } from "react"
import { migrateLegacyOfflineSnapshot } from "@/lib/offline/offline-package-manager"
import { supportsServiceWorkerOfflineShell } from "@/lib/offline/offline-mode"

export function OfflineBootstrap() {
  useEffect(() => {
    let idleTimer: number | null = null
    let idleCallbackId: number | null = null

    const scheduleLegacyMigration = () => {
      const runMigration = () => {
        void migrateLegacyOfflineSnapshot().catch((error) => {
          console.error("[OFFLINE] legacy migration error", error)
        })
      }

      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(runMigration, { timeout: 2500 })
        return
      }

      idleTimer = window.setTimeout(runMigration, 1200)
    }

    scheduleLegacyMigration()

    if (!supportsServiceWorkerOfflineShell()) return

    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[OFFLINE] service worker registration error", error)
      })
    }

    if (document.readyState === "complete") {
      registerServiceWorker()
      return () => {
        if (idleTimer !== null) window.clearTimeout(idleTimer)
        if (idleCallbackId !== null && "cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleCallbackId)
        }
      }
    }

    window.addEventListener("load", registerServiceWorker, { once: true })
    return () => {
      window.removeEventListener("load", registerServiceWorker)
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      if (idleCallbackId !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallbackId)
      }
    }
  }, [])

  return null
}
