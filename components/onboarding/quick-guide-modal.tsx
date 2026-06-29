"use client"

import type { ReactNode } from "react"
import { BookOpen, FileText, Link2, Lock, MoreHorizontal, Plane, Settings, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CreateTripButton } from "@/components/portal/create-trip-button"

type QuickGuideVariant = "agency" | "traveler"

interface QuickGuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: QuickGuideVariant
  onCreateTrip?: () => void
}

export function QuickGuideModal({ open, onOpenChange, variant, onCreateTrip }: QuickGuideModalProps) {
  const isAgency = variant === "agency"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_100%)] p-0 shadow-[0_32px_90px_rgba(15,23,42,0.18)] sm:max-w-2xl">
        <div className="border-b border-slate-200/80 px-6 py-5 sm:px-7">
          <Badge variant="outline" className="border-[#0b56d8]/15 bg-[#0b56d8]/6 text-[#0b56d8]">
            <BookOpen className="mr-1 h-3.5 w-3.5" />
            Guia rápido
          </Badge>
          <DialogHeader className="mt-3 text-left">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-950">Guia rápido</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {isAgency ? "Sua primeira viagem leva menos de 2 minutos." : "Organize sua viagem em poucos passos."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5 sm:px-7">
          {isAgency ? (
            <>
              <GuideStep icon={Users} index={1} title="Cadastre seu primeiro cliente.">
                Todo cliente pode ter uma ou mais viagens.
              </GuideStep>
              <GuideStep icon={Plane} index={2} title="Crie a viagem.">
                Escolha destino, datas e informações básicas.
              </GuideStep>
              <GuideStep icon={FileText} index={3} title="Adicione passagens, hospedagens e documentos.">
                O Vuei organiza tudo em um único lugar.
              </GuideStep>
              <GuideStep icon={Lock} index={4} title="Defina o PIN da viagem.">
                <p>Abra o menu <InlineDots /> da viagem e selecione &quot;Configurar PIN&quot;.</p>
                <p className="mt-2">Esse será o PIN do cliente.</p>
                <p className="mt-2">É uma senha de 4 dígitos que protege todos os documentos e informações da viagem.</p>
              </GuideStep>
              <GuideStep icon={Link2} index={5} title="Compartilhe o Link da Viagem.">
                <p>O cliente poderá consultar, editar e anexar informações quando necessário.</p>
                <p className="mt-2">
                  A agência também poderá acessar o mesmo Link da Viagem para acompanhar, conferir e manter tudo atualizado.
                </p>
              </GuideStep>
            </>
          ) : (
            <>
              <GuideStep icon={Plane} index={1} title="Crie sua viagem.">
                Informe destino, datas e informações básicas.
              </GuideStep>
              <GuideStep icon={Settings} index={2} title="Defina seu PIN.">
                <p>Abra Configurações e configure um PIN de 4 dígitos.</p>
                <p className="mt-2">Esse PIN protege todos os documentos e informações da sua viagem.</p>
              </GuideStep>
              <GuideStep icon={Link2} index={3} title="Abra o Link da Viagem.">
                É nele que toda a organização acontece.
              </GuideStep>
              <GuideStep icon={FileText} index={4} title="Adicione passagens, hospedagens, documentos e roteiros.">
                Todas as ações da viagem são feitas diretamente pelo Link da Viagem.
              </GuideStep>
              <GuideStep icon={Users} index={5} title="Compartilhe quando desejar.">
                Pronto. Sua viagem estará organizada em um único lugar.
              </GuideStep>
            </>
          )}
        </div>

        <div className="border-t border-slate-200/80 px-6 py-5 sm:px-7">
          {isAgency ? (
            <Button className="w-full bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white hover:opacity-95" onClick={onCreateTrip}>
              Criar primeira viagem
            </Button>
          ) : (
            <CreateTripButton className="w-full bg-gradient-to-r from-[#37beff] to-[#0b56d8] text-white hover:opacity-95">
              Criar minha viagem
            </CreateTripButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GuideStep({
  icon: Icon,
  index,
  title,
  children,
}: {
  icon: typeof Plane
  index: number
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#37beff]/18 to-[#0b56d8]/12 text-[#0b56d8]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Passo {index}</p>
          <p className="mt-1 text-base font-semibold text-slate-950">{title}</p>
          <div className="mt-2 text-sm leading-6 text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  )
}

function InlineDots() {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 align-middle text-slate-700">
      <MoreHorizontal className="h-3.5 w-3.5" />
    </span>
  )
}
