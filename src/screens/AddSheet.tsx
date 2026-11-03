import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { DayKey } from '../lib/dates'
import {
  addEntry,
  db,
  deleteEntry,
  MEAL_SHORT,
  mealForNow,
  restoreEntry,
  saveProduct,
  updateEntry,
  type Entry,
  type Meal,
  type Product,
} from '../lib/db'
import { lookupBarcode, searchOff, type ProductDraft } from '../lib/off'
import { fmt1, fmtInt, parseNumber, round1, scale, toPer100 } from '../lib/nutrition'
import { SearchIcon, StarIcon } from '../ui/icons'
import { AnimatedNumber, Segmented, Sheet } from '../ui/motion'
import { useToast } from '../ui/Toast'

// Der Scanner samt WebAssembly wird erst geladen, wenn er gebraucht wird.
const Scanner = lazy(() => import('../scanner/Scanner').then((m) => ({ default: m.Scanner })))

type Mode = 'scan' | 'search' | 'manual'

type View =
  | { kind: 'pick' }
  | { kind: 'portion'; product: Product }
  | { kind: 'manual'; draft?: ProductDraft; notice?: string }
  | { kind: 'edit'; entry: Entry; product: Product }

const ADD_LABEL: Record<Meal, string> = {
  breakfast: 'Zum Frühstück hinzufügen',
  lunch: 'Zum Mittagessen hinzufügen',
  dinner: 'Zum Abendessen hinzufügen',
  snack: 'Zu den Snacks hinzufügen',
}

const MEAL_OPTIONS = (Object.keys(MEAL_SHORT) as Meal[]).map((m) => ({ value: m, label: MEAL_SHORT[m] }))

function draftToProduct(d: ProductDraft): Product {
  return {
    barcode: d.barcode || undefined,
    name: d.name,
    brand: d.brand,
    per100: d.per100,
    servingGrams: d.servingGrams,
    imageUrl: d.imageUrl,
    source: 'off',
    favorite: 0,
    lastUsedAt: 0,
    useCount: 0,
  }
}

/** Ein gelöschtes Produkt wird aus dem Eintrag zurückgerechnet. */
function productFromEntry(e: Entry): Product {
  const g = e.grams || 100
  return {
    id: e.productId,
    name: e.name,
    brand: e.brand,
    per100: toPer100(e, g),
    source: 'manual',
    favorite: 0,
    lastUsedAt: 0,
    useCount: 0,
  }
}

export function AddSheet({
  open,
  date,
  initialMeal,
  editing,
  onClose,
}: {
  open: boolean
  date: DayKey
  initialMeal?: Meal
  editing: Entry | null
  onClose: () => void
}) {
  const [meal, setMeal] = useState<Meal>('breakfast')
  const [mode, setMode] = useState<Mode>('scan')
  const [view, setView] = useState<View>({ kind: 'pick' })

  useEffect(() => {
    if (!open) return
    setMeal(editing?.meal ?? initialMeal ?? mealForNow())
    setMode('scan')
    if (editing) {
      db.products.get(editing.productId).then((p) => {
        setView({ kind: 'edit', entry: editing, product: p ?? productFromEntry(editing) })
      })
    } else {
      setView({ kind: 'pick' })
    }
  }, [open, editing, initialMeal])

  const title =
    view.kind === 'edit'
      ? 'Eintrag bearbeiten'
      : view.kind === 'portion'
        ? 'Menge wählen'
        : view.kind === 'manual'
          ? 'Selbst eintragen'
          : 'Essen eintragen'

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <Segmented label="Mahlzeit" value={meal} options={MEAL_OPTIONS} onChange={setMeal} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view.kind}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.18 }}
            className="stack"
          >
            {view.kind === 'pick' && (
              <>
                <Segmented
                  label="Art der Eingabe"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'scan', label: 'Scannen' },
                    { value: 'search', label: 'Suchen' },
                    { value: 'manual', label: 'Manuell' },
                  ]}
                />
                {mode === 'scan' && (
                  <ScanPane
                    onPick={(product) => setView({ kind: 'portion', product })}
                    onManual={(draft, notice) => setView({ kind: 'manual', draft, notice })}
                  />
                )}
                {mode === 'search' && <SearchPane onPick={(product) => setView({ kind: 'portion', product })} />}
                {mode === 'manual' && <ManualForm meal={meal} date={date} onDone={onClose} />}
              </>
            )}

            {view.kind === 'manual' && (
              <ManualForm meal={meal} date={date} draft={view.draft} notice={view.notice} onDone={onClose} />
            )}

            {(view.kind === 'portion' || view.kind === 'edit') && (
              <PortionView
                product={view.product}
                entry={view.kind === 'edit' ? view.entry : undefined}
                meal={meal}
                date={date}
                onBack={view.kind === 'portion' ? () => setView({ kind: 'pick' }) : undefined}
                onDone={onClose}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Sheet>
  )
}

