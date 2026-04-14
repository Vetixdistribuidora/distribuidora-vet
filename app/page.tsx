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

  const [ventasHoy, setVentasHoy] = useState(0)
  const [ventasMes, setVentasMes] = useState(0)
  const [gananciaMes, setGananciaMes] = useState(0)
  const [cantidadVentas, setCantidadVentas] = useState(0)
  const [ticketPromedio, setTicketPromedio] = useState(0)

  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])

  const [sinVentas, setSinVentas] = useState<any[]>([])
  const [masRentables, setMasRentables] = useState<any[]>([])

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

    // 🔹 Ventas
    const { data: ventas } = await supabase.from("ventas").select("*")

    const ventasHoyData = ventas?.filter(v => v.fecha.startsWith(hoy)) || []
    const ventasMesData = ventas?.filter(v => v.fecha >= inicioMes.toISOString()) || []

    const totalHoy = ventasHoyData.reduce((acc, v) => acc + Number(v.total), 0)
    const totalMes = ventasMesData.reduce((acc, v) => acc + Number(v.total), 0)

    setVentasHoy(totalHoy)
    setVentasMes(totalMes)
    setCantidadVentas(ventasMesData.length)

    if (ventasMesData.length) {
      setTicketPromedio(totalMes / ventasMesData.length)
    }

    // 🔹 Productos
    const { data: productos } = await supabase.from("productos").select("*")

    // 🔹 Detalle ventas
    const { data: detalleVentas } = await supabase
      .from("detalle_ventas")
      .select("producto_id, cantidad")

    // 🔹 Ganancia REAL
    let ganancia = 0

    if (detalleVentas && productos) {
      detalleVentas.forEach(d => {
        const prod = productos.find(p => p.id === d.producto_id)
        if (prod) {
          ganancia += (prod.precio_venta - prod.costo) * d.cantidad
        }
      })
    }

    setGananciaMes(ganancia)

    // 🔹 Stock bajo
    setStockBajo(productos?.filter(p => p.stock <= 5) || [])

    // 🔹 Top productos
    if (detalleVentas) {
      const conteo: any = {}

      detalleVentas.forEach(d => {
        conteo[d.producto_id] = (conteo[d.producto_id] || 0) + d.cantidad
      })

      const topIds = Object.entries(conteo)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(d => Number(d[0]))

      const top = productos?.filter(p => topIds.includes(p.id)) || []
      setTopProductos(top)
    }

    // 🔹 Sin ventas
    const vendidosIds = new Set(detalleVentas?.map(d => d.producto_id))
    setSinVentas(productos?.filter(p => !vendidosIds.has(p.id)) || [])

    // 🔹 Más rentables
    const rentables = productos
      ?.map(p => ({
        ...p,
        ganancia: p.precio_venta - p.costo
      }))
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5)

    setMasRentables(rentables || [])

    // 🔹 Gráfico
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

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  function formato(num: number) {
    return "$" + num.toLocaleString("es-AR", { maximumFractionDigits: 0 })
  }

  if (loading) return <p style={{ padding: 30 }}>🔐 Cargando...</p>

  return (
    <div style={{ padding: 20, background: "#f8f9fa", minHeight: "100vh" }}>

      <button onClick={logout} style={{ marginBottom: 20 }}>
        🚪 Cerrar sesión
      </button>

      <h1>📊 Dashboard</h1>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <Card titulo="Ventas hoy" valor={formato(ventasHoy)} />
        <Card titulo="Ventas mes" valor={formato(ventasMes)} />
        <Card titulo="Ganancia real" valor={formato(gananciaMes)} />
        <Card titulo="Ticket promedio" valor={formato(ticketPromedio)} />
        <Card titulo="Cantidad ventas" valor={cantidadVentas} />
        <Card titulo="Stock bajo" valor={stockBajo.length} />
      </div>

      {/* GRÁFICO */}
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

      {/* BLOQUES */}
      <Bloque titulo="⚠️ Stock bajo" lista={stockBajo} />
      <Bloque titulo="🥇 Más vendidos" lista={topProductos} />
      <Bloque titulo="🟡 Sin ventas" lista={sinVentas} />
      <Bloque titulo="🟢 Más rentables" lista={masRentables} mostrarGanancia />
    </div>
  )
}

// 🎨 COMPONENTES

function Card({ titulo, valor }: any) {

  let color = "#333"
  if (titulo.includes("Ganancia")) color = "#2f9e44"
  if (titulo.includes("Stock")) color = "#e03131"

  return (
    <div style={card}>
      <p style={{ color: "#666" }}>{titulo}</p>
      <h2 style={{ color }}>{valor}</h2>
    </div>
  )
}

function Bloque({ titulo, lista, mostrarGanancia }: any) {
  return (
    <div style={cardGrande}>
      <h3>{titulo}</h3>

      {lista.length === 0 && <p>Todo en orden 👍</p>}

      {lista.slice(0, 5).map((p: any) => (
        <p key={p.id}>
          {p.nombre}
          {mostrarGanancia && ` — 💰 $${Math.round(p.ganancia)}`}
        </p>
      ))}
    </div>
  )
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