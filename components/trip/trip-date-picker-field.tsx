"use client"

import { Calendar as CalendarIcon } from "lucide-react"
import { ptBR } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/components/ui/use-mobile"
import { cn } from "@/lib/utils"
import { formatDateForDisplay, formatDateFromDate, parseTripDateToDate } from "@/lib/trip-date"

type TripDatePickerFieldProps = {
  label: string
  value: string
  placeholder?: string
  minValue?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
  className?: string
  labelClassName?: string
  iconClassName?: string
  popoverClassName?: string
}

export function TripDatePickerField(props: TripDatePickerFieldProps) {
  const isMobile = useIsMobile()
  const selectedDate = parseTripDateToDate(props.value)
  const minDate = parseTripDateToDate(props.minValue)

  return (
    <div className="space-y-2">
      <Label className={cn("flex items-center gap-2 text-sm font-medium", props.labelClassName)}>
        <CalendarIcon size={14} className={cn("text-primary", props.iconClassName)} />
        {props.label}
      </Label>
      <Popover open={props.open} onOpenChange={props.onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-xl border border-border/60 bg-card/70 px-4 text-left text-sm text-foreground shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              props.className
            )}
          >
            <span className={cn(!props.value && "text-muted-foreground")}>
              {formatDateForDisplay(props.value) || props.placeholder || "DD/MM/AAAA"}
            </span>
            <CalendarIcon size={16} className="shrink-0 text-primary" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={8}
          className={cn(
            isMobile
              ? "z-[120] w-[min(22rem,calc(100vw-2rem))] min-w-[18rem] max-w-[calc(100vw-2rem)] max-h-[min(68vh,34rem)] overflow-y-auto rounded-[24px] border border-border/60 bg-card/98 p-0 shadow-2xl backdrop-blur"
              : "z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-card/95 p-0 shadow-2xl backdrop-blur",
            props.popoverClassName
          )}
        >
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selectedDate}
            defaultMonth={selectedDate ?? minDate ?? new Date()}
            disabled={minDate ? { before: minDate } : undefined}
            className={cn("w-full", isMobile && "p-4")}
            onSelect={(date) => {
              const nextValue = formatDateFromDate(date)
              if (!nextValue) return
              props.onSelect(nextValue)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