// ---------- Scannen ----------

function ScanPane({
  onPick,
  onManual,
}: {
  onPick: (p: Product) => void
  onManual: (draft: ProductDraft, notice: string) => void
}) {
  const [status, setStatus] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string; code: string }>({
    kind: 'idle',
  })
  const [typed, setTyped] = useState('')
  const [attempt, setAttempt] = useState(0)

  const handleCode = async (code: string) => {
    setStatus({ kind: 'loading' })
    const local = await db.products.where('barcode').equals(code).first()
    if (local) return onPick(local)

    const res = await lookupBarcode(code)
    if (res.status === 'found' && !res.draft.incomplete) return onPick(draftToProduct(res.draft))
    if (res.status === 'found') {
      return onManual(res.draft, 'Open Food Facts kennt das Produkt, aber nicht alle Nährwerte. Ergänze sie von der Verpackung.')
    }
    if (res.status === 'not-found') {
      return onManual(
        { barcode: code, name: '', per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, incomplete: true },
        'Dieses Produkt ist noch nicht in der Datenbank. Trag die Werte von der Verpackung ein, beim nächsten Scan kennt Teller es.',
      )
    }
    setStatus({ kind: 'error', message: res.message, code })
  }

  return (
    <>
      {status.kind === 'error' ? (
        <div className="notice">
          <p style={{ margin: 0 }}>{status.message}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => handleCode(status.code)}>
              Nochmal versuchen
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onManual(
                  { barcode: status.code, name: '', per100: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, incomplete: true },
                  'Trag die Werte von der Verpackung ein.',
                )
              }
            >
              Manuell eintragen
            </button>
          </div>
        </div>
      ) : status.kind === 'loading' ? (
        <div className="scanner scanner-loading">
          <span className="spinner" aria-hidden="true" />
          <p className="scanner-caption">Suche Nährwerte …</p>
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="scanner scanner-loading">
              <span className="spinner" aria-hidden="true" />
            </div>
          }
        >
          <Scanner key={attempt} onDetect={handleCode} />
        </Suspense>
      )}

      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          const code = typed.replace(/\D/g, '')
          if (code.length >= 8) {
            setAttempt((a) => a + 1)
            void handleCode(code)
          }
        }}
      >
        <label className="visually-hidden" htmlFor="barcode-input">
          Barcode eintippen
        </label>
        <input
          id="barcode-input"
          className="input"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Barcode eintippen"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
        <button type="submit" className="btn btn-inline" disabled={typed.replace(/\D/g, '').length < 8}>
          Suchen
        </button>
      </form>
    </>
  )
}

// ---------- Suchen ----------

