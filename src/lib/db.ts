import Dexie, { type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import type { DayKey } from './dates'
import { todayKey } from './dates'
import type { Nutrients } from './nutrition'
import { scale } from './nutrition'
import { computeStreak } from './streak'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'lunch', label: 'Mittagessen' },
  { id: 'dinner', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' },
]

export const MEAL_SHORT: Record<Meal, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abend',
  snack: 'Snack',
}

/** Mahlzeit, die zur aktuellen Uhrzeit am wahrscheinlichsten passt. */
export function mealForNow(date = new Date()): Meal {
  const h = date.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 17) return 'snack'
  if (h < 22) return 'dinner'
  return 'snack'
}

export interface Product {
  id?: number
  barcode?: string
  name: string
  brand?: string
  /** Nährwerte pro 100 g */
  per100: Nutrients
  servingGrams?: number
  imageUrl?: string
  source: 'off' | 'manual'
  /** 1 = Favorit (als Zahl, damit es indexiert werden kann) */
  favorite: 0 | 1
  lastUsedAt: number
  useCount: number
}

export interface Entry extends Nutrients {
  id?: number
  date: DayKey
  meal: Meal
  productId: number
  /** Kopie von Name und Marke, damit alte Einträge stabil bleiben */
  name: string
  brand?: string
  grams: number
  createdAt: number
}

export interface Weight {
  id?: number
  date: DayKey
  kg: number
}

export interface Settings {
  id: 'main'
  goalKcal: number
  goalProtein: number
  goalCarbs: number
  goalFat: number
  targetWeight?: number
  longestStreak: number
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  goalKcal: 2000,
  goalProtein: 120,
  goalCarbs: 220,
  goalFat: 70,
  longestStreak: 0,
}

// Interner Name aus der ersten Version. Er bleibt, damit vorhandene Daten erhalten bleiben.
export const db = new Dexie('teller') as Dexie & {
  products: EntityTable<Product, 'id'>
  entries: EntityTable<Entry, 'id'>
  weights: EntityTable<Weight, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  products: '++id, barcode, name, favorite, lastUsedAt',
  entries: '++id, date, productId',
  weights: '++id, &date',
  settings: 'id',
})

// ---------- Hooks ----------

export function useSettings(): Settings {
  const stored = useLiveQuery(() => db.settings.get('main'), [])
  return stored ?? DEFAULT_SETTINGS
}

export function useEntries(date: DayKey): Entry[] | undefined {
  return useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date])
}

/** Kalorien pro Tag im Zeitraum (beide Grenzen inklusive). Tage ohne Eintrag fehlen. */
export function useDayTotals(from: DayKey, to: DayKey): Map<DayKey, number> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<DayKey, number>()
    await db.entries
      .where('date')
      .between(from, to, true, true)
      .each((e) => map.set(e.date, (map.get(e.date) ?? 0) + e.kcal))
    return map
  }, [from, to])
}

/** Alle Messungen, älteste zuerst. */
export function useWeights(): Weight[] | undefined {
  return useLiveQuery(() => db.weights.orderBy('date').toArray(), [])
}

/** Alle Tage mit mindestens einem Eintrag. */
export function useTrackedDays(): Set<DayKey> | undefined {
  const keys = useLiveQuery(() => db.entries.orderBy('date').uniqueKeys(), [])
  return useMemo(() => (keys ? new Set(keys as DayKey[]) : undefined), [keys])
}

/** Aktuelle und längste Serie. Ein neuer Rekord wird dauerhaft gespeichert. */
export function useStreak() {
  const days = useTrackedDays()
  const settings = useSettings()
  const today = todayKey()
  const info = useMemo(() => computeStreak(days ?? [], today), [days, today])
  const longest = Math.max(info.longest, settings.longestStreak)

  useEffect(() => {
    if (days && info.longest > settings.longestStreak) {
      void updateSettings({ longestStreak: info.longest })
    }
  }, [days, info.longest, settings.longestStreak])

  return { ...info, longest, ready: days !== undefined }
}

// ---------- Schreiben ----------

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>) {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get('main')) ?? DEFAULT_SETTINGS
    await db.settings.put({ ...current, ...patch, id: 'main' })
  })
}

