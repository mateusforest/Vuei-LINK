"use client"

import { useEffect } from "react"
import { migrateLegacyOfflineSnapshot } from "@/lib/offline/offline-package-manager"
import { supportsServiceWorkerOfflineShell } from "@/lib/offline/offline-mode"

export function OfflineBootstrap() {
  useEffect(() => {
    void migrateLegacyOfflineSnapshot().catch((error) => {
      console.error("[OFFLINE] legacy migration error", error)
    })

    if (!supportsServiceWorkerOfflineShell()) return

    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[OFFLINE] service worker registration error", error)
      })
    }

    if (document.readyState === "complete") {
      registerServiceWorker()
      return
    }

    window.addEventListener("load", registerServiceWorker, { once: true })
    return () => window.removeEventListener("load", registerServiceWorker)
  }, [])

  return null
}
