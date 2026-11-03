import type { Nutrients } from './nutrition'
import { round1 } from './nutrition'

// Open Food Facts: freie Lebensmitteldatenbank, keine Anmeldung nötig.
const FIELDS = [
  'product_name',
  'product_name_de',
  'generic_name_de',
  'brands',
  'nutriments',
  'serving_quantity',
  'image_front_small_url',
].join(',')

export interface ProductDraft {
  barcode?: string
  name: string
  brand?: string
  per100: Nutrients
  servingGrams?: number
  imageUrl?: string
  /** true, wenn Name oder Nährwerte fehlen und ergänzt werden sollten. */
  incomplete: boolean
}

export type LookupResult =
  | { status: 'found'; draft: ProductDraft }
  | { status: 'not-found'; barcode: string }
  | { status: 'error'; barcode: string; message: string }

export interface OffProduct {
  product_name?: string
  product_name_de?: string
  generic_name_de?: string
  brands?: string
  nutriments?: Record<string, number | string | undefined>
  serving_quantity?: number | string
  image_front_small_url?: string
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

export function mapOffProduct(barcode: string, p: OffProduct): ProductDraft {
  const n = p.nutriments ?? {}
  const kj = num(n['energy-kj_100g']) ?? num(n['energy_100g'])
  const kcal = num(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined)
  const protein = num(n['proteins_100g'])
  const carbs = num(n['carbohydrates_100g'])
  const fat = num(n['fat_100g'])

  const name = (p.product_name_de || p.product_name || p.generic_name_de || '').trim()
  const brand = p.brands?.split(',')[0]?.trim() || undefined
  const serving = num(p.serving_quantity)

  return {
    barcode,
    name,
    brand,
    per100: {
      kcal: Math.round(kcal ?? 0),
      protein: round1(protein ?? 0),
      carbs: round1(carbs ?? 0),
      fat: round1(fat ?? 0),
    },
    servingGrams: serving && serving > 0 ? Math.round(serving) : undefined,
    imageUrl: p.image_front_small_url,
    incomplete:
      !name || kcal === undefined || protein === undefined || carbs === undefined || fat === undefined,
  }
}

/** Volltextsuche, liefert nur Produkte mit vollständigen Nährwerten. */
export async function searchOff(query: string, signal?: AbortSignal): Promise<ProductDraft[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '24',
    lc: 'de',
    fields: `code,${FIELDS}`,
  })
  const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { signal })
  if (!res.ok) throw new Error('Open Food Facts ist gerade nicht erreichbar.')
  const data = (await res.json()) as { products?: (OffProduct & { code?: string })[] }
  return (data.products ?? [])
    .map((p) => mapOffProduct(p.code ?? '', p))
    .filter((d) => !d.incomplete)
}

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<LookupResult> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`
  try {
    const res = await fetch(url, { signal })
    if (res.status === 404) return { status: 'not-found', barcode }
    if (!res.ok) return { status: 'error', barcode, message: 'Open Food Facts ist gerade nicht erreichbar.' }
    const data = (await res.json()) as { status?: number; product?: OffProduct }
    if (data.status !== 1 || !data.product) return { status: 'not-found', barcode }
    return { status: 'found', draft: mapOffProduct(barcode, data.product) }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return {
      status: 'error',
      barcode,
      message: navigator.onLine
        ? 'Open Food Facts ist gerade nicht erreichbar.'
        : 'Du bist offline. Trag die Werte manuell ein.',
    }
  }
}
