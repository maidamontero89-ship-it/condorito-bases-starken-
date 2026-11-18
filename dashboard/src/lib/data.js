import { createClient } from '@supabase/supabase-js'

// Clave publicable: diseñada para ir en el navegador. La base solo permite lectura (RLS).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://kkvumowpftyckriszlya.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_1tPVAcMMtwKaBmAyq700nw_yGUiVJ2-'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

const COLS = [
  'id_pedido', 'fecha_emision', 'canal_venta', 'tipo_cliente', 'region_origen', 'comuna_origen',
  'region_destino', 'zona_destino', 'comuna_destino', 'tipo_entrega', 'tipo_servicio', 'tipo_bulto',
  'contenido_declarado', 'total_con_iva_clp', 'peso_facturable_kg', 'estado', 'motivo_incidencia',
  'cumple_sla', 'calificacion_cliente', 'dias_transito_habiles', 'medio_pago',
].join(',')

const PAGE = 1000

export async function fetchPedidos() {
  const { count, error } = await supabase
    .from('v_pedidos')
    .select('id_pedido', { count: 'exact', head: true })
  if (error) throw error

  const requests = []
  for (let from = 0; from < count; from += PAGE) {
    requests.push(
      supabase.from('v_pedidos').select(COLS).order('id_pedido').range(from, from + PAGE - 1),
    )
  }
  const pages = await Promise.all(requests)
  const rows = []
  for (const p of pages) {
    if (p.error) throw p.error
    rows.push(...p.data)
  }
  return { rows, fetchedAt: new Date() }
}

// ---------------------------------------------------------------- formato
const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 })
const dec1 = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const fmt = {
  clp: (v) => clp.format(v ?? 0),
  clpCompact: (v) => {
    const a = Math.abs(v ?? 0)
    if (a >= 1e6) return `$${dec1.format(v / 1e6)} M`
    if (a >= 1e3) return `$${num.format(v / 1e3)} mil`
    return clp.format(v ?? 0)
  },
  num: (v) => num.format(v ?? 0),
  pct: (v) => `${dec1.format((v ?? 0) * 100)}%`,
  dec1: (v) => dec1.format(v ?? 0),
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const mesLabel = (ym) => {
  const [y, m] = ym.split('-')
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`
}

// ---------------------------------------------------------------- agregaciones
export function groupBy(rows, keyFn, valFn = () => 1) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (k == null) continue
    m.set(k, (m.get(k) ?? 0) + valFn(r))
  }
  return m
}

export function toSortedArray(map, { by = 'value', desc = true } = {}) {
  const arr = [...map].map(([name, value]) => ({ name, value }))
  arr.sort((a, b) => {
    const d = by === 'value' ? a.value - b.value : String(a.name).localeCompare(String(b.name))
    return desc ? -d : d
  })
  return arr
}

export function kpis(rows) {
  const n = rows.length
  let ventas = 0, entregados = 0, slaSi = 0, slaTot = 0, calSum = 0, calN = 0, incid = 0, transito = 0, transitoN = 0
  for (const r of rows) {
    ventas += r.total_con_iva_clp
    if (r.estado === 'Entregado') entregados++
    if (r.cumple_sla !== null) { slaTot++; if (r.cumple_sla) slaSi++ }
    if (r.calificacion_cliente != null) { calSum += r.calificacion_cliente; calN++ }
    if (r.motivo_incidencia) incid++
    if (r.dias_transito_habiles != null && r.dias_transito_habiles >= 0) { transito += r.dias_transito_habiles; transitoN++ }
  }
  return {
    pedidos: n,
    ventas,
    ticket: n ? ventas / n : 0,
    entregados: n ? entregados / n : 0,
    sla: slaTot ? slaSi / slaTot : 0,
    calificacion: calN ? calSum / calN : 0,
    incidencias: n ? incid / n : 0,
    transito: transitoN ? transito / transitoN : 0,
  }
}
