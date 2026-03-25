"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 20px",
      borderRadius: 10, fontWeight: "bold",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)

  const [busqueda, setBusqueda] = useState("")

  // ➕ FORM
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [cuit, setCuit] = useState("")
  const [telefono, setTelefono] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [porcentaje, setPorcentaje] = useState("")

  // ✏️ EDITAR
  const [editando, setEditando] = useState<any | null>(null)

  // 🔥 MODAL HISTORIAL
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    setClientes(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // 📊 HISTORIAL
  async function abrirHistorial(cliente: any) {

    setClienteSeleccionado(cliente)
    setModalAbierto(true)

    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id, total")
      .eq("cliente_id", cliente.id)
      .order("id", { ascending: false })

    if (!ventasData) return setVentas([])

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

  function cerrarModal() {
    setModalAbierto(false)
    setVentas([])
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando...</p>

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>👥 Clientes</h1>

      <input
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ marginBottom: 20, padding: 8, width: "100%" }}
      />

      {clientes
        .filter(c => `${c.nombre} ${c.apellido}`.toLowerCase().includes(busqueda.toLowerCase()))
        .map(c => (

          <div key={c.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10
          }}>

            <b>{c.nombre} {c.apellido}</b>
            <p>CUIT: {c.cuit || "-"}</p>
            <p>📞 {c.telefono || "-"}</p>
            <p>📍 {c.localidad || "-"}</p>
            <p>📊 Margen: {c.porcentaje || 0}%</p>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditando({ ...c })}>✏️ Editar</button>

              <button onClick={() => abrirHistorial(c)}>
                📊 Historial
              </button>

              <button
                onClick={() => supabase.from("clientes").delete().eq("id", c.id).then(() => cargar())}
                style={{ background: "#e03131", color: "white", borderRadius: 6 }}
              >
                🗑️
              </button>
            </div>

          </div>
        ))}

      {/* 🔥 MODAL */}
      {modalAbierto && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>

          <div style={{
            background: "white",
            padding: 20,
            borderRadius: 10,
            width: "90%",
            maxWidth: 600,
            maxHeight: "80%",
            overflowY: "auto"
          }}>

            <h2>📊 {clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido}</h2>

            <button onClick={cerrarModal}>❌ Cerrar</button>

            {ventas.length === 0 && <p>Sin compras</p>}

            {ventas.map(v => (
              <div key={v.id} style={{ marginTop: 10 }}>
                <b>Factura #{v.id}</b>
                <p>${v.total}</p>

                {(v.detalle_ventas || []).map((d: any, i: number) => (
                  <div key={i}>
                    • {d.productos?.nombre} → {d.cantidad} x ${d.precio}
                  </div>
                ))}
              </div>
            ))}

          </div>

        </div>
      )}

    </div>
  )
}