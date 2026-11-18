import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'

export const PALETTE = ['#c6ff3d', '#8b6cff', '#4cc9ff', '#ff6b4a', '#f2e8d5', '#ff9de2', '#5eead4', '#facc15']

export function Card({ className = '', children, delay = 0 }) {
  return (
    <motion.section
      className={`card ${className}`}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  )
}

export function CardHeader({ eyebrow, title, right }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-6">
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{eyebrow}</p>}
        <h3 className="mt-1 font-display text-lg font-semibold tracking-tight text-white">{title}</h3>
      </div>
      {right}
    </div>
  )
}

export function CountUp({ value, format, duration = 1100 }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 4)
      setShown(a + (value - a) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{format(shown)}</>
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" className="chip" data-active={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0e0e13]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur">
      {label != null && <p className="mb-1.5 font-display text-sm font-semibold text-white">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-[#c9c9d3]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <span className="font-semibold text-white">{formatter ? formatter(p.value, p.dataKey ?? p.name) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function BarList({ data, format, color = '#c6ff3d', max }) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1)
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-[#d6d6de]">{d.name}</span>
            <span className="shrink-0 font-display font-semibold tabular-nums text-white">{format(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: typeof color === 'function' ? color(d, i) : color }}
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / top) * 100}%` }}
              transition={{ duration: 0.9, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
