// Beispieldaten für die Entwicklung. Aufruf über ?demo in der Adresse.
import { addDays, todayKey } from './dates'
import { db, type Meal, type Product } from './db'
import { scale } from './nutrition'

const PRODUCTS: Omit<Product, 'id'>[] = [
  { name: 'Haferflocken kernig', brand: 'Kölln', per100: { kcal: 372, protein: 13.5, carbs: 58.7, fat: 7 }, servingGrams: 50, source: 'off', barcode: '4000540000108', favorite: 1, lastUsedAt: 0, useCount: 0 },
  { name: 'Skyr Natur', brand: 'Milbona', per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 }, servingGrams: 150, source: 'off', favorite: 1, lastUsedAt: 0, useCount: 0 },
  { name: 'Banane', per100: { kcal: 93, protein: 1.2, carbs: 20, fat: 0.2 }, servingGrams: 120, source: 'manual', favorite: 0, lastUsedAt: 0, useCount: 0 },
  { name: 'Vollkorn-Spaghetti', brand: 'Barilla', per100: { kcal: 359, protein: 13, carbs: 64, fat: 2.5 }, source: 'off', favorite: 0, lastUsedAt: 0, useCount: 0 },
  { name: 'Hähnchenbrustfilet', per100: { kcal: 105, protein: 23.5, carbs: 0, fat: 1.2 }, source: 'manual', favorite: 1, lastUsedAt: 0, useCount: 0 },
  { name: 'Tomatensauce Basilikum', brand: 'Mutti', per100: { kcal: 52, protein: 1.5, carbs: 7.6, fat: 1.4 }, source: 'off', favorite: 0, lastUsedAt: 0, useCount: 0 },
  { name: 'Nuss-Nougat-Creme', brand: 'Nutella', per100: { kcal: 539, protein: 6.3, carbs: 57.5, fat: 30.9 }, servingGrams: 15, source: 'off', barcode: '3017620422003', favorite: 0, lastUsedAt: 0, useCount: 0 },
  { name: 'Vollkornbrot', brand: 'Mestemacher', per100: { kcal: 198, protein: 5.6, carbs: 34, fat: 1.9 }, servingGrams: 50, source: 'off', favorite: 0, lastUsedAt: 0, useCount: 0 },
]

const DAY_PLAN: [number, number, Meal][] = [
  [0, 60, 'breakfast'],
  [1, 150, 'breakfast'],
  [2, 120, 'snack'],
  [3, 110, 'lunch'],
  [5, 180, 'lunch'],
  [4, 160, 'dinner'],
  [7, 100, 'dinner'],
]

export async function seedDemo() {
  await db.delete()
  await db.open()
  const ids = (await db.products.bulkAdd(PRODUCTS, { allKeys: true })) as number[]
  const today = todayKey()

  // 12 Tage in Folge, davor eine Lücke und eine ältere Serie von 16 Tagen.
  const days: number[] = []
  for (let i = 0; i < 12; i++) days.push(i)
  for (let i = 14; i < 30; i++) days.push(i)

  const entries = days.flatMap((ago) => {
    const date = addDays(today, -ago)
    // Heute: Frühstück und Mittag, damit noch Platz bleibt.
    const plan = ago === 0 ? DAY_PLAN.slice(0, 5) : DAY_PLAN.filter((_, i) => (i + ago) % 5 !== 0)
    return plan.map(([p, grams, meal], i) => {
      const product = PRODUCTS[p]
      const g = Math.round(grams * (0.85 + ((ago * 7 + i * 3) % 10) / 30))
      return {
        ...scale(product.per100, g),
        date,
        meal,
        grams: g,
        productId: ids[p],
        name: product.name,
        brand: product.brand,
        createdAt: Date.now() - ago * 86_400_000 + i * 60_000,
      }
    })
  })
  await db.entries.bulkAdd(entries)

  const weights = []
  for (let ago = 60; ago >= 0; ago -= 2) {
    const trend = 84.6 - (60 - ago) * 0.045
    const noise = Math.sin(ago * 1.7) * 0.35
    weights.push({ date: addDays(today, -ago), kg: Math.round((trend + noise) * 10) / 10 })
  }
  await db.weights.bulkAdd(weights)
  await db.settings.put({
    id: 'main',
    goalKcal: 2100,
    goalProtein: 130,
    goalCarbs: 230,
    goalFat: 70,
    targetWeight: 80,
    longestStreak: 16,
  })
}
