const TRIP_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function getUtcDateParts(value: string) {
  const [yearText, monthText, dayText] = value.split("-")
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  return { year, month, day }
}

export function isValidTripDate(value?: string | null) {
  if (!value || !TRIP_DATE_PATTERN.test(value)) return false

  const parts = getUtcDateParts(value)
  if (!parts) return false

  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  return (
    utcDate.getUTCFullYear() === parts.year &&
    utcDate.getUTCMonth() === parts.month - 1 &&
    utcDate.getUTCDate() === parts.day
  )
}

export function formatDateForInput(value?: string | null) {
  return isValidTripDate(value) ? value ?? "" : ""
}

export function formatDateForDisplay(value?: string | null) {
  if (!isValidTripDate(value)) return ""

  const safeValue = value ?? ""
  const parts = getUtcDateParts(safeValue)
  if (!parts) return ""

  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`
}

export function calculateTripDays(startDate?: string | null, endDate?: string | null) {
  if (!isValidTripDate(startDate) || !isValidTripDate(endDate)) return null

  const startParts = getUtcDateParts(startDate ?? "")
  const endParts = getUtcDateParts(endDate ?? "")
  if (!startParts || !endParts) return null

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day)
  if (endUtc < startUtc) return null

  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1
}

export function parseTripDateToDate(value?: string | null) {
  if (!isValidTripDate(value)) return undefined

  const parts = getUtcDateParts(value ?? "")
  if (!parts) return undefined

  return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)
}

export function formatDateFromDate(value?: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return ""

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
