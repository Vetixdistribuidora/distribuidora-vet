"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Dashboard() {

  const [ventasHoy, setVentasHoy] = useState(0)
  const [ventasMes, setVentasMes] = useState(0)
  const [cantidadVentas, setCantidadVentas] = useState(0)
  const [ticketPromedio, setTicketPromedio] = useState(0)
  const [stockBajo, setStockBajo] = useState<any[]>([])
  const [topProductos, setTopProductos] = useState<any[]>([])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {

    const hoy = new Date().toISOString().slice(0, 10)
    const inicioMes = new Date()
    inicioMes.setDate(1)

    // 🔹 Ventas hoy
    const { data: ventasHoyData } = await supabase
      .from("ventas")
      .select("total")
      .gte("fecha", hoy)

    const totalHoy = ventasHoyData?.reduce((acc, v) => acc + v.total, 0) || 0
    setVentasHoy(totalHoy)

    // 🔹 Ventas mes
    const { data: ventasMesData } = await supabase
      .from("ventas")
      .select("total")
      .gte("fecha", inicioMes.toISOString())

    const totalMes = ventasMesData?.reduce((acc, v) => acc + v.total, 0) || 0
    setVentasMes(totalMes)

    // 🔹 Cantidad ventas
    setCantidadVentas(ventasMesData?.length || 0)

    // 🔹 Ticket promedio
    if (ventasMesData?.length) {
      setTicketPromedio(totalMes / ventasMesData.length)
    }

    // 🔹 Stock bajo
    const { data: productos } = await supabase
      .from("productos")
      .select("*")

    const bajos = productos?.filter(p => p.stock <= 5) || []
    setStockBajo(bajos)

    // 🔹 Top productos (desde ventas_detalle)
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
        .map(d => d[0])

      const { data: productosTop } = await supabase
        .from("productos")
        .select("*")
        .in("id", topIds)

      setTopProductos(productosTop || [])
    }
  }

  function formato(num: number) {
    return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 0 })
  }

  return (
    <div style={{ padding: 20 }}>

      <h1>📊 Dashboard</h1>

      {/* 🔹 KPIs */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 30 }}>

        <div style={card}>
          <h3>💵 Ventas hoy</h3>
          <p>{formato(ventasHoy)}</p>
        </div>

        <div style={card}>
          <h3>📈 Ventas mes</h3>
          <p>{formato(ventasMes)}</p>
        </div>

        <div style={card}>
          <h3>🧾 Ventas</h3>
          <p>{cantidadVentas}</p>
        </div>

        <div style={card}>
          <h3>💳 Ticket promedio</h3>
          <p>{formato(ticketPromedio)}</p>
        </div>

        <div style={card}>
          <h3>⚠️ Stock bajo</h3>
          <p>{stockBajo.length}</p>
        </div>

      </div>

      {/* 🔹 STOCK BAJO */}
      <div style={cardGrande}>
        <h3>⚠️ Productos con stock bajo</h3>

        {stockBajo.slice(0, 5).map(p => (
          <p key={p.id}>
            {p.nombre} — 📦 {p.stock}
          </p>
        ))}

      </div>

      {/* 🔹 TOP PRODUCTOS */}
      <div style={cardGrande}>
        <h3>🥇 Productos más vendidos</h3>

        {topProductos.map(p => (
          <p key={p.id}>
            {p.nombre}
          </p>
        ))}

      </div>

    </div>
  )
}

const card = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  minWidth: 200
}

const cardGrande = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  marginBottom: 20
}