"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"

export default function Factura() {

  const { id } = useParams()

  const [venta, setVenta] = useState<any>(null)
  const [detalle, setDetalle] = useState<any[]>([])

  async function cargar() {

    const { data: v } = await supabase
      .from("ventas")
      .select("*")
      .eq("id", id)
      .single()

    const { data: d } = await supabase
      .from("detalle_ventas")
      .select("*, productos(nombre)")
      .eq("venta_id", id)

    setVenta(v)
    setDetalle(d || [])
  }

  useEffect(() => { cargar() }, [])

  if (!venta) return <p>Cargando...</p>

  return (
    <div style={{
      background: "white",
      padding: 40,
      maxWidth: 600,
      margin: "auto"
    }}>

      <h2>🧾 Factura #{venta.id}</h2>

      <hr />

      {detalle.map((item, i) => (
        <div key={i}>
          {item.productos?.nombre} - ${item.precio}
        </div>
      ))}

      <hr />

      <h3>Total: ${venta.total}</h3>

      <button onClick={() => window.print()}>🖨 Imprimir</button>
      <button onClick={() => window.history.back()}>🔙 Volver</button>

    </div>
  )
}