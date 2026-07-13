import Image from "next/image"
import Link from "next/link"
import { Camera, MessageCircle } from "lucide-react"

const links = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Concierge", href: "#concierge" },
  { label: "Demonstração", href: "#como-funciona" },
  { label: "Central de ajuda", href: "/suporte" },
  { label: "Privacidade", href: "/privacy" },
  { label: "Termos", href: "/terms" },
]

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-4">
      <div className="flex flex-col gap-8 border-t border-border/60 pt-8 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="flex items-center" aria-label="Vuei - página inicial">
          <Image src="/vuei-logo.png" alt="Vuei" width={112} height={36} className="h-7 w-auto" />
        </Link>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Rodapé">
          {links.map((link) => (
            <Link key={link.label} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#"
            aria-label="Instagram"
            className="flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-border/60 transition-colors hover:bg-accent"
          >
            <Camera className="size-4 text-foreground" aria-hidden="true" />
          </a>
          <a
            href="#"
            aria-label="WhatsApp"
            className="flex size-9 items-center justify-center rounded-full bg-card ring-1 ring-border/60 transition-colors hover:bg-accent"
          >
            <MessageCircle className="size-4 text-[#25D366]" aria-hidden="true" />
          </a>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground md:text-left">Toda a sua viagem, em um único link.</p>
    </footer>
  )
}
