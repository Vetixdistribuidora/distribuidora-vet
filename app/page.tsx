"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"

function fmt(num: number) {
  return "$" + Math.round(num).toLocaleString("es-AR")
}
function fechaLocal(f: string | null | undefined): string {
  if (!f) return ""
  // Si es solo fecha (YYYY-MM-DD) agregar T00:00:00 para evitar desfase UTC
  const d = f.includes("T") ? new Date(f) : new Date(f + "T00:00:00")
  return d.toLocaleDateString("es-AR")
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

// dias_para_vencer puede no venir de la vista — calcular desde fecha_vencimiento como fallback
function diasParaVencer(l: any): number {
  if (l.dias_para_vencer != null) return Number(l.dias_para_vencer)
  if (!l.fecha_vencimiento) return 999
  return Math.floor((new Date(l.fecha_vencimiento + "T00:00:00").getTime() - Date.now()) / 86400000)
}

type ModalTipo = "stockBajo" | "sinStock" | "sinVentas" | "sinRotacion" | "lotes" | "ventasHoy" | "ventasMes" | "detalleVenta" | "cuentasCC" | null

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [kpis, setKpis] = useState<any>({})
  const [alertas, setAlertas] = useState<any>({ sinStock: [], stockBajo: [], sinVentas: [], sinRotacion: [] })
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])
  const [ventasMensual, setVentasMensual] = useState<any[]>([])
  const [periodoGrafico, setPeriodoGrafico] = useState<"7dias" | "6meses">("7dias")
  const [lotesPorVencer, setLotesPorVencer] = useState<any[]>([])
  const [ventasHoyLista, setVentasHoyLista] = useState<any[]>([])
  const [ventasMesLista, setVentasMesLista] = useState<any[]>([])
  const [ccPendientes, setCcPendientes] = useState<any[]>([])
  const [topProductosMes, setTopProductosMes] = useState<any[]>([])
  const [modal, setModal] = useState<ModalTipo>(null)
  const [ventaDetalle, setVentaDetalle] = useState<any>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [loadingModalLista, setLoadingModalLista] = useState(false)

  useEffect(() => { iniciar() }, [])

  async function iniciar() {
    setLoading(true)
    setErrorCarga(null)
    try {
      await cargarDatos()
    } catch (e: any) {
      console.error("Error cargando dashboard:", e)
      setErrorCarga("Error al cargar el dashboard: " + (e?.message || "error desconocido"))
    } finally {
      setLoading(false)
    }
  }

  async function cargarDatos() {
    const hoyDate = new Date()

    // ── Fechas en hora LOCAL (Argentina = UTC-3) ──────────────────────────────
    // toLocaleDateString("sv-SE") devuelve YYYY-MM-DD usando la hora del navegador
    const hoyStr = hoyDate.toLocaleDateString("sv-SE")
    // Medianoche local convertida a UTC para queries Supabase (timestamptz)
    // Ej. Argentina: "2026-05-20T00:00:00" local → "2026-05-20T03:00:00.000Z" UTC
    const inicioHoyUTC = new Date(hoyStr + "T00:00:00").toISOString()
    // Inicio de mes: new Date(y, m, 1) ya usa hora local → toISOString() es correcto
    const inicioMesDate = new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1)
    const inicioMesStr = inicioMesDate.toISOString()
    // Mismo tramo del mes anterior (para "Crecimiento" justo: lo que va del mes vs igual
    // cantidad de días del mes pasado, no contra el mes pasado completo).
    const spanMs = hoyDate.getTime() - inicioMesDate.getTime()
    const prevMesInicio = new Date(hoyDate.getFullYear(), hoyDate.getMonth() - 1, 1)
    const prevMesInicioUTC = prevMesInicio.toISOString()
    const prevMesHastaUTC = new Date(prevMesInicio.getTime() + spanMs).toISOString()
    // 90 días usando fecha local
    const d90 = new Date(hoyDate); d90.setDate(d90.getDate() + 90)
    const en90Str = d90.toLocaleDateString("sv-SE")

    // ── Todo en paralelo: 1 RPC + 7 queries pequeñas ─────────────────────────
    const [kpisRes, lotesRes, ccRes, ventasHoyRes, ventasMesRes, prodRes, pagosHoyRes, pagosMesRes, ventasPrevMTDRes] = await Promise.all([
      supabase.rpc("dashboard_kpis"),
      supabase.from("lotes_con_stock").select("*")
        .lte("fecha_vencimiento", en90Str).order("fecha_vencimiento", { ascending: true }),
      supabase.from("ventas")
        .select("id, total, nro_factura, fecha, clientes(nombre, apellido)")
        .eq("estado", "cuenta_corriente").order("id", { ascending: false }),
      supabase.from("ventas")
        .select("id, total, nro_factura, fecha, estado, metodo_cobro, clientes(nombre, apellido)")
        .gte("fecha", inicioHoyUTC).neq("estado", "anulada"),
      supabase.from("ventas")
        .select("id, total, nro_factura, fecha, estado, metodo_cobro, clientes(nombre, apellido)")
        .gte("fecha", inicioMesStr).neq("estado", "anulada").order("id", { ascending: false }),
      // Solo traer productos con stock bajo o sin stock — evita cargar 9000+ filas
      // para luego filtrar. Supabase devuelve máx 1000 sin paginación explícita.
      supabase.from("productos").select("id, nombre, stock").or("stock.is.null,stock.lte.5"),
      supabase.from("pagos_cuenta_corriente").select("venta_id, monto").gte("fecha", inicioHoyUTC),
      supabase.from("pagos_cuenta_corriente").select("venta_id, monto").gte("fecha", inicioMesStr),
      // Ventas del MISMO tramo del mes anterior (para Crecimiento)
      supabase.from("ventas").select("total")
        .gte("fecha", prevMesInicioUTC).lt("fecha", prevMesHastaUTC).neq("estado", "anulada"),
    ])

    const k = kpisRes.data as any
    if (!k) return

    // ── KPIs (todos vienen calculados del servidor) ───────────────────────────
    // Crecimiento: lo que va del mes (total_mes) vs el MISMO tramo del mes anterior
    // (no el mes anterior completo), para que la comparación sea justa desde el día 1.
    const totalPrevMTD = (ventasPrevMTDRes.data || []).reduce((s: number, v: any) => s + Number(v.total || 0), 0)
    const crecimiento = totalPrevMTD > 0
      ? ((Number(k.total_mes) - totalPrevMTD) / totalPrevMTD) * 100 : 0
    const margen = Number(k.total_mes) > 0 ? (Number(k.ganancia_mes) / Number(k.total_mes)) * 100 : 0

    // ── Efectivo real ingresado (ventas directas cobradas + cobros de CC) ─────
    // IMPORTANTE: una venta directa inserta fila en `ventas` Y en `pagos_cuenta_corriente`.
    // Para NO duplicar, las ventas directas se identifican por `metodo_cobro` no nulo
    // (las cuentas corrientes siempre tienen metodo_cobro NULL, aun cobradas), y de los
    // pagos solo se cuentan los que corresponden a ventas CC (metodo_cobro NULL).
    const ventasHoyData = ventasHoyRes.data || []
    const ventasMesData = ventasMesRes.data || []
    const pagosHoy = pagosHoyRes.data || []
    const pagosMes = pagosMesRes.data || []

    // Mapa venta_id → metodo_cobro para los pagos (las ventas pueden ser de otro mes)
    const idsPagos = [...new Set([...pagosHoy, ...pagosMes].map((p: any) => p.venta_id).filter((x: any) => x != null))]
    const metodoCobroPorVenta: Record<number, string | null> = {}
    if (idsPagos.length) {
      const { data: vInfo } = await supabase.from("ventas").select("id, metodo_cobro").in("id", idsPagos)
      ;(vInfo || []).forEach((v: any) => { metodoCobroPorVenta[v.id] = v.metodo_cobro })
    }
    const esCobroCC = (p: any) => metodoCobroPorVenta[p.venta_id] == null

    const cobradoHoy =
      ventasHoyData.filter((v: any) => v.metodo_cobro != null).reduce((s: number, v: any) => s + Number(v.total), 0) +
      pagosHoy.filter(esCobroCC).reduce((s: number, p: any) => s + Number(p.monto), 0)
    const cobradoMes =
      ventasMesData.filter((v: any) => v.metodo_cobro != null).reduce((s: number, v: any) => s + Number(v.total), 0) +
      pagosMes.filter(esCobroCC).reduce((s: number, p: any) => s + Number(p.monto), 0)

    setKpis({
      totalHoy: Number(k.total_hoy), cantidadHoy: Number(k.cant_hoy),
      totalMes: Number(k.total_mes), cantidadVentas: Number(k.cant_mes),
      ganancia: Number(k.ganancia_mes), margen,
      crecimiento, ticketPromedio: Number(k.ticket_promedio),
      capitalStock: Number(k.capital_stock),
      totalComprasMes: Number(k.total_compras_mes),
      totalCC: Number(k.total_cc), cantidadCC: Number(k.cant_cc),
      cobradoHoy, cobradoMes,
    })

    // ── Alertas: sinStock/stockBajo desde productos, conteos del RPC ──────────
    const productos = prodRes.data || []
    const sinStock = productos.filter((p: any) => p.stock == null || p.stock === 0)
    const stockBajo = productos.filter((p: any) => p.stock != null && p.stock > 0 && p.stock <= 5)
    // sinVentas y sinRotacion: count del RPC, lista se carga cuando se abre el modal
    setAlertas({
      sinStock, stockBajo,
      sinVentas: [], sinRotacion: [],
      sinVentasCount: Number(k.sin_ventas),
      sinRotacionCount: Number(k.sin_rotacion),
    })

    // ── Listas para modales ───────────────────────────────────────────────────
    setLotesPorVencer(lotesRes.data || [])
    setCcPendientes(ccRes.data || [])
    setVentasHoyLista(ventasHoyData)
    setVentasMesLista(ventasMesData)

    // ── Top productos (viene del RPC) ─────────────────────────────────────────
    setTopProductosMes(k.top_productos || [])

    // ── Gráfico 7 días: llena días sin ventas con 0 ───────────────────────────
    const map7: Record<string, number> = {}
    ;(k.grafico_7dias || []).forEach((d: any) => { map7[d.fecha] = Number(d.total) })
    const ultimos7 = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const iso = d.toLocaleDateString("sv-SE")   // fecha LOCAL, no UTC
      return { fecha: iso.slice(8, 10) + "/" + iso.slice(5, 7), total: map7[iso] || 0 }
    })
    setVentasGrafico(ultimos7)

    // ── Gráfico 6 meses: merge ventas + compras, llena meses vacíos con 0 ─────
    const mapV: Record<string, number> = {}
    const mapC: Record<string, number> = {}
    ;(k.grafico_ventas_6m || []).forEach((d: any) => { mapV[d.mes] = Number(d.ventas) })
    ;(k.grafico_compras_6m || []).forEach((d: any) => { mapC[d.mes] = Number(d.compras) })
    const ultimos6 = [...Array(6)].map((_, i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i))
      const mes = d.toLocaleDateString("sv-SE").slice(0, 7)   // mes LOCAL, no UTC
      const label = d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
      return { fecha: label, ventas: mapV[mes] || 0, compras: mapC[mes] || 0 }
    })
    setVentasMensual(ultimos6)
  }

  // ── Lazy load para modales sinVentas y sinRotacion ────────────────────────
  async function abrirModal(tipo: ModalTipo) {
    setModal(tipo)
    if (tipo !== "sinVentas" && tipo !== "sinRotacion") return
    cargarListaModal(tipo)
  }

  async function cargarListaModal(tipo: "sinVentas" | "sinRotacion") {
    setLoadingModalLista(true)
    const { data } = await supabase.rpc(tipo === "sinVentas" ? "productos_sin_ventas" : "productos_sin_rotacion")
    setAlertas((prev: any) => ({ ...prev, [tipo]: data || [] }))
    setLoadingModalLista(false)
  }

  async function verDetalleVenta(venta: any) {
    setVentaDetalle(venta)
    setLoadingDetalle(true)
    setModal("detalleVenta")
    try {
      // Two-step: no FK declared between detalle_ventas and productos
      const { data: detalle, error } = await supabase
        .from("detalle_ventas")
        .select("*")
        .eq("venta_id", venta.id)
      if (error) throw error
      if (!detalle || detalle.length === 0) { setDetalleItems([]); return }
      const ids = [...new Set(detalle.map((d: any) => d.producto_id))]
      const { data: prods } = await supabase
        .from("productos")
        .select("id, nombre")
        .in("id", ids)
      const prodsMap: Record<number, any> = {}
      ;(prods || []).forEach((p: any) => { prodsMap[p.id] = p })
      setDetalleItems(detalle.map((d: any) => ({ ...d, productos: prodsMap[d.producto_id] || null })))
    } catch (e: any) {
      console.error("Error cargando detalle:", e)
      setDetalleItems([])
    } finally {
      setLoadingDetalle(false)
    }
  }

  function cerrarModal() { setModal(null); setVentaDetalle(null); setDetalleItems([]) }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0c0f1a" }}>
      <p style={{ color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>🔐 Cargando...</p>
    </div>
  )

  if (errorCarga) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 16 }}>
      <p style={{ color: "#f87171", fontWeight: 700, fontSize: 15 }}>{errorCarga}</p>
      <button onClick={iniciar} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        Reintentar
      </button>
    </div>
  )

  const kpiCards = [
    { titulo: "Ventas hoy", valor: fmt(kpis.totalHoy), sub: `${kpis.cantidadHoy} venta${kpis.cantidadHoy !== 1 ? "s" : ""}`, icon: "☀️", color: "#3b82f6", onClick: () => abrirModal("ventasHoy") },
    { titulo: "Ingresos hoy", valor: fmt(kpis.cobradoHoy ?? 0), sub: "Cobrado + pagos CC recibidos", icon: "💵", color: "#10b981", onClick: undefined },
    { titulo: "Ventas del mes", valor: fmt(kpis.totalMes), sub: `${kpis.cantidadVentas} ventas`, icon: "📅", color: "#6366f1", onClick: () => abrirModal("ventasMes") },
    { titulo: "Ingresos del mes", valor: fmt(kpis.cobradoMes ?? 0), sub: "Cobrado + pagos CC recibidos", icon: "🏦", color: "#059669", onClick: undefined },
    { titulo: "Compras del mes", valor: fmt(kpis.totalComprasMes), sub: "Total gastado en compras", icon: "🛒", color: "#f59e0b", onClick: undefined },
    { titulo: "Ganancia", valor: fmt(kpis.ganancia), sub: `Margen ${kpis.margen?.toFixed(1)}%`, icon: "💰", color: "#22c55e", onClick: undefined },
    { titulo: "Crecimiento", valor: (kpis.crecimiento >= 0 ? "+" : "") + kpis.crecimiento?.toFixed(1) + "%", sub: "vs mismo tramo mes anterior", icon: "📈", color: kpis.crecimiento >= 0 ? "#22c55e" : "#ef4444", onClick: undefined },
    { titulo: "Capital en stock", valor: fmt(kpis.capitalStock), sub: "Costo × stock", icon: "📦", color: "#a78bfa", onClick: undefined },
    { titulo: "Cuentas corrientes", valor: fmt(kpis.totalCC), sub: `${kpis.cantidadCC} venta${kpis.cantidadCC !== 1 ? "s" : ""} pendiente${kpis.cantidadCC !== 1 ? "s" : ""}`, icon: "🕐", color: "#ef4444", onClick: () => abrirModal("cuentasCC") },
  ]

  const alertaCards = [
    { titulo: "Sin stock", valor: alertas.sinStock.length, icon: "📭", tipo: "sinStock" as ModalTipo, sub: "0 unidades" },
    { titulo: "Stock bajo", valor: alertas.stockBajo.length, icon: "⚠️", tipo: "stockBajo" as ModalTipo, sub: "1 a 5 unidades" },
    { titulo: "Sin ventas", valor: alertas.sinVentasCount ?? alertas.sinVentas.length, icon: "🚫", tipo: "sinVentas" as ModalTipo, sub: "Nunca vendidos" },
    { titulo: "Sin rotación", valor: alertas.sinRotacionCount ?? alertas.sinRotacion.length, icon: "🔄", tipo: "sinRotacion" as ModalTipo, sub: "Sin ventas 30 días" },
    { titulo: "Vencen en 90d", valor: lotesPorVencer.length, icon: "📅", tipo: "lotes" as ModalTipo, sub: "Lotes próximos" },
  ]

  return (
    <div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: 16, marginBottom: 24 }}>
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
                onClick={() => abrirModal(a.tipo)}
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
                  <span style={{ fontSize: 22, fontWeight: 800, color: hayProblema ? "#f87171" : "#22c55e" }}>{a.valor}</span>
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

      {/* Top productos del mes */}
      {topProductosMes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>🏆 Más vendidos este mes</h2>
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            {topProductosMes.map((p, idx) => (
              <div key={p.nombre} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
                borderBottom: idx < topProductosMes.length - 1 ? "1px solid #f1f5f9" : "none"
              }}>
                {/* Posición */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: idx === 0 ? "#fef3c7" : idx === 1 ? "#f1f5f9" : idx === 2 ? "#fef3c7" : "#f8fafc",
                  color: idx === 0 ? "#d97706" : idx === 1 ? "#64748b" : idx === 2 ? "#92400e" : "#94a3b8",
                  fontSize: 12, fontWeight: 800, flexShrink: 0
                }}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                </div>
                {/* Nombre */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{fmt(p.total)} en ventas</div>
                </div>
                {/* Cantidad */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#3b82f6" }}>{p.cantidad}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>unidades</div>
                </div>
                {/* Barra */}
                <div style={{ width: 80, flexShrink: 0 }}>
                  <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: "#3b82f6",
                      width: `${Math.round((p.cantidad / topProductosMes[0].cantidad) * 100)}%`
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico + Vencimientos */}
      <div className="grid-grafico" style={{ display: "grid", gridTemplateColumns: lotesPorVencer.length > 0 ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#374151" }}>
              {periodoGrafico === "7dias" ? "📈 Ventas últimos 7 días" : "📊 Ventas vs Compras — 6 meses"}
            </h3>
            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <button
                onClick={() => setPeriodoGrafico("7dias")}
                style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: periodoGrafico === "7dias" ? "#3b82f6" : "white", color: periodoGrafico === "7dias" ? "white" : "#6b7280" }}>
                7 días
              </button>
              <button
                onClick={() => setPeriodoGrafico("6meses")}
                style={{ padding: "5px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: periodoGrafico === "6meses" ? "#3b82f6" : "white", color: periodoGrafico === "6meses" ? "white" : "#6b7280" }}>
                6 meses
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            {periodoGrafico === "7dias" ? (
              <LineChart data={ventasGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} />
                <Tooltip formatter={(v: any) => [fmt(v), "Ventas"]} labelStyle={{ color: "#374151" }} contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} name="Ventas" />
              </LineChart>
            ) : (
              <LineChart data={ventasMensual}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => "$" + (v >= 1000000 ? (v / 1000000).toFixed(1) + "M" : v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)} />
                <Tooltip
                  formatter={(v: any, name: any) => [fmt(v), name === "ventas" ? "Ventas" : "Compras"]}
                  labelStyle={{ color: "#374151" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Legend formatter={(value) => value === "ventas" ? "Ventas" : "Compras"} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: "#3b82f6", r: 4 }} activeDot={{ r: 6 }} name="ventas" />
                <Line type="monotone" dataKey="compras" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }} name="compras" strokeDasharray="5 3" />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {lotesPorVencer.length > 0 && (
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.06)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "white" }}>📅 Próximos vencimientos</h3>
              <button onClick={() => abrirModal("lotes")} style={{ background: "rgba(59,130,246,0.15)", border: "none", color: "#3b82f6", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                Ver todos
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lotesPorVencer.slice(0, 5).map((l: any) => {
                const dias = diasParaVencer(l)
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

            {/* Cuentas corrientes */}
            {modal === "cuentasCC" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>🕐 Cuentas corrientes pendientes</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>
                  {ccPendientes.length} venta{ccPendientes.length !== 1 ? "s" : ""} sin cobrar · Total: <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(kpis.totalCC)}</span>
                </p>
                {ccPendientes.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ No hay cuentas corrientes pendientes</p>
                ) : [...ccPendientes].sort((a, b) => Number(b.total) - Number(a.total)).map((v: any) => (
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
                        {fechaLocal(v.fecha)} · N° {v.nro_factura}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#f87171", fontWeight: 700, fontSize: 14 }}>{fmtExacto(v.total)}</div>
                      <div style={{ color: "#3b82f6", fontSize: 10, marginTop: 2 }}>Ver detalle →</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Sin stock */}
            {modal === "sinStock" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>📭 Productos sin stock</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Sin unidades disponibles</p>
                {alertas.sinStock.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ Todos los productos tienen stock</p>
                ) : alertas.sinStock.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    <span style={{ background: "rgba(107,114,128,0.2)", color: "#9ca3af", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 6 }}>
                      Sin stock
                    </span>
                  </div>
                ))}
              </>
            )}

            {/* Stock bajo */}
            {modal === "stockBajo" && (
              <>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>⚠️ Productos con stock bajo</h2>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Entre 1 y 5 unidades disponibles</p>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0 }}>🚫 Productos sin ventas</h2>
                  <button onClick={() => cargarListaModal("sinVentas")} disabled={loadingModalLista} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#9ca3af", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>🔄 Actualizar</button>
                </div>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Nunca fueron vendidos</p>
                {loadingModalLista ? (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>Cargando...</p>
                ) : alertas.sinVentas.length === 0 ? (
                  <p style={{ color: "#4ade80", fontSize: 14 }}>✓ Todos los productos tienen ventas</p>
                ) : alertas.sinVentas.map((p: any) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{p.nombre}</span>
                    <span style={{ color: "#6b7280", fontSize: 12 }}>Stock: {p.stock ?? 0}</span>
                  </div>
                ))}
              </>
            )}

            {/* Sin rotación */}
            {modal === "sinRotacion" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0 }}>🔄 Productos sin rotación</h2>
                  <button onClick={() => cargarListaModal("sinRotacion")} disabled={loadingModalLista} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#9ca3af", fontSize: 11, padding: "4px 10px", cursor: "pointer" }}>🔄 Actualizar</button>
                </div>
                <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>Con stock pero sin ventas en los últimos 30 días</p>
                {loadingModalLista ? (
                  <p style={{ color: "#9ca3af", fontSize: 13 }}>Cargando...</p>
                ) : alertas.sinRotacion.length === 0 ? (
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
                  const dias = diasParaVencer(l)
                  const est = estadoLote(dias)
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, marginBottom: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div>
                        <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>{l.producto_nombre}</div>
                        <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{l.fecha_vencimiento} · {l.cantidad} u.</div>
                      </div>
                      <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 }}>
                        {dias < 0 ? "Vencido" : `${dias}d`}
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
                        {fechaLocal(v.fecha)} · N° {v.nro_factura} · {v.estado === "cuenta_corriente" ? "⏳ CC" : "✅ Cobrada"}
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
                N° {ventaDetalle.nro_factura} · {fechaLocal(ventaDetalle.fecha)} · {ventaDetalle.estado === "cuenta_corriente" ? "⏳ Cuenta corriente" : "✅ Cobrada"}
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
