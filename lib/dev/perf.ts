const isDev = process.env.NODE_ENV !== "production"

export function startPerfMeasure(label: string) {
  if (!isDev || typeof performance === "undefined") {
    return {
      end() {
        return 0
      },
    }
  }

  const startedAt = performance.now()

  return {
    end(metadata?: Record<string, unknown>) {
      const duration = performance.now() - startedAt
      console.info(`[PERF] ${label}: ${duration.toFixed(1)}ms`, metadata ?? {})
      return duration
    },
  }
}

export function devLog(label: string, payload?: unknown) {
  if (!isDev) return
  console.info(`[DEV] ${label}`, payload)
}
