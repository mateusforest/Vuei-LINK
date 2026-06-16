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
      <DialogContent className="portal-dialog max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {actionLabel ? (
          <DialogFooter>
            {actionHref ? (
              <Button asChild className="rounded-xl border-0 bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)]">
                <Link href={actionHref}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button
                className="rounded-xl border-0 bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white shadow-[0_18px_36px_rgba(11,86,216,0.18)]"
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
