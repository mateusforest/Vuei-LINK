"use client"

import { Loader2, MapPin } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { searchDestinationOptions, type DestinationOption } from "@/lib/destinations/catalog"
import { cn } from "@/lib/utils"

const DEBOUNCE_MS = 300
const MIN_CHARS = 2

export function DestinationCombobox({
  value,
  onChange,
  onSelect,
  inputRef,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onSelect?: (destination: DestinationOption) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  placeholder?: string
}) {
  const listboxId = useId()
  const localRef = useRef<HTMLInputElement>(null)
  const ref = inputRef ?? localRef
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DestinationOption[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const query = value.trim()
    if (query.length < MIN_CHARS) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = window.setTimeout(() => {
      setResults(searchDestinationOptions(query, 8))
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [value])

  function updateRect() {
    const element = ref.current
    if (!element) return
    const nextRect = element.getBoundingClientRect()
    setRect({
      left: nextRect.left,
      top: nextRect.bottom + 8,
      width: nextRect.width,
    })
  }

  useLayoutEffect(() => {
    if (!open) return

    updateRect()
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)

    return () => {
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [open, results.length])

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target) || document.getElementById(listboxId)?.contains(target)) {
        return
      }
      setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [listboxId, open])

  function commit(destination: DestinationOption) {
    onChange(destination.label)
    onSelect?.(destination)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : -1))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : -1))
      return
    }

    if (event.key === "Enter") {
      if (open && activeIndex >= 0 && results[activeIndex]) {
        event.preventDefault()
        commit(results[activeIndex])
      }
      return
    }

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
      return
    }

    if (event.key === "Tab") {
      setOpen(false)
    }
  }

  const canShow = value.trim().length >= MIN_CHARS
  const showDropdown = open && canShow
  const showEmpty = showDropdown && !loading && results.length === 0
  const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <input
          ref={ref}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-9 text-[0.95rem] outline-none transition-shadow placeholder:text-muted-foreground/70 focus:border-brand/50 focus:ring-4 focus:ring-brand/10"
        />
        {loading && canShow ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground/70" />
        ) : null}
      </div>

      {mounted && showDropdown && rect
        ? createPortal(
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Sugestoes de destino"
              className="vuei-pop fixed z-50 max-h-64 overflow-auto overscroll-contain rounded-xl border border-border/70 p-1 shadow-xl backdrop-blur-xl"
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                background: "color-mix(in oklch, var(--popover) 94%, transparent)",
              }}
            >
              {loading && results.length === 0 ? (
                <li className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando destinos...
                </li>
              ) : null}

              {showEmpty ? <li className="px-3 py-2.5 text-sm text-muted-foreground">Nenhum destino encontrado</li> : null}

              {results.map((destination, index) => {
                const optionId = `${listboxId}-opt-${index}`
                const selected = index === activeIndex

                return (
                  <li key={destination.id} role="none">
                    <button
                      id={optionId}
                      role="option"
                      aria-selected={selected}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        commit(destination)
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected ? "bg-brand/10" : "hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          selected ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <MapPin className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          <Highlight text={destination.label} query={value} />
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[destination.city, destination.country].filter(Boolean).join(" - ")}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </div>
  )
}

function Highlight({ text, query }: { text: string; query: string }) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return <>{text}</>

  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()

  const normalizedText = normalize(text)
  const normalizedQuery = normalize(trimmedQuery)
  const startIndex = normalizedText.indexOf(normalizedQuery)

  if (startIndex === -1) {
    return <>{text}</>
  }

  return (
    <>
      {text.slice(0, startIndex)}
      <mark className="bg-transparent font-semibold text-brand">
        {text.slice(startIndex, startIndex + trimmedQuery.length)}
      </mark>
      {text.slice(startIndex + trimmedQuery.length)}
    </>
  )
}
