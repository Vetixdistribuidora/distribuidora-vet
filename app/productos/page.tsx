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

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)

  const [busqueda, setBusqueda] = useState("")

  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")

  const [editando, setEditando] = useState<any | null>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    const { data } = await supabase
      .from("productos")
      .select("*")
      .order("nombre")

    setProductos(data || [])
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  // 🟢 AGREGAR PRODUCTO
  async function agregar() {

    if (!nombre || !costo || !margen || !stock) {
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
    }

    const costoNum = Number(costo)
    const margenNum = Number(margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)

    const { data, error } = await supabase.from("productos").insert([{
      nombre,
      costo: costoNum,
      margen: margenNum,
      precio_venta: precioVenta,
      stock: Number(stock)
    }]).select()

    if (error) return mostrarToast("❌ " + error.message, "error")

    // 🔥 AUDITORÍA
    await supabase.rpc("registrar_auditoria", {
      accion: "crear",
      tabla: "productos",
      registro_id: data?.[0]?.id || 0
    })

    mostrarToast("✅ Producto agregado", "ok")

    setNombre("")
    setCosto("")
    setMargen("")
    setStock("")
    cargar()
  }

  // ✏️ EDITAR
  async function guardarEdicion() {

    const costoNum = Number(editando.costo)
    const margenNum = Number(editando.margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)

    const { error } = await supabase
      .from("productos")
      .update({
        nombre: editando.nombre,
        costo: costoNum,
        margen: margenNum,
        precio_venta: precioVenta,
        stock: Number(editando.stock)
      })
      .eq("id", editando.id)

    if (error) return mostrarToast("❌ " + error.message, "error")

    // 🔥 AUDITORÍA
    await supabase.rpc("registrar_auditoria", {
      accion: "editar",
      tabla: "productos",
      registro_id: editando.id
    })

    mostrarToast("✅ Producto actualizado", "ok")
    setEditando(null)
    cargar()
  }

  // 🗑️ ELIMINAR
  async function eliminar(id: number) {

    if (!confirm("¿Eliminar este producto?")) return

    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", id)

    if (error) return mostrarToast("❌ " + error.message, "error")

    // 🔥 AUDITORÍA
    await supabase.rpc("registrar_auditoria", {
      accion: "eliminar",
      tabla: "productos",
      registro_id: id
    })

    mostrarToast("🗑️ Producto eliminado", "ok")
    cargar()
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando...</p>

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>📦 Productos</h1>

      <input
        placeholder="Buscar..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: "100%", marginBottom: 20, padding: 10 }}
      />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" type="number" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="% Margen" type="number" value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
        <button onClick={agregar}>➕ Agregar</button>
      </div>

      {productosFiltrados.map(p => {

        const costoNum = Number(editando?.costo || 0)
        const margenNum = Number(editando?.margen || 0)
        const precioEstimado = costoNum + (costoNum * margenNum / 100)

        return (
          <div key={p.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10
          }}>

            {editando?.id === p.id ? (

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                <input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                <input type="number" value={editando.costo} onChange={e => setEditando({ ...editando, costo: e.target.value })} />
                <input type="number" value={editando.margen} onChange={e => setEditando({ ...editando, margen: e.target.value })} />
                <input type="number" value={editando.stock} onChange={e => setEditando({ ...editando, stock: e.target.value })} />

                <div style={{ background: "#f1f3f5", padding: 10 }}>
                  💵 {formatearPrecio(precioEstimado)}
                </div>

                <button onClick={guardarEdicion}>💾 Guardar</button>
                <button onClick={() => setEditando(null)}>❌ Cancelar</button>

              </div>

            ) : (

              <div>
                <b>{p.nombre}</b>

                <p>
                  💰 {formatearPrecio(p.costo)} · 📊 {p.margen}% · 💵 {formatearPrecio(p.precio_venta)}
                </p>

                <p>📦 {p.stock}</p>

                <button onClick={() => setEditando({ ...p })}>✏️</button>
                <button onClick={() => eliminar(p.id)}>🗑️</button>

              </div>

            )}

          </div>
        )
      })}

    </div>
  )
}