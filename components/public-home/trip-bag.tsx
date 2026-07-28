"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { VueiSymbol } from "@/components/public-home/vuei-mark"

export function TripBag({
  count,
  glow,
  showBalloon,
  onDismissBalloon,
  onOpen,
}: {
  count: number
  glow: boolean
  showBalloon: boolean
  onDismissBalloon: () => void
  onOpen: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {showBalloon ? (
        <div className="vuei-pop pointer-events-auto absolute bottom-[23%] right-[6%] sm:right-[10%] lg:bottom-[34%] lg:right-[20%]">
          <div className="vuei-glass relative w-[15.5rem] rounded-2xl border border-border/50 p-4 shadow-[0_28px_70px_-30px_rgba(20,60,120,0.4)] sm:w-64">
            <button
              type="button"
              onClick={onDismissBalloon}
              aria-label="Fechar aviso"
              className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
            <div className="flex items-start gap-3 pr-4">
              <VueiSymbol className="mt-0.5 size-6" />
              <div>
                <p className="text-[0.92rem] font-semibold leading-snug text-foreground">Sua viagem foi guardada.</p>
                <p className="mt-1 text-[0.82rem] leading-snug text-muted-foreground">
                  Sempre que voltar ao Vuei, ela estara aqui.
                </p>
              </div>
            </div>
            <span className="vuei-glass absolute -bottom-1.5 right-10 size-3 rotate-45 rounded-[3px] border-b border-r border-border/70" />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        aria-label={count > 0 ? `Abrir sua bolsa Vuei (${count})` : "Abrir sua bolsa Vuei"}
        className="group pointer-events-auto absolute bottom-[6%] right-[4%] h-[17vh] min-h-[112px] w-[38vw] min-w-[128px] max-w-[210px] rounded-[28px] transition-transform duration-[600ms] [transition-timing-function:var(--ease-out-soft)] hover:scale-[1.015] sm:bottom-[7%] sm:right-[8%] sm:h-[19vh] sm:w-[34vw] lg:bottom-[10%] lg:right-[20%] lg:h-[150px] lg:w-[210px]"
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[40%] blur-2xl transition-opacity duration-700 [transition-timing-function:var(--ease-out-soft)]",
            glow ? "opacity-100" : "opacity-0",
            "group-hover:opacity-100",
          )}
          style={{
            background:
              "radial-gradient(60% 55% at 50% 60%, color-mix(in oklch, var(--brand) 32%, transparent), transparent 70%)",
          }}
        />

        {glow ? (
          <span className="vuei-glow absolute right-[30%] top-[30%] size-2.5 rounded-full bg-brand" />
        ) : null}

        {count > 0 ? (
          <span
            className={cn(
              "absolute right-[26%] top-[20%] grid min-w-5 translate-y-1 place-items-center rounded-full bg-foreground px-1.5 text-[0.7rem] font-semibold text-background opacity-0 shadow-md transition-all duration-300 [transition-timing-function:var(--ease-out-soft)] group-hover:translate-y-0 group-hover:opacity-100",
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    </div>
  )
}
