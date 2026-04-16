"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"

export default function Dashboard() {

  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [kpis, setKpis] = useState<any>({})
  const [alertas, setAlertas] = useState<any>({})
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])

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

    // 🔹 Ventas
    const { data: ventas } = await supabase.from("ventas").select("*")

    const ventasHoy = ventas?.filter(v => v.fecha.startsWith(hoy)) || []
    const ventasMes = ventas?.filter(v => v.fecha >= inicioMes.toISOString()) || []
    const ventasMesAnterior = ventas?.filter(v =>
      v.fecha >= mesAnterior.toISOString() &&
      v.fecha < inicioMes.toISOString()
    ) || []

    const totalHoy = ventasHoy.reduce((acc, v) => acc + Number(v.total), 0)
    const totalMes = ventasMes.reduce((acc, v) => acc + Number(v.total), 0)
    const totalAnterior = ventasMesAnterior.reduce((acc, v) => acc + Number(v.total), 0)

    const crecimiento = totalAnterior
      ? ((totalMes - totalAnterior) / totalAnterior) * 100
      : 0

    const ticketPromedio = ventasMes.length
      ? totalMes / ventasMes.length
      : 0

    // 🔹 Productos
    const { data: productos } = await supabase.from("productos").select("*")

    // 🔹 Detalle ventas
    const { data: detalleVentas } = await supabase
      .from("detalle_ventas")
      .select("producto_id, cantidad")

    // 🔹 Ganancia
    let ganancia = 0

    if (detalleVentas && productos) {
      detalleVentas.forEach(d => {
        const prod = productos.find(p => p.id === d.producto_id)
        if (prod) {
          ganancia += (prod.precio_venta - prod.costo) * d.cantidad
        }
      })
    }

    const margen = totalMes ? (ganancia / totalMes) * 100 : 0

    // 🔹 Capital en stock
    const capitalStock = productos?.reduce(
      (acc, p) => acc + p.costo * p.stock,
      0
    ) || 0

    // 🔹 ALERTAS

    // Stock bajo
    const stockBajo = productos?.filter(p => p.stock <= 5) || []

    // Sin ventas (histórico)
    const vendidosIds = new Set(detalleVentas?.map(d => d.producto_id))
    const sinVentas = productos?.filter(p => !vendidosIds.has(p.id)) || []

    // Sin rotación (30 días)
    const hace30 = new Date()
    hace30.setDate(hace30.getDate() - 30)

    const ventasRecientes = ventas?.filter(v => v.fecha >= hace30.toISOString()) || []
    const idsRecientes = new Set(ventasRecientes.map(v => v.id))

    const sinRotacion = productos?.filter(p =>
  !detalleVentas?.some(d =>
    d.producto_id === p.id
  )
) || []

    setKpis({
      totalHoy,
      totalMes,
      ganancia,
      margen,
      crecimiento,
      ticketPromedio,
      cantidadVentas: ventasMes.length,
      capitalStock
    })

    setAlertas({
      stockBajo,
      sinVentas,
      sinRotacion
    })

    // 🔹 Gráfico (7 días)
    const ultimos7 = [...Array(7)].map((_, i) => {
      const fecha = new Date()
      fecha.setDate(fecha.getDate() - i)
      const f = fecha.toISOString().slice(0, 10)

      const total = ventas
        ?.filter(v => v.fecha.startsWith(f))
        .reduce((acc, v) => acc + Number(v.total), 0) || 0

      return { fecha: f.slice(5), total }
    }).reverse()

    setVentasGrafico(ultimos7)
  }

  function formato(num: number) {
    return "$" + Math.round(num).toLocaleString("es-AR")
  }

  function porcentaje(num: number) {
    return num.toFixed(1) + "%"
  }

  if (loading) return <p style={{ padding: 30 }}>🔐 Cargando...</p>

  return (
    <div style={{ padding: 20, background: "#f8f9fa", minHeight: "100vh" }}>

      <h1>📊 Dashboard</h1>

      {/* 🧠 KPIs */}
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

      {/* ⚠️ ALERTAS */}
      <h2 style={{ marginTop: 30 }}>⚠️ Alertas</h2>
      <div style={grid}>
        <Alerta titulo="Stock bajo" valor={alertas.stockBajo.length} />
        <Alerta titulo="Sin ventas" valor={alertas.sinVentas.length} />
        <Alerta titulo="Sin rotación (30d)" valor={alertas.sinRotacion.length} />
      </div>

      {/* 📈 GRÁFICO */}
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

// 🎨 COMPONENTES

function Card({ titulo, valor, verde }: any) {
  return (
    <div style={card}>
      <p style={{ color: "#666" }}>{titulo}</p>
      <h2 style={{ color: verde ? "#2f9e44" : "#111" }}>{valor}</h2>
    </div>
  )
}

function Alerta({ titulo, valor }: any) {

  let color = "#2f9e44"
  if (valor > 0) color = "#e03131"

  return (
    <div style={card}>
      <p>{titulo}</p>
      <h2 style={{ color }}>{valor}</h2>
    </div>
  )
}

// 🎨 estilos

const grid: React.CSSProperties = {
  display: "flex",
  gap: 20,
  flexWrap: "wrap"
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  minWidth: 180,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
}

const cardGrande = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginTop: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
}