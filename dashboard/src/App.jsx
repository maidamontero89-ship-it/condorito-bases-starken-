import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ArrowUpRight, Database, RotateCcw, Search, Sparkles } from 'lucide-react'
import { fetchPedidos, fmt, groupBy, kpis, mesLabel, toSortedArray } from './lib/data.js'
import { BarList, Card, CardHeader, ChartTooltip, Chips, CountUp, PALETTE, SectionHeader } from './components/ui.jsx'
import { Dock, Heatmap, Insights, Territorio, ZONA_COLOR, buildInsights } from './components/viz.jsx'

const TODAS = 'Todas'
const TODOS = 'Todos'
const ZONAS = [TODAS, 'Norte', 'Centro', 'Sur', 'Austral']
const SERVICIOS = [TODOS, 'Normal', 'Express', 'Mismo Día']
const ESTADO_COLOR = {
  Entregado: '#c6ff3d', 'Con Incidencia': '#ff6b4a', 'Devuelto a Origen': '#ff9de2', Siniestrado: '#ef4444',
  'En Reparto': '#4cc9ff', 'En Tránsito': '#8b6cff', 'Disponible para Retiro': '#f2e8d5', 'Recibido en Sucursal': '#5eead4',
}
const PALABRAS = ['en un vistazo.', 'en tiempo real.', 'sin fricción.', 'de norte a sur.']
const EASE = [0.22, 1, 0.36, 1]
const axis = { stroke: '#5c5c68', fontSize: 11, tickLine: false, axisLine: false }

