import { ChevronRight, Link2, LoaderCircle, MapPin, Users } from "lucide-react"

const steps = [
  { icon: MapPin, title: "Aruba", subtitle: "Destino escolhido", highlight: false, spin: false },
  { icon: LoaderCircle, title: "Criando\nsua viagem...", subtitle: "", highlight: false, spin: true },
  { icon: Link2, title: "vuei.app/ARUBA-K72L", subtitle: "Seu link nasceu", highlight: true, spin: false },
  { icon: Users, title: "Pronto para\ncompartilhar", subtitle: "", highlight: false, spin: false },
]

export function LinkSteps() {
  return (
    <section id="como-funciona" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-28 sm:py-36">
      <div className="text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Seu link está sendo criado...
        </h2>
        <p className="mx-auto mt-4 max-w-md text-pretty text-muted-foreground">
          Em segundos, tudo da sua viagem ganha um endereço só seu.
        </p>
      </div>

      <div className="mt-20 flex flex-col items-stretch gap-6 md:flex-row md:items-center">
        {steps.map((step, index) => (
          <div key={step.title} className="flex items-center gap-6 md:flex-1">
            <div
              className={`flex flex-1 flex-col items-center justify-center rounded-[2rem] px-6 py-12 text-center transition-shadow ${
                step.highlight
                  ? "bg-card shadow-[0_40px_80px_-40px_rgba(27,92,240,0.4)] ring-1 ring-primary/15"
                  : "bg-card shadow-[0_30px_70px_-45px_rgba(16,26,44,0.35)] ring-1 ring-border/50"
              }`}
            >
              <div
                className={`flex size-14 items-center justify-center rounded-full ${
                  step.highlight ? "bg-[#16a34a]/10 text-[#16a34a]" : "bg-accent text-primary"
                }`}
              >
                <step.icon className={`size-6 ${step.spin ? "animate-spin" : ""}`} aria-hidden="true" />
              </div>
              <p
                className={`mt-5 whitespace-pre-line text-base font-semibold ${
                  step.highlight ? "text-primary" : "text-foreground"
                }`}
              >
                {step.title}
              </p>
              {step.subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{step.subtitle}</p> : null}
            </div>

            {index < steps.length - 1 ? (
              <ChevronRight className="hidden size-5 shrink-0 text-muted-foreground/40 md:block" aria-hidden="true" />
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