export type ProductInput = Omit<Product, 'id' | 'favorite' | 'lastUsedAt' | 'useCount'> & {
  favorite?: boolean
}

/** Legt ein Produkt an oder aktualisiert ein vorhandenes mit gleichem Barcode. */
export async function saveProduct(input: ProductInput, existingId?: number): Promise<number> {
  return db.transaction('rw', db.products, async () => {
    const match =
      existingId !== undefined
        ? await db.products.get(existingId)
        : input.barcode
          ? await db.products.where('barcode').equals(input.barcode).first()
          : undefined
    const { favorite, ...rest } = input
    if (match?.id !== undefined) {
      await db.products.update(match.id, {
        ...rest,
        favorite: favorite === undefined ? match.favorite : favorite ? 1 : 0,
      })
      return match.id
    }
    return (await db.products.add({
      ...rest,
      favorite: favorite ? 1 : 0,
      lastUsedAt: 0,
      useCount: 0,
    })) as number
  })
}

export async function setFavorite(productId: number, favorite: boolean) {
  await db.products.update(productId, { favorite: favorite ? 1 : 0 })
}

export async function addEntry(product: Product, grams: number, meal: Meal, date: DayKey) {
  if (product.id === undefined) throw new Error('Produkt ohne ID')
  const values = scale(product.per100, grams)
  await db.transaction('rw', db.entries, db.products, async () => {
    await db.entries.add({
      ...values,
      date,
      meal,
      grams,
      productId: product.id!,
      name: product.name,
      brand: product.brand,
      createdAt: Date.now(),
    })
    await db.products.update(product.id!, {
      lastUsedAt: Date.now(),
      useCount: (product.useCount ?? 0) + 1,
    })
  })
}

export async function updateEntry(entry: Entry, grams: number, meal: Meal) {
  if (entry.id === undefined) return
  const product = await db.products.get(entry.productId)
  // Ohne Produkt (gelöscht) rechnen wir aus den gespeicherten Werten zurück.
  const per100 = product?.per100 ?? {
    kcal: (entry.kcal / entry.grams) * 100,
    protein: (entry.protein / entry.grams) * 100,
    carbs: (entry.carbs / entry.grams) * 100,
    fat: (entry.fat / entry.grams) * 100,
  }
  await db.entries.update(entry.id, { ...scale(per100, grams), grams, meal })
}

export async function deleteEntry(id: number) {
  await db.entries.delete(id)
}

export async function restoreEntry(entry: Entry) {
  await db.entries.add(entry)
}

export async function saveWeight(date: DayKey, kg: number) {
  await db.transaction('rw', db.weights, async () => {
    const existing = await db.weights.where('date').equals(date).first()
    if (existing?.id !== undefined) await db.weights.update(existing.id, { kg })
    else await db.weights.add({ date, kg })
  })
}

export async function deleteWeight(id: number) {
  await db.weights.delete(id)
}

// ---------- Sicherung ----------

export interface Backup {
  /** Kennung der Sicherungsdatei, bleibt für alte Sicherungen gleich */
  app: 'teller'
  version: 1
  exportedAt: string
  products: Product[]
  entries: Entry[]
  weights: Weight[]
  settings: Settings[]
}

export async function exportData(): Promise<Backup> {
  const [products, entries, weights, settings] = await Promise.all([
    db.products.toArray(),
    db.entries.toArray(),
    db.weights.toArray(),
    db.settings.toArray(),
  ])
  return { app: 'teller', version: 1, exportedAt: new Date().toISOString(), products, entries, weights, settings }
}

export async function importData(data: Backup) {
  if (data?.app !== 'teller' || !Array.isArray(data.entries)) {
    throw new Error('Diese Datei ist keine Tracker-Sicherung.')
  }
  await db.transaction('rw', [db.products, db.entries, db.weights, db.settings], async () => {
    await Promise.all([db.products.clear(), db.entries.clear(), db.weights.clear(), db.settings.clear()])
    await db.products.bulkAdd(data.products ?? [])
    await db.entries.bulkAdd(data.entries)
    await db.weights.bulkAdd(data.weights ?? [])
    await db.settings.bulkAdd(data.settings ?? [])
  })
}
