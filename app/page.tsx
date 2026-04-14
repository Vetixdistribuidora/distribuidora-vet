"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"

export default function Dashboard() {

  const [ventasHoy, setVentasHoy] = useState(0)
  const [ventasMes, setVentasMes] = useState(0)
  const [gananciaMes, setGananciaMes] = useState(0)
  const [cantidadVentas, setCantidadVentas] = useState(0)
  const [ticketPromedio, setTicketPromedio] = useState(0)
  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])
  const [ventasGrafico, setVentasGrafico] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {

    const hoy = new Date().toISOString().slice(0, 10)
    const inicioMes = new Date()
    inicioMes.setDate(1)

    // 🔹 Ventas
    const { data: ventas } = await supabase
      .from("ventas")
      .select("*")

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

    // 🔹 Ganancia estimada (usando margen)
    let ganancia = 0

const { data: detalleVentas } = await supabase
  .from("detalle_ventas")
  .select("producto_id, cantidad")

if (detalleVentas) {

  const { data: productos } = await supabase
    .from("productos")
    .select("id, costo, precio_venta")

  detalleVentas.forEach(d => {
    const prod = productos?.find(p => p.id === d.producto_id)

    if (prod) {
      const gananciaProducto = (prod.precio_venta - prod.costo) * d.cantidad
      ganancia += gananciaProducto
    }
  })
}

setGananciaMes(ganancia)

    // 🔹 Stock bajo
    const { data: productos } = await supabase.from("productos").select("*")
    {stockBajo.length === 0 && <p>Todo en orden 👍</p>}

    // 🔹 Top productos
    const { data: detalle } = await supabase
      .from("detalle_ventas")
      .select("producto_id, cantidad")

    if (detalle) {
      const conteo: any = {}

      detalle.forEach(d => {
        conteo[d.producto_id] = (conteo[d.producto_id] || 0) + d.cantidad
      })

      const topIds = Object.entries(conteo)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(d => Number(d[0]))

      const { data: productosTop } = await supabase
        .from("productos")
        .select("*")
        .in("id", topIds)

      setTopProductos(productosTop || [])
    }

    // 🔹 Datos gráfico (últimos 7 días)
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
    return "$" + num.toLocaleString("es-AR", { maximumFractionDigits: 0 })
  }

  return (
    <div style={{ padding: 20, background: "#f8f9fa", minHeight: "100vh" }}>

      <h1 style={{ marginBottom: 20 }}>📊 Dashboard</h1>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

        <Card titulo="Ventas hoy" valor={formato(ventasHoy)} />
        <Card titulo="Ventas mes" valor={formato(ventasMes)} />
        <Card titulo="Ganancia estimada" valor={formato(gananciaMes)} />
        <Card titulo="Ventas" valor={cantidadVentas} />
        <Card titulo="Ticket promedio" valor={formato(ticketPromedio)} />
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

      {/* STOCK BAJO */}
      <div style={cardGrande}>
        <h3>⚠️ Stock bajo</h3>
        {stockBajo.slice(0, 5).map(p => (
          <p key={p.id}>{p.nombre} — {p.stock}</p>
        ))}
      </div>

      {/* TOP PRODUCTOS */}
      <div style={cardGrande}>
        <h3>🥇 Más vendidos</h3>
        {topProductos.map(p => (
          <p key={p.id}>{p.nombre}</p>
        ))}
      </div>

    </div>
  )
}

function Card({ titulo, valor }: any) {

  let color = "#333"

  if (titulo.includes("Ganancia")) color = "#2f9e44"
  if (titulo.includes("Stock")) color = "#e03131"

  return (
    <div style={{
      background: "white",
      padding: 20,
      borderRadius: 12,
      minWidth: 180,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
    }}>
      <p style={{ color: "#666" }}>{titulo}</p>
      <h2 style={{ color }}>{valor}</h2>
    </div>
  )
}

const cardGrande = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginTop: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
}