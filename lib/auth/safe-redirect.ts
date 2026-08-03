import type { UserRole } from "@/types"

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

const PUBLIC_GENERIC_PATH_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/criar-viagem",
  "/agency/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/privacidade",
  "/terms",
  "/termos",
  "/suporte",
] as const

function getRedirectPathname(redirect: string) {
  try {
    return new URL(redirect, "https://vuei.local").pathname
  } catch {
    return redirect
  }
}

function matchesPrefix(pathname: string, prefix: string) {
  if (prefix === "/") return pathname === "/"
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function isGenericPublicRedirect(redirect: string) {
  const pathname = getRedirectPathname(redirect)
  return PUBLIC_GENERIC_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
}

function isRoleCompatibleRedirect(role: UserRole, redirect: string) {
  const pathname = getRedirectPathname(redirect)

  switch (role) {
    case "agency_owner":
    case "agency_member":
      return matchesPrefix(pathname, "/agencia") || matchesPrefix(pathname, "/agency")
    case "master":
      return matchesPrefix(pathname, "/master")
    case "traveler":
    default:
      return (
        isGenericPublicRedirect(redirect) ||
        matchesPrefix(pathname, "/portal") ||
        matchesPrefix(pathname, "/v") ||
        matchesPrefix(pathname, "/viagem")
      )
  }
}

export function resolvePostAuthRedirect(role: UserRole | null | undefined, redirect: string | null | undefined, fallback: string) {
  if (!redirect) return fallback
  if (!role) return fallback

  if (isGenericPublicRedirect(redirect)) {
    return role === "traveler" ? redirect : fallback
  }

  if (isRoleCompatibleRedirect(role, redirect)) {
    return redirect
  }

  return fallback
}
