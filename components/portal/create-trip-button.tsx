"use client"

import { useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useTrips } from "@/contexts/trips-context"
import { PortalActionDialog } from "@/components/portal/portal-action-dialog"

interface CreateTripButtonProps extends ComponentProps<typeof Button> {
  children: ReactNode
}

export function CreateTripButton({ children, onClick, ...props }: CreateTripButtonProps) {
  const router = useRouter()
  const { canCreateMoreTrips } = useTrips()
  const [showLimitDialog, setShowLimitDialog] = useState(false)

  return (
    <>
      <Button
        {...props}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented) return

          if (!canCreateMoreTrips) {
            setShowLimitDialog(true)
            return
          }

          router.push("/portal/criar-viagem")
        }}
      >
        {children}
      </Button>

      <PortalActionDialog
        open={showLimitDialog}
        onOpenChange={setShowLimitDialog}
        title="Limite do plano gratuito atingido"
        description="O plano gratuito permite apenas uma viagem ativa por vez. Faça upgrade para o Premium para criar viagens ilimitadas."
        actionLabel="Conhecer Premium"
        actionHref="/portal/planos"
      />
    </>
  )
}
