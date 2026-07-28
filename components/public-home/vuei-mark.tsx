import { cn } from "@/lib/utils"

export function VueiSymbol({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
    >
      <img
        src="/beach-landing/vuei-symbol.png"
        alt=""
        aria-hidden="true"
        className="h-full w-full scale-[1.85] object-contain"
      />
    </span>
  )
}

export function VueiWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-8 w-[92px] items-center overflow-hidden",
        className,
      )}
      aria-label="Vuei"
      role="img"
    >
      <img
        src="/beach-landing/vuei-wordmark-color.png"
        alt=""
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-[240%] w-auto max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
      />
    </span>
  )
}
