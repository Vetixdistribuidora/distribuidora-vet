"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

function estadoLote(dias: number) {
  if (dias < 0) return { label: "Vencido", color: "#e03131", bg: "#fff5f5" }
  if (dias <= 30) return { label: "Crítico", color: "#e03131", bg: "#fff5f5" }
  if (dias <= 60) return { label: "Próximo", color: "#f08c00", bg: "#fff9db" }
  return { label: "OK", color: "#2f9e44", bg: "#ebfbee" }
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<any>({})
  const [alertas, setAlertas] = useState<any>({})
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])
  const [lotesPorVencer, setLotesPorVencer] = useState<any[]>([])

  useEffect(() => {
    iniciar()
  }, [])

  async function iniciar() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      router.push("/login")
      return
    }
    await cargarDatos()
    setLoading(false)
  }

  async function cargarDatos() {
    const hoy = new Date().toISOString().slice(0, 10)
    const inicioMes = new Date()
    inicioMes.setDate(1)
    const mesAnterior = new Date()
    mesAnterior.setMonth(mesAnterior.getMonth() - 1)
    mesAnterior.setDate(1)

    const { data: ventas } = await supabase.from("ventas").select("*")
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

    const { data: productos } = await supabase.from("productos").select("*")
    const { data: detalleVentas } = await supabase.from("detalle_ventas").select("producto_id, cantidad")

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

    setKpis({ totalHoy, totalMes, ganancia, margen, crecimiento, ticketPromedio, cantidadVentas: ventasMes.length, capitalStock })
    setAlertas({ stockBajo, sinVentas, sinRotacion })

    // Lotes próximos a vencer (90 días)
    const en90 = new Date()
    en90.setDate(en90.getDate() + 90)
    const { data: lotes } = await supabase
      .from("lotes_con_stock")
      .select("*")
      .lte("fecha_vencimiento", en90.toISOString().slice(0, 10))
      .order("fecha_vencimiento", { ascending: true })
    setLotesPorVencer(lotes || [])

    const ultimos7 = [...Array(7)].map((_, i) => {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() - i)
      const f = fecha.toISOString().slice(0, 10)
      const total = ventas?.filter(v => v.fecha.startsWith(f)).reduce((acc, v) => acc + Number(v.total), 0) || 0
      return { fecha: f.slice(5), total }
    }).reverse()

    setVentasGrafico(ultimos7)
  }

  function formato(num: number) { return "$" + Math.round(num).toLocaleString("es-AR") }
  function porcentaje(num: number) { return num.toFixed(1) + "%" }

  if (loading) return <p style={{ padding: 30 }}>🔐 Cargando...</p>

  return (
    <div style={{ padding: 20, background: "#f8f9fa", minHeight: "100vh" }}>
      <h1>📊 Dashboard</h1>

      <h2>📈 Rendimiento</h2>
      <div style={grid}>
        <Card titulo="Ventas hoy" valor={formato(kpis.totalHoy)} />
        <Card titulo="Ventas mes" valor={formato(kpis.totalMes)} />
        <Card titulo="Ganancia" valor={formato(kpis.ganancia)} verde />
        <Card titulo="Margen" valor={porcentaje(kpis.margen)} verde />
        <Card titulo="Crecimiento" valor={porcentaje(kpis.crecimiento)} />
        <Card titulo="Ticket promedio" valor={formato(kpis.ticketPromedio)} />
        <Card titulo="Ventas" valor={kpis.cantidadVentas} />
        <Card titulo="Capital stock" valor={formato(kpis.capitalStock)} />
      </div>

      <h2 style={{ marginTop: 30 }}>⚠️ Alertas</h2>
      <div style={grid}>
        <Alerta titulo="Stock bajo" valor={alertas.stockBajo.length} />
        <Alerta titulo="Sin ventas" valor={alertas.sinVentas.length} />
        <Alerta titulo="Sin rotación (30d)" valor={alertas.sinRotacion.length} />
        <Alerta titulo="Vencen en 90d" valor={lotesPorVencer.length} />
      </div>

      {/* Widget vencimientos */}
      {lotesPorVencer.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 20, marginTop: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 14px" }}>📅 Próximos vencimientos</h3>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#666", textAlign: "left", borderBottom: "1px solid #e9ecef" }}>
                <th style={{ paddingBottom: 8 }}>Producto</th>
                <th style={{ paddingBottom: 8 }}>Vencimiento</th>
                <th style={{ paddingBottom: 8 }}>Días</th>
                <th style={{ paddingBottom: 8 }}>Estado</th>
                <th style={{ paddingBottom: 8, textAlign: "right" }}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {lotesPorVencer.map((l: any) => {
                const dias = l.dias_para_vencer
                const est = estadoLote(dias)
                return (
                  <tr key={l.id} style={{ borderTop: "1px solid #f1f3f5" }}>
                    <td style={{ padding: "7px 0", fontWeight: 500 }}>{l.producto_nombre}</td>
                    <td style={{ padding: "7px 8px", color: "#555" }}>{l.fecha_vencimiento}</td>
                    <td style={{ padding: "7px 8px", color: est.color, fontWeight: 600 }}>
                      {dias < 0 ? "Vencido" : `${dias}d`}
                    </td>
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{
                        background: est.bg, color: est.color,
                        padding: "2px 8px", borderRadius: 6, fontWeight: 600, fontSize: 12
                      }}>
                        {est.label}
                      </span>
                    </td>
                    <td style={{ padding: "7px 0", textAlign: "right", color: "#333" }}>{l.cantidad} u.</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={cardGrande}>
        <h3>📈 Ventas últimos 7 días</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={ventasGrafico}>
            <XAxis dataKey="fecha" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="total" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function Card({ titulo, valor, verde }: any) {
  return (
    <div style={card}>
      <p style={{ color: "#666" }}>{titulo}</p>
      <h2 style={{ color: verde ? "#2f9e44" : "#111" }}>{valor}</h2>
    </div>
  )
}

function Alerta({ titulo, valor }: any) {
  const color = valor > 0 ? "#e03131" : "#2f9e44"
  return (
    <div style={card}>
      <p>{titulo}</p>
      <h2 style={{ color }}>{valor}</h2>
    </div>
  )
}

const grid: React.CSSProperties = { display: "flex", gap: 20, flexWrap: "wrap" }
const card = { background: "white", padding: 20, borderRadius: 12, minWidth: 180, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }
const cardGrande = { background: "white", padding: 20, borderRadius: 12, marginTop: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }