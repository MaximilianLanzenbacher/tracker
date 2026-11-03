// Tage werden als lokale Schlüssel "YYYY-MM-DD" gespeichert.
// Gerechnet wird immer mit 12:00 Uhr, damit Zeitumstellungen keinen Tag verschieben.

export type DayKey = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fromKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function todayKey(): DayKey {
  return toKey(new Date())
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromKey(key)
  date.setDate(date.getDate() + days)
  return toKey(date)
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000)
}

/** Montag der Woche, in der der Tag liegt. */
export function startOfWeek(key: DayKey): DayKey {
  const weekday = (fromKey(key).getDay() + 6) % 7
  return addDays(key, -weekday)
}

const longFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const shortFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
const dayMonthFmt = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' })
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long' })
const weekdayShortFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

/** "Heute", "Gestern" oder der Wochentag. */
export function relativeDayName(key: DayKey, today = todayKey()): string {
  const diff = daysBetween(key, today)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Gestern'
  return weekdayFmt.format(fromKey(key))
}

export const formatLong = (key: DayKey) => longFmt.format(fromKey(key))
export const formatShort = (key: DayKey) => shortFmt.format(fromKey(key))
export const formatDayMonth = (key: DayKey) => dayMonthFmt.format(fromKey(key))
export const formatWeekdayShort = (key: DayKey) => weekdayShortFmt.format(fromKey(key)).replace('.', '')

// ---------- Monate ("YYYY-MM") ----------

export type MonthKey = string

export const monthOf = (key: DayKey): MonthKey => key.slice(0, 7)

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1, 12)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
export const formatMonth = (month: MonthKey) => monthFmt.format(fromKey(`${month}-01`))
