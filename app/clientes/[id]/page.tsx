"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"

export default function HistorialCliente() {

  const { id } = useParams()

  const [ventas, setVentas] = useState<any[]>([])

  async function cargar() {
    const { data } = await supabase
      .from("ventas")
      .select("*")
      .eq("cliente_id", id)

    setVentas(data || [])
  }

  useEffect(() => { cargar() }, [])

  return (
    <div>

      <h1>📊 Historial de cliente</h1>

      <button onClick={() => window.history.back()}>
        🔙 Volver
      </button>

      <div style={{ marginTop: 20 }}>
        {ventas.map(v => (
          <div key={v.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 10
          }}>
            Venta #{v.id} - ${v.total}
          </div>
        ))}
      </div>

    </div>
  )
}