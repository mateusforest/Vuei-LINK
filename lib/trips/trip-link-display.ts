const DEFAULT_MASK_PLACEHOLDER = "Link da viagem"

function getDisplayBaseUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  return process.env.NEXT_PUBLIC_APP_URL || "https://www.meuvuei.com"
}

function normalizeUrlCandidate(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url
  }

  const base = getDisplayBaseUrl()
  if (!url) return base

  return `${base}${url.startsWith("/") ? "" : "/"}${url}`
}

export function formatTripLinkPreview(url?: string | null, options?: { maxSlugLength?: number }) {
  if (!url) return DEFAULT_MASK_PLACEHOLDER

  try {
    const candidate = normalizeUrlCandidate(url)
    const parsed = new URL(candidate)
    const normalizedPath = parsed.pathname.endsWith("/") && parsed.pathname.length > 1
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname
    const segments = normalizedPath.split("/").filter(Boolean)

    if (segments.length === 0) {
      return `${parsed.origin}/...`
    }

    const [root, ...rest] = segments
    const slugRaw = rest.length > 0 ? rest.join("/") : ""
    const maxSlugLength = Math.min(options?.maxSlugLength ?? 12, 12)
    const visibleSlugLength = Math.max(0, Math.min(maxSlugLength, slugRaw.length - 1))
    const slug = visibleSlugLength > 0
      ? `${slugRaw.slice(0, visibleSlugLength)}...`
      : "..."

    return `${parsed.origin}/${root}/${slug}`
  } catch {
    return DEFAULT_MASK_PLACEHOLDER
  }
}

export function getTripPublicLinkCopyHint(lifecycle: string | null | undefined) {
  switch (lifecycle) {
    case "active":
    case "post_trip":
      return null
    case "ended":
      return "Link encerrado"
    default:
      return "Rascunho privado"
  }
}
