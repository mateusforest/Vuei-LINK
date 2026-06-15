"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { UserRole } from "@/types"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRole, getRedirectByRole } from "@/lib/auth/role-redirect"
import { buildLoginRedirectTarget } from "@/lib/auth/safe-redirect"
import { shouldUseSupabase } from "@/lib/data-source"

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

  useEffect(() => {
    if (!shouldUseSupabase() || loading || !initialized) return

    if (!user) {
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
  }, [allowedRoles, initialized, loading, pathname, resolvedProfile, resolvedRole, router, user])

  if (!shouldUseSupabase()) return <>{children}</>

  if (loading || !initialized || (user && !resolvedRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Carregando sessao...</div>
      </div>
    )
  }

  if (!user || (resolvedProfile && !canAccessRole(resolvedProfile, allowedRoles))) {
    return null
  }

  return <>{children}</>
}
