"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface PortalActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
}

export function PortalActionDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: PortalActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="vuei-glass max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {actionLabel ? (
          <DialogFooter>
            {actionHref ? (
              <Button asChild className="rounded-xl bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button
                className="rounded-xl bg-gradient-to-r from-[#5de0e6] to-[#004aad] text-white border-0"
                onClick={onAction}
              >
                {actionLabel}
              </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
