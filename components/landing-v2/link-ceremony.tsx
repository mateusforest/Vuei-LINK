"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { ArrowRight, Check, ExternalLink, LockKeyhole } from "lucide-react"

const phrases = ["Preparando sua viagem...", "Criando seu link...", "Tudo pronto."]

type LinkCeremonyProps = {
  visible: boolean
  tripUrl: string | null
  error: string | null
  isLoading: boolean
  needsClaim: boolean
  onClose: () => void
  onOpenTrip: () => void
  onProtectTrip: () => void
  onContinueWithoutAccount: () => void
}

export function LinkCeremony({
  visible,
  tripUrl,
  error,
  isLoading,
  needsClaim,
  onClose,
  onOpenTrip,
  onProtectTrip,
  onContinueWithoutAccount,
}: LinkCeremonyProps) {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    if (!visible) return

    setPhraseIndex(0)

    const interval = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length)
    }, 950)

    return () => {
      window.clearInterval(interval)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div className="landing-shell fixed inset-0 z-[100] overflow-y-auto bg-[radial-gradient(120%_90%_at_50%_-5%,#ffffff_0%,#faf8f4_60%)]">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-6xl items-center px-6 py-5">
          <Image src="/vuei-logo.png" alt="Vuei" width={124} height={40} className="h-8 w-auto" priority />
        </div>
      </header>

      <div className="flex min-h-[calc(100dvh-72px)] flex-col items-center justify-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 text-center">
        {!tripUrl && !error ? (
          <>
            <CeremonyMark />
            <p
              key={phraseIndex}
              className="mt-12 text-lg font-medium text-muted-foreground"
              style={{ animation: "vuei-fade-in 0.5s ease both" }}
            >
              {isLoading ? phrases[phraseIndex] : "Preparando sua viagem..."}
            </p>
          </>
        ) : error ? (
          <div className="w-full max-w-md" style={{ animation: "vuei-pop-in 0.6s cubic-bezier(0.22,1,0.36,1) both" }}>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Não foi possível concluir agora.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-10 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_24px_60px_-20px_rgba(27,92,240,0.7)] transition-colors hover:bg-primary/90"
            >
              Voltar
              <ArrowRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md" style={{ animation: "vuei-pop-in 0.6s cubic-bezier(0.22,1,0.36,1) both" }}>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#16a34a]/10 text-[#16a34a]">
              <Check className="size-7" aria-hidden="true" />
            </div>
            <h1 className="mt-8 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              {needsClaim ? "Seu rascunho está pronto." : "Viagem criada."}
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              {needsClaim
                ? "Ele está privado e salvo neste navegador. Entre para ativar e compartilhar depois."
                : "Continue pela sua Bolsa para revisar e ativar a viagem."}
            </p>

            <div className="mt-8 flex items-center gap-3 rounded-[28px] border border-amber-500/20 bg-amber-500/[0.06] p-5 text-left shadow-[0_18px_50px_-28px_rgba(16,26,44,0.24)]">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700">
                <LockKeyhole className="size-4.5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Rascunho privado</p>
                <p className="mt-1 text-sm text-muted-foreground">O link público será liberado somente após a ativação.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={onOpenTrip}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground shadow-[0_24px_60px_-20px_rgba(27,92,240,0.7)] transition-colors hover:bg-primary/90"
              >
                {needsClaim ? "Continuar rascunho" : "Abrir viagem"}
                <ExternalLink className="size-5" aria-hidden="true" />
              </button>
            </div>

            {needsClaim ? (
              <>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  Sua viagem permanecerá disponível neste navegador por até 24 horas.
                  Ao ativar sua conta, ela ficará sincronizada e poderá ser acessada de qualquer dispositivo.
                </p>

                <div className="mt-8 rounded-[28px] border border-[#0b56d8]/10 bg-[#f8fbff] p-5 text-left shadow-[0_18px_40px_-30px_rgba(37,99,235,0.25)]">
                  <div className="space-y-3 text-sm">
                    {[
                      { label: "Reabrir o rascunho neste navegador", active: true },
                      { label: "Ativar e compartilhar o link", active: false },
                      { label: "Editar informações", active: false },
                      { label: "Anexar documentos e passagens", active: false },
                      { label: "Gerar roteiros com IA", active: false },
                      { label: "Configurar um PIN de segurança", active: false },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                            item.active
                              ? "border-[#16a34a]/30 bg-[#16a34a]/10 text-[#16a34a]"
                              : "border-slate-300 bg-white text-slate-400"
                          }`}
                          aria-hidden="true"
                        >
                          {item.active ? "✓" : "○"}
                        </span>
                        <span className={item.active ? "text-slate-900" : "text-slate-500"}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 text-sm leading-6 text-muted-foreground">
                    Para editar a viagem, anexar documentos, usar todos os recursos e proteger seus dados com um PIN,
                    ative gratuitamente sua conta.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onProtectTrip}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#0f172a] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[#111f35]"
                >
                  Ativar minha viagem
                  <ArrowRight className="size-5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={onContinueWithoutAccount}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-white px-6 py-4 text-base font-semibold text-foreground transition-colors hover:bg-muted/40"
                >
                  Agora não
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

function CeremonyMark() {
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 160 160" className="size-full" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="vuei-grad" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#1b4fd0" />
          </linearGradient>
        </defs>

        <circle cx="80" cy="80" r="54" fill="url(#vuei-grad)" style={{ opacity: 0.07 }} />

        <g style={{ animation: "vuei-fade-out 0.45s ease 0.85s both" }}>
          <path
            d="M80 46c-10 0-18 8-18 18 0 13 18 30 18 30s18-17 18-30c0-10-8-18-18-18z"
            fill="none"
            stroke="url(#vuei-grad)"
            strokeWidth="6"
            style={{ animation: "vuei-pin-drop 0.7s cubic-bezier(0.22,1,0.36,1) both" }}
          />
          <circle cx="80" cy="64" r="6" fill="url(#vuei-grad)" />
        </g>

        <g fill="none" stroke="url(#vuei-grad)" strokeWidth="7" strokeLinecap="round">
          <rect
            x="46"
            y="68"
            width="38"
            height="24"
            rx="12"
            style={{
              transformOrigin: "65px 80px",
              animation: "vuei-links-join-left 0.6s cubic-bezier(0.22,1,0.36,1) 0.95s both",
            }}
          />
          <rect
            x="76"
            y="68"
            width="38"
            height="24"
            rx="12"
            style={{
              transformOrigin: "95px 80px",
              animation: "vuei-links-join-right 0.6s cubic-bezier(0.22,1,0.36,1) 0.95s both",
            }}
          />
        </g>

        <line
          x1="70"
          y1="80"
          x2="90"
          y2="80"
          stroke="url(#vuei-grad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray="22"
          strokeDashoffset="22"
          style={{ animation: "vuei-draw 0.5s ease 1.45s both" }}
        />

        <path
          d="M64 81l11 11 22-24"
          stroke="url(#vuei-grad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          strokeDashoffset="60"
          style={{ animation: "vuei-draw 0.5s ease 1.85s both" }}
        />
      </svg>

      <span
        className="absolute left-0 top-0 size-3 rounded-full bg-white shadow-[0_0_16px_6px_rgba(56,189,248,0.9)]"
        style={{
          offsetPath: "path('M 66 80 L 94 80')",
          animation: "vuei-glow-travel 0.9s ease 1.4s both",
        }}
      />
    </div>
  )
}
