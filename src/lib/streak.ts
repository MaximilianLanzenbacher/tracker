import { addDays, type DayKey } from './dates'

export interface StreakInfo {
  /** Tage in Folge bis heute bzw. bis gestern, solange heute noch läuft. */
  current: number
  /** Längste Serie, die sich aus den vorhandenen Einträgen ergibt. */
  longest: number
  trackedToday: boolean
}

/**
 * Ein Tag zählt, sobald es mindestens einen Eintrag gibt.
 * Ist heute noch nichts eingetragen, bleibt die Serie bis gestern bestehen.
 */
export function computeStreak(trackedDays: Iterable<DayKey>, today: DayKey): StreakInfo {
  const days = new Set([...trackedDays].filter((d) => d <= today))
  const trackedToday = days.has(today)

  let current = 0
  let cursor = trackedToday ? today : addDays(today, -1)
  while (days.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  let longest = 0
  let run = 0
  let prev: DayKey | null = null
  for (const day of [...days].sort()) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = day
  }

  return { current, longest, trackedToday }
}
