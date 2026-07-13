import Image from "next/image"
import { Copy, Link2, Mail, MessageCircle, MessageSquare, MoreHorizontal, Send, ShieldCheck } from "lucide-react"

const shareChannels = [
  { icon: MessageCircle, label: "WhatsApp", color: "text-[#25D366]" },
  { icon: MessageSquare, label: "Mensagens", color: "text-[#25D366]" },
  { icon: Mail, label: "E-mail", color: "text-primary" },
  { icon: MoreHorizontal, label: "Mais", color: "text-muted-foreground" },
]

const avatars = [
  { src: "/landing-v2/avatar-1.png", pos: "left-4 top-2" },
  { src: "/landing-v2/avatar-2.png", pos: "right-4 top-2" },
  { src: "/landing-v2/avatar-3.png", pos: "left-8 bottom-2" },
  { src: "/landing-v2/avatar-4.png", pos: "right-8 bottom-2" },
]

export function SharedLink() {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-16 px-6 py-28 sm:py-36 lg:grid-cols-2">
      <div>
        <h2 className="text-balance text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
          Quem viaja com você entra pelo mesmo link.
        </h2>
        <p className="mt-5 text-pretty text-lg text-muted-foreground">
          Um link para todos verem, editarem e viverem a viagem juntos, do primeiro plano ao último dia.
        </p>

        <div className="mt-10 flex items-center gap-2 rounded-full bg-card p-2 pl-5 shadow-[0_24px_60px_-40px_rgba(16,26,44,0.3)] ring-1 ring-border/50">
          <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1 truncate text-sm font-medium text-foreground">vuei.app/ARUBA-K72L</span>
          <button className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent/70">
            <Copy className="size-3.5" aria-hidden="true" /> Copiar link
          </button>
        </div>

        <div className="mt-10 flex items-center gap-10">
          {shareChannels.map((channel) => (
            <div key={channel.label} className="flex flex-col items-center gap-2">
              <div className="flex size-12 items-center justify-center rounded-full bg-card shadow-[0_16px_40px_-30px_rgba(16,26,44,0.5)] ring-1 ring-border/70">
                <channel.icon className={`size-5 ${channel.color}`} aria-hidden="true" />
              </div>
              <span className="text-[11px] text-muted-foreground">{channel.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex h-80 w-full max-w-md items-center justify-center">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 320" fill="none" aria-hidden="true">
          <ellipse
            cx="200"
            cy="160"
            rx="180"
            ry="130"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            opacity="0.35"
          />
        </svg>

        <Send className="absolute left-14 top-16 size-4 -rotate-12 text-primary/50" aria-hidden="true" />
        <Send className="absolute right-16 bottom-16 size-4 rotate-45 text-primary/50" aria-hidden="true" />

        {avatars.map((avatar, index) => (
          <Image
            key={index}
            src={avatar.src}
            alt=""
            width={56}
            height={56}
            className={`absolute size-14 rounded-full border-4 border-background object-cover shadow-md ${avatar.pos}`}
          />
        ))}

        <div className="relative z-10 w-60 rounded-[1.75rem] bg-card p-6 text-center shadow-[0_40px_90px_-40px_rgba(16,26,44,0.5)] ring-1 ring-border/40">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-[#16a34a]/10 text-[#16a34a]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Sua viagem</p>
          <p className="mt-1 text-base font-semibold text-primary">vuei.app/ARUBA-K72L</p>
          <p className="mt-3 text-xs text-muted-foreground">Qualquer pessoa com o link pode acessar.</p>
        </div>
      </div>
    </section>
  )
}