function SearchPane({ onPick }: { onPick: (p: Product) => void }) {
  const [query, setQuery] = useState('')
  const [online, setOnline] = useState<{ state: 'idle' | 'loading' | 'done' | 'error'; results: ProductDraft[]; q: string }>({
    state: 'idle',
    results: [],
    q: '',
  })
  const q = query.trim().toLowerCase()

  const local = useLiveQuery(async () => {
    const all = await db.products.orderBy('lastUsedAt').reverse().toArray()
    if (!q) {
      const favs = all.filter((p) => p.favorite === 1)
      const recent = all.filter((p) => p.favorite !== 1 && p.lastUsedAt > 0).slice(0, 20)
      return { favs, recent }
    }
    const hits = all.filter((p) => `${p.name} ${p.brand ?? ''}`.toLowerCase().includes(q))
    return { favs: [], recent: hits }
  }, [q])

  const runOnline = async () => {
    setOnline({ state: 'loading', results: [], q: query.trim() })
    try {
      const results = await searchOff(query.trim())
      setOnline({ state: 'done', results, q: query.trim() })
    } catch {
      setOnline({ state: 'error', results: [], q: query.trim() })
    }
  }

  return (
    <>
      <div className="search-field">
        <SearchIcon size={18} />
        <input
          className="input"
          type="search"
          placeholder="Produkt oder Marke"
          aria-label="Produkt suchen"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && q.length >= 2 && runOnline()}
        />
      </div>

      {local && !q && local.favs.length === 0 && local.recent.length === 0 && (
        <p className="empty">
          Hier erscheinen deine Favoriten und zuletzt gegessenen Produkte. Such nach einem Produkt, um online in Open
          Food Facts zu suchen.
        </p>
      )}

      {local && local.favs.length > 0 && <ProductList title="Favoriten" products={local.favs} onPick={onPick} />}
      {local && local.recent.length > 0 && (
        <ProductList title={q ? 'Deine Produkte' : 'Zuletzt gegessen'} products={local.recent} onPick={onPick} />
      )}

      {q.length >= 2 && online.q !== query.trim() && (
        <button type="button" className="btn btn-secondary" onClick={runOnline}>
          Online nach „{query.trim()}“ suchen
        </button>
      )}
      {online.state === 'loading' && <p className="empty">Suche in Open Food Facts …</p>}
      {online.state === 'error' && <p className="empty">Die Suche hat nicht geklappt. Prüf deine Verbindung.</p>}
      {online.state === 'done' && online.q === query.trim() && (
        online.results.length > 0 ? (
          <ProductList
            title="Open Food Facts"
            products={online.results.map(draftToProduct)}
            onPick={async (p) => {
              // Bereits bekannte Barcodes nicht doppelt anlegen.
              const known = p.barcode ? await db.products.where('barcode').equals(p.barcode).first() : undefined
              onPick(known ?? p)
            }}
          />
        ) : (
          <p className="empty">Nichts gefunden. Probier einen anderen Begriff oder trag es manuell ein.</p>
        )
      )}
    </>
  )
}

function ProductList({ title, products, onPick }: { title: string; products: Product[]; onPick: (p: Product) => void }) {
  return (
    <section>
      <h3 className="list-title">{title}</h3>
      <div className="list">
        {products.map((p, i) => (
          <button key={p.id ?? `${p.barcode}-${i}`} type="button" className="row" onClick={() => onPick(p)}>
            <span className="row-main">
              <span className="row-title" style={{ display: 'block' }}>
                {p.name}
              </span>
              <span className="row-sub" style={{ display: 'block' }}>
                {p.brand ? `${p.brand}, ` : ''}
                <span className="num">{fmtInt(p.per100.kcal)}</span> kcal je 100 g
              </span>
            </span>
            {p.favorite === 1 && <StarIcon size={16} filled style={{ color: 'var(--carbs)' }} />}
          </button>
        ))}
      </div>
    </section>
  )
}

// ---------- Menge wählen / bearbeiten ----------

