import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { CalendarRange, Gauge, MapPin, TriangleAlert, Zap } from 'lucide-react'
import { fmt, groupBy, mesLabel } from '../lib/data.js'

export const ZONA_COLOR = { Norte: '#facc15', Centro: '#c6ff3d', Sur: '#4cc9ff', Austral: '#8b6cff' }

const NORTE_SUR = [
  'Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana',
  "O'Higgins", 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes',
]

// ------------------------------------------------------------------ Insights
export function buildInsights(rows) {
  if (!rows.length) return []
  const out = []

  const reg = [...groupBy(rows, (r) => r.region_destino)].sort((a, b) => b[1] - a[1])[0]
  out.push({ icon: MapPin, color: '#c6ff3d', big: fmt.pct(reg[1] / rows.length), text: `de los pedidos tiene destino ${reg[0]}.` })

  const mes = [...groupBy(rows, (r) => r.fecha_emision.slice(0, 7), (r) => r.total_con_iva_clp)].sort((a, b) => b[1] - a[1])[0]
  out.push({ icon: CalendarRange, color: '#8b6cff', big: mesLabel(mes[0]), text: `fue el mes con más ventas: ${fmt.clpCompact(mes[1])}.` })

  const si = groupBy(rows, (r) => (r.cumple_sla === null ? null : r.zona_destino), (r) => (r.cumple_sla ? 1 : 0))
  const tot = groupBy(rows, (r) => (r.cumple_sla === null ? null : r.zona_destino))
  const zonas = [...tot.keys()].map((z) => [z, si.get(z) / tot.get(z)]).sort((a, b) => a[1] - b[1])
  if (zonas.length > 1) {
    out.push({ icon: Gauge, color: '#4cc9ff', big: fmt.pct(zonas[0][1]), text: `de cumplimiento SLA en zona ${zonas[0][0]}, la más baja.` })
  }

  const inc = rows.filter((r) => r.motivo_incidencia)
  if (inc.length) {
    const mot = [...groupBy(inc, (r) => r.motivo_incidencia)].sort((a, b) => b[1] - a[1])[0]
    out.push({ icon: TriangleAlert, color: '#ff6b4a', big: fmt.pct(mot[1] / inc.length), text: `de las incidencias se deben a “${mot[0].toLowerCase()}”.` })
  }

  const t = (s) => {
    const x = rows.filter((r) => r.tipo_servicio === s)
    return x.length ? x.reduce((a, r) => a + r.total_con_iva_clp, 0) / x.length : 0
  }
  const md = t('Mismo Día'), nor = t('Normal')
  if (md && nor) {
    out.push({ icon: Zap, color: '#f2e8d5', big: `${fmt.dec1(md / nor)}×`, text: 'más alto es el ticket de Mismo Día frente al servicio Normal.' })
  }
  return out
}

