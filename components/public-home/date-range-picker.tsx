"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"]
const MONTHS = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
]

function parseIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function toIso(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export function formatRange(start: string | null, end: string | null) {
  if (!start) return null

  const shortFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" })
  const longFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })

  if (!end) {
    return longFormatter.format(parseIso(start))
  }

  return `${shortFormatter.format(parseIso(start))} - ${shortFormatter.format(parseIso(end))}`
}

export function DateRangePicker({
  start,
  end,
  onChange,
  onComplete,
}: {
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
  onComplete?: () => void
}) {
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const initialDate = start ? parseIso(start) : today
  const [view, setView] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))

  const startDate = start ? parseIso(start) : null
  const endDate = end ? parseIso(end) : null

  const days = useMemo(() => {
    const firstDay = new Date(view.getFullYear(), view.getMonth(), 1)
    const offset = firstDay.getDay()
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = []

    for (let index = 0; index < offset; index += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(view.getFullYear(), view.getMonth(), day))
    }

    return cells
  }, [view])

  function isInRange(day: Date) {
    if (!startDate || !endDate) return false
    return day > startDate && day < endDate
  }

  function handlePick(day: Date) {
    if (!startDate || (startDate && endDate)) {
      onChange(toIso(day), null)
      return
    }

    if (day < startDate) {
      onChange(toIso(day), null)
      return
    }

    onChange(toIso(startDate), toIso(day))
    onComplete?.()
  }

  return (
    <div className="w-[19rem] select-none p-1" onPointerDown={(event) => event.stopPropagation()}>
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium capitalize">
          {MONTHS[view.getMonth()]} {view.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Proximo mes"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday, index) => (
          <div key={`${weekday}-${index}`} className="grid h-8 place-items-center text-xs font-medium text-muted-foreground">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} />
          }

          const isStart = startDate ? isSameDay(day, startDate) : false
          const isEnd = endDate ? isSameDay(day, endDate) : false
          const selected = isStart || isEnd
          const between = isInRange(day)
          const isPast = day < today
          const isToday = isSameDay(day, today)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "relative grid h-9 place-items-center",
                between && "bg-brand/12",
                isStart && endDate && "rounded-l-full bg-brand/12",
                isEnd && "rounded-r-full bg-brand/12",
              )}
            >
              <button
                type="button"
                disabled={isPast}
                onClick={() => handlePick(day)}
                className={cn(
                  "grid size-9 place-items-center rounded-full text-sm transition-colors",
                  isPast && "cursor-not-allowed text-muted-foreground/40",
                  !isPast && !selected && "hover:bg-muted",
                  isToday && !selected && "font-semibold text-brand",
                  selected && "bg-foreground font-semibold text-background hover:bg-foreground",
                )}
              >
                {day.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
