"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 20px",
      borderRadius: 10
    }}>
      {mensaje}
    </div>
  )
}

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [ventas, setVentas] = useState<any[]>([])
  const [clienteHistorial, setClienteHistorial] = useState<any>(null)

  const [toast, setToast] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  // 🔁 cargar clientes
  async function cargarClientes() {
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    setClientes(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargarClientes()
  }, [])

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // 📊 HISTORIAL
  async function verHistorial(cliente: any) {

    setClienteHistorial(cliente)

    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id, total")
      .eq("cliente_id", cliente.id)
      .order("id", { ascending: false })

    if (!ventasData) {
      setVentas([])
      return
    }

    const conDetalle = await Promise.all(
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

    setVentas(conDetalle)
  }

  // 🔙 VOLVER
  function volver() {
    setClienteHistorial(null)
    setVentas([])
  }

  if (cargando) return <p>⏳ Cargando...</p>

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* 🟢 VISTA HISTORIAL */}
      {clienteHistorial ? (
        <div>

          <h1>📊 Historial</h1>
          <h2>{clienteHistorial.nombre} {clienteHistorial.apellido}</h2>

          <button onClick={volver}>🔙 Volver</button>

          {ventas.map(v => (
            <div key={v.id} style={{
              background: "white",
              padding: 15,
              marginTop: 10,
              borderRadius: 10
            }}>
              <b>Factura #{v.id}</b>
              <p>Total: ${v.total}</p>

              {(v.detalle_ventas || []).map((d: any, i: number) => (
                <div key={i}>
                  • {d.productos?.nombre} → {d.cantidad} x ${d.precio}
                </div>
              ))}
            </div>
          ))}

        </div>

      ) : (

        /* 🔵 VISTA NORMAL CLIENTES */
        <div>

          <h1>👥 Clientes</h1>

          {clientes.map(c => (
            <div key={c.id} style={{
              background: "white",
              padding: 15,
              marginBottom: 10,
              borderRadius: 10
            }}>

              <b>{c.nombre} {c.apellido}</b>
              <p>{c.telefono}</p>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => verHistorial(c)}>
                  📊 Historial
                </button>
              </div>

            </div>
          ))}

        </div>

      )}

    </div>
  )
}