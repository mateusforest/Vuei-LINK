import { buildAbsoluteAppUrl } from "@/lib/app-url"

export function generateSecureToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

export function generateAdminLink(slug: string) {
  return `/viagem/${slug}/admin`
}

export function generatePublicLink(slug: string) {
  return `/viagem/${slug}`
}

export function buildAdminTripUrl(slug: string, adminToken?: string | null) {
  const baseUrl = buildAbsoluteAppUrl(generateAdminLink(slug))
  if (!adminToken) return baseUrl

  const url = new URL(baseUrl)
  url.searchParams.set("adminToken", adminToken)
  return url.toString()
}

export function buildPublicTripUrl(slug: string) {
  return buildAbsoluteAppUrl(generatePublicLink(slug))
}

export function isAdminLinkMode(
  params: URLSearchParams | { get: (key: string) => string | null },
  pathname?: string | null,
) {
  return Boolean(pathname?.endsWith("/admin")) || Boolean(params.get("adminToken")) || params.get("admin") === "true"
}

export function isPublicLinkMode(params: URLSearchParams | { get: (key: string) => string | null }) {
  return Boolean(params.get("publicToken") || params.get("token"))
}
