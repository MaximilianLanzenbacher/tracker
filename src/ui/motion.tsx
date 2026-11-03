import {
  animate,
  AnimatePresence,
  motion,
  useDragControls,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { fmtInt } from '../lib/nutrition'
import { CloseIcon } from './icons'

const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const SPRING = { type: 'spring', stiffness: 380, damping: 34 } as const

/** Zahl, die bei Änderungen sichtbar hoch- oder runterzählt. */
export function AnimatedNumber({
  value,
  format = (n) => fmtInt(Math.round(n)),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(value)

  useEffect(() => {
    if (reduce) {
      mv.jump(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.7, ease: EASE_OUT })
    return () => controls.stop()
  }, [value, reduce, mv])

  useMotionValueEvent(mv, 'change', (v) => {
    if (ref.current) ref.current.textContent = format(v)
  })

  return (
    <span ref={ref} className={`num ${className ?? ''}`}>
      {format(value)}
    </span>
  )
}

/** Fortschrittsring. Werte über 1 bleiben voll, die Farbe kommt vom Aufrufer. */
export function Ring({
  progress,
  size = 132,
  stroke = 12,
  color,
  children,
}: {
  progress: number
  size?: number
  stroke?: number
  color: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const p = Math.max(0, Math.min(progress, 1))
  return (
    <div className="ring-wrap">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - p), opacity: p > 0 ? 1 : 0, stroke: color }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

export function Bar({ progress, color }: { progress: number; color: string }) {
  return (
    <div className="bar">
      <motion.div
        className="bar-fill"
        style={{ background: color }}
        initial={false}
        animate={{ scaleX: Math.max(0, Math.min(progress, 1)) }}
        transition={{ type: 'spring', stiffness: 110, damping: 22 }}
      />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segment"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.value === value && (
            <motion.span layoutId={`${id}-pill`} className="segment-pill" transition={SPRING} />
          )}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Bottom-Sheet im iOS-Stil. Am Griff oder Titel nach unten ziehen schließt es. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const controls = useDragControls()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="sheet-grab" onPointerDown={(e) => controls.start(e)}>
              <span />
            </div>
            <div className="sheet-head" onPointerDown={(e) => controls.start(e)}>
              <h2 className="sheet-title">{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen">
                <CloseIcon size={22} />
              </button>
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

const DELETE_W = 96

/**
 * Listenzeile, die sich nach links wischen lässt, um „Löschen“ freizulegen.
 * Ganz durchgewischt wird sofort gelöscht. Muss in einer AnimatePresence liegen.
 */
export function SwipeRow({
  onDelete,
  onTap,
  children,
  label,
}: {
  onDelete: () => void
  onTap?: () => void
  children: ReactNode
  label: string
}) {
  const x = useMotionValue(0)
  // Erst sichtbar machen, wenn gewischt wird, sonst schimmert die Farbe an den Ecken durch.
  const deleteOpacity = useTransform(x, [-12, 0], [1, 0])
  const [open, setOpen] = useState(false)
  const dragged = useRef(false)

  const settle = (toOpen: boolean) => {
    setOpen(toOpen)
    animate(x, toOpen ? -DELETE_W : 0, SPRING)
  }

  return (
    <motion.div
      className="row-shell"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      <motion.button
        type="button"
        className="row-delete"
        style={{ opacity: deleteOpacity }}
        onClick={onDelete}
        tabIndex={open ? 0 : -1}
      >
        Löschen
      </motion.button>
      <motion.button
        type="button"
        className="row"
        aria-label={label}
        style={{ x, touchAction: 'pan-y' }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -DELETE_W, right: 0 }}
        dragElastic={{ left: 0.5, right: 0.05 }}
        dragMomentum={false}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragged.current = false), 0)
          if (info.offset.x < -220) {
            onDelete()
            return
          }
          settle(open ? info.offset.x < 30 : info.offset.x < -40)
        }}
        onClick={() => {
          if (dragged.current) return
          if (open) settle(false)
          else onTap?.()
        }}
      >
        {children}
      </motion.button>
    </motion.div>
  )
}
