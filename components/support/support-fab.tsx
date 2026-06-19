"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { HelpCircle, MessageSquareWarning, Send, CheckCircle2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { createSupportTicket } from "@/lib/repositories/support-repository"
import { SUPPORT_WHATSAPP } from "@/lib/support/labels"
import type { SupportTicketCategory, SupportTicketPriority } from "@/types"

const categories: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: "vuei_help", label: "Dúvida sobre o Vuei" },
  { value: "technical_issue", label: "Problema técnico" },
  { value: "billing", label: "Plano ou cobrança" },
  { value: "credits", label: "Créditos" },
  { value: "trip_link", label: "Viagem ou link" },
  { value: "other", label: "Outro" },
]

export function SupportFab({
  portalType,
  agencyId = null,
}: {
  portalType: "traveler" | "agency"
  agencyId?: string | null
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: "",
    category: "vuei_help" as SupportTicketCategory,
    message: "",
    priority: "normal" as SupportTicketPriority,
  })

  const showUrgentHint = form.priority === "urgent"

  const resetForm = () => {
    setForm({
      title: "",
      category: "vuei_help",
      message: "",
      priority: "normal",
    })
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setError("Preencha assunto e mensagem para enviar o chamado.")
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const result = await createSupportTicket({
      title: form.title.trim(),
      category: form.category,
      priority: form.priority,
      message: form.message.trim(),
      portalType,
      currentRoute: pathname ?? null,
    })

    setSubmitting(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSuccess("Chamado enviado. Vamos te responder em breve.")
    resetForm()
    window.setTimeout(() => {
      setOpen(false)
      setSuccess(null)
    }, 1800)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 flex items-center gap-2 rounded-full border border-primary/15 bg-white/96 px-4 py-3 text-sm font-medium text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl transition hover:scale-[1.01] hover:shadow-[0_24px_48px_rgba(15,23,42,0.16)]",
          "bottom-[calc(env(safe-area-inset-bottom)+84px)] lg:bottom-6 lg:right-6",
        )}
        aria-label="Abrir suporte"
      >
        <HelpCircle className="h-4 w-4 text-primary" />
        <span>Suporte</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-border/60 bg-white">
          <DialogHeader>
            <DialogTitle>Falar com o suporte</DialogTitle>
            <DialogDescription>
              Abra um chamado pelo portal. Casos urgentes também podem ser acompanhados pelo WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Assunto</Label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex: Não consegui abrir minha viagem"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as SupportTicketCategory }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as SupportTicketPriority }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Conte o que aconteceu e em qual tela você estava."
                className="min-h-32"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              Contexto enviado automaticamente:
              {" "}
              {portalType === "agency" ? "portal da agência" : "portal viajante"}
              , rota atual, usuário autenticado, timestamp e vínculo de agência
              {agencyId ? " disponível" : " não aplicável"}.
            </div>

            {showUrgentHint ? (
              <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <div className="flex items-start gap-3">
                  <MessageSquareWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    Para situações urgentes, entre em contato também pelo WhatsApp:
                    {" "}
                    <strong>{SUPPORT_WHATSAPP}</strong>
                  </p>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {success}
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button className="gap-2 bg-gradient-to-r from-primary to-accent text-white" onClick={() => void handleSubmit()} disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? "Enviando..." : "Enviar chamado"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
