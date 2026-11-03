import { useEffect, useState, type FormEvent } from 'react'
import { todayKey, type DayKey } from '../lib/dates'
import { db, deleteWeight, saveWeight, type Weight } from '../lib/db'
import { fmtKg, parseNumber, round1 } from '../lib/nutrition'
import { Sheet } from '../ui/motion'
import { useToast } from '../ui/Toast'

export function WeightSheet({
  open,
  editing,
  lastKg,
  onClose,
}: {
  open: boolean
  editing: Weight | null
  lastKg?: number
  onClose: () => void
}) {
  const toast = useToast()
  const today = todayKey()
  const [kgText, setKgText] = useState('')
  const [date, setDate] = useState<DayKey>(today)
  const [existing, setExisting] = useState<Weight | undefined>()

  useEffect(() => {
    if (!open) return
    setDate(editing?.date ?? today)
    const kg = editing?.kg ?? lastKg
    setKgText(kg !== undefined ? fmtKg(kg) : '')
  }, [open, editing, lastKg, today])

  // Hinweis, wenn für den Tag schon ein Wert existiert.
  useEffect(() => {
    if (!open) return
    db.weights.where('date').equals(date).first().then(setExisting)
  }, [open, date])

  const kg = parseNumber(kgText)
  const valid = Number.isFinite(kg) && kg >= 20 && kg <= 400 && date <= today

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    if (editing && editing.date !== date && editing.id !== undefined) await deleteWeight(editing.id)
    await saveWeight(date, round1(kg))
    toast(`${fmtKg(round1(kg))} kg gesichert`)
    onClose()
  }

  const remove = async () => {
    if (editing?.id === undefined) return
    await deleteWeight(editing.id)
    toast('Messung gelöscht', { label: 'Rückgängig', run: () => void saveWeight(editing.date, editing.kg) })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Messung bearbeiten' : 'Gewicht eintragen'}>
      <form className="stack" onSubmit={submit}>
        <label className="portion-input weight-input">
          <input
            className="num"
            inputMode="decimal"
            value={kgText}
            placeholder="0,0"
            onChange={(e) => setKgText(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Gewicht in Kilogramm"
            autoFocus
          />
          <span>kg</span>
        </label>

        <label className="field">
          <span className="field-label">Datum</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
        </label>

        {existing && existing.id !== editing?.id && (
          <p className="notice">
            Für diesen Tag hast du schon <span className="num">{fmtKg(existing.kg)}</span> kg eingetragen. Der neue
            Wert ersetzt ihn.
          </p>
        )}

        <button type="submit" className="btn" disabled={!valid}>
          Gewicht sichern
        </button>
        {editing && (
          <button type="button" className="btn btn-danger" onClick={remove}>
            Messung löschen
          </button>
        )}
      </form>
    </Sheet>
  )
}
