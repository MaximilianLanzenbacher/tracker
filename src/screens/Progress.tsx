import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { CalorieBars } from '../charts/CalorieBars'
import { WeightChart } from '../charts/WeightChart'
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatShort,
  relativeDayName,
  startOfWeek,
  todayKey,
  type DayKey,
} from '../lib/dates'
import { deleteWeight, saveWeight, useDayTotals, useSettings, useStreak, useTrackedDays, useWeights, type Weight } from '../lib/db'
import { fmtInt, fmtKg, round1 } from '../lib/nutrition'
import { FlameIcon, GearIcon, PlusIcon } from '../ui/icons'
import { AnimatedNumber, Segmented, SwipeRow } from '../ui/motion'
import { useToast } from '../ui/Toast'
import { WeightSheet } from './WeightSheet'

type Range = '30' | '90' | 'all'

const WEEKS = 6

export function Progress({ onOpenDay, onOpenSettings }: { onOpenDay: (d: DayKey) => void; onOpenSettings: () => void }) {
  const today = todayKey()
  const settings = useSettings()
  const streak = useStreak()
  const tracked = useTrackedDays()
  const weights = useWeights()
  const toast = useToast()
  const [range, setRange] = useState<Range>('90')
  const [weightSheet, setWeightSheet] = useState<{ editing: Weight | null } | null>(null)

  // ---- Kalorien ----
  const weekStart = addDays(today, -6)
  const listStart = addDays(today, -29)
  const totals = useDayTotals(listStart, today)
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((date) => ({ date, kcal: totals?.get(date) ?? 0 })),
    [totals, weekStart],
  )
  const trackedWeek = week.filter((d) => d.kcal > 0)
  const avg = trackedWeek.length ? Math.round(trackedWeek.reduce((s, d) => s + d.kcal, 0) / trackedWeek.length) : 0
  const recentDays = useMemo(
    () => (totals ? [...totals.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14) : []),
    [totals],
  )

  // ---- Serie: die letzten Wochen als Raster ----
  const gridStart = addDays(startOfWeek(today), -(WEEKS - 1) * 7)
  const grid = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i))

  // ---- Gewicht ----
  const shown = useMemo(() => {
    if (!weights) return []
    if (range === 'all') return weights
    const from = addDays(today, -Number(range))
    return weights.filter((w) => w.date >= from)
  }, [weights, range, today])
  const latest = weights?.[weights.length - 1]
  const firstW = weights?.[0]
  const monthAgo = weights?.filter((w) => daysBetween(w.date, today) >= 30).pop()

  return (
    <main className="screen">
      <header className="screen-head">
        <h1 className="large-title">Fortschritt</h1>
        <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Ziele und Einstellungen">
          <GearIcon size={22} />
        </button>
      </header>

      {/* Serie */}
      <section className="card" aria-labelledby="streak-title">
        <h2 id="streak-title" className="visually-hidden">
          Serie
        </h2>
        <div className="streak-row">
          <div className="streak-main">
            <FlameIcon size={30} filled={streak.current > 0} style={{ color: streak.current > 0 ? 'var(--streak)' : 'var(--ink-3)' }} />
            <div>
              <AnimatedNumber value={streak.current} className="streak-num" />
              <div className="muted streak-label">{streak.current === 1 ? 'Tag in Folge' : 'Tage in Folge'}</div>
            </div>
          </div>
          <div className="streak-record">
            <div className="num record-num">{fmtInt(streak.longest)}</div>
            <div className="muted streak-label">Längste Serie</div>
          </div>
        </div>

        <div className="streak-grid" aria-label={`Getrackte Tage der letzten ${WEEKS} Wochen`}>
          {['M', 'D', 'M', 'D', 'F', 'S', 'S'].map((w, i) => (
            <span key={i} className="streak-wd" aria-hidden="true">
              {w}
            </span>
          ))}
          {grid.map((d) => (
            <span
              key={d}
              className={`streak-cell ${tracked?.has(d) ? 'on' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}`}
              title={formatShort(d)}
            />
          ))}
        </div>

        <p className="streak-note">
          {streak.current === 0
            ? 'Trag heute etwas ein, um eine neue Serie zu starten.'
            : streak.trackedToday
              ? streak.current >= streak.longest
                ? 'Das ist deine bisher längste Serie.'
                : `Noch ${streak.longest - streak.current + 1} ${streak.longest - streak.current + 1 === 1 ? 'Tag' : 'Tage'} bis zum neuen Rekord.`
              : 'Heute noch nichts eingetragen. Bis Mitternacht läuft die Serie weiter.'}
        </p>
      </section>

      {/* Gewicht */}
      <section className="group" aria-labelledby="weight-title">
        <div className="group-head">
          <h2 id="weight-title" className="group-title">
            Gewicht
          </h2>
          <button type="button" className="text-btn" onClick={() => setWeightSheet({ editing: null })}>
            <PlusIcon size={18} />
            Eintragen
          </button>
        </div>

        {weights && weights.length === 0 ? (
          <div className="card empty-card">
            <p>Trag dein Gewicht ein, wenn du dich wiegst. Hier siehst du dann, wie es sich entwickelt.</p>
            <button type="button" className="btn" onClick={() => setWeightSheet({ editing: null })}>
              Gewicht eintragen
            </button>
          </div>
        ) : (
          latest && (
            <div className="card">
              <div className="weight-figures">
                <div>
                  <span className="num weight-now">{fmtKg(latest.kg)}</span>
                  <span className="weight-unit"> kg</span>
                  <div className="muted" style={{ fontSize: 14 }}>
                    {relativeDayName(latest.date, today) === 'Heute' ? 'heute' : `am ${formatDayMonth(latest.date)}`}
                  </div>
                </div>
                <div className="weight-deltas">
                  {firstW && firstW !== latest && <Delta label="seit Start" value={latest.kg - firstW.kg} target={settings.targetWeight} start={firstW.kg} />}
                  {monthAgo && <Delta label="in 30 Tagen" value={latest.kg - monthAgo.kg} target={settings.targetWeight} start={monthAgo.kg} />}
                  {settings.targetWeight !== undefined && (
                    <div className="delta">
                      <span className="num">{fmtKg(Math.abs(latest.kg - settings.targetWeight))} kg</span>
                      <span className="muted"> bis zum Ziel</span>
                    </div>
                  )}
                </div>
              </div>

              <Segmented
                label="Zeitraum"
                value={range}
                onChange={setRange}
                options={[
                  { value: '30', label: '1 Monat' },
                  { value: '90', label: '3 Monate' },
                  { value: 'all', label: 'Alles' },
                ]}
              />
              {shown.length > 0 ? (
                <WeightChart points={shown} target={settings.targetWeight} />
              ) : (
                <p className="empty">In diesem Zeitraum gibt es keine Messung.</p>
              )}
            </div>
          )
        )}

        {weights && weights.length > 0 && (
          <div className="list" style={{ marginTop: 12 }}>
            <AnimatePresence initial={false}>
              {[...weights]
                .reverse()
                .slice(0, 8)
                .map((w, i, arr) => {
                  const prev = arr[i + 1]
                  const diff = prev ? round1(w.kg - prev.kg) : null
                  return (
                    <SwipeRow
                      key={w.id}
                      label={`${formatShort(w.date)}, ${fmtKg(w.kg)} kg. Tippen zum Bearbeiten`}
                      onTap={() => setWeightSheet({ editing: w })}
                      onDelete={async () => {
                        await deleteWeight(w.id!)
                        toast('Messung gelöscht', { label: 'Rückgängig', run: () => void saveWeight(w.date, w.kg) })
                      }}
                    >
                      <span className="row-main">
                        <span className="row-title" style={{ display: 'block' }}>
                          {formatShort(w.date)}
                        </span>
                      </span>
                      {diff !== null && diff !== 0 && (
                        <span className="row-sub num">
                          {diff > 0 ? '+' : '−'}
                          {fmtKg(Math.abs(diff))}
                        </span>
                      )}
                      <span className="row-value num">{fmtKg(w.kg)} kg</span>
                    </SwipeRow>
                  )
                })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Kalorien */}
      <section className="group" aria-labelledby="kcal-title">
        <div className="group-head">
          <h2 id="kcal-title" className="group-title">
            Kalorien
          </h2>
          {avg > 0 && (
            <span className="group-meta">
              Schnitt <span className="num">{fmtInt(avg)}</span> kcal
            </span>
          )}
        </div>
        <div className="card">
          <CalorieBars days={week} goal={settings.goalKcal} today={today} onSelect={onOpenDay} />
        </div>

        {recentDays.length > 0 && (
          <div className="list" style={{ marginTop: 12 }}>
            {recentDays.map(([date, kcal]) => {
              const diff = kcal - settings.goalKcal
              return (
                <button key={date} type="button" className="row" onClick={() => onOpenDay(date)}>
                  <span className="row-main">
                    <span className="row-title" style={{ display: 'block' }}>
                      {daysBetween(date, today) < 2 ? relativeDayName(date, today) : formatShort(date)}
                    </span>
                    <span className="row-sub" style={{ display: 'block', color: diff > 0 ? 'var(--warn)' : undefined }}>
                      {diff > 0 ? (
                        <>
                          <span className="num">{fmtInt(diff)}</span> kcal über dem Ziel
                        </>
                      ) : (
                        <>
                          <span className="num">{fmtInt(-diff)}</span> kcal unter dem Ziel
                        </>
                      )}
                    </span>
                  </span>
                  <span className="row-value num">{fmtInt(kcal)}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <WeightSheet
        open={weightSheet !== null}
        editing={weightSheet?.editing ?? null}
        lastKg={latest?.kg}
        onClose={() => setWeightSheet(null)}
      />
    </main>
  )
}

/** Veränderung, eingefärbt danach, ob sie Richtung Ziel geht. */
function Delta({ label, value, target, start }: { label: string; value: number; target?: number; start: number }) {
  const v = round1(value)
  const towardsGoal = target === undefined ? null : Math.sign(target - start) === Math.sign(v) && v !== 0
  return (
    <div className="delta">
      <span className="num" style={{ color: towardsGoal ? 'var(--accent)' : undefined, fontWeight: 600 }}>
        {v > 0 ? '+' : v < 0 ? '−' : '±'}
        {fmtKg(Math.abs(v))} kg
      </span>
      <span className="muted"> {label}</span>
    </div>
  )
}
