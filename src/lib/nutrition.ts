export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/** Rechnet Werte pro 100 g auf eine Menge in Gramm um. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100
  return {
    kcal: Math.round(per100.kcal * f),
    protein: round1(per100.protein * f),
    carbs: round1(per100.carbs * f),
    fat: round1(per100.fat * f),
  }
}

/** Gegenrichtung: Gesamtwerte einer Portion auf 100 g umrechnen. */
export function toPer100(total: Nutrients, grams: number): Nutrients {
  if (grams <= 0) return { ...ZERO }
  const f = 100 / grams
  return {
    kcal: round1(total.kcal * f),
    protein: round1(total.protein * f),
    carbs: round1(total.carbs * f),
    fat: round1(total.fat * f),
  }
}

export function sum(items: Nutrients[]): Nutrients {
  const total = items.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      carbs: acc.carbs + n.carbs,
      fat: acc.fat + n.fat,
    }),
    { ...ZERO },
  )
  return {
    kcal: Math.round(total.kcal),
    protein: round1(total.protein),
    carbs: round1(total.carbs),
    fat: round1(total.fat),
  }
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

const intFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
const oneFmt = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const kgFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const fmtInt = (n: number) => intFmt.format(n)
export const fmt1 = (n: number) => oneFmt.format(n)
export const fmtKg = (n: number) => kgFmt.format(n)

/** Liest deutsche Eingaben wie "12,5" ein. Leer oder ungültig ergibt NaN. */
export function parseNumber(input: string): number {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return NaN
  return Number(cleaned)
}
