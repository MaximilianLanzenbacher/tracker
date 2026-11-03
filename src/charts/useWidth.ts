import { useLayoutEffect, useRef, useState } from 'react'

/** Breite eines Elements, aktualisiert bei Größenänderung. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Runde Achsenschritte, höchstens `max` Linien. */
export function niceTicks(min: number, max: number, maxTicks = 4, steps = [0.5, 1, 2, 5, 10, 20, 50]) {
  const span = max - min || 1
  const step = steps.find((s) => span / s <= maxTicks - 1) ?? steps[steps.length - 1]
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}
