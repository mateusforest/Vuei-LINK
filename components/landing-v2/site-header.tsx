"use client"

import Image from "next/image"
import Link from "next/link"

export function SiteHeader({ onCreateTrip }: { onCreateTrip: () => void }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-background/70 backdrop-blur-xl">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center px-6 py-5 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex items-center" aria-label="Vuei - pagina inicial">
          <Image src="/vuei-logo.png" alt="Vuei" width={124} height={40} className="h-8 w-auto" priority />
        </Link>

        <nav className="hidden items-center gap-10 justify-self-center md:flex" aria-label="Principal">
          <Link href="/login" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            Abrir viagem
          </Link>
          <Link href="#como-funciona" className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground">
            Ver demonstracao
          </Link>
        </nav>

        <div className="justify-self-end">
          <button
            type="button"
            onClick={onCreateTrip}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-12px_rgba(27,92,240,0.6)] transition-colors hover:bg-primary/90"
          >
            Criar minha viagem
          </button>
        </div>
      </div>
    </header>
  )
}
