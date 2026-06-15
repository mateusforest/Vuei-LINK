"use client"

import { Calendar as CalendarIcon } from "lucide-react"
import { ptBR } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
}

export function TripDatePickerField(props: TripDatePickerFieldProps) {
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
          <Input
            readOnly
            value={formatDateForDisplay(props.value)}
            placeholder={props.placeholder ?? "DD/MM/AAAA"}
            className={cn("cursor-pointer", props.className)}
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selectedDate}
            defaultMonth={selectedDate ?? minDate ?? new Date()}
            disabled={minDate ? { before: minDate } : undefined}
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
