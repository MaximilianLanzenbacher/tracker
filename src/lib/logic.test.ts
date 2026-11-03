import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, startOfWeek } from './dates'
import { parseNumber, scale, sum, toPer100 } from './nutrition'
import { mapOffProduct } from './off'
import { computeStreak } from './streak'

describe('dates', () => {
  it('rechnet über Monats- und Jahreswechsel', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('übersteht die Zeitumstellung', () => {
    // Sommerzeit 2026 beginnt am 29. März, Winterzeit am 25. Oktober
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(daysBetween('2026-03-28', '2026-03-31')).toBe(3)
  })

  it('findet den Montag der Woche', () => {
    expect(startOfWeek('2026-11-03')).toBe('2026-11-02') // Dienstag
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02') // Sonntag
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02')
  })
})

describe('nutrition', () => {
  const oats = { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 }

  it('rechnet auf Gramm um', () => {
    expect(scale(oats, 60)).toEqual({ kcal: 223, protein: 8.1, carbs: 35.2, fat: 4.2 })
    expect(scale(oats, 0)).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })

  it('rechnet Portionswerte auf 100 g zurück', () => {
    expect(toPer100({ kcal: 250, protein: 10, carbs: 30, fat: 5 }, 50)).toEqual({
      kcal: 500,
      protein: 20,
      carbs: 60,
      fat: 10,
    })
  })

  it('summiert ohne Rundungsfehler', () => {
    const total = sum([
      { kcal: 100, protein: 0.1, carbs: 0.2, fat: 0 },
      { kcal: 50, protein: 0.2, carbs: 0.1, fat: 0.3 },
    ])
    expect(total).toEqual({ kcal: 150, protein: 0.3, carbs: 0.3, fat: 0.3 })
  })

  it('liest deutsche Zahlen', () => {
    expect(parseNumber('72,4')).toBe(72.4)
    expect(parseNumber(' 80 ')).toBe(80)
    expect(parseNumber('')).toBeNaN()
    expect(parseNumber('abc')).toBeNaN()
  })
})

describe('streak', () => {
  const today = '2026-11-03'

  it('zählt Tage in Folge bis heute', () => {
    const s = computeStreak(['2026-11-01', '2026-11-02', '2026-11-03'], today)
    expect(s).toEqual({ current: 3, longest: 3, trackedToday: true })
  })

  it('hält die Serie, solange heute noch nichts eingetragen ist', () => {
    const s = computeStreak(['2026-11-01', '2026-11-02'], today)
    expect(s.current).toBe(2)
    expect(s.trackedToday).toBe(false)
  })

  it('beendet die Serie nach einem verpassten Tag', () => {
    const s = computeStreak(['2026-10-30', '2026-10-31', '2026-11-01'], today)
    expect(s.current).toBe(0)
    expect(s.longest).toBe(3)
  })

  it('startet nach einer Lücke wieder bei 1', () => {
    const s = computeStreak(['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-03'], today)
    expect(s.current).toBe(1)
    expect(s.longest).toBe(3)
  })

  it('zählt über den Monatswechsel', () => {
    const s = computeStreak(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03'], today)
    expect(s.current).toBe(5)
  })

  it('ignoriert Einträge in der Zukunft', () => {
    const s = computeStreak(['2026-11-03', '2026-11-04', '2026-11-05'], today)
    expect(s.current).toBe(1)
    expect(s.longest).toBe(1)
  })

  it('kommt ohne Einträge aus', () => {
    expect(computeStreak([], today)).toEqual({ current: 0, longest: 0, trackedToday: false })
  })
})

describe('Open Food Facts', () => {
  it('übernimmt deutsche Namen und Nährwerte', () => {
    const draft = mapOffProduct('3017620422003', {
      product_name: 'Nutella',
      product_name_de: 'Nutella Nuss-Nougat-Creme',
      brands: 'Ferrero, Nutella',
      serving_quantity: '15',
      nutriments: {
        'energy-kcal_100g': 539,
        proteins_100g: 6.3,
        carbohydrates_100g: 57.5,
        fat_100g: 30.9,
      },
    })
    expect(draft).toMatchObject({
      name: 'Nutella Nuss-Nougat-Creme',
      brand: 'Ferrero',
      servingGrams: 15,
      per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 },
      incomplete: false,
    })
  })

  it('rechnet kJ in kcal um, wenn kcal fehlen', () => {
    const draft = mapOffProduct('1', {
      product_name: 'Test',
      nutriments: { 'energy-kj_100g': 1000, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 },
    })
    expect(draft.per100.kcal).toBe(239)
    expect(draft.incomplete).toBe(false)
  })

  it('markiert unvollständige Produkte', () => {
    const draft = mapOffProduct('1', { product_name: 'Nur Name', nutriments: {} })
    expect(draft.incomplete).toBe(true)
    expect(draft.per100.kcal).toBe(0)
  })
})
