"use client"

import { ArrowRight, CalendarDays, MapPin } from "lucide-react"

type PrepareTripProps = {
  destination: string
  startDate: string
  endDate: string
  visible: boolean
  onDestinationChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onContinue: (startDate: string, endDate: string) => void
}

export function PrepareTrip({
  destination,
  startDate,
  endDate,
  visible,
  onDestinationChange,
  onStartDateChange,
  onEndDateChange,
  onContinue,
}: PrepareTripProps) {
  if (!visible) return null

  return (
    <section
      id="preparar-viagem"
      className="w-full scroll-mt-20 bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff_0%,#faf8f4_55%)] py-28 sm:py-36"
    >
      <div className="mx-auto w-full max-w-2xl px-6">
        <div className="animate-in fade-in slide-in-from-bottom-4 text-center duration-700">
          <p className="text-sm font-medium tracking-wide text-primary">Quase lá</p>
          <h2 className="mt-4 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            Vamos preparar sua viagem.
          </h2>
          <p className="mt-5 text-pretty text-lg text-muted-foreground">
            Só mais alguns detalhes e seu link estará pronto para compartilhar.
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-6 mx-auto mt-14 flex max-w-lg flex-col gap-4 delay-100 duration-700">
          <div>
            <label htmlFor="prep-destination" className="mb-2 block pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Destino
            </label>
            <div className="flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-[0_20px_50px_-35px_rgba(16,26,44,0.3)] ring-1 ring-border/50">
              <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <input
                id="prep-destination"
                type="text"
                value={destination}
                onChange={(event) => onDestinationChange(event.target.value)}
                placeholder="Seu destino"
                className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="prep-start" className="mb-2 block pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data de ida
              </label>
              <div className="flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-[0_20px_50px_-35px_rgba(16,26,44,0.3)] ring-1 ring-border/50">
                <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <input
                  id="prep-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => onStartDateChange(event.target.value)}
                  className="w-full bg-transparent text-base font-medium text-foreground outline-none [color-scheme:light]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="prep-end" className="mb-2 block pl-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data de volta
              </label>
              <div className="flex items-center gap-3 rounded-3xl bg-card px-5 py-4 shadow-[0_20px_50px_-35px_rgba(16,26,44,0.3)] ring-1 ring-border/50">
                <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <input
                  id="prep-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => onEndDateChange(event.target.value)}
                  className="w-full bg-transparent text-base font-medium text-foreground outline-none [color-scheme:light]"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onContinue(startDate, endDate)}
            disabled={!destination.trim()}
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_20px_50px_-20px_rgba(27,92,240,0.7)] transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continuar
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
