"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function Home() {

  const [ventas, setVentas] = useState<any[]>([])
  const [total, setTotal] = useState(0)

  async function cargar() {
    const { data } = await supabase.from("ventas").select("*")

    setVentas(data || [])

    const suma = (data || []).reduce((acc, v) => acc + Number(v.total), 0)
    setTotal(suma)
  }

  useEffect(() => { cargar() }, [])

  return (
    <div>

      <h1>📊 Dashboard</h1>

      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 10,
        marginBottom: 20
      }}>
        <h2>💰 Ventas totales</h2>
        <h1>${total.toFixed(2)}</h1>
      </div>

      <div style={{
        background: "white",
        padding: 20,
        borderRadius: 10
      }}>
        <h2>🧾 Últimas ventas</h2>

        {ventas.slice(-5).reverse().map(v => (
          <div key={v.id}>
            Venta #{v.id} - ${v.total}
          </div>
        ))}
      </div>

    </div>
  )
}