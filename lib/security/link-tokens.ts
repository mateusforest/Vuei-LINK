export function generateSecureToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function generateAdminLink(slug: string, token: string) {
  return `/viagem/${slug}?adminToken=${encodeURIComponent(token)}`
}

export function generatePublicLink(slug: string, token: string) {
  return `/v/${slug}?token=${encodeURIComponent(token)}`
}

export function isAdminLinkMode(params: URLSearchParams | { get: (key: string) => string | null }) {
  return Boolean(params.get("adminToken")) || params.get("admin") === "true"
}

export function isPublicLinkMode(params: URLSearchParams | { get: (key: string) => string | null }) {
  return Boolean(params.get("publicToken") || params.get("token"))
}
