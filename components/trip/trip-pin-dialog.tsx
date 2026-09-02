"use client"

import { useEffect, useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { buildQuickAccessPinSettings } from "@/lib/auth/quick-access"
import { getTripById, updateTrip } from "@/lib/repositories/trips-repository"

interface TripPinDialogProps {
  open: boolean
  tripId: string | null
  onOpenChange: (open: boolean) => void
  onSaved?: () => void | Promise<void>
}

const emptyPinForm = { pin: "", confirmPin: "" }

export function TripPinDialog({ open, tripId, onOpenChange, onSaved }: TripPinDialogProps) {
  const pinInputId = useId()
  const confirmPinInputId = useId()
  const [pinForm, setPinForm] = useState(emptyPinForm)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !tripId) return

    let active = true
    setPinForm(emptyPinForm)
    setError("")
    setSuccess("")
    setConfigured(false)
    setLoading(true)

    void getTripById(tripId)
      .then((result) => {
        if (!active) return
        if (!result.data) {
          throw new Error(result.error ?? "Não foi possível consultar o PIN da viagem.")
        }

        const tripPin = result.data.permissions?.tripPin
        setConfigured(Boolean(tripPin?.enabled && tripPin.pinHash && tripPin.pinSalt))
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : "Não foi possível consultar o PIN da viagem.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, tripId])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPinForm(emptyPinForm)
      setError("")
      setSuccess("")
    }
    onOpenChange(nextOpen)
  }

  const handleSave = async () => {
    if (!tripId) return

    if (pinForm.pin.length !== 4 || pinForm.confirmPin.length !== 4) {
      setError("Informe um PIN de 4 dígitos.")
      return
    }

    if (pinForm.pin !== pinForm.confirmPin) {
      setError("Os PINs não conferem.")
      return
    }

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const currentTripResult = await getTripById(tripId)
      if (!currentTripResult.data) {
        throw new Error(currentTripResult.error ?? "Não foi possível localizar a viagem.")
      }

      const tripPin = await buildQuickAccessPinSettings(pinForm.pin)
      const result = await updateTrip(tripId, {
        permissions: {
          ...currentTripResult.data.permissions,
          tripPin,
        },
      })

      if (!result.data) {
        throw new Error(result.error ?? "Não foi possível salvar o PIN da viagem.")
      }

      setConfigured(true)
      setPinForm(emptyPinForm)
      setSuccess("PIN salvo com sucesso.")
      await onSaved?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o PIN da viagem.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="agency-modal max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>PIN da viagem</DialogTitle>
          <DialogDescription>
            Crie o código de acesso que será compartilhado com o viajante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-border/60 bg-[#fbfbfc] p-4 text-sm text-muted-foreground">
              Carregando configuração do PIN...
            </div>
          ) : null}

          {!loading && configured ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700">
              PIN configurado para esta viagem. Você pode alterá-lo abaixo.
            </div>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-[#fbfbfc] p-4 text-sm text-muted-foreground">
            Este PIN será usado para desbloquear áreas protegidas do link da viagem.
          </div>
          <div className="rounded-xl border border-border/60 bg-[#fbfbfc] p-4 text-sm text-muted-foreground">
            Utilize os 4 primeiros números do CPF do viajante ou os 4 últimos números do telefone.
          </div>

          <div className="space-y-2">
            <Label htmlFor={pinInputId}>PIN</Label>
            <Input
              id={pinInputId}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="0000"
              value={pinForm.pin}
              onChange={(event) => {
                setPinForm((current) => ({
                  ...current,
                  pin: event.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }}
              className="text-center text-2xl tracking-[0.5em]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={confirmPinInputId}>Confirmar PIN</Label>
            <Input
              id={confirmPinInputId}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              placeholder="0000"
              value={pinForm.confirmPin}
              onChange={(event) => {
                setPinForm((current) => ({
                  ...current,
                  confirmPin: event.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }}
              className="text-center text-2xl tracking-[0.5em]"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
        </div>

        <DialogFooter className="flex-row">
          <Button variant="outline" className="flex-1" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void handleSave()} disabled={saving || loading || !tripId}>
            {saving ? "Salvando..." : "Salvar PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
