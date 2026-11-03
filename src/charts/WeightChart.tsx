import { motion } from 'motion/react'
import { useMemo, useState, type PointerEvent } from 'react'
import { daysBetween, formatDayMonth, type DayKey } from '../lib/dates'
import { fmtKg } from '../lib/nutrition'
import { niceTicks, useWidth } from './useWidth'

const H = 188
const PAD = { top: 16, right: 48, bottom: 26, left: 34 }

export function WeightChart({
  points,
  target,
}: {
  points: { date: DayKey; kg: number }[]
  target?: number
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const geo = useMemo(() => {
    if (points.length === 0 || width === 0) return null
    const first = points[0].date
    const span = Math.max(1, daysBetween(first, points[points.length - 1].date))
    const kgs = points.map((p) => p.kg)
    let lo = Math.min(...kgs)
    let hi = Math.max(...kgs)
    // Ziel nur einbeziehen, wenn es nah genug liegt. Sonst wird die Kurve platt.
    const showTarget = target !== undefined && target >= lo - 3 && target <= hi + 3
    if (showTarget) {
      lo = Math.min(lo, target!)
      hi = Math.max(hi, target!)
    }
    const ticks = niceTicks(lo - 0.3, hi + 0.3)
    const yMin = ticks[0]
    const yMax = ticks[ticks.length - 1]
    const iw = width - PAD.left - PAD.right
    const ih = H - PAD.top - PAD.bottom
    const x = (d: DayKey) => PAD.left + (daysBetween(first, d) / span) * iw
    const y = (kg: number) => PAD.top + (1 - (kg - yMin) / (yMax - yMin || 1)) * ih
    const xy = points.map((p) => [x(p.date), y(p.kg)] as const)
    const line = xy.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join('')
    const base = PAD.top + ih
    const area = `${line}L${xy[xy.length - 1][0].toFixed(1)},${base}L${xy[0][0].toFixed(1)},${base}Z`
    return { ticks, x, y, xy, line, area, base, showTarget, iw }
  }, [points, width, target])

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!geo) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left + PAD.left
    let best = 0
    geo.xy.forEach(([x], i) => {
      if (Math.abs(x - px) < Math.abs(geo.xy[best][0] - px)) best = i
    })
    setHover(best)
  }

  const last = points.length - 1
  const active = hover ?? null

  return (
    <div ref={ref} className="chart">
      {geo && (
        <svg width={width} height={H} role="img" aria-label="Gewichtsverlauf">
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={geo.y(t)} y2={geo.y(t)} className="grid" />
              <text x={PAD.left - 8} y={geo.y(t) + 4} className="axis" textAnchor="end">
                {Number.isInteger(t) ? t : fmtKg(t)}
              </text>
            </g>
          ))}

          {geo.showTarget && (
            <g>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={geo.y(target!)}
                y2={geo.y(target!)}
                className="ref-line"
              />
              <text x={width - PAD.right + 6} y={geo.y(target!) + 4} className="axis">
                Ziel
              </text>
            </g>
          )}

          <text x={PAD.left} y={H - 6} className="axis">
            {formatDayMonth(points[0].date)}
          </text>
          {points.length > 1 && (
            <text x={width - PAD.right} y={H - 6} className="axis" textAnchor="end">
              {formatDayMonth(points[last].date)}
            </text>
          )}

          <path d={geo.area} fill="var(--accent)" opacity={0.1} />
          <motion.path
            key={`${points[0].date}-${points.length}`}
            d={geo.line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />

          <circle
            cx={geo.xy[last][0]}
            cy={geo.xy[last][1]}
            r={4.5}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={2}
          />
          {active === null && (
            <text x={geo.xy[last][0] + 9} y={geo.xy[last][1] + 4} className="end-label">
              {fmtKg(points[last].kg)}
            </text>
          )}

          {active !== null && (
            <g pointerEvents="none">
              <line
                x1={geo.xy[active][0]}
                x2={geo.xy[active][0]}
                y1={PAD.top}
                y2={geo.base}
                className="crosshair"
              />
              <circle
                cx={geo.xy[active][0]}
                cy={geo.xy[active][1]}
                r={5}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}

          <rect
            x={PAD.left}
            y={0}
            width={Math.max(0, geo.iw)}
            height={H}
            fill="transparent"
            style={{ touchAction: 'pan-y' }}
            onPointerDown={onMove}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
            onPointerUp={(e) => e.pointerType !== 'mouse' && setTimeout(() => setHover(null), 1400)}
          />
        </svg>
      )}

      {geo && active !== null && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(geo.xy[active][0], 56), width - 56),
            top: Math.max(geo.xy[active][1] - 52, 0),
          }}
        >
          <span className="muted">{formatDayMonth(points[active].date)}</span>
          <strong className="num">{fmtKg(points[active].kg)} kg</strong>
        </div>
      )}
    </div>
  )
}