export default function App() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ['pedidos'], queryFn: fetchPedidos })
  const rows = data?.rows ?? []

  const [zona, setZona] = useState(TODAS)
  const [servicio, setServicio] = useState(TODOS)
  const [canal, setCanal] = useState(TODOS)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const meses = useMemo(() => [...new Set(rows.map((r) => r.fecha_emision.slice(0, 7)))].sort(), [rows])
  const canales = useMemo(() => [TODOS, ...new Set(rows.map((r) => r.canal_venta))], [rows])

  const filtradas = useMemo(
    () =>
      rows.filter((r) => {
        const ym = r.fecha_emision.slice(0, 7)
        return (
          (zona === TODAS || r.zona_destino === zona) &&
          (servicio === TODOS || r.tipo_servicio === servicio) &&
          (canal === TODOS || r.canal_venta === canal) &&
          (!desde || ym >= desde) &&
          (!hasta || ym <= hasta)
        )
      }),
    [rows, zona, servicio, canal, desde, hasta],
  )

  const k = useMemo(() => kpis(filtradas), [filtradas])
  const insights = useMemo(() => buildInsights(filtradas), [filtradas])
  const hayFiltros = zona !== TODAS || servicio !== TODOS || canal !== TODOS || desde || hasta
  const limpiar = () => { setZona(TODAS); setServicio(TODOS); setCanal(TODOS); setDesde(''); setHasta('') }

  const porMes = useMemo(() => {
    const v = groupBy(filtradas, (r) => r.fecha_emision.slice(0, 7), (r) => r.total_con_iva_clp)
    const n = groupBy(filtradas, (r) => r.fecha_emision.slice(0, 7))
    return [...n.keys()].sort().map((m) => ({ mes: mesLabel(m), ventas: v.get(m), pedidos: n.get(m) }))
  }, [filtradas])

  const porServicio = useMemo(() => toSortedArray(groupBy(filtradas, (r) => r.tipo_servicio)), [filtradas])
  const porCanal = useMemo(() => toSortedArray(groupBy(filtradas, (r) => r.canal_venta, (r) => r.total_con_iva_clp)), [filtradas])
  const porEstado = useMemo(() => toSortedArray(groupBy(filtradas, (r) => r.estado)), [filtradas])
  const porMotivo = useMemo(() => toSortedArray(groupBy(filtradas, (r) => r.motivo_incidencia)), [filtradas])
  const porContenido = useMemo(() => toSortedArray(groupBy(filtradas, (r) => r.contenido_declarado, (r) => r.total_con_iva_clp)).slice(0, 8), [filtradas])
  const slaZona = useMemo(() => {
    const si = groupBy(filtradas, (r) => (r.cumple_sla === null ? null : r.zona_destino), (r) => (r.cumple_sla ? 1 : 0))
    const tot = groupBy(filtradas, (r) => (r.cumple_sla === null ? null : r.zona_destino))
    return ['Norte', 'Centro', 'Sur', 'Austral'].filter((z) => tot.get(z)).map((z) => ({ name: z, value: si.get(z) / tot.get(z) }))
  }, [filtradas])
  const regiones = useMemo(() => new Set(filtradas.map((r) => r.region_destino)).size, [filtradas])

  return (
    <div className="relative">
      <ScrollProgress />
      <div className="aurora" aria-hidden />

      {/* ------------------------------------------------ Nav */}
      <header className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-lime font-display text-lg font-bold text-ink">C</span>
          <span className="font-display text-lg font-semibold tracking-tight">Condorito<span className="text-lime">.</span>pulse</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-lime opacity-75 ${isFetching ? 'animate-ping' : ''}`} />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
          </span>
          <span className="hidden sm:inline">En vivo desde Supabase</span>
          <button type="button" onClick={() => refetch()} className="chip ml-2 !py-1.5" aria-label="Actualizar datos">
            <RotateCcw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1400px] px-4 pb-32 sm:px-8">
        <Hero total={rows.length} k={k} ready={!isLoading} />

        {error && (
          <div className="card mb-8 p-6 text-coral">No se pudieron cargar los datos: {String(error.message ?? error)}</div>
        )}

        {/* ------------------------------------------------ Filtros */}
        <div className="liquid z-30 mb-2 flex flex-col gap-4 rounded-[1.75rem] p-4 sm:p-5 lg:sticky lg:top-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
            <Chips options={ZONAS} value={zona} onChange={setZona} />
            <span className="hidden h-6 w-px bg-white/10 md:block" />
            <Chips options={SERVICIOS} value={servicio} onChange={setServicio} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field" value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal de venta">
              {canales.map((c) => <option key={c} value={c}>{c === TODOS ? 'Todos los canales' : c}</option>)}
            </select>
            <select className="field" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde">
              <option value="">Desde</option>
              {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
            <select className="field" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta">
              <option value="">Hasta</option>
              {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
            </select>
            {hayFiltros && <button type="button" className="chip" onClick={limpiar}>Limpiar</button>}
          </div>
        </div>

        {isLoading ? (
          <Skeleton />
        ) : filtradas.length === 0 ? (
          <div className="card mt-10 p-10 text-center text-muted">No hay pedidos para esta combinación de filtros.</div>
        ) : (
          <>
            {/* ================================================ 01 Pulso */}
            <SectionHeader id="pulso" n="01" title="Pulso" kicker="Los indicadores que importan, recalculados con cada filtro." />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card className="col-span-2 row-span-2 flex flex-col justify-between overflow-hidden p-6 sm:p-8">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-lime/20 blur-3xl" aria-hidden />
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Ventas con IVA</p>
                <div>
                  <p className="font-display text-[clamp(2.8rem,7vw,6rem)] font-bold leading-none tracking-[-0.045em] text-lime">
                    <CountUp value={k.ventas} format={fmt.clpCompact} />
                  </p>
                  <p className="mt-3 text-sm text-[#a8a8b4]">
                    <CountUp value={k.ventas} format={fmt.clp} /> en <CountUp value={k.pedidos} format={fmt.num} /> pedidos
                  </p>
                </div>
                <div className="mt-6 h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={porMes} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c6ff3d" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#c6ff3d" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="ventas" stroke="#c6ff3d" strokeWidth={2} fill="url(#spark)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Kpi label="Ticket promedio" value={k.ticket} format={fmt.clp} delay={0.05} />
              <Kpi label="Cumplimiento SLA" value={k.sla} format={fmt.pct} accent="text-violet" delay={0.1} />
              <Kpi label="Entregados" value={k.entregados} format={fmt.pct} delay={0.15} />
              <Kpi label="Calificación cliente" value={k.calificacion} format={(v) => `${fmt.dec1(v)} / 5`} accent="text-sky" delay={0.2} />
            </div>

            <div className="mb-4 mt-10 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
              <Sparkles size={14} className="text-lime" /> Insights automáticos
            </div>
            <Insights items={insights} />

            <Marquee k={k} regiones={regiones} />

            {/* ================================================ 02 Tendencia */}
            <SectionHeader id="tendencia" n="02" title="Tendencia" kicker="Cómo se mueve el negocio mes a mes y día a día." />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-8">
                <CardHeader eyebrow="Mensual" title="Ventas y pedidos por mes" />
                <div className="h-80 px-2 pb-4 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={porMes} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b6cff" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="#8b6cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="mes" {...axis} />
                      <YAxis yAxisId="v" {...axis} tickFormatter={fmt.clpCompact} width={70} />
                      <YAxis yAxisId="n" orientation="right" {...axis} width={40} />
                      <Tooltip content={<ChartTooltip formatter={(v, key) => (key === 'ventas' ? fmt.clp(v) : fmt.num(v))} />} />
                      <Area yAxisId="v" type="monotone" dataKey="ventas" name="Ventas" stroke="#8b6cff" strokeWidth={2.5} fill="url(#ventas)" />
                      <Line yAxisId="n" type="monotone" dataKey="pedidos" name="Pedidos" stroke="#c6ff3d" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="lg:col-span-4" delay={0.05}>
                <CardHeader eyebrow="Mix" title="Tipo de servicio" />
                <Donut data={porServicio} format={fmt.num} centerLabel="pedidos" />
              </Card>
              <Card className="lg:col-span-12" delay={0.05}>
                <CardHeader eyebrow="Diario" title="Calendario de actividad 2026" right={<span className="text-xs text-muted">Pedidos emitidos por día</span>} />
                <Heatmap rows={filtradas} />
              </Card>
            </div>

            {/* ================================================ 03 Territorio */}
            <SectionHeader id="territorio" n="03" title="Territorio" kicker="Chile de norte a sur: dónde llegan los envíos y qué tan a tiempo." />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-6 lg:row-span-2">
                <CardHeader eyebrow="Destino" title="Pedidos por región" />
                <Territorio rows={filtradas} />
              </Card>
              <Card className="lg:col-span-6" delay={0.05}>
                <CardHeader eyebrow="Calidad" title="Cumplimiento SLA por zona" />
                <div className="px-6 pb-6 pt-5">
                  <BarList data={slaZona} format={fmt.pct} max={1} color={(d) => ZONA_COLOR[d.name]} />
                </div>
              </Card>
              <Card className="lg:col-span-6" delay={0.1}>
                <CardHeader eyebrow="Canales" title="Ventas por canal" />
                <Donut data={porCanal} format={fmt.clpCompact} centerLabel="ventas" compact />
              </Card>
            </div>

            {/* ================================================ 04 Operación */}
            <SectionHeader id="operacion" n="04" title="Operación" kicker="Estados, fricciones y qué se mueve en cada bulto." />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-7">
                <CardHeader eyebrow="Seguimiento" title="Estado de los envíos" />
                <div className="h-[360px] px-2 pb-4 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porEstado} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                      <XAxis type="number" {...axis} tickFormatter={fmt.num} />
                      <YAxis type="category" dataKey="name" {...axis} width={150} />
                      <Tooltip content={<ChartTooltip formatter={fmt.num} />} />
                      <Bar dataKey="value" name="Pedidos" radius={[0, 10, 10, 0]} barSize={22}>
                        {porEstado.map((d) => <Cell key={d.name} fill={ESTADO_COLOR[d.name] ?? '#8b8b98'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="lg:col-span-5" delay={0.05}>
                <CardHeader eyebrow="Fricción" title="Motivos de incidencia" />
                <div className="px-6 pb-6 pt-5">
                  <BarList data={porMotivo.slice(0, 8)} format={fmt.num} color="#ff6b4a" />
                </div>
              </Card>
              <Card className="lg:col-span-12" delay={0.05}>
                <CardHeader eyebrow="Carga" title="Ventas por contenido declarado (top 8)" />
                <div className="h-72 px-2 pb-4 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porContenido} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 10, fill: '#8b8b98' }} />
                      <YAxis {...axis} tickFormatter={fmt.clpCompact} width={70} />
                      <Tooltip content={<ChartTooltip formatter={fmt.clp} />} />
                      <Bar dataKey="value" name="Ventas" radius={[10, 10, 0, 0]}>
                        {porContenido.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* ================================================ 05 Explorador */}
            <SectionHeader id="explorador" n="05" title="Explorador" kicker="Busca cualquier pedido por ID, comuna, estado o contenido." />
            <Explorer rows={filtradas} />
          </>
        )}

        <footer className="mt-24 border-t border-white/10 pt-10">
          <p className="text-outline select-none font-display text-[clamp(3rem,15vw,13rem)] font-bold leading-[0.8] tracking-[-0.05em]">condorito</p>
          <div className="mt-8 flex flex-col gap-2 text-xs text-muted sm:flex-row sm:justify-between">
            <p>Datos 100% sintéticos y anonimizados, con fines de análisis. No corresponden a personas reales.</p>
            <p>
              {data?.fetchedAt && <>Actualizado {data.fetchedAt.toLocaleString('es-CL')} · </>}
              React · Supabase
            </p>
          </div>
        </footer>
      </main>

      <Dock ready={!isLoading && filtradas.length > 0} />
    </div>
  )
}

// ------------------------------------------------------------------ piezas
function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30 })
  return <motion.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-lime via-sky to-violet" />
}

function Hero({ total, k, ready }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setW((x) => (x + 1) % PALABRAS.length), 2600)
    return () => clearInterval(t)
  }, [])
  const linea1 = ['Cada', 'envío,']

  return (
    <section className="grid gap-10 pb-12 pt-8 sm:pt-14 lg:grid-cols-12 lg:items-end">
      <div className="lg:col-span-8">
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-[#c9c9d3]"
        >
          <Database size={12} className="text-lime" /> Dataset sintético y anonimizado · noviembre 2026
        </motion.p>
        <h1 className="mt-6 font-display text-[clamp(2.8rem,9vw,8.5rem)] font-bold leading-[0.88] tracking-[-0.05em]">
          <span className="block">
            {linea1.map((p, i) => (
              <span key={p} className="mr-[0.22em] inline-block overflow-hidden pb-[0.08em] align-bottom">
                <motion.span
                  className="inline-block"
                  initial={{ y: '110%' }} animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: EASE }}
                >
                  {p}
                </motion.span>
              </span>
            ))}
          </span>
          <span className="relative block h-[1.02em] overflow-hidden pb-[0.08em]">
            <AnimatePresence mode="wait">
              <motion.span
                key={w}
                className="absolute left-0 top-0 inline-block whitespace-nowrap bg-gradient-to-r from-lime via-[#e5ffb0] to-violet bg-clip-text text-transparent"
                initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                {PALABRAS[w]}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-6 max-w-xl text-base text-[#a8a8b4] sm:text-lg"
        >
          Ventas, cumplimiento y operación de {fmt.num(total || 10000)} pedidos de courier en Chile.
          Filtra y todo se recalcula al instante.
        </motion.p>
      </div>

      <motion.div
        className="liquid grid grid-cols-3 gap-px overflow-hidden rounded-[1.75rem] lg:col-span-4"
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.9, ease: EASE }}
      >
        {[
          ['Pedidos', ready ? <CountUp value={k.pedidos} format={fmt.num} /> : '—'],
          ['A tiempo', ready ? <CountUp value={k.sla} format={fmt.pct} /> : '—'],
          ['Nota', ready ? <CountUp value={k.calificacion} format={fmt.dec1} /> : '—'],
        ].map(([label, v]) => (
          <div key={label} className="bg-white/[0.02] px-4 py-5 text-center">
            <p className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{v}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">{label}</p>
          </div>
        ))}
      </motion.div>
    </section>
  )
}

function Marquee({ k, regiones }) {
  return (
    <div className="mt-14 overflow-hidden border-y border-white/10 py-5">
      <div className="marquee font-display text-3xl font-semibold tracking-tight sm:text-5xl">
        {[0, 1].map((dup) => (
          <div key={dup} className="flex shrink-0 items-center gap-10 pr-10" aria-hidden={dup === 1}>
            <span>{fmt.num(k.pedidos)} pedidos</span><Star />
            <span className="text-outline">{fmt.pct(k.incidencias)} con incidencia</span><Star />
            <span>{fmt.dec1(k.transito)} días de tránsito</span><Star />
            <span className="text-outline">{regiones} regiones</span><Star />
            <span>{fmt.pct(k.sla)} a tiempo</span><Star />
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, format, accent = 'text-white', delay }) {
  return (
    <Card className="flex min-h-[150px] flex-col justify-between p-5 sm:p-6" delay={delay}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
        <ArrowUpRight size={16} className="text-muted" />
      </div>
      <p className={`font-display text-[clamp(1.6rem,3vw,2.4rem)] font-bold leading-none tracking-[-0.03em] ${accent}`}>
        <CountUp value={value} format={format} />
      </p>
    </Card>
  )
}

function Donut({ data, format, centerLabel, compact = false }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className={`px-6 pb-6 ${compact ? 'sm:flex sm:items-center sm:gap-8' : ''}`}>
      <div className={`relative mx-auto h-56 w-full max-w-[240px] ${compact ? 'sm:mx-0 sm:shrink-0' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip formatter={format} />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="100%" paddingAngle={3} stroke="none" cornerRadius={8}>
              {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight">{format(total)}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="mt-4 w-full space-y-2 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[#d6d6de]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
              {d.name}
            </span>
            <span className="tabular-nums text-muted">{fmt.pct(total ? d.value / total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const PAGE = 15

function Explorer({ rows }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    const base = t
      ? rows.filter((r) =>
          [r.id_pedido, r.comuna_origen, r.comuna_destino, r.estado, r.contenido_declarado].some((v) => v?.toLowerCase().includes(t)),
        )
      : rows
    return [...base].sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision) || b.id_pedido.localeCompare(a.id_pedido))
  }, [rows, q])
  const pages = Math.max(1, Math.ceil(lista.length / PAGE))
  const p = Math.min(page, pages - 1)
  const visibles = lista.slice(p * PAGE, p * PAGE + PAGE)

  return (
    <Card className="overflow-hidden">
      <CardHeader
        eyebrow="Registros"
        title={`${fmt.num(lista.length)} pedidos`}
        right={
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="field w-44 !pl-9 sm:w-64"
              placeholder="ID, comuna, estado…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(0) }}
            />
          </label>
        }
      />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.14em] text-muted">
            <tr className="border-y border-white/10">
              <th className="px-6 py-3 font-medium">Pedido</th>
              <th className="px-3 py-3 font-medium">Emisión</th>
              <th className="px-3 py-3 font-medium">Ruta</th>
              <th className="px-3 py-3 font-medium">Servicio</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-6 py-3 text-right font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <tr key={r.id_pedido} className="border-b border-white/[0.05] transition-colors hover:bg-white/[0.03]">
                <td className="px-6 py-3 font-mono text-xs text-[#d6d6de]">{r.id_pedido}</td>
                <td className="px-3 py-3 tabular-nums text-[#a8a8b4]">{r.fecha_emision.split('-').reverse().join('-')}</td>
                <td className="px-3 py-3 text-[#d6d6de]">{r.comuna_origen} <span className="text-muted">→</span> {r.comuna_destino}</td>
                <td className="px-3 py-3 text-[#a8a8b4]">{r.tipo_servicio}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#d6d6de]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ESTADO_COLOR[r.estado] ?? '#8b8b98' }} />
                    {r.estado}
                  </span>
                </td>
                <td className="px-3 py-3 text-right font-display tabular-nums">{fmt.clp(r.total_con_iva_clp)}</td>
                <td className="px-6 py-3 text-right text-xs">
                  {r.cumple_sla === null ? <span className="text-muted">Pendiente</span> : r.cumple_sla ? <span className="text-lime">A tiempo</span> : <span className="text-coral">Atrasado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 text-xs text-muted">
        <span>Página {p + 1} de {fmt.num(pages)}</span>
        <div className="flex gap-2">
          <button type="button" className="chip disabled:opacity-30" disabled={p === 0} onClick={() => setPage(p - 1)}>Anterior</button>
          <button type="button" className="chip disabled:opacity-30" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Siguiente</button>
        </div>
      </div>
    </Card>
  )
}

function Star() {
  return <span className="text-lime">✦</span>
}

function Skeleton() {
  return (
    <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="card col-span-2 row-span-2 h-[316px] animate-pulse" />
      {[0, 1, 2, 3].map((i) => <div key={i} className="card h-[150px] animate-pulse" />)}
      <p className="col-span-2 text-sm text-muted lg:col-span-4">Cargando 10.000 pedidos desde Supabase…</p>
    </div>
  )
}
