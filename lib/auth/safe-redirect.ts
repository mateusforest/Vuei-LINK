export function getSafeRedirectFromWindow() {
  if (typeof window === "undefined") return null

  const requestedRedirect = new URLSearchParams(window.location.search).get("redirect")
  if (!requestedRedirect || !requestedRedirect.startsWith("/")) return null

  return requestedRedirect
}

export function buildLoginRedirectTarget(pathname?: string | null) {
  const currentPath = typeof window !== "undefined"
    ? `${pathname || window.location.pathname}${window.location.search}`
    : pathname || "/"

  return `/login?redirect=${encodeURIComponent(currentPath)}`
}
