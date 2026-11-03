import { MotionConfig } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { todayKey, type DayKey } from './lib/dates'
import type { Entry, Meal } from './lib/db'
import { AddSheet } from './screens/AddSheet'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { PlateIcon, PlusIcon, TrendIcon } from './ui/icons'
import { ToastProvider } from './ui/Toast'

type Tab = 'today' | 'progress' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [previousTab, setPreviousTab] = useState<Tab>('today')
  const [date, setDate] = useState<DayKey>(todayKey())
  const [adding, setAdding] = useState<{ meal?: Meal } | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  // Bleibt die App über Mitternacht offen, springt „Heute“ beim Zurückkehren auf den neuen Tag.
  const shownToday = useRef(todayKey())
  useEffect(() => {
    const onVisible = () => {
      const now = todayKey()
      if (document.visibilityState !== 'visible' || now === shownToday.current) return
      setDate((d) => (d === shownToday.current ? now : d))
      shownToday.current = now
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const showTab = (t: Tab) => {
    if (t === 'settings') setPreviousTab(tab)
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {tab === 'today' && (
          <Today
            date={date}
            onDateChange={setDate}
            onAdd={(meal) => setAdding({ meal })}
            onEdit={setEditing}
            onOpenSettings={() => showTab('settings')}
            onOpenProgress={() => showTab('progress')}
          />
        )}
        {tab === 'progress' && (
          <Progress
            onOpenDay={(d) => {
              setDate(d)
              showTab('today')
            }}
            onOpenSettings={() => showTab('settings')}
          />
        )}
        {tab === 'settings' && <Settings onBack={() => showTab(previousTab)} />}

        <nav className="tabbar" aria-label="Hauptnavigation">
          <div className="tabbar-inner">
            <button
              type="button"
              className="tab"
              aria-current={tab === 'today' ? 'page' : undefined}
              onClick={() => showTab('today')}
            >
              <PlateIcon size={24} />
              Tagebuch
            </button>
            <button
              type="button"
              className="tab-add"
              aria-label="Essen eintragen"
              onClick={() => {
                if (tab !== 'today') showTab('today')
                setAdding({})
              }}
            >
              <PlusIcon size={28} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className="tab"
              aria-current={tab === 'progress' ? 'page' : undefined}
              onClick={() => showTab('progress')}
            >
              <TrendIcon size={24} />
              Fortschritt
            </button>
          </div>
        </nav>

        <AddSheet
          open={adding !== null || editing !== null}
          date={date}
          initialMeal={adding?.meal}
          editing={editing}
          onClose={() => {
            setAdding(null)
            setEditing(null)
          }}
        />
      </ToastProvider>
    </MotionConfig>
  )
}