export function Insights({ items }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-5">
      {items.map((it, i) => (
        <motion.article
          key={it.text}
          className="card min-w-[78%] snap-start p-5 sm:min-w-0"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${it.color}1f`, color: it.color }}>
            <it.icon size={17} />
          </span>
          <p className="mt-5 font-display text-3xl font-bold tracking-[-0.03em]" style={{ color: it.color }}>{it.big}</p>
          <p className="mt-2 text-sm leading-snug text-[#b9b9c4]">{it.text}</p>
        </motion.article>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ Chile norte → sur
export function Territorio({ rows }) {
  const data = useMemo(() => {
    const n = groupBy(rows, (r) => r.region_destino)
    const si = groupBy(rows, (r) => (r.cumple_sla === null ? null : r.region_destino), (r) => (r.cumple_sla ? 1 : 0))
    const tot = groupBy(rows, (r) => (r.cumple_sla === null ? null : r.region_destino))
    const zona = new Map(rows.map((r) => [r.region_destino, r.zona_destino]))
    return NORTE_SUR.map((name) => ({
      name,
      value: n.get(name) ?? 0,
      sla: tot.get(name) ? si.get(name) / tot.get(name) : null,
      zona: zona.get(name),
    }))
  }, [rows])
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="px-4 pb-6 pt-4 sm:px-6">
      <div className="mb-4 flex flex-wrap gap-3 text-[11px] text-muted">
        {Object.entries(ZONA_COLOR).map(([z, c]) => (
          <span key={z} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{z}</span>
        ))}
        <span className="ml-auto">N ↑ · S ↓</span>
      </div>
      <ul className="space-y-[5px]">
        {data.map((d, i) => (
          <li key={d.name} className="group grid grid-cols-[minmax(0,7.5rem)_1fr_4.5rem] items-center gap-3 text-xs sm:grid-cols-[9rem_1fr_6rem]">
            <span className="truncate text-right text-[#b9b9c4] group-hover:text-white">{d.name}</span>
            <div className="flex h-5 items-center justify-center">
              <motion.div
                className="h-full rounded-full"
                style={{ background: ZONA_COLOR[d.zona] ?? '#555', opacity: d.value ? 1 : 0.2 }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, Math.sqrt(d.value / max) * 100)}%` }}
                transition={{ duration: 0.9, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-right tabular-nums">
              <span className="font-display font-semibold text-white">{fmt.num(d.value)}</span>
              <span className="ml-1.5 hidden text-muted sm:inline">{d.sla == null ? '' : fmt.pct(d.sla)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted">Ancho = pedidos (escala raíz). Derecha: pedidos · % SLA.</p>
    </div>
  )
}

// ------------------------------------------------------------------ Calendario de calor
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIAS = ['L', '', 'M', '', 'V', '', 'D']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function Heatmap({ rows }) {
  const { weeks, max, top } = useMemo(() => {
    const c = groupBy(rows, (r) => r.fecha_emision)
    if (!c.size) return { weeks: [], max: 1, top: null }
    const dates = [...c.keys()].sort()
    const start = new Date(`${dates[0]}T00:00:00`)
    const end = new Date(`${dates.at(-1)}T00:00:00`)
    const cur = new Date(start)
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
    const weeks = []
    while (cur <= end) {
      const wk = []
      for (let i = 0; i < 7; i++) {
        const key = iso(cur)
        wk.push({ key, m: cur.getMonth(), v: cur < start || cur > end ? null : c.get(key) ?? 0 })
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(wk)
    }
    const best = [...c].sort((a, b) => b[1] - a[1])[0]
    return { weeks, max: Math.max(...c.values()), top: best }
  }, [rows])

  const color = (v) => {
    if (v == null) return 'transparent'
    if (v === 0) return 'rgba(255,255,255,0.05)'
    return `rgba(198,255,61,${0.12 + 0.88 * (v / max)})`
  }

  return (
    <div className="px-4 pb-6 pt-5 sm:px-6">
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-2">
          <div className="mt-5 flex flex-col gap-[3px] text-[9px] leading-3 text-muted">
            {DIAS.map((d, i) => <span key={i} className="h-3">{d}</span>)}
          </div>
          <div>
            <div className="mb-1.5 flex gap-[3px] text-[10px] leading-3 text-muted">
              {weeks.map((w, i) => (
                <span key={i} className="w-3 overflow-visible whitespace-nowrap">
                  {i === 0 || w[6].m !== weeks[i - 1][6].m ? MES[w[6].m] : ''}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  {w.map((d) => (
                    <span
                      key={d.key}
                      title={d.v == null ? '' : `${d.key.split('-').reverse().join('-')}: ${d.v} pedidos`}
                      className="h-3 w-3 rounded-[3px] transition-transform hover:scale-150"
                      style={{ background: color(d.v) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted">
        <span>{top && <>Día peak: <span className="text-white">{top[0].split('-').reverse().join('-')}</span> con {top[1]} pedidos</>}</span>
        <span className="flex items-center gap-1.5">
          Menos {[0.12, 0.35, 0.6, 0.85, 1].map((a) => <span key={a} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: `rgba(198,255,61,${a})` }} />)} Más
        </span>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Dock flotante
export const SECCIONES = [
  ['pulso', 'Pulso'], ['tendencia', 'Tendencia'], ['territorio', 'Territorio'], ['operacion', 'Operación'], ['explorador', 'Explorador'],
]

export function Dock({ ready }) {
  const [active, setActive] = useState('pulso')
  useEffect(() => {
    if (!ready) return
    let raf = 0
    const update = () => {
      raf = 0
      const limite = window.innerHeight * 0.4
      let actual = SECCIONES[0][0]
      for (const [id] of SECCIONES) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= limite) actual = id
      }
      setActive(actual)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ready])

  return (
    <nav className="liquid fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-24px)] -translate-x-1/2 gap-0.5 rounded-full p-1.5">
      {SECCIONES.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          className={`relative rounded-full px-2.5 py-2 text-[11px] font-medium transition-colors sm:px-4 sm:text-xs ${active === id ? 'text-ink' : 'text-[#c9c9d3] hover:text-white'}`}
        >
          {active === id && (
            <motion.span layoutId="dock-pill" className="absolute inset-0 rounded-full bg-lime" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
          )}
          <span className="relative">{label}</span>
        </a>
      ))}
    </nav>
  )
}
