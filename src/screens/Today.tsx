import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { addDays, formatLong, relativeDayName, todayKey, type DayKey } from '../lib/dates'
import {
  deleteEntry,
  MEALS,
  restoreEntry,
  useEntries,
  useSettings,
  useStreak,
  type Entry,
  type Meal,
} from '../lib/db'
import { fmt1, fmtInt, sum } from '../lib/nutrition'
import { CalendarIcon, ChevronLeft, ChevronRight, FlameIcon, GearIcon, PlusIcon } from '../ui/icons'
import { MonthCalendar } from '../ui/MonthCalendar'
import { AnimatedNumber, Bar, Ring, Sheet, SwipeRow } from '../ui/motion'
import { useToast } from '../ui/Toast'

const MACROS = [
  { key: 'protein', label: 'Eiweiß', color: 'var(--protein)', goal: 'goalProtein' },
  { key: 'carbs', label: 'Kohlenhydrate', color: 'var(--carbs)', goal: 'goalCarbs' },
  { key: 'fat', label: 'Fett', color: 'var(--fat)', goal: 'goalFat' },
] as const

export function Today({
  date,
  onDateChange,
  onAdd,
  onEdit,
  onOpenSettings,
  onOpenProgress,
}: {
  date: DayKey
  onDateChange: (d: DayKey) => void
  onAdd: (meal?: Meal) => void
  onEdit: (entry: Entry) => void
  onOpenSettings: () => void
  onOpenProgress: () => void
}) {
  const today = todayKey()
  const entries = useEntries(date)
  const settings = useSettings()
  const streak = useStreak()
  const toast = useToast()
  const [direction, setDirection] = useState(0)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const totals = useMemo(() => sum(entries ?? []), [entries])
  const byMeal = useMemo(() => {
    const map = new Map<Meal, Entry[]>(MEALS.map((m) => [m.id, []]))
    for (const e of entries ?? []) map.get(e.meal)!.push(e)
    return map
  }, [entries])

  const go = (days: number) => {
    const next = addDays(date, days)
    if (next > today) return
    setDirection(days)
    onDateChange(next)
  }

  const remove = async (entry: Entry) => {
    await deleteEntry(entry.id!)
    toast(`${entry.name} entfernt`, { label: 'Rückgängig', run: () => void restoreEntry(entry) })
  }

  const remaining = settings.goalKcal - totals.kcal
  const over = remaining < 0
  const isToday = date === today

  return (
    <main className="screen">
      <header className="screen-head">
        <button
          type="button"
          className="title-btn"
          onClick={() => setCalendarOpen(true)}
          aria-label={`${formatLong(date)}. Kalender öffnen`}
        >
          <h1 className="large-title">{relativeDayName(date, today)}</h1>
          <p className="subtitle">{formatLong(date)}</p>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className={`streak-chip ${streak.current === 0 ? 'off' : ''}`}
            onClick={onOpenProgress}
            aria-label={`Serie: ${streak.current} Tage in Folge`}
          >
            <FlameIcon size={18} filled={streak.current > 0} />
            <span className="num">{streak.current}</span>
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Ziele und Einstellungen">
            <GearIcon size={22} />
          </button>
        </div>
      </header>

      <div className="day-nav">
        <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Vorheriger Tag">
          <ChevronLeft size={22} />
        </button>
        <div className="day-nav-mid">
          <button type="button" className="pill-btn" onClick={() => setCalendarOpen(true)}>
            <CalendarIcon size={18} />
            Kalender
          </button>
          {!isToday && (
            <button
              type="button"
              className="pill-btn accent"
              onClick={() => {
                setDirection(1)
                onDateChange(today)
              }}
            >
              Zu heute
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => go(1)}
          disabled={isToday}
          aria-label="Nächster Tag"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {entries && (
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={date}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 60 : d < 0 ? -60 : 0, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d > 0 ? -60 : d < 0 ? 60 : 0, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.section
              className="summary"
              aria-label="Tagesübersicht"
              onPanEnd={(_, info) => {
                if (Math.abs(info.offset.x) < 60 || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return
                go(info.offset.x > 0 ? -1 : 1)
              }}
            >
              <div className="summary-top">
                <Ring
                  progress={settings.goalKcal > 0 ? totals.kcal / settings.goalKcal : 0}
                  color={over ? 'var(--warn)' : 'var(--accent)'}
                >
                  <span className="ring-pct num">
                    {settings.goalKcal > 0 ? `${fmtInt(Math.round((totals.kcal / settings.goalKcal) * 100))} %` : ''}
                  </span>
                </Ring>
                <div className="summary-figures">
                  <AnimatedNumber value={Math.abs(remaining)} className="big-number" />
                  <div className={`big-label ${over ? 'over' : ''}`}>{over ? 'kcal über dem Ziel' : 'kcal übrig'}</div>
                  <div className="small-line">
                    <span className="num">{fmtInt(totals.kcal)}</span> von{' '}
                    <span className="num">{fmtInt(settings.goalKcal)}</span> gegessen
                  </div>
                </div>
              </div>

              <div className="macros">
                {MACROS.map((m) => {
                  const value = totals[m.key]
                  const goal = settings[m.goal]
                  return (
                    <div key={m.key}>
                      <div className="macro-head">
                        <span className="macro-name">
                          <span className="macro-dot" style={{ background: m.color }} />
                          {m.label}
                        </span>
                        <span className="muted">
                          <span className="num" style={{ color: 'var(--ink)', fontWeight: 600 }}>
                            {fmt1(value)}
                          </span>{' '}
                          / <span className="num">{fmtInt(goal)}</span> g
                        </span>
                      </div>
                      <Bar progress={goal > 0 ? value / goal : 0} color={m.color} />
                    </div>
                  )
                })}
              </div>

              {isToday && !streak.trackedToday && streak.current > 0 && (
                <p className="hint">
                  <FlameIcon size={16} />
                  <span>
                    Trag heute noch etwas ein, damit deine Serie von {streak.current}{' '}
                    {streak.current === 1 ? 'Tag' : 'Tagen'} weiterläuft.
                  </span>
                </p>
              )}
            </motion.section>

            {MEALS.map((meal) => {
              const list = byMeal.get(meal.id)!
              const kcal = list.reduce((s, e) => s + e.kcal, 0)
              return (
                <section className="group" key={meal.id} aria-label={meal.label}>
                  <div className="group-head">
                    <h2 className="group-title">{meal.label}</h2>
                    {kcal > 0 && (
                      <span className="group-meta">
                        <span className="num">{fmtInt(kcal)}</span> kcal
                      </span>
                    )}
                  </div>
                  <div className="list">
                    <AnimatePresence initial={false}>
                      {list.map((e) => (
                        <SwipeRow
                          key={e.id}
                          label={`${e.name}, ${e.grams} g, ${e.kcal} kcal. Tippen zum Bearbeiten`}
                          onTap={() => onEdit(e)}
                          onDelete={() => void remove(e)}
                        >
                          <span className="row-main">
                            <span className="row-title" style={{ display: 'block' }}>
                              {e.name}
                            </span>
                            <span className="row-sub" style={{ display: 'block' }}>
                              <span className="num">{fmtInt(e.grams)}</span> g
                              {e.brand ? `, ${e.brand}` : ''}
                            </span>
                          </span>
                          <span className="row-value num">{fmtInt(e.kcal)}</span>
                        </SwipeRow>
                      ))}
                    </AnimatePresence>
                    <button type="button" className="row-action" onClick={() => onAdd(meal.id)}>
                      <PlusIcon size={20} />
                      Hinzufügen
                    </button>
                  </div>
                </section>
              )
            })}
          </motion.div>
        </AnimatePresence>
      )}

      <Sheet open={calendarOpen} onClose={() => setCalendarOpen(false)} title="Tag auswählen">
        <MonthCalendar
          selected={date}
          today={today}
          onSelect={(d) => {
            setDirection(d < date ? -1 : 1)
            onDateChange(d)
            setCalendarOpen(false)
          }}
        />
      </Sheet>
    </main>
  )
}
