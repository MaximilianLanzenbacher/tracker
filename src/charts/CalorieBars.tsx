import { motion } from 'motion/react'
import { useState } from 'react'
import { formatDayMonth, formatWeekdayShort, type DayKey } from '../lib/dates'
import { fmtInt } from '../lib/nutrition'
import { useWidth } from './useWidth'

const H = 156
const PAD = { top: 18, right: 40, bottom: 24, left: 4 }

export function CalorieBars({
  days,
  goal,
  today,
  onSelect,
}: {
  days: { date: DayKey; kcal: number }[]
  goal: number
  today: DayKey
  onSelect?: (d: DayKey) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const iw = width - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const max = Math.max(goal * 1.15, ...days.map((d) => d.kcal * 1.05), 1)
  const y = (v: number) => PAD.top + (1 - v / max) * ih
  const slot = iw / Math.max(days.length, 1)
  const bw = Math.min(24, slot * 0.56)
  const base = PAD.top + ih

  // Säule mit 4px runden Ecken oben, gerade an der Grundlinie.
  const bar = (cx: number, top: number) => {
    const h = base - top
    const r = Math.min(4, h, bw / 2)
    const l = cx - bw / 2
    return `M${l},${base}V${top + r}Q${l},${top} ${l + r},${top}H${l + bw - r}Q${l + bw},${top} ${l + bw},${top + r}V${base}Z`
  }

  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Kalorien der letzten sieben Tage">
          <line x1={PAD.left} x2={width - PAD.right} y1={base} y2={base} className="grid" />
          <line x1={PAD.left} x2={width - PAD.right} y1={y(goal)} y2={y(goal)} className="ref-line" />
          <text x={width - PAD.right + 6} y={y(goal) + 4} className="axis">
            Ziel
          </text>

          {days.map((d, i) => {
            const cx = PAD.left + slot * (i + 0.5)
            const over = d.kcal > goal
            return (
              <g key={d.date}>
                {d.kcal > 0 && (
                  <motion.path
                    d={bar(cx, y(d.kcal))}
                    fill={over ? 'var(--warn)' : 'var(--accent)'}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                    style={{ transformOrigin: `${cx}px ${base}px` }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ type: 'spring', stiffness: 160, damping: 22, delay: i * 0.03 }}
                  />
                )}
                <text
                  x={cx}
                  y={H - 6}
                  textAnchor="middle"
                  className={`axis ${d.date === today ? 'axis-strong' : ''}`}
                >
                  {d.date === today ? 'Heute' : formatWeekdayShort(d.date)}
                </text>
                <rect
                  x={cx - slot / 2}
                  y={0}
                  width={slot}
                  height={H}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => onSelect?.(d.date)}
                  style={{ cursor: onSelect ? 'pointer' : undefined }}
                >
                  <title>{`${formatDayMonth(d.date)}: ${fmtInt(d.kcal)} kcal`}</title>
                </rect>
              </g>
            )
          })}
        </svg>
      )}

      {hover !== null && width > 0 && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(PAD.left + slot * (hover + 0.5), 56), width - 56),
            top: Math.max(y(days[hover].kcal) - 54, 0),
          }}
        >
          <span className="muted">{formatDayMonth(days[hover].date)}</span>
          <strong className="num">{fmtInt(days[hover].kcal)} kcal</strong>
        </div>
      )}
    </div>
  )
}
