"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useParams } from "next/navigation"

export default function HistorialCliente() {

  const params = useParams()
  const id = params?.id?.toString()

  const [ventas, setVentas] = useState<any[]>([])
  const [cliente, setCliente] = useState<any>(null)

  async function cargar() {

    if (!id) return

    // 👤 CLIENTE
    const { data: clienteData } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single()

    setCliente(clienteData)

    // 💰 VENTAS
    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id, total")
      .eq("cliente_id", id)
      .order("id", { ascending: false })

    if (!ventasData) {
      setVentas([])
      return
    }

    // 🔥 DETALLES
    const ventasConDetalle = await Promise.all(
      ventasData.map(async (v) => {

        const { data: detalles } = await supabase
          .from("detalle_ventas")
          .select("cantidad, precio, productos(nombre)")
          .eq("venta_id", v.id)

        return {
          ...v,
          detalle_ventas: detalles || []
        }
      })
    )

    setVentas(ventasConDetalle)
  }

  useEffect(() => {
    cargar()
  }, [id])

  return (
    <div>

      <h1>📊 Historial</h1>

      {cliente && (
        <h2>{cliente.nombre} {cliente.apellido}</h2>
      )}

      <button onClick={() => window.history.back()}>
        🔙 Volver
      </button>

      <div style={{ marginTop: 20 }}>

        {ventas.length === 0 && (
          <p style={{ color: "#888" }}>
            Este cliente no tiene compras aún.
          </p>
        )}

        {ventas.map((v) => (
          <div key={v.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 15,
            borderRadius: 10
          }}>

            <b>Factura #{v.id}</b>
            <p>💰 Total: ${v.total}</p>

            {(v.detalle_ventas || []).length > 0 ? (
              (v.detalle_ventas || []).map((d: any, i: number) => (
                <div key={i} style={{ marginLeft: 10 }}>
                  • {d.productos?.nombre || "Producto"}  
                  → {d.cantidad} x ${d.precio}
                </div>
              ))
            ) : (
              <p style={{ color: "#888", marginLeft: 10 }}>
                Sin productos cargados
              </p>
            )}

          </div>
        ))}

      </div>

    </div>
  )
}