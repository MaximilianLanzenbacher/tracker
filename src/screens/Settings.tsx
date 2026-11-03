import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { todayKey } from '../lib/dates'
import { db, DEFAULT_SETTINGS, exportData, importData, updateSettings, type Backup } from '../lib/db'
import { fmtInt, fmtKg, parseNumber, round1 } from '../lib/nutrition'
import { ChevronLeft } from '../ui/icons'
import { useToast } from '../ui/Toast'

export function Settings({ onBack }: { onBack: () => void }) {
  // undefined nur, solange die Datenbank lädt
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? DEFAULT_SETTINGS, [])
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ kcal: '', protein: '', carbs: '', fat: '', target: '' })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded || settings === undefined) return
    setForm({
      kcal: String(settings.goalKcal),
      protein: String(settings.goalProtein),
      carbs: String(settings.goalCarbs),
      fat: String(settings.goalFat),
      target: settings.targetWeight !== undefined ? fmtKg(settings.targetWeight) : '',
    })
    setLoaded(true)
  }, [settings, loaded])

  const n = (s: string) => parseNumber(s)
  const kcal = n(form.kcal)
  const macroKcal = Math.round((n(form.protein) || 0) * 4 + (n(form.carbs) || 0) * 4 + (n(form.fat) || 0) * 9)
  const target = form.target.trim() ? n(form.target) : undefined
  const valid =
    Number.isFinite(kcal) &&
    kcal >= 500 &&
    kcal <= 10000 &&
    [form.protein, form.carbs, form.fat].every((v) => Number.isFinite(n(v)) && n(v) >= 0) &&
    (target === undefined || (Number.isFinite(target) && target >= 20 && target <= 400))

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    await updateSettings({
      goalKcal: Math.round(kcal),
      goalProtein: Math.round(n(form.protein)),
      goalCarbs: Math.round(n(form.carbs)),
      goalFat: Math.round(n(form.fat)),
      targetWeight: target === undefined ? undefined : round1(target),
    })
    toast('Ziele gesichert')
  }

  const doExport = async () => {
    const data = await exportData()
    const file = new File([JSON.stringify(data, null, 1)], `teller-sicherung-${todayKey()}.json`, {
      type: 'application/json',
    })
    // Auf dem iPhone öffnet das Teilen-Menü, dort lässt sich die Datei in „Dateien“ sichern.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Teller-Sicherung' })
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const doImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup
      const count = data.entries?.length ?? 0
      if (!window.confirm(`Sicherung mit ${count} Einträgen laden? Deine aktuellen Daten werden dabei ersetzt.`)) return
      await importData(data)
      setLoaded(false)
      toast('Sicherung geladen')
    } catch (err) {
      toast(err instanceof SyntaxError ? 'Diese Datei lässt sich nicht lesen.' : (err as Error).message)
    }
  }

  return (
    <main className="screen">
      <button type="button" className="back-btn" onClick={onBack}>
        <ChevronLeft size={22} />
        Zurück
      </button>
      <header className="screen-head">
        <h1 className="large-title">Ziele</h1>
      </header>

      <form onSubmit={save}>
        <section className="group" style={{ marginTop: 0 }}>
          <div className="group-head">
            <h2 className="group-title">Pro Tag</h2>
          </div>
          <div className="form-grid">
            <Num label="Kalorien (kcal)" value={form.kcal} onChange={set('kcal')} wide />
            <Num label="Eiweiß (g)" value={form.protein} onChange={set('protein')} />
            <Num label="Kohlenhydrate (g)" value={form.carbs} onChange={set('carbs')} />
            <Num label="Fett (g)" value={form.fat} onChange={set('fat')} />
          </div>
          {Number.isFinite(kcal) && macroKcal > 0 && Math.abs(macroKcal - kcal) > 50 && (
            <p className="hint-text">
              Deine Makros ergeben zusammen <span className="num">{fmtInt(macroKcal)}</span> kcal, also{' '}
              {macroKcal > kcal ? 'mehr' : 'weniger'} als dein Kalorienziel.
            </p>
          )}
        </section>

        <section className="group">
          <div className="group-head">
            <h2 className="group-title">Gewicht</h2>
          </div>
          <Num label="Zielgewicht in kg (optional)" value={form.target} onChange={set('target')} />
        </section>

        <button type="submit" className="btn" style={{ marginTop: 20 }} disabled={!valid}>
          Ziele sichern
        </button>
      </form>

      <section className="group">
        <div className="group-head">
          <h2 className="group-title">Deine Daten</h2>
        </div>
        <p className="hint-text" style={{ marginTop: 0 }}>
          Alles bleibt auf diesem iPhone. Sichere deine Daten ab und zu als Datei, zum Beispiel in iCloud Drive.
        </p>
        <div className="list">
          <button type="button" className="row-action" onClick={doExport}>
            Daten sichern
          </button>
          <button type="button" className="row-action" style={{ borderTop: '0.5px solid var(--line)' }} onClick={() => fileRef.current?.click()}>
            Sicherung laden
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void doImport(file)
          }}
        />
      </section>

      <section className="group">
        <div className="group-head">
          <h2 className="group-title">Als App installieren</h2>
        </div>
        <p className="hint-text" style={{ marginTop: 0 }}>
          Öffne Teller in Safari, tippe auf das Teilen-Symbol und wähle „Zum Home-Bildschirm“. Danach startet Teller wie eine
          App, im Vollbild und auch ohne Internet.
        </p>
        <p className="hint-text faint">
          Nährwerte stammen von Open Food Facts (openfoodfacts.org), einer freien Datenbank unter der Open Database License.
        </p>
      </section>
    </main>
  )
}

function Num({
  label,
  value,
  onChange,
  wide,
}: {
  label: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  wide?: boolean
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}</span>
      <input className="input num" inputMode="decimal" value={value} onChange={onChange} />
    </label>
  )
}
