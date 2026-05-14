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
    .rep-grids { grid-template-columns: 1fr !important; }
    .rep-filtros { flex-wrap: wrap !important; }
    .rep-presets { flex-wrap: wrap !important; }
  }
`

export default function Reportes() {
  const hoy = new Date()
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10)
  const hoyStr = hoy.toISOString().slice(0, 10)

  const [desde, setDesde] = useState(primerDiaMes)
  const [hasta, setHasta] = useState(hoyStr)
  const [cargando, setCargando] = useState(false)

  const [kpis, setKpis] = useState({ total: 0, ganancia: 0, ticket: 0, clientesUnicos: 0, cantVentas: 0 })
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [topClientes, setTopClientes] = useState<any[]>([])
  const [graficoDiario, setGraficoDiario] = useState<any[]>([])

  function applyPreset(preset: string) {
    const hoy = new Date()
    if (preset === "mes") {
      setDesde(new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10))
      setHasta(hoy.toISOString().slice(0, 10))
    } else if (preset === "mes_ant") {
      const ini = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      setDesde(ini.toISOString().slice(0, 10)); setHasta(fin.toISOString().slice(0, 10))
    } else if (preset === "3meses") {
      const ini = new Date(hoy); ini.setMonth(ini.getMonth() - 3)
      setDesde(ini.toISOString().slice(0, 10)); setHasta(hoy.toISOString().slice(0, 10))
    } else if (preset === "anio") {
      setDesde(hoy.getFullYear() + "-01-01"); setHasta(hoy.toISOString().slice(0, 10))
    }
  }

  async function cargar() {
    setCargando(true)
    try {
      // 1. Query ventas in range
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select("id, total, cliente_id, fecha")
        .gte("fecha", desde)
        .lte("fecha", hasta + "T23:59:59")
        .neq("estado", "anulada")

      if (ventasError || !ventas) { setCargando(false); return }

      if (ventas.length === 0) {
        setKpis({ total: 0, ganancia: 0, ticket: 0, clientesUnicos: 0, cantVentas: 0 })
        setTopProductos([])
        setTopClientes([])
        setGraficoDiario([])
        setCargando(false)
        return
      }

      // 2. Get venta IDs → query detalle_ventas (sin join, para evitar errores de FK)
      const ventaIds = ventas.map((v: any) => v.id)

      const CHUNK = 200
      let detalles: any[] = []
      for (let i = 0; i < ventaIds.length; i += CHUNK) {
        const chunk = ventaIds.slice(i, i + CHUNK)
        const { data: det } = await supabase
          .from("detalle_ventas")
          .select("venta_id, producto_id, cantidad, precio")
          .in("venta_id", chunk)
        if (det) detalles = [...detalles, ...det]
      }

      // Fetch nombres y costos de productos involucrados
      const productoIdsUnicos = [...new Set(detalles.map((d: any) => d.producto_id))]
      const productosMap: Record<number, { nombre: string, costo: number }> = {}
      if (productoIdsUnicos.length > 0) {
        for (let i = 0; i < productoIdsUnicos.length; i += CHUNK) {
          const chunk = productoIdsUnicos.slice(i, i + CHUNK)
          const { data: prods } = await supabase
            .from("productos")
            .select("id, nombre, costo")
            .in("id", chunk)
          prods?.forEach((p: any) => { productosMap[p.id] = { nombre: p.nombre, costo: p.costo ?? 0 } })
        }
      }

      // 3. Calculate KPIs
      const totalVendido = ventas.reduce((sum: number, v: any) => sum + (v.total || 0), 0)
      const cantVentas = ventas.length
      const ticket = cantVentas > 0 ? totalVendido / cantVentas : 0
      const clientesUnicos = new Set(ventas.filter((v: any) => v.cliente_id).map((v: any) => v.cliente_id)).size

      let ganancia = 0
      for (const d of detalles) {
        const costo = productosMap[d.producto_id]?.costo ?? 0
        ganancia += (d.precio - costo) * d.cantidad
      }

      setKpis({ total: totalVendido, ganancia, ticket, clientesUnicos, cantVentas })

      // 4. Group detalle_ventas by producto_id para top productos
      const prodMap: Record<string, { producto_id: number, nombre: string, total_unidades: number }> = {}
      for (const d of detalles) {
        const pid = String(d.producto_id)
        if (!prodMap[pid]) {
          prodMap[pid] = {
            producto_id: d.producto_id,
            nombre: productosMap[d.producto_id]?.nombre ?? "Producto #" + d.producto_id,
            total_unidades: 0
          }
        }
        prodMap[pid].total_unidades += d.cantidad
      }
      const topProds = Object.values(prodMap)
        .sort((a, b) => b.total_unidades - a.total_unidades)
        .slice(0, 10)
      setTopProductos(topProds)

      // 5. Group ventas by cliente_id for top clientes
      const clienteMap: Record<string, { cliente_id: string, total: number, cant: number }> = {}
      for (const v of ventas) {
        if (!v.cliente_id) continue
        const cid = String(v.cliente_id)
        if (!clienteMap[cid]) clienteMap[cid] = { cliente_id: v.cliente_id, total: 0, cant: 0 }
        clienteMap[cid].total += v.total || 0
        clienteMap[cid].cant += 1
      }
      const topClientesData = Object.values(clienteMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)

      // Fetch client names
      if (topClientesData.length > 0) {
        const clienteIds = topClientesData.map(c => c.cliente_id)
        const { data: clientes } = await supabase
          .from("clientes")
          .select("id, nombre, apellido")
          .in("id", clienteIds)
        const clienteNombres: Record<string, string> = {}
        clientes?.forEach((c: any) => {
          clienteNombres[String(c.id)] = `${c.nombre || ""} ${c.apellido || ""}`.trim() || "Sin nombre"
        })
        const topClientesConNombre = topClientesData.map(c => ({
          ...c,
          nombre: clienteNombres[String(c.cliente_id)] ?? "Sin nombre",
        }))
        setTopClientes(topClientesConNombre)
      } else {
        setTopClientes([])
      }

      // 6. Build graficoDiario: group ventas by date string
      const diasMap: Record<string, number> = {}
      for (const v of ventas) {
        const fecha = String(v.fecha).slice(0, 10)
        diasMap[fecha] = (diasMap[fecha] || 0) + (v.total || 0)
      }
      const grafico = Object.entries(diasMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([fecha, total]) => ({ fecha: fecha.slice(8, 10) + "/" + fecha.slice(5, 7), total: Math.round(total) }))
      setGraficoDiario(grafico)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [desde, hasta])

  const presetStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 8,
    border: active ? "1px solid #3b82f6" : "1px solid #e2e8f0",
    background: active ? "#eff6ff" : "white",
    color: active ? "#2563eb" : "#6b7280",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  })

  const presets = [
    { key: "mes", label: "Este mes" },
    { key: "mes_ant", label: "Mes anterior" },
    { key: "3meses", label: "Últimos 3 meses" },
    { key: "anio", label: "Este año" },
  ]

  // Determine active preset
  const hoyNow = new Date()
  const primerMes = new Date(hoyNow.getFullYear(), hoyNow.getMonth(), 1).toISOString().slice(0, 10)
  const hoyISO = hoyNow.toISOString().slice(0, 10)
  const primerMesAnt = new Date(hoyNow.getFullYear(), hoyNow.getMonth() - 1, 1).toISOString().slice(0, 10)
  const finMesAnt = new Date(hoyNow.getFullYear(), hoyNow.getMonth(), 0).toISOString().slice(0, 10)
  const hace3m = new Date(hoyNow); hace3m.setMonth(hace3m.getMonth() - 3)
  const hace3mISO = hace3m.toISOString().slice(0, 10)
  const inicioAnio = hoyNow.getFullYear() + "-01-01"

  function getActivePreset() {
    if (desde === primerMes && hasta === hoyISO) return "mes"
    if (desde === primerMesAnt && hasta === finMesAnt) return "mes_ant"
    if (desde === hace3mISO && hasta === hoyISO) return "3meses"
    if (desde === inicioAnio && hasta === hoyISO) return "anio"
    return ""
  }
  const activePreset = getActivePreset()

  const maxUnidades = topProductos[0]?.total_unidades || 1
  const maxClienteTotal = topClientes[0]?.total || 1

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* Filtros */}
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
          {presets.map(p => (
            <button key={p.key} onClick={() => applyPreset(p.key)} style={presetStyle(activePreset === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="rep-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {[
          { label: "Total vendido", value: fmtExacto(kpis.total), icon: "💰", color: "#2563eb", bg: "#eff6ff" },
          { label: "Ganancia", value: fmtExacto(kpis.ganancia), icon: "📈", color: "#16a34a", bg: "#f0fdf4" },
          { label: "Ticket promedio", value: fmtExacto(kpis.ticket), icon: "🧾", color: "#7c3aed", bg: "#f5f3ff" },
          { label: "Clientes únicos", value: String(kpis.clientesUnicos), icon: "👤", color: "#d97706", bg: "#fffbeb" },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "white", borderRadius: 14, padding: "20px 22px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                {kpi.icon}
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
            {kpi.label === "Total vendido" && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{kpis.cantVentas} ventas</div>
            )}
          </div>
        ))}
      </div>

      {/* Gráfico diario */}
      <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Ventas por día</h3>
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [fmtExacto(Number(value ?? 0)), "Total"]}
                contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "white", fontSize: 12 }}
                labelStyle={{ color: "#9ca3af" }}
              />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#3b82f6" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top productos + Top clientes */}
      <div className="rep-grids" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Top 10 productos */}
        <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Top 10 productos más vendidos</h3>
          {topProductos.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin datos</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topProductos.map((item, i) => (
                <div key={item.producto_id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: i < 3 ? "#1e40af" : "#f1f5f9",
                      color: i < 3 ? "white" : "#6b7280",
                      fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{item.total_unidades} u.</span>
                  </div>
                  <div style={{ marginLeft: 32 }}>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(item.total_unidades / maxUnidades) * 100}%`, height: 4, background: "#3b82f6", borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 10 clientes */}
        <div style={{ background: "white", borderRadius: 14, padding: "20px 24px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Top 10 clientes</h3>
          {topClientes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Sin datos</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topClientes.map((item, i) => (
                <div key={item.cliente_id}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6,
                      background: i < 3 ? "#1e40af" : "#f1f5f9",
                      color: i < 3 ? "white" : "#6b7280",
                      fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                    }}>{i + 1}</span>
                    <span style={{ flex: 1, fontSize: 13, color: "#111827", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</span>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{fmt(item.total)}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.cant} compra{item.cant !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <div style={{ marginLeft: 32 }}>
                    <div style={{ height: 4, background: "#f1f5f9", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(item.total / maxClienteTotal) * 100}%`, height: 4, background: "#a78bfa", borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
