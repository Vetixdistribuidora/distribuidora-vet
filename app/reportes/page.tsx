"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

function fmt(num: number) {
  return "$" + Math.round(num).toLocaleString("es-AR")
}
function fmtExacto(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .rep-kpis { grid-template-columns: repeat(2, 1fr) !important; }
    .rep-flujo { grid-template-columns: repeat(2, 1fr) !important; }
    .rep-grids { grid-template-columns: 1fr !important; }
    .rep-filtros { flex-wrap: wrap !important; }
    .rep-presets { flex-wrap: wrap !important; }
  }
`

function CambioChip({ actual, ant }: { actual: number; ant: number }) {
  if (ant === 0) return null
  const diff = ((actual - ant) / ant) * 100
  const pos = diff >= 0
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
      background: pos ? "#dcfce7" : "#fee2e2",
      color: pos ? "#16a34a" : "#dc2626", marginLeft: 6,
    }}>
      {pos ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}%
    </span>
  )
}

export default function Reportes() {
  const hoy = new Date()
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toLocaleDateString("sv-SE")
  const hoyStr = hoy.toLocaleDateString("sv-SE")

  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyStr)
  const [cargando, setCargando] = useState(false)
  const [topTab, setTopTab] = useState<"facturacion" | "unidades" | "ganancia">("facturacion")

  const [kpis, setKpis] = useState({
    total: 0, ganancia: 0, ticket: 0, clientesUnicos: 0, cantVentas: 0,
    margen: 0, markup: 0, promedioDiario: 0,
    cobrado: 0, pendienteCC: 0, compras: 0, resultado: 0, diasPeriodo: 1,
  })
  const [anterior, setAnterior] = useState({ total: 0, ticket: 0, cantVentas: 0 })
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])
  const [graficoDiario, setGraficoDiario] = useState<any[]>([])

  function applyPreset(preset: string) {
    const h = new Date()
    if (preset === "mes") {
      setDesde(new Date(h.getFullYear(), h.getMonth(), 1).toLocaleDateString("sv-SE"))
      setHasta(h.toLocaleDateString("sv-SE"))
    } else if (preset === "mes_ant") {
      const ini = new Date(h.getFullYear(), h.getMonth() - 1, 1)
      const fin = new Date(h.getFullYear(), h.getMonth(), 0)
      setDesde(ini.toLocaleDateString("sv-SE")); setHasta(fin.toLocaleDateString("sv-SE"))
    } else if (preset === "3meses") {
      const ini = new Date(h); ini.setMonth(ini.getMonth() - 3)
      setDesde(ini.toLocaleDateString("sv-SE")); setHasta(h.toLocaleDateString("sv-SE"))
    } else if (preset === "anio") {
      setDesde(h.getFullYear() + "-01-01"); setHasta(h.toLocaleDateString("sv-SE"))
    }
  }

  async function cargar() {
    setCargando(true)
    try {
      // "T00:00:00" sin zona → se interpreta en hora local (Argentina), no UTC
      const desdeDate = new Date(desde + "T00:00:00")
      const hastaDate = new Date(hasta + "T00:00:00")
      const diasPeriodo = Math.max(1, Math.round((hastaDate.getTime() - desdeDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)

      // Período anterior (misma duración, inmediatamente antes)
      const antHastaDate = new Date(desdeDate); antHastaDate.setDate(antHastaDate.getDate() - 1)
      const antDesdeDate = new Date(antHastaDate); antDesdeDate.setDate(antDesdeDate.getDate() - diasPeriodo + 1)
      const antDesde = antDesdeDate.toLocaleDateString("sv-SE")
      const antHasta = antHastaDate.toLocaleDateString("sv-SE")

      // Convertir fechas locales a UTC para queries
      const desdeUTC = new Date(desde + "T00:00:00").toISOString()
      const hastaUTC = new Date(hasta + "T23:59:59").toISOString()
      const antDesdeUTC = new Date(antDesde + "T00:00:00").toISOString()
      const antHastaUTC = new Date(antHasta + "T23:59:59").toISOString()

      // Todas las queries en paralelo
      const [ventasRes, pagosRes, comprasRes, comprasPagosRes, ventasAntRes] = await Promise.all([
        supabase.from("ventas")
          .select("id, total, cliente_id, fecha, estado, metodo_cobro")
          .gte("fecha", desdeUTC).lte("fecha", hastaUTC).neq("estado", "anulada"),
        supabase.from("pagos_cuenta_corriente")
          .select("venta_id, monto")
          .gte("fecha", desdeUTC).lte("fecha", hastaUTC),
        supabase.from("compras")
          .select("total")
          .gte("fecha", desdeUTC).lte("fecha", hastaUTC),
        // Pagos REALES a proveedores del período (fecha es DATE → rango YYYY-MM-DD)
        supabase.from("compras_pagos")
          .select("monto")
          .gte("fecha", desde).lte("fecha", hasta),
        supabase.from("ventas")
          .select("id, total")
          .gte("fecha", antDesdeUTC).lte("fecha", antHastaUTC).neq("estado", "anulada"),
      ])

      const ventas = ventasRes.data || []

      // Período anterior
      const ventasAnt = ventasAntRes.data || []
      const totalAnt = ventasAnt.reduce((s: number, v: any) => s + (v.total || 0), 0)
      const cantAnt = ventasAnt.length
      setAnterior({ total: totalAnt, ticket: cantAnt > 0 ? totalAnt / cantAnt : 0, cantVentas: cantAnt })

      if (ventas.length === 0) {
        setKpis({ total: 0, ganancia: 0, ticket: 0, clientesUnicos: 0, cantVentas: 0, margen: 0, markup: 0, promedioDiario: 0, cobrado: 0, pendienteCC: 0, compras: 0, resultado: 0, diasPeriodo })
        setTopProductos([]); setTopClientes([]); setGraficoDiario([])
        return
      }

      // Detalle ventas en chunks
      const ventaIds = ventas.map((v: any) => v.id)
      const CHUNK = 200
      let detalles: any[] = []
      for (let i = 0; i < ventaIds.length; i += CHUNK) {
        const { data: det } = await supabase.from("detalle_ventas")
          .select("venta_id, producto_id, cantidad, precio, costo_unitario, bonificacion")
          .in("venta_id", ventaIds.slice(i, i + CHUNK))
        if (det) detalles = [...detalles, ...det]
      }

      // Productos únicos involucrados
      const productoIdsUnicos = [...new Set(detalles.map((d: any) => d.producto_id))]
      const productosMap: Record<number, { nombre: string; costoReal: number }> = {}
      for (let i = 0; i < productoIdsUnicos.length; i += CHUNK) {
        const { data: prods } = await supabase.from("productos")
          .select("id, nombre, costo").in("id", productoIdsUnicos.slice(i, i + CHUNK))
        prods?.forEach((p: any) => { productosMap[p.id] = { nombre: p.nombre, costoReal: p.costo ?? 0 } })
      }

      // ── KPIs base ─────────────────────────────────────────────────────────────
      const totalVendido = ventas.reduce((s: number, v: any) => s + (v.total || 0), 0)
      const cantVentas = ventas.length
      const ticket = cantVentas > 0 ? totalVendido / cantVentas : 0
      const clientesUnicos = new Set(ventas.filter((v: any) => v.cliente_id).map((v: any) => v.cliente_id)).size
      const promedioDiario = totalVendido / diasPeriodo

      let ganancia = 0
      let totalCosto = 0
      for (const d of detalles) {
        const costoReal = (d.costo_unitario && d.costo_unitario > 0)
          ? d.costo_unitario : (productosMap[d.producto_id]?.costoReal ?? 0)
        const bonif = d.bonificacion || 0
        const pagan = Math.max(0, d.cantidad - bonif)
        ganancia += d.precio * pagan - costoReal * d.cantidad
        totalCosto += costoReal * d.cantidad
      }
      const margen = totalVendido > 0 ? (ganancia / totalVendido) * 100 : 0
      const markup = totalCosto > 0 ? (ganancia / totalCosto) * 100 : 0

      // ── Cobrado vs CC ─────────────────────────────────────────────────────────
      // Sin duplicar: ventas directas = metodo_cobro no nulo (las CC siempre tienen
      // metodo_cobro NULL, aun cobradas). De los pagos solo contamos los de ventas CC.
      const pagos = pagosRes.data || []
      const idsPagos = [...new Set(pagos.map((p: any) => p.venta_id).filter((x: any) => x != null))]
      const metodoCobroPorVenta: Record<number, string | null> = {}
      if (idsPagos.length) {
        const { data: vInfo } = await supabase.from("ventas").select("id, metodo_cobro").in("id", idsPagos)
        ;(vInfo || []).forEach((v: any) => { metodoCobroPorVenta[v.id] = v.metodo_cobro })
      }
      const ventasCobradas = ventas.filter((v: any) => v.metodo_cobro != null)
      // Pendiente = solo las que SIGUEN en cuenta corriente sin saldar (estado),
      // no todas las metodo_cobro NULL (una CC ya cobrada queda metodo_cobro NULL pero estado 'cobrada').
      const ventasCC = ventas.filter((v: any) => v.estado === "cuenta_corriente")
      const cobradoVentas = ventasCobradas.reduce((s: number, v: any) => s + (v.total || 0), 0)
      const pagosCCperiodo = pagos
        .filter((p: any) => metodoCobroPorVenta[p.venta_id] == null)
        .reduce((s: number, p: any) => s + Number(p.monto), 0)
      const cobrado = cobradoVentas + pagosCCperiodo
      const pendienteCC = ventasCC.reduce((s: number, v: any) => s + (v.total || 0), 0)
      const compras = (comprasRes.data || []).reduce((s: number, c: any) => s + Number(c.total || 0), 0)
      const comprasPagadas = (comprasPagosRes.data || []).reduce((s: number, p: any) => s + Number(p.monto || 0), 0)
      const resultado = cobrado - comprasPagadas

      setKpis({ total: totalVendido, ganancia, ticket, clientesUnicos, cantVentas, margen, markup, promedioDiario, cobrado, pendienteCC, compras, resultado, diasPeriodo })

      // ── Top productos ─────────────────────────────────────────────────────────
      const prodMap: Record<string, any> = {}
      for (const d of detalles) {
        const pid = String(d.producto_id)
        const costoReal = (d.costo_unitario && d.costo_unitario > 0)
          ? d.costo_unitario : (productosMap[d.producto_id]?.costoReal ?? 0)
        const bonif = d.bonificacion || 0
        const pagan = Math.max(0, d.cantidad - bonif)
        if (!prodMap[pid]) prodMap[pid] = {
          producto_id: d.producto_id,
          nombre: productosMap[d.producto_id]?.nombre ?? ("Producto #" + d.producto_id),
          total_unidades: 0, total_revenue: 0, total_ganancia: 0,
        }
        prodMap[pid].total_unidades += d.cantidad
        prodMap[pid].total_revenue += d.precio * pagan
        prodMap[pid].total_ganancia += d.precio * pagan - costoReal * d.cantidad
      }
      setTopProductos(Object.values(prodMap).sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10))

      // ── Top clientes ──────────────────────────────────────────────────────────
      const clienteMap: Record<string, any> = {}
      for (const v of ventas) {
        if (!v.cliente_id) continue
        const cid = String(v.cliente_id)
        if (!clienteMap[cid]) clienteMap[cid] = { cliente_id: v.cliente_id, total: 0, cant: 0 }
        clienteMap[cid].total += v.total || 0
        clienteMap[cid].cant += 1
      }
      const topClientesData = Object.values(clienteMap).sort((a, b) => b.total - a.total).slice(0, 10)
      if (topClientesData.length > 0) {
        const clienteIds = topClientesData.map(c => c.cliente_id)
        const { data: clientes } = await supabase.from("clientes").select("id, nombre, apellido").in("id", clienteIds)
        const nom: Record<string, string> = {}
        clientes?.forEach((c: any) => { nom[String(c.id)] = `${c.nombre || ""} ${c.apellido || ""}`.trim() || "Sin nombre" })
        setTopClientes(topClientesData.map(c => ({ ...c, nombre: nom[String(c.cliente_id)] ?? "Sin nombre" })))
      } else { setTopClientes([]) }

      // ── Gráfico diario ────────────────────────────────────────────────────────
      const diasMap: Record<string, number> = {}
      for (const v of ventas) {
        const fecha = new Date(v.fecha).toLocaleDateString("sv-SE")
        diasMap[fecha] = (diasMap[fecha] || 0) + (v.total || 0)
      }
      setGraficoDiario(Object.entries(diasMap).sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, total]) => ({ fecha: fecha.slice(8, 10) + "/" + fecha.slice(5, 7), total: Math.round(total) })))

    } finally { setCargando(false) }
  }

  useEffect(() => { cargar() }, [desde, hasta])

  // Presets activo
  const hoyNow = new Date()
  const primerMes = new Date(hoyNow.getFullYear(), hoyNow.getMonth(), 1).toLocaleDateString("sv-SE")
  const hoyISO = hoyNow.toLocaleDateString("sv-SE")
  const primerMesAnt = new Date(hoyNow.getFullYear(), hoyNow.getMonth() - 1, 1).toLocaleDateString("sv-SE")
  const finMesAnt = new Date(hoyNow.getFullYear(), hoyNow.getMonth(), 0).toLocaleDateString("sv-SE")
  const hace3m = new Date(hoyNow); hace3m.setMonth(hace3m.getMonth() - 3)
  const hace3mISO = hace3m.toLocaleDateString("sv-SE")
  const inicioAnio = hoyNow.getFullYear() + "-01-01"
  function getActivePreset() {
    if (desde === primerMes && hasta === hoyISO) return "mes"
    if (desde === primerMesAnt && hasta === finMesAnt) return "mes_ant"
    if (desde === hace3mISO && hasta === hoyISO) return "3meses"
    if (desde === inicioAnio && hasta === hoyISO) return "anio"
    return ""
  }
  const activePreset = getActivePreset()
  const presetStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px", borderRadius: 8,
    border: active ? "1px solid #3b82f6" : "1px solid #e2e8f0",
    background: active ? "#eff6ff" : "white",
    color: active ? "#2563eb" : "#6b7280",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  })

  // Top productos ordenados según tab
  const topOrdenados = [...topProductos].sort((a, b) => {
    if (topTab === "unidades") return b.total_unidades - a.total_unidades
    if (topTab === "ganancia") return b.total_ganancia - a.total_ganancia
    return b.total_revenue - a.total_revenue
  })
  const maxTop = topOrdenados[0]
    ? (topTab === "unidades" ? topOrdenados[0].total_unidades : topTab === "ganancia" ? topOrdenados[0].total_ganancia : topOrdenados[0].total_revenue)
    : 1
  const maxClienteTotal = topClientes[0]?.total || 1

  const kpiCards = [
    {
      label: "Total vendido", value: fmtExacto(kpis.total), icon: "💰", color: "#2563eb", bg: "#eff6ff",
      sub: `${kpis.cantVentas} venta${kpis.cantVentas !== 1 ? "s" : ""}`,
      chip: <CambioChip actual={kpis.total} ant={anterior.total} />,
    },
    {
      label: "Ganancia estimada", value: fmtExacto(kpis.ganancia), icon: "📈",
      color: kpis.ganancia >= 0 ? "#16a34a" : "#dc2626",
      bg: kpis.ganancia >= 0 ? "#f0fdf4" : "#fef2f2",
      sub: "Costo histórico si disponible", chip: null,
    },
    {
      label: "Margen bruto", value: kpis.margen.toFixed(1) + "%", icon: "📊", color: "#7c3aed", bg: "#f5f3ff",
      sub: `Markup: ${kpis.markup.toFixed(1)}%`, chip: null,
    },
    {
      label: "Ticket promedio", value: fmtExacto(kpis.ticket), icon: "🧾", color: "#d97706", bg: "#fffbeb",
      sub: null, chip: <CambioChip actual={kpis.ticket} ant={anterior.ticket} />,
    },
    {
      label: "Promedio diario", value: fmt(kpis.promedioDiario), icon: "📅", color: "#0891b2", bg: "#ecfeff",
      sub: `en ${kpis.diasPeriodo} días`, chip: null,
    },
    {
      label: "Clientes únicos", value: String(kpis.clientesUnicos), icon: "👤", color: "#be185d", bg: "#fdf2f8",
      sub: kpis.clientesUnicos > 0 ? `${(kpis.cantVentas / kpis.clientesUnicos).toFixed(1)} compras/cliente` : null,
      chip: null,
    },
  ]

  const flujoCards = [
    {
      label: "Ingresos cobrados", value: fmt(kpis.cobrado), icon: "✅",
      color: "#16a34a", bg: "#f0fdf4", sub: "Ventas cobradas + pagos CC",
    },
    {
      label: "Pendiente CC", value: fmt(kpis.pendienteCC), icon: "⏳",
      color: "#d97706", bg: "#fffbeb", sub: "En cuenta corriente sin cobrar",
    },
    {
      label: "Compras del período", value: fmt(kpis.compras), icon: "🛒",
      color: "#dc2626", bg: "#fef2f2", sub: "Total gastado en stock",
    },
    {
      label: "Resultado neto", value: fmt(kpis.resultado), icon: kpis.resultado >= 0 ? "🟢" : "🔴",
      color: kpis.resultado >= 0 ? "#16a34a" : "#dc2626",
      bg: kpis.resultado >= 0 ? "#f0fdf4" : "#fef2f2",
      sub: "Cobrado − pagado a proveedores",
    },
  ]

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* ── Filtros ── */}
      <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="rep-filtros" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "nowrap", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", color: "#111827" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", color: "#111827" }} />
          </div>
          <button onClick={cargar}
            style={{ padding: "8px 18px", background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}>
            Aplicar
          </button>
          {cargando && <span style={{ fontSize: 12, color: "#9ca3af" }}>Cargando...</span>}
        </div>
        <div className="rep-presets" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            { key: "mes", label: "Este mes" },
            { key: "mes_ant", label: "Mes anterior" },
            { key: "3meses", label: "Últimos 3 meses" },
            { key: "anio", label: "Este año" },
          ].map(p => (
            <button key={p.key} onClick={() => applyPreset(p.key)} style={presetStyle(activePreset === p.key)}>{p.label}</button>
          ))}
          {anterior.total > 0 && (
            <span style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", marginLeft: 8 }}>
              Período anterior: {fmt(anterior.total)} · {anterior.cantVentas} ventas
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="rep-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
        {kpiCards.map(kpi => (
          <div key={kpi.label} style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{kpi.icon}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: kpi.color, display: "flex", alignItems: "center", flexWrap: "wrap" }}>
              {kpi.value}{kpi.chip}
            </div>
            {kpi.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Resultado del período ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>💼 Resultado del período</h2>
        <div className="rep-flujo" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {flujoCards.map(item => (
            <div key={item.label} style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{item.icon}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Gráfico diario ── */}
      <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>📈 Ventas por día</h3>
        {graficoDiario.length === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13 }}>
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={graficoDiario} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#9ca3af" }} />
              <YAxis tickFormatter={v => "$" + Math.round(v / 1000) + "k"} tick={{ fontSize: 11, fill: "#9ca3af" }} width={52} />
              <Tooltip
                formatter={(value: any) => [fmtExacto(Number(value ?? 0)), "Total"]}
                contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "white", fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#3b82f6" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Top productos + Top clientes ── */}
      <div className="rep-grids" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Top productos */}
        <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>🏆 Top 10 productos</h3>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              {([["facturacion", "$ Venta"], ["unidades", "Unid."], ["ganancia", "Ganancia"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTopTab(key)}
                  style={{ padding: "4px 10px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: topTab === key ? "#3b82f6" : "white", color: topTab === key ? "white" : "#6b7280" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {topOrdenados.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin datos</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topOrdenados.map((item, i) => {
                const valor = topTab === "unidades" ? item.total_unidades : topTab === "ganancia" ? item.total_ganancia : item.total_revenue
                const valorStr = topTab === "unidades" ? `${item.total_unidades} u.` : fmt(valor)
                const colorBarra = topTab === "ganancia" ? (valor >= 0 ? "#22c55e" : "#ef4444") : "#3b82f6"
                return (
                  <div key={item.producto_id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: i < 3 ? "#1e40af" : "#f1f5f9",
                        color: i < 3 ? "white" : "#6b7280",
                        fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: topTab === "ganancia" && valor < 0 ? "#dc2626" : "#374151", whiteSpace: "nowrap" }}>{valorStr}</span>
                    </div>
                    <div style={{ marginLeft: 32 }}>
                      <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${maxTop > 0 ? (Math.abs(valor) / Math.abs(maxTop)) * 100 : 0}%`, height: 4, background: colorBarra, borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top clientes */}
        <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>👥 Top 10 clientes</h3>
          {topClientes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin datos</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topClientes.map((item, i) => {
                const pctTotal = kpis.total > 0 ? (item.total / kpis.total) * 100 : 0
                return (
                  <div key={item.cliente_id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: i < 3 ? "#1e40af" : "#f1f5f9",
                        color: i < 3 ? "white" : "#6b7280",
                        fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, fontSize: 12, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</span>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{fmt(item.total)}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>{item.cant} compra{item.cant !== 1 ? "s" : ""} · {pctTotal.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div style={{ marginLeft: 32 }}>
                      <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(item.total / maxClienteTotal) * 100}%`, height: 4, background: "#a78bfa", borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
