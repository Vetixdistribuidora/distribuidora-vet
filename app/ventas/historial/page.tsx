"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"

type Venta = {
  id: number
  total: number
  created_at: string
}

export default function Historial() {

  const [ventas, setVentas] = useState<Venta[]>([])

  async function fetchVentas() {
    const { data, error } = await supabase
      .from("ventas")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.log(error)
    } else {
      setVentas(data || [])
    }
  }

  useEffect(() => {
    fetchVentas()
  }, [])

  return (

    <main style={{ padding: "40px" }}>

      <h1>📊 Historial de Ventas</h1>

      {ventas.map(v => (
        <div key={v.id} style={{ borderBottom: "1px solid gray", padding: "10px" }}>
          <p><b>Venta #{v.id}</b></p>
          <p>Total: ${v.total}</p>
          <p>Fecha: {new Date(v.created_at).toLocaleString()}</p>
        </div>
      ))}

    </main>

  )
}