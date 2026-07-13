"use client"

import { useEffect, useReducer, useRef } from "react"
import { Sparkles } from "lucide-react"

type Message = { from: "user" | "bot"; text: string }

const script: Message[] = [
  { from: "user", text: "Que horas tenho que estar no aeroporto de POA?" },
  {
    from: "bot",
    text: "Para o voo Copa 820/348 saindo as 01:15, chegue ao aeroporto de Porto Alegre as 22:15 do dia anterior.",
  },
  { from: "user", text: "Preciso de quais documentos para Aruba?" },
  {
    from: "bot",
    text: "Você precisará de passaporte válido, passagens de ida e volta e comprovante de hospedagem.",
  },
]

type State = { count: number; typing: boolean }
type Action = { type: "typing" } | { type: "reveal" } | { type: "reset" }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "typing":
      return { ...state, typing: true }
    case "reveal":
      return { count: state.count + 1, typing: false }
    case "reset":
      return { count: 0, typing: false }
    default:
      return state
  }
}

export function ConciergeChat() {
  const [state, dispatch] = useReducer(reducer, { count: 0, typing: false })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const pausedRef = useRef(false)

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReduced) {
      for (let index = 0; index < script.length; index += 1) {
        dispatch({ type: "reveal" })
      }
      return
    }

    let cancelled = false

    function schedule(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        if (cancelled) return
        if (pausedRef.current) {
          schedule(callback, 400)
          return
        }
        callback()
      }, delay)
      timers.current.push(timer)
    }

    function step(index: number) {
      if (index >= script.length) {
        schedule(() => {
          dispatch({ type: "reset" })
          step(0)
        }, 2600)
        return
      }

      const message = script[index]
      if (message.from === "bot") {
        schedule(() => {
          dispatch({ type: "typing" })
          schedule(() => {
            dispatch({ type: "reveal" })
            step(index + 1)
          }, 1100)
        }, 500)
        return
      }

      schedule(() => {
        dispatch({ type: "reveal" })
        step(index + 1)
      }, 900)
    }

    step(0)

    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const visible = script.slice(0, state.count)

  return (
    <div
      className="rounded-[1.75rem] bg-card p-5 shadow-[0_30px_70px_-45px_rgba(16,26,44,0.35)] ring-1 ring-border/40"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Concierge IA</p>
          <p className="mt-1 text-xs text-muted-foreground">Pergunte sobre sua viagem</p>
        </div>
      </div>

      <div className="mt-4 flex h-52 flex-col justify-end gap-2 overflow-hidden" aria-live="polite">
        {visible.map((message, index) =>
          message.from === "user" ? (
            <div key={index} className="chat-msg-in ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2.5">
              <p className="text-xs leading-relaxed text-foreground">{message.text}</p>
            </div>
          ) : (
            <div
              key={index}
              className="chat-msg-in mr-auto max-w-[88%] rounded-2xl rounded-tl-sm bg-secondary/70 px-3.5 py-2.5 ring-1 ring-border/40"
            >
              <p className="text-xs leading-relaxed text-foreground">{message.text}</p>
            </div>
          ),
        )}

        {state.typing ? (
          <div className="chat-msg-in mr-auto flex items-center gap-1 rounded-2xl rounded-tl-sm bg-secondary/70 px-3.5 py-3 ring-1 ring-border/40">
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
            <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
