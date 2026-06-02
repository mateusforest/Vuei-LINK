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
  const { user, profile, loading } = useAuth()
  const resolvedRole = profile?.role ?? (typeof user?.user_metadata?.role === "string" ? (user.user_metadata.role as UserRole) : null)
  const resolvedProfile = resolvedRole ? { role: resolvedRole } : null

  useEffect(() => {
    if (!shouldUseSupabase() || loading) return

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
  }, [allowedRoles, loading, pathname, resolvedProfile, resolvedRole, router, user])

  if (!shouldUseSupabase()) return <>{children}</>

  if (loading) {
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
