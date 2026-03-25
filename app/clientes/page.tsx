"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../../lib/supabase"
import { useParams } from "next/navigation"

export default function HistorialCliente() {

  const { id } = useParams()

  const [ventas, setVentas] = useState<any[]>([])
  const [cliente, setCliente] = useState<any>(null)

  async function cargar() {

    // 👤 Cliente
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single()

    setCliente(clienteData)

    // 💰 Ventas
    const { data: ventasData } = await supabase
      .from("ventas")
      .select(`
        *,
        detalle_ventas (
          cantidad,
          precio,
          productos ( nombre )
        )
      `)
      .eq("cliente_id", id)
      .order("id", { ascending: false })

    setVentas(ventasData || [])
  }

  useEffect(() => {
    if (id) cargar()
  }, [id])

  return (
    <div>

      <h1>📊 Historial</h1>

      {cliente && (
        <h2>
          {cliente.nombre} {cliente.apellido}
        </h2>
      )}

      <button onClick={() => window.history.back()}>
        🔙 Volver
      </button>

      <div style={{ marginTop: 20 }}>

        {ventas.map(v => (
          <div key={v.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 15,
            borderRadius: 10
          }}>

            <b>Factura #{v.id}</b>
            <p>💰 Total: ${v.total}</p>

            <div style={{ marginTop: 10 }}>
              {v.detalle_ventas.map((d: any, i: number) => (
                <div key={i} style={{ marginLeft: 10 }}>
                  • {d.productos?.nombre}  
                  → {d.cantidad} x ${d.precio}
                </div>
              ))}
            </div>

          </div>
        ))}

        {ventas.length === 0 && (
          <p>Este cliente no tiene compras aún.</p>
        )}

      </div>

    </div>
  )
}