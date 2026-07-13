import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"

export function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
      <div className="grid items-center gap-10 rounded-[2.75rem] bg-secondary/50 px-8 py-16 sm:px-16 md:grid-cols-[260px_1fr]">
        <div className="mx-auto w-48 md:w-full">
          <Image
            src="/landing-v2/suitcase.png"
            alt="Mala de viagem"
            width={320}
            height={320}
            className="h-auto w-full object-contain"
          />
        </div>

        <div>
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sua viagem começa aqui.
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Crie seu link em segundos e tenha tudo da sua viagem em um só lugar.
          </p>

          <div className="mt-8 flex items-center gap-2 rounded-full bg-card p-2 pl-5 shadow-[0_30px_70px_-30px_rgba(16,26,44,0.28)] ring-1 ring-border/60">
            <MapPin className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="w-full py-2.5 text-base text-muted-foreground">Para onde você vai?</span>
            <Link
              href="/criar-viagem"
              aria-label="Criar link da viagem"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
