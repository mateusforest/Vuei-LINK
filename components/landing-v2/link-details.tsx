import type { ElementType, ReactNode } from "react"
import {
  Building2,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  Pencil,
  Plane,
  Route,
  Trash2,
  X,
} from "lucide-react"
import { ConciergeChat } from "@/components/landing-v2/concierge-chat"

function SideCard({
  icon: Icon,
  title,
  status,
  statusColor = "text-primary",
  statusPill = false,
  children,
  showArrow = true,
}: {
  icon: ElementType
  title: string
  status?: string
  statusColor?: string
  statusPill?: boolean
  children: ReactNode
  showArrow?: boolean
}) {
  return (
    <div className="flex items-start gap-3 rounded-[1.75rem] bg-card p-5 shadow-[0_30px_70px_-45px_rgba(16,26,44,0.35)] ring-1 ring-border/40">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {status && !statusPill ? <span className={`text-xs font-medium ${statusColor}`}>{status}</span> : null}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{children}</div>
        {status && statusPill ? (
          <span className="mt-2 inline-block rounded-full bg-[#16a34a]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#16a34a]">
            {status}
          </span>
        ) : null}
      </div>
      {showArrow ? <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" /> : null}
    </div>
  )
}

export function LinkDetails() {
  return (
    <section className="w-full bg-muted/50 py-28 sm:py-36">
      <div className="mx-auto w-full max-w-6xl px-6">
        <h2 className="text-balance text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Seu link. Tudo da sua viagem.
        </h2>
        <p className="mt-4 text-center text-muted-foreground">Conectado, organizado e sempre à mão.</p>

        <div className="mt-20 grid items-center gap-10 lg:grid-cols-[1fr_auto_1fr] lg:gap-14">
          <div className="flex flex-col gap-6">
            <SideCard icon={Plane} title="Passagens" status="Confirmado" statusPill>
              Copa 820 / 348
              <br />
              POA - AUA
              <br />
              04 jul. 2026 - 01:15
            </SideCard>
            <SideCard icon={FileText} title="Documentos" status="Pronto">
              7 documento(s)
              <br />
              Abra para ver
            </SideCard>
            <SideCard icon={Route} title="Roteiro com IA" status="Ver">
              6 dia(s) planejado(s)
              <br />
              Abra para ver
            </SideCard>
          </div>

          <div className="relative mx-auto w-[310px] shrink-0 lg:scale-[1.06]">
            <div className="absolute -inset-10 -z-10 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[2.9rem] bg-[#0e1420] p-2.5 shadow-[0_70px_130px_-45px_rgba(16,26,44,0.6),0_25px_60px_-35px_rgba(16,26,44,0.4)]">
              <div className="relative overflow-hidden rounded-[2.25rem] bg-[#f7f6f2]">
                <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-[#0e1420]" />

                <div className="px-4 pb-5 pt-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">Passagens</h3>
                    <div className="flex size-7 items-center justify-center rounded-full bg-black/5 text-muted-foreground">
                      <X className="size-4" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
                          <Plane className="size-4" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">Passagens</p>
                          <p className="text-[10px] text-muted-foreground">1 voo(s) salvo(s)</p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary">
                        <Paperclip className="size-3" aria-hidden="true" /> Anexar
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-border/60">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">Copa</p>
                        <p className="text-[10px] text-muted-foreground">Voo internacional</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">04 de jul. de 2026</p>
                        <p className="text-sm font-bold text-primary">820</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-lg font-bold text-foreground">POA</p>
                        <p className="text-[10px] text-muted-foreground">01:15</p>
                      </div>
                      <div className="flex flex-1 flex-col items-center px-2">
                        <p className="text-[10px] text-muted-foreground">10h 56m</p>
                        <div className="my-1 flex w-full items-center gap-1">
                          <span className="h-px flex-1 bg-border" />
                          <Plane className="size-3 text-primary" aria-hidden="true" />
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">AUA</p>
                        <p className="text-[10px] text-muted-foreground">12:11</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Terminal</p>
                        <p className="text-xs font-semibold text-foreground">1</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Portão</p>
                        <p className="text-xs font-semibold text-foreground">11</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground">Assento</p>
                        <p className="text-xs font-semibold text-foreground">2A</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-medium">
                    <span className="text-muted-foreground">Detalhes</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Plane className="size-3" aria-hidden="true" /> Abrir passagem
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1 text-[11px] font-medium">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Pencil className="size-3" aria-hidden="true" /> Editar
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <Trash2 className="size-3" aria-hidden="true" /> Excluir
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="concierge" className="flex scroll-mt-24 flex-col gap-6">
            <SideCard icon={Building2} title="Hospedagem" status="Confirmado" statusColor="text-[#16a34a]">
              The Mill Resort & Suites
              <br />
              04-09 jul. 2026 - 5 noites
            </SideCard>

            <ConciergeChat />

            <div className="flex items-center gap-3 rounded-[1.75rem] bg-card p-5 shadow-[0_30px_70px_-45px_rgba(16,26,44,0.35)] ring-1 ring-border/40">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                <Download className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Disponível offline</p>
                <p className="text-xs text-muted-foreground">Baixe seus documentos</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-primary">
                <Download className="size-3" aria-hidden="true" /> Baixar docs
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
