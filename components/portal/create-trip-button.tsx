"use client"

import type { ComponentProps, ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface CreateTripButtonProps extends ComponentProps<typeof Button> {
  children: ReactNode
}

export function CreateTripButton({ children, onClick, ...props }: CreateTripButtonProps) {
  const router = useRouter()

  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return
        router.push("/portal/criar-viagem")
      }}
    >
      {children}
    </Button>
  )
}
