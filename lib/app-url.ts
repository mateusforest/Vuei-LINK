function normalizeBaseUrl(value?: string | null) {
  if (!value) return null
  return value.trim().replace(/\/+$/, "")
}

export function getAppUrl() {
  const fromEnv = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL)
  if (fromEnv) return fromEnv

  if (typeof window !== "undefined") {
    return normalizeBaseUrl(window.location.origin) || "http://localhost:3000"
  }

  return "http://localhost:3000"
}

export function buildAbsoluteAppUrl(path: string) {
  const safePath = path.startsWith("/") ? path : `/${path}`
  return `${getAppUrl()}${safePath}`
}
