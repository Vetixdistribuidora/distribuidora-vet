"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 30,
      right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: "bold",
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

  // 📊 HISTORIAL + MÉTRICAS
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])

  const [totalGastado, setTotalGastado] = useState(0)
  const [cantidadCompras, setCantidadCompras] = useState(0)
  const [promedioCompra, setPromedioCompra] = useState(0)
  const [productoTop, setProductoTop] = useState("")

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .order("nombre")

    setClientes(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  // ➕ AGREGAR
  async function agregar() {

    if (!nombre || !apellido) {
      mostrarToast("⚠️ Nombre y apellido obligatorios", "error")
      return
    }

    const { error } = await supabase.from("clientes").insert([{
      nombre,
      apellido,
      cuit,
      telefono,
      localidad,
      porcentaje: Number(porcentaje || 0)
    }])

    if (error) return mostrarToast("❌ " + error.message, "error")

    mostrarToast("✅ Cliente agregado", "ok")

    setNombre("")
    setApellido("")
    setCuit("")
    setTelefono("")
    setLocalidad("")
    setPorcentaje("")

    cargar()
  }

  // ✏️ EDITAR
  async function guardarEdicion() {

    if (!editando.nombre || !editando.apellido) {
      mostrarToast("⚠️ Nombre y apellido obligatorios", "error")
      return
    }

    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: editando.nombre,
        apellido: editando.apellido,
        cuit: editando.cuit,
        telefono: editando.telefono,
        localidad: editando.localidad,
        porcentaje: Number(editando.porcentaje || 0)
      })
      .eq("id", editando.id)

    if (error) return mostrarToast("❌ " + error.message, "error")

    mostrarToast("✅ Cliente actualizado", "ok")
    setEditando(null)
    cargar()
  }

  // 🗑️ ELIMINAR
  async function eliminar(id: number) {

    if (!confirm("¿Eliminar este cliente?")) return

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id)

    if (error) return mostrarToast("❌ " + error.message, "error")

    mostrarToast("🗑️ Cliente eliminado", "ok")
    cargar()
  }

  // 📊 HISTORIAL + MÉTRICAS
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

    // 💰 TOTAL
    const total = conDetalle.reduce((acc, v) => acc + Number(v.total), 0)
    setTotalGastado(total)

    // 🧾 CANTIDAD
    setCantidadCompras(conDetalle.length)

    // 📊 PROMEDIO
    setPromedioCompra(conDetalle.length ? total / conDetalle.length : 0)

    // 🏆 PRODUCTO TOP
    const contador: any = {}

    conDetalle.forEach(v => {
      v.detalle_ventas?.forEach((d: any) => {
        const nombre = d.productos?.nombre || "Sin nombre"
        contador[nombre] = (contador[nombre] || 0) + d.cantidad
      })
    })

    const top = Object.entries(contador).sort((a: any, b: any) => b[1] - a[1])[0]
    setProductoTop(top ? top[0] : "Ninguno")
  }

  function cerrarModal() {
    setModalAbierto(false)
    setVentas([])
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando clientes...</p>

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>👥 Clientes</h1>

      <input
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: 20, padding: 8, width: "100%" }}
      />

      {/* FORM */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
        <input placeholder="CUIT" value={cuit} onChange={e => setCuit(e.target.value)} />
        <input placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
        <input placeholder="Localidad" value={localidad} onChange={e => setLocalidad(e.target.value)} />
        <input placeholder="% Margen" type="number" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />

        <button onClick={agregar}>➕ Agregar</button>
      </div>

      {/* LISTA */}
      {clientes
        .filter(c =>
          `${c.nombre} ${c.apellido}`.toLowerCase().includes(busqueda.toLowerCase())
        )
        .map(c => (

          <div key={c.id} style={{
            background: editando?.id === c.id ? "#fff9db" : "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10
          }}>

            {editando?.id === c.id ? (

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={editando.nombre || ""} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                <input value={editando.apellido || ""} onChange={e => setEditando({ ...editando, apellido: e.target.value })} />
                <input value={editando.cuit || ""} onChange={e => setEditando({ ...editando, cuit: e.target.value })} />
                <input value={editando.telefono || ""} onChange={e => setEditando({ ...editando, telefono: e.target.value })} />
                <input value={editando.localidad || ""} onChange={e => setEditando({ ...editando, localidad: e.target.value })} />
                <input type="number" value={editando.porcentaje ?? ""} onChange={e => setEditando({ ...editando, porcentaje: e.target.value })} />

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={guardarEdicion}>💾 Guardar</button>
                  <button onClick={() => setEditando(null)}>✖️ Cancelar</button>
                </div>
              </div>

            ) : (

              <div>
                <b>{c.nombre} {c.apellido}</b>
                <p>CUIT: {c.cuit || "-"}</p>
                <p>📞 {c.telefono || "-"}</p>
                <p>📍 {c.localidad || "-"}</p>
                <p>📊 Margen: {c.porcentaje || 0}%</p>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditando({ ...c, porcentaje: String(c.porcentaje || "") })}>
                    ✏️ Editar
                  </button>

                  <button onClick={() => abrirHistorial(c)}>
                    📊 Historial
                  </button>

                  <button onClick={() => eliminar(c.id)} style={{ background: "#e03131", color: "white" }}>
                    🗑️
                  </button>
                </div>
              </div>

            )}

          </div>
        ))}

      {/* MODAL */}
      {modalAbierto && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
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
            <h2>📊 {clienteSeleccionado?.nombre}</h2>
            <button onClick={cerrarModal}>❌ Cerrar</button>

            {/* 🔥 PANEL */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 20
            }}>
              <div>💰 Total: ${totalGastado.toFixed(2)}</div>
              <div>🧾 Compras: {cantidadCompras}</div>
              <div>📊 Promedio: ${promedioCompra.toFixed(2)}</div>
              <div>🏆 Top: {productoTop}</div>
            </div>

            {ventas.map(v => (
              <div key={v.id}>
                <b>Factura #{v.id}</b>
                <p>${v.total}</p>

                {(v.detalle_ventas || []).map((d: any, i: number) => (
                  <div key={i}>
                    • {d.productos?.nombre} x {d.cantidad}
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
