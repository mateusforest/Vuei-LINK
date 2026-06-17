"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import type { UserRole } from "@/types"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRole, getRedirectByRole } from "@/lib/auth/role-redirect"
import { buildLoginRedirectTarget } from "@/lib/auth/safe-redirect"
import { shouldUseSupabase } from "@/lib/data-source"

const CHECKOUT_SESSION_GRACE_MS = 4000

export function RouteGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading, initialized } = useAuth()
  const resolvedRole = profile?.role ?? null
  const resolvedProfile = resolvedRole ? { role: resolvedRole } : null
  const [isCheckoutReturn, setIsCheckoutReturn] = useState(false)
  const [checkoutGraceExpired, setCheckoutGraceExpired] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get("checkout")
    setIsCheckoutReturn(checkoutStatus === "success" || checkoutStatus === "canceled")
  }, [])

  useEffect(() => {
    setCheckoutGraceExpired(false)

    if (!shouldUseSupabase() || !isCheckoutReturn || loading || !initialized || user) {
      return
    }

    const timer = window.setTimeout(() => {
      setCheckoutGraceExpired(true)
    }, CHECKOUT_SESSION_GRACE_MS)

    return () => window.clearTimeout(timer)
  }, [initialized, isCheckoutReturn, loading, user])

  useEffect(() => {
    if (!shouldUseSupabase() || loading || !initialized) return

    if (!user) {
      if (isCheckoutReturn && !checkoutGraceExpired) {
        return
      }

      if (isCheckoutReturn && checkoutGraceExpired) {
        return
      }

      const target = buildLoginRedirectTarget(pathname)
      console.log("[BOOT] redirecting", target)
      router.replace(target)
      return
    }

    if (resolvedProfile && !canAccessRole(resolvedProfile, allowedRoles)) {
      const target = getRedirectByRole(resolvedRole)
      console.log("[BOOT] redirecting", target)
      router.replace(target)
    }
  }, [allowedRoles, checkoutGraceExpired, initialized, isCheckoutReturn, loading, pathname, resolvedProfile, resolvedRole, router, user])

  if (!shouldUseSupabase()) return <>{children}</>

  if (loading || !initialized || (user && !resolvedRole) || (!user && isCheckoutReturn && !checkoutGraceExpired)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Carregando sessão...</div>
      </div>
    )
  }

  if (!user && isCheckoutReturn && checkoutGraceExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="max-w-sm text-center">
          <p className="text-base font-medium">Sua sessão expirou. Faça login novamente para continuar.</p>
          <Link
            href={buildLoginRedirectTarget(pathname)}
            className="mt-4 inline-flex rounded-xl border border-border/60 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Ir para login
          </Link>
        </div>
      </div>
    )
  }

  if (!user || (resolvedProfile && !canAccessRole(resolvedProfile, allowedRoles))) {
    return null
  }

  return <>{children}</>
}
