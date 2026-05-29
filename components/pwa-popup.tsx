"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Download, Share, Plus } from "lucide-react"

export function PWAPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [showIOSTutorial, setShowIOSTutorial] = useState(false)
  const [dismissCount, setDismissCount] = useState(0)

  useEffect(() => {
    // Check if already dismissed twice
    const dismissed = localStorage.getItem("vuei-pwa-dismissed")
    if (dismissed && parseInt(dismissed) >= 2) return

    // Show popup after 3 seconds
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    const newCount = dismissCount + 1
    setDismissCount(newCount)
    localStorage.setItem("vuei-pwa-dismissed", newCount.toString())
    setIsVisible(false)

    // Show once more if dismissed once
    if (newCount < 2) {
      setTimeout(() => {
        setIsVisible(true)
      }, 30000) // 30 seconds later
    }
  }

  const handleInstall = async () => {
    // Check if iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    
    if (isIOS) {
      setShowIOSTutorial(true)
      return
    }

    // Check for install prompt (Android/Desktop)
    const deferredPrompt = (window as unknown as { deferredPrompt?: BeforeInstallPromptEvent }).deferredPrompt
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setIsVisible(false)
    } else {
      // Fallback - show generic instructions
      setShowIOSTutorial(true)
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 right-6 z-50 w-[320px]"
        >
          <div className="relative p-6 rounded-2xl vuei-glass vuei-glow">
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>

            {!showIOSTutorial ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5de0e6] to-[#004aad] flex items-center justify-center">
                    <Download className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Instalar Vuei</p>
                    <p className="text-white/40 text-sm">Acesso rápido e offline</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleInstall}
                    className="flex-1 px-4 py-3 text-sm font-medium text-black bg-gradient-to-r from-[#5de0e6] to-[#004aad] rounded-xl hover:opacity-90 transition-opacity"
                  >
                    Instalar
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-3 text-sm font-medium text-white/60 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Depois
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pr-6">
                <p className="text-white font-medium">Como instalar no iPhone</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#5de0e6]/20 flex items-center justify-center flex-shrink-0">
                      <Share className="w-3 h-3 text-[#5de0e6]" />
                    </div>
                    <p className="text-sm text-white/60">
                      Toque em <span className="text-white">Compartilhar</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#5de0e6]/20 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-3 h-3 text-[#5de0e6]" />
                    </div>
                    <p className="text-sm text-white/60">
                      Selecione <span className="text-white">Adicionar à Tela Inicial</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSTutorial(false)}
                  className="w-full px-4 py-3 text-sm font-medium text-white/60 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Entendi
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Type for the install prompt
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Register the deferred prompt globally
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    ;(window as unknown as { deferredPrompt: BeforeInstallPromptEvent }).deferredPrompt = e as BeforeInstallPromptEvent
  })
}
