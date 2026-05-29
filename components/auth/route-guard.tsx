"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/types"
import { useAuth } from "@/contexts/auth-context"
import { canAccessRole, getRedirectByRole } from "@/lib/auth/role-redirect"
import { shouldUseSupabase } from "@/lib/data-source"

export function RouteGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[]
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  useEffect(() => {
    if (!shouldUseSupabase() || loading) return

    if (!user) {
      router.replace("/login")
      return
    }

    if (profile && !canAccessRole(profile, allowedRoles)) {
      router.replace(getRedirectByRole(profile.role))
    }
  }, [allowedRoles, loading, profile, router, user])

  if (!shouldUseSupabase()) return <>{children}</>

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Carregando sessao...</div>
      </div>
    )
  }

  if (!user || (profile && !canAccessRole(profile, allowedRoles))) {
    return null
  }

  return <>{children}</>
}