function PortionView({
  product,
  entry,
  meal,
  date,
  onBack,
  onDone,
}: {
  product: Product
  entry?: Entry
  meal: Meal
  date: DayKey
  onBack?: () => void
  onDone: () => void
}) {
  const toast = useToast()
  const [gramsText, setGramsText] = useState(String(entry?.grams ?? product.servingGrams ?? 100))
  const [favorite, setFavorite] = useState(product.favorite === 1)
  const [busy, setBusy] = useState(false)
  const grams = parseNumber(gramsText)
  const valid = Number.isFinite(grams) && grams > 0 && grams < 10000
  const values = scale(product.per100, valid ? grams : 0)

  const chips = useMemo(() => {
    const list: { label: string; grams: number }[] = []
    if (product.servingGrams) list.push({ label: `1 Portion, ${fmtInt(product.servingGrams)} g`, grams: product.servingGrams })
    for (const g of [50, 100, 150, 200]) if (g !== product.servingGrams) list.push({ label: `${g} g`, grams: g })
    return list
  }, [product.servingGrams])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      const g = round1(grams)
      if (entry) {
        await updateEntry(entry, g, meal)
        if (product.id !== undefined && (product.favorite === 1) !== favorite) {
          await db.products.update(product.id, { favorite: favorite ? 1 : 0 })
        }
        toast('Änderungen gesichert')
      } else {
        const { id, favorite: _f, lastUsedAt: _l, useCount: _u, ...input } = product
        const productId = await saveProduct({ ...input, favorite }, id)
        const saved = (await db.products.get(productId))!
        await addEntry(saved, g, meal, date)
        toast(`${saved.name} eingetragen`)
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!entry?.id) return
    await deleteEntry(entry.id)
    toast(`${entry.name} entfernt`, { label: 'Rückgängig', run: () => void restoreEntry(entry) })
    onDone()
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="product-head">
        {product.imageUrl && <img className="product-img" src={product.imageUrl} alt="" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="product-name">{product.name}</div>
          <div className="row-sub">
            {product.brand ? `${product.brand}, ` : ''}
            <span className="num">{fmtInt(product.per100.kcal)}</span> kcal je 100 g
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={favorite}
          aria-label={favorite ? 'Aus Favoriten entfernen' : 'Als Favorit merken'}
          onClick={() => setFavorite((f) => !f)}
          style={{ color: favorite ? 'var(--carbs)' : 'var(--ink-3)' }}
        >
          <motion.span
            key={String(favorite)}
            initial={{ scale: favorite ? 0.6 : 1 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}
            style={{ display: 'grid' }}
          >
            <StarIcon size={24} filled={favorite} />
          </motion.span>
        </button>
      </div>

      <div className="portion">
        <label className="portion-input">
          <input
            className="num"
            inputMode="decimal"
            value={gramsText}
            onChange={(e) => setGramsText(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Menge in Gramm"
          />
          <span>g</span>
        </label>
        <div className="portion-kcal">
          <AnimatedNumber value={values.kcal} className="portion-kcal-num" />
          <span className="muted">kcal</span>
        </div>
      </div>

      <div className="chips" role="group" aria-label="Schnellauswahl Menge">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            className="chip"
            aria-pressed={valid && grams === c.grams}
            onClick={() => setGramsText(String(c.grams))}
          >
            {c.label}
          </button>
        ))}
      </div>

      <dl className="macro-table">
        <div>
          <dt>
            <span className="macro-dot" style={{ background: 'var(--protein)' }} /> Eiweiß
          </dt>
          <dd className="num">{fmt1(values.protein)} g</dd>
        </div>
        <div>
          <dt>
            <span className="macro-dot" style={{ background: 'var(--carbs)' }} /> Kohlenhydrate
          </dt>
          <dd className="num">{fmt1(values.carbs)} g</dd>
        </div>
        <div>
          <dt>
            <span className="macro-dot" style={{ background: 'var(--fat)' }} /> Fett
          </dt>
          <dd className="num">{fmt1(values.fat)} g</dd>
        </div>
      </dl>

      <button type="submit" className="btn" disabled={!valid || busy}>
        {entry ? 'Änderungen sichern' : ADD_LABEL[meal]}
      </button>
      {entry && (
        <button type="button" className="btn btn-danger" onClick={remove}>
          Eintrag löschen
        </button>
      )}
      {onBack && (
        <button type="button" className="link-btn" onClick={onBack}>
          Anderes Produkt wählen
        </button>
      )}
    </form>
  )
}

