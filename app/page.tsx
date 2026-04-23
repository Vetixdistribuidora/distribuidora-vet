"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

function fmt(num: number) {
  return "$" + Math.round(num).toLocaleString("es-AR")
}

function fmtExacto(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function estadoLote(dias: number) {
  if (dias < 0) return { label: "Vencido", color: "#f87171", bg: "rgba(239,68,68,0.12)" }
  if (dias <= 30) return { label: "Crítico", color: "#f87171", bg: "rgba(239,68,68,0.12)" }
  if (dias <= 60) return { label: "Próximo", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" }
  return { label: "OK", color: "#4ade80", bg: "rgba(74,222,128,0.12)" }
}

type ModalTipo = "stockBajo" | "sinVentas" | "sinRotacion" | "lotes" | "ventasHoy" | "ventasMes" | "detalleVenta" | null

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>({})
  const [alertas, setAlertas] = useState<any>({ stockBajo: [], sinVentas: [], sinRotacion: [] })
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])
  const [lotesPorVencer, setLotesPorVencer] = useState<any[]>([])
  const [ventasHoyLista, setVentasHoyLista] = useState<any[]>([])
  const [ventasMesLista, setVentasMesLista] = useState<any[]>([])
  const [modal, setModal] = useState<ModalTipo>(null)
  const [ventaDetalle, setVentaDetalle] = useState<any>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  useEffect(() => { iniciar() }, [])

  async function iniciar() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) { router.push("/login"); return }
    await cargarDatos()
    setLoading(false)
  }

  async function cargarDatos() {
    const hoy = new Date().toISOString().slice(0, 10)
    const inicioMes = new Date(); inicioMes.setDate(1)
    const mesAnterior = new Date(); mesAnterior.setMonth(mesAnterior.getMonth() - 1); mesAnterior.setDate(1)

    const { data: ventas } = await supabase.from("ventas").select("*, clientes(nombre, apellido)")
    const { data: productos } = await supabase.from("productos").select("*")
    const { data: detalleVentas } = await supabase.from("detalle_ventas").select("producto_id, cantidad")

    const ventasHoy = ventas?.filter(v => v.fecha.startsWith(hoy)) || []
    const ventasMes = ventas?.filter(v => v.fecha >= inicioMes.toISOString()) || []
    const ventasMesAnterior = ventas?.filter(v =>
      v.fecha >= mesAnterior.toISOString() && v.fecha < inicioMes.toISOString()
    ) || []

    const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0)
    const totalMes = ventasMes.reduce((acc, v) => acc + Number(v.total), 0)
    const totalAnterior = ventasMesAnterior.reduce((acc, v) => acc + Number(v.total), 0)
    const crecimiento = totalAnterior ? ((totalMes - totalAnterior) / totalAnterior) * 100 : 0
    const ticketPromedio = ventasMes.length ? totalMes / ventasMes.length : 0

    let ganancia = 0
    if (detalleVentas && productos) {
      detalleVentas.forEach(d => {
        const prod = productos.find(p => p.id === d.producto_id)
        if (prod) ganancia += (prod.precio_venta - prod.costo) * d.cantidad
      })
    }

    const margen = totalMes ? (ganancia / totalMes) * 100 : 0
    const capitalStock = productos?.reduce((acc, p) => acc + p.costo * p.stock, 0) || 0
    const stockBajo = productos?.filter(p => p.stock <= 5) || []
    const vendidosIds = new Set(detalleVentas?.map(d => d.producto_id))
    const sinVentas = productos?.filter(p => !vendidosIds.has(p.id)) || []
    const sinRotacion = productos?.filter(p => !detalleVentas?.some(d => d.producto_id === p.id)) || []

    setKpis({ totalHoy, totalMes, ganancia, margen, crecimiento, ticketPromedio, cantidadVentas: ventasMes.length, cantidadHoy: ventasHoy.length, capitalStock })
    setAlertas({ stockBajo, sinVentas, sinRotacion })
    setVentasHoyLista(ventasHoy)
    setVentasMesLista(ventasMes)

    const en90 = new Date(); en90.setDate(en90.getDate() + 90)
    const { data: lotes } = await supabase
      .from("lotes_con_stock")
      .select("*")
      .lte("fecha_vencimiento", en90.toISOString().slice(0, 10))
      .order("fecha_vencimiento", { ascending: true })
    setLotesPorVencer(lotes || [])

    const ultimos7 = [...Array(7)].map((_, i) => {
      const fecha = new Date(); fecha.setDate(fecha.getDate() - i)
      const f = fecha.toISOString().slice(0, 10)
      const total = ventas?.filter(v => v.fecha.startsWith(f)).reduce((acc, v) => acc + Number(v.total), 0) || 0
      return { fecha: f.slice(5), total }
    }).reverse()
    setVentasGrafico(ultimos7)
  }

  async function verDetalleVenta(venta: any) {
    setVentaDetalle(venta)
    setLoadingDetalle(true)
    setModal("detalleVenta")
    const { data } = await supabase
      .from("detalle_ventas")
      .select("*, productos(nombre)")
      .eq("venta_id", venta.id)
    setDetalleItems(data || [])
    setLoadingDetalle(false)
  }

  function cerrarModal() { setModal(null); setVentaDetalle(null); setDetalleItems([]) }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0c0f1a" }}>
      <p style={{ color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>🔐 Cargando...</p>
    </div>
  )

  const kpiCards = [
    { titulo: "Ventas hoy", valor: fmt(kpis.totalHoy), sub: `${kpis.cantidadHoy} venta${kpis.cantidadHoy !== 1 ? "s" : ""}`, icon: "☀️", color: "#3b82f6", onClick: () => setModal("ventasHoy") },
    { titulo: "Ventas del mes", valor: fmt(kpis.totalMes), sub: `${kpis.cantidadVentas} ventas`, icon: "📅", color: "#6366f1", onClick: () => setModal("ventasMes") },
    { titulo: "Ganancia", valor: fmt(kpis.ganancia), sub: `Margen ${kpis.margen?.toFixed(1)}%`, icon: "💰", color: "#22c55e", onClick: undefined },
    { titulo: "Ticket promedio", valor: fmt(kpis.ticketPromedio), sub: "Este mes", icon: "🧾", color: "#f59e0b", onClick: undefined },
    { titulo: "Crecimiento", valor: (kpis.crecimiento >= 0 ? "+" : "") + kpis.crecimiento?.toFixed(1) + "%", sub: "vs mes anterior", icon: "📈", color: kpis.crecimiento >= 0 ? "#22c55e" : "#ef4444", onClick: undefined },
    { titulo: "Capital en stock", valor: fmt(kpis.capitalStock), sub: "Valor de inventario", icon: "📦", color: "#a78bfa", onClick: undefined },
  ]

  const alertaCards = [
    { titulo: "Stock bajo", valor: alertas.stockBajo.length, icon: "⚠️", tipo: "stockBajo" as ModalTipo, sub: "≤ 5 unidades" },
    { titulo: "Sin ventas", valor: alertas.sinVentas.length, icon: "🚫", tipo: "sinVentas" as ModalTipo, sub: "Nunca vendidos" },
    { titulo: "Sin rotación", valor: alertas.sinRotacion.length, icon: "🔄", tipo: "sinRotacion" as ModalTipo, sub: "Sin movimiento" },
    { titulo: "Vencen en 90d", valor: lotesPorVencer.length, icon: "📅", tipo: "lotes" as ModalTipo, sub: "Lotes próximos" },
  ]

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f1f5f9", minHeight: "100vh", padding: 24 }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        {kpiCards.map(k => (
          <div key={k.titulo}
            onClick={k.onClick}
            style={{
              background: "white", borderRadius: 16, padding: "20px 22px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
              cursor: k.onClick ? "pointer" : "default",
              transition: "transform 0.15s, box-shadow 0.15s",
              position: "relative", overflow: "hidden"
            }}
            onMouseEnter={e => { if (k.onClick) { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)" } }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: k.color, borderRadius: "16px 0 0 16px" }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase" }}>{k.titulo}</span>
                <span style={{ fontSize: 18 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{k.valor}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                {k.sub}
                {k.onClick && <span style={{ color: k.color, marginLeft: 6, fontWeight: 600 }}>Ver →</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>⚠️ Alertas</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {alertaCards.map(a => {
            const hayProblema = a.valor > 0
            return (
              <button key={a.titulo}
                onClick={() => setModal(a.tipo)}
                style={{
                  background: hayProblema ? "#0f172a" : "white",
                  border: hayProblema ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
                  borderRadius: 14, padding: "16px 18px", cursor: "pointer",
                  textAlign: "left", transition: "transform 0.15s, box-shadow 0.15s",
                  boxShadow: hayProblema ? "0 4px 16px rgba(0,0,0,0.2)" : "0 1px 4px rgba(0,0,0,0.05)"
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span style={{
                    fontSize: 22, fontWeight: 800,
                    color: hayProblema ? "#f87171" : "#22c55e"
                  }}>{a.valor}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: hayProblema ? "white" : "#374151" }}>{a.titulo}</div>
                <div style={{ fontSize: 11, color: hayProblema ? "#6b7280" : "#94a3b8", marginTop: 2 }}>{a.sub}</div>
                <div style={{ fontSize: 11, color: hayProblema ? "#3b82f6" : "#94a3b8", marginTop: 6, fontWeight: 600 }}>
                  {hayProblema ? "Ver detalle →" : "Sin problemas ✓"}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gráfico + Vencimientos */}
      <div style={{ display: "grid", gridTemplateColumns: lotesPorVencer.length > 0 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#374151" }}>📈 Ventas últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ventasGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip formatter={(v: any) => [fmt(v), "Total"]} labelStyle={{ color: "#374151" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {lotesPorVencer.length > 0 && (
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>📅 Próximos vencimientos</h3>
              <button onClick={() => setModal("lotes")} style={{ background: "rgba(59,130,246,0.15)", border: "none", color: "#3b82f6", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                Ver todos
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lotesPorVencer.slice(0, 5).map((l: any) => {
                const dias = l.dias_para_vencer
                const est = estadoLote(dias)
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.producto_nombre}</div>
                      <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{l.fecha_vencimiento} · {l.cantidad} u.</div>
                    </div>
                    <span style={{ background: est.bg, color: est.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, marginLeft: 8, flexShrink: 0 }}>
                      {dias < 0 ? "Vencido" : `${dias}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALES ── */}
      {modal && modal !== "detalleVenta" && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={cerrarModal}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 520, maxHeight: "80vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>

            {/* Stock bajo */}
            {modal === "stockBajo" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>⚠️ Productos con stock bajo</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Stock igual o menor a 5 unidades</p>
                {alertas.stockBajo.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ No hay productos con stock bajo</p>
                ) : alertas.stockBajo.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    <span style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 6 }}>
                      {p.stock} u.
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Sin ventas */}
            {modal === "sinVentas" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>🚫 Productos sin ventas</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Nunca fueron vendidos</p>
                {alertas.sinVentas.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ Todos los productos tienen ventas</p>
                ) : alertas.sinVentas.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>Stock: {p.stock}</span>
                  </div>
                ))}
              </>
            )}

            {/* Sin rotación */}
            {modal === "sinRotacion" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>🔄 Productos sin rotación</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Sin movimiento de ventas registrado</p>
                {alertas.sinRotacion.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ Todos los productos rotan</p>
                ) : alertas.sinRotacion.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>Stock: {p.stock}</span>
                  </div>
                ))}
              </>
            )}

            {/* Lotes */}
            {modal === "lotes" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📅 Lotes por vencer</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Próximos 90 días</p>
                {lotesPorVencer.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ No hay lotes próximos a vencer</p>
                ) : lotesPorVencer.map((l: any) => {
                  const est = estadoLote(l.dias_para_vencer)
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{l.producto_nombre}</div>
                        <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{l.fecha_vencimiento} · {l.cantidad} u.</div>
                      </div>
                      <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 }}>
                        {l.dias_para_vencer < 0 ? "Vencido" : `${l.dias_para_vencer}d`}
                      </span>
                    </div>
                  )
                })}
              </>
            )}

            {/* Ventas hoy */}
            {modal === "ventasHoy" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>☀️ Ventas de hoy</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
                  {ventasHoyLista.length} venta{ventasHoyLista.length !== 1 ? "s" : ""} · Total: <span style={{ color: "white", fontWeight: 700 }}>{fmt(kpis.totalHoy)}</span>
                </p>
                {ventasHoyLista.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: 14 }}>Sin ventas registradas hoy</p>
                ) : ventasHoyLista.map((v: any) => (
                  <div key={v.id}
                    onClick={() => verDetalleVenta(v)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(59,130,246,0.1)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"}
                  >
                    <div>
                      <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>
                        {v.clientes?.nombre} {v.clientes?.apellido}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                        N° {v.nro_factura} · {v.estado === "cuenta_corriente" ? "⏳ Cuenta corriente" : "✅ Cobrada"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>{fmtExacto(v.total)}</div>
                      <div style={{ color: "#3b82f6", fontSize: 10, marginTop: 2 }}>Ver detalle →</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Ventas mes */}
            {modal === "ventasMes" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📅 Ventas del mes</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
                  {ventasMesLista.length} venta{ventasMesLista.length !== 1 ? "s" : ""} · Total: <span style={{ color: "white", fontWeight: 700 }}>{fmt(kpis.totalMes)}</span>
                </p>
                {ventasMesLista.length === 0 ? (
                  <p style={{ color: "#6b7280", fontSize: 14 }}>Sin ventas este mes</p>
                ) : [...ventasMesLista].reverse().map((v: any) => (
                  <div key={v.id}
                    onClick={() => verDetalleVenta(v)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(59,130,246,0.1)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"}
                  >
                    <div>
                      <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>
                        {v.clientes?.nombre} {v.clientes?.apellido}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                        {v.fecha?.slice(0, 10)} · N° {v.nro_factura} · {v.estado === "cuenta_corriente" ? "⏳ CC" : "✅ Cobrada"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 14 }}>{fmtExacto(v.total)}</div>
                      <div style={{ color: "#3b82f6", fontSize: 10, marginTop: 2 }}>Ver detalle →</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            <button onClick={cerrarModal} style={{ marginTop: 20, width: "100%", padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal detalle venta */}
      {modal === "detalleVenta" && ventaDetalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
          onClick={cerrarModal}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>
                {ventaDetalle.clientes?.nombre} {ventaDetalle.clientes?.apellido}
              </h2>
              <p style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>
                N° {ventaDetalle.nro_factura} · {ventaDetalle.fecha?.slice(0, 10)} · {ventaDetalle.estado === "cuenta_corriente" ? "⏳ Cuenta corriente" : "✅ Cobrada"}
              </p>
            </div>

            {loadingDetalle ? (
              <p style={{ color: "#6b7280", fontSize: 13 }}>Cargando...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {detalleItems.map((d: any) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{d.productos?.nombre}</div>
                      <div style={{ color: "#6b7280", fontSize: 11 }}>{d.cantidad} u. × {fmtExacto(d.precio)}</div>
                    </div>
                    <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{fmtExacto(d.cantidad * d.precio)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>Total</span>
              <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>{fmtExacto(ventaDetalle.total)}</span>
            </div>

            <button onClick={cerrarModal} style={{ marginTop: 20, width: "100%", padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}