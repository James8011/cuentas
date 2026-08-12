import { format, isValid, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/** Formats API dates (`YYYY-MM-DD` or ISO) for display in es-CO. */
export function formatDate(
  value: string | null | undefined,
  pattern = "d 'de' MMMM 'de' yyyy",
): string {
  if (!value) return '—'
  const parsed = parseISO(value.length <= 10 ? `${value}T12:00:00` : value)
  if (!isValid(parsed)) return value
  return format(parsed, pattern, { locale: es })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = parseISO(value)
  if (!isValid(parsed)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /T00:00:00/.test(value)) {
    return formatDate(value)
  }
  return format(parsed, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })
}

export function dayOfMonthFromDate(value: string | null | undefined): number {
  if (!value) return 1
  const parsed = parseISO(value.length <= 10 ? `${value}T12:00:00` : value)
  if (!isValid(parsed)) return 1
  return parsed.getDate()
}

/** Monday=1 … Sunday=7 */
export function weekdayFromDate(value: string | null | undefined): number {
  if (!value) return 1
  const parsed = parseISO(value.length <= 10 ? `${value}T12:00:00` : value)
  if (!isValid(parsed)) return 1
  const js = parsed.getDay() // Sun=0 … Sat=6
  return js === 0 ? 7 : js
}

/** Día 1–15 de la quincena a partir de una fecha ancla. */
export function quincenaDayFromDate(value: string | null | undefined): number {
  const day = dayOfMonthFromDate(value)
  return day <= 15 ? day : Math.min(15, day - 15)
}

export const WEEKDAY_OPTIONS: [string, string][] = [
  ['1', 'Lunes'],
  ['2', 'Martes'],
  ['3', 'Miércoles'],
  ['4', 'Jueves'],
  ['5', 'Viernes'],
  ['6', 'Sábado'],
  ['7', 'Domingo'],
]

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_OPTIONS.find(([value]) => Number(value) === weekday)?.[1] ?? `Día ${weekday}`
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfToday(from: Date) {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate())
}

/**
 * Next calendar date for a recurring day-of-month (1–31).
 * Days beyond the month length clamp to the last day of that month.
 */
export function nextDateForDayOfMonth(day: number, from = new Date()): string {
  const safeDay = Math.min(31, Math.max(1, Math.trunc(day)))
  const year = from.getFullYear()
  const month = from.getMonth()
  const today = startOfToday(from)

  const build = (y: number, m: number) => {
    const clamped = Math.min(safeDay, daysInMonth(y, m))
    return new Date(y, m, clamped)
  }

  let candidate = build(year, month)
  if (candidate < today) {
    const next = month + 1
    candidate = build(year + Math.floor(next / 12), next % 12)
  }
  return toDateString(candidate)
}

/**
 * Next date for a weekday (Monday=1 … Sunday=7), on or after `from`.
 */
export function nextDateForWeekday(weekday: number, from = new Date()): string {
  const safe = Math.min(7, Math.max(1, Math.trunc(weekday)))
  const today = startOfToday(from)
  const jsTarget = safe === 7 ? 0 : safe // convert to JS getDay
  const candidate = new Date(today)
  const delta = (jsTarget - candidate.getDay() + 7) % 7
  candidate.setDate(candidate.getDate() + delta)
  return toDateString(candidate)
}

/**
 * Quincenal (Colombia): día D (1–15) ocurre dos veces al mes:
 * - día D (primera quincena)
 * - día min(D+15, último del mes) (segunda quincena)
 */
export function nextDateForQuincenaDay(day: number, from = new Date()): string {
  const safeDay = Math.min(15, Math.max(1, Math.trunc(day)))
  const today = startOfToday(from)
  const year = today.getFullYear()
  const month = today.getMonth()

  const first = new Date(year, month, Math.min(safeDay, daysInMonth(year, month)))
  const secondDay = Math.min(safeDay + 15, daysInMonth(year, month))
  const second = new Date(year, month, secondDay)

  if (first >= today) return toDateString(first)
  if (second >= today) return toDateString(second)

  const nextMonth = month + 1
  const y = year + Math.floor(nextMonth / 12)
  const m = nextMonth % 12
  return toDateString(new Date(y, m, Math.min(safeDay, daysInMonth(y, m))))
}

/** Human label for a scheduled recurrence anchor date. */
export function scheduleAnchorLabel(
  frequency: string,
  date: string | null | undefined,
): string {
  if (frequency === 'monthly') {
    return `Día ${dayOfMonthFromDate(date)} de cada mes`
  }
  if (frequency === 'weekly') {
    return `Cada ${weekdayLabel(weekdayFromDate(date)).toLowerCase()}`
  }
  if (frequency === 'biweekly') {
    const day = quincenaDayFromDate(date)
    return `Día ${day} de cada quincena (${day} y ${Math.min(day + 15, 31)})`
  }
  return formatDate(date)
}