// ---------- Manuell ----------

function ManualForm({
  meal,
  date,
  draft,
  notice,
  onDone,
}: {
  meal: Meal
  date: DayKey
  draft?: ProductDraft
  notice?: string
  onDone: () => void
}) {
  const toast = useToast()
  const show = (n?: number) => (n ? String(n).replace('.', ',') : '')
  const [name, setName] = useState(draft?.name ?? '')
  const [brand, setBrand] = useState(draft?.brand ?? '')
  const [basis, setBasis] = useState<'per100' | 'total'>('per100')
  const [kcal, setKcal] = useState(show(draft?.per100.kcal))
  const [protein, setProtein] = useState(show(draft?.per100.protein))
  const [carbs, setCarbs] = useState(show(draft?.per100.carbs))
  const [fat, setFat] = useState(show(draft?.per100.fat))
  const [grams, setGrams] = useState(String(draft?.servingGrams ?? 100))
  const [favorite, setFavorite] = useState(false)
  const [tried, setTried] = useState(false)

  const g = parseNumber(grams)
  const k = parseNumber(kcal)
  const opt = (s: string) => {
    const n = parseNumber(s)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  const errors = {
    name: !name.trim(),
    kcal: !Number.isFinite(k) || k < 0,
    grams: !Number.isFinite(g) || g <= 0,
  }
  const hasError = errors.name || errors.kcal || errors.grams

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (hasError) return
    const values = { kcal: k, protein: opt(protein), carbs: opt(carbs), fat: opt(fat) }
    const per100 = basis === 'per100' ? values : toPer100(values, g)
    const productId = await saveProduct({
      barcode: draft?.barcode || undefined,
      name: name.trim(),
      brand: brand.trim() || undefined,
      per100,
      servingGrams: basis === 'total' || g !== 100 ? round1(g) : draft?.servingGrams,
      imageUrl: draft?.imageUrl,
      source: 'manual',
      favorite,
    })
    const product = (await db.products.get(productId))!
    await addEntry(product, round1(g), meal, date)
    toast(`${product.name} eingetragen`)
    onDone()
  }

  const per = basis === 'per100' ? 'je 100 g' : 'gesamt'

  return (
    <form className="stack" onSubmit={submit} noValidate>
      {notice && <p className="notice">{notice}</p>}
      {draft?.barcode && (
        <p className="faint" style={{ margin: '-4px 4px 0', fontSize: 13 }}>
          Barcode <span className="num">{draft.barcode}</span>
        </p>
      )}

      <Field label="Name" error={tried && errors.name ? 'Gib dem Produkt einen Namen.' : undefined}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Apfel" />
      </Field>
      <Field label="Marke (optional)">
        <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
      </Field>

      <Segmented
        label="Bezug der Nährwerte"
        value={basis}
        onChange={setBasis}
        options={[
          { value: 'per100', label: 'Werte je 100 g' },
          { value: 'total', label: 'Werte für die Menge' },
        ]}
      />

      <div className="form-grid">
        <Field label={`Kalorien (kcal) ${per}`} error={tried && errors.kcal ? 'Kalorien fehlen.' : undefined} wide>
          <input className="input num" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        </Field>
        <Field label="Eiweiß (g)">
          <input className="input num" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </Field>
        <Field label="Kohlenhydrate (g)">
          <input className="input num" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </Field>
        <Field label="Fett (g)">
          <input className="input num" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
        </Field>
        <Field label="Gegessene Menge (g)" error={tried && errors.grams ? 'Menge fehlt.' : undefined}>
          <input className="input num" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
        </Field>
      </div>

      <label className="check-row">
        <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        Als Favorit merken
      </label>

      <button type="submit" className="btn">
        {ADD_LABEL[meal]}
      </button>
    </form>
  )
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string
  error?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''} ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  )
}
