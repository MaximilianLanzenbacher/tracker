import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  daysInMonth,
  formatLong,
  formatMonth,
  monthOf,
  startOfWeek,
  type DayKey,
  type MonthKey,
} from '../lib/dates'
import { useDayTotals, useSettings } from '../lib/db'
import { fmtInt } from '../lib/nutrition'
import { ChevronLeft, ChevronRight } from './icons'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Monatsansicht: Punkte zeigen, an welchen Tagen etwas eingetragen ist. */
export function MonthCalendar({
  selected,
  today,
  onSelect,
}: {
  selected: DayKey
  today: DayKey
  onSelect: (d: DayKey) => void
}) {
  const [month, setMonth] = useState<MonthKey>(monthOf(selected))
  const [direction, setDirection] = useState(0)
  const settings = useSettings()

  const first = `${month}-01`
  const last = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
  const totals = useDayTotals(first, last)

  const cells = useMemo(() => {
    const start = startOfWeek(first)
    const out: DayKey[] = []
    for (let d = start; d <= last || out.length % 7 !== 0; d = addDays(d, 1)) out.push(d)
    return out
  }, [first, last])

  const tracked = totals ? [...totals.keys()].filter((d) => d <= today) : []
  const overCount = totals ? [...totals.values()].filter((k) => k > settings.goalKcal).length : 0
  const canNext = month < monthOf(today)

  const shift = (n: number) => {
    setDirection(n)
    setMonth((m) => addMonths(m, n))
  }

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Vorheriger Monat">
          <ChevronLeft size={22} />
        </button>
        <h3 className="cal-title" aria-live="polite">
          {formatMonth(month)}
        </h3>
        <button
          type="button"
          className="icon-btn"
          onClick={() => shift(1)}
          disabled={!canNext}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="cal-grid cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="cal-viewport">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={month}
            className="cal-grid"
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onPanEnd={(_, info) => {
              if (Math.abs(info.offset.x) < 50) return
              if (info.offset.x > 0) shift(-1)
              else if (canNext) shift(1)
            }}
          >
            {cells.map((d) => {
              const inMonth = monthOf(d) === month
              const future = d > today
              const kcal = totals?.get(d)
              const state = kcal === undefined ? '' : kcal > settings.goalKcal ? 'over' : 'ok'
              const label = `${formatLong(d)}${kcal !== undefined ? `, ${fmtInt(kcal)} kcal` : ', kein Eintrag'}`
              return (
                <button
                  key={d}
                  type="button"
                  className={`cal-day ${inMonth ? '' : 'outside'} ${d === today ? 'today' : ''}`}
                  aria-pressed={d === selected}
                  aria-label={label}
                  disabled={future}
                  onClick={() => onSelect(d)}
                >
                  <span className="num">{Number(d.slice(8))}</span>
                  {state && inMonth && <i className={`cal-dot ${state}`} />}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="cal-foot">
        <span>
          An <span className="num">{tracked.length}</span> {tracked.length === 1 ? 'Tag' : 'Tagen'} eingetragen
        </span>
        <span className="cal-legend">
          <i className="cal-dot ok" /> im Ziel
          {overCount > 0 && (
            <>
              <i className="cal-dot over" style={{ marginLeft: 10 }} /> darüber
            </>
          )}
        </span>
      </div>
    </div>
  )
}
