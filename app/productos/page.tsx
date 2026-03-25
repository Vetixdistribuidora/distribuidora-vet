"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 20px",
      borderRadius: 10, fontWeight: "bold",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<{ mensaje: string, tipo: "ok" | "error" } | null>(null)

  // 🔍 BUSCADOR
  const [busqueda, setBusqueda] = useState("")

  // 📝 AGREGAR
  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")

  // ✏️ EDITAR
  const [editando, setEditando] = useState<any | null>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from("productos").select("*").order("nombre")
    setProductos(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  // 💵 PRECIO EN VIVO
  const precioPreview =
    Number(costo) && Number(margen)
      ? Number(costo) + (Number(costo) * Number(margen) / 100)
      : 0

  async function agregar() {

    if (!nombre || !costo || !margen || !stock) {
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
    }

    if (Number(stock) < 0) {
      mostrarToast("⚠️ Stock no puede ser negativo", "error")
      return
    }

    const costoNum = Number(costo)
    const margenNum = Number(margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)

    const { error } = await supabase.from("productos").insert([{
      nombre,
      costo: costoNum,
      margen: margenNum,
      precio_venta: precioVenta,
      stock: Number(stock)
    }])

    if (error) {
      mostrarToast("❌ " + error.message, "error")
      return
    }

    mostrarToast("✅ Producto agregado", "ok")

    setNombre("")
    setCosto("")
    setMargen("")
    setStock("")

    cargar()
  }

  async function guardarEdicion() {

    if (!editando.nombre || !editando.costo || !editando.margen) {
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
    }

    if (Number(editando.stock) < 0) {
      mostrarToast("⚠️ Stock no puede ser negativo", "error")
      return
    }

    if (!confirm("¿Guardar cambios?")) return

    const costoNum = Number(editando.costo)
    const margenNum = Number(editando.margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)

    const { error } = await supabase.from("productos").update({
      nombre: editando.nombre,
      costo: costoNum,
      margen: margenNum,
      precio_venta: precioVenta,
      stock: Number(editando.stock)
    }).eq("id", editando.id)

    if (error) {
      mostrarToast("❌ " + error.message, "error")
      return
    }

    mostrarToast("✅ Producto actualizado", "ok")
    setEditando(null)
    cargar()
  }

  async function eliminar(id: number) {

    if (!confirm("¿Eliminar este producto?")) return

    const { error } = await supabase.from("productos").delete().eq("id", id)

    if (error) {
      mostrarToast("❌ " + error.message, "error")
      return
    }

    mostrarToast("🗑️ Producto eliminado", "ok")
    cargar()
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando productos...</p>

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>📦 Productos</h1>

      {/* 🔍 BUSCADOR */}
      <input
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ marginBottom: 20, padding: 8, width: "100%" }}
      />

      {/* ➕ FORMULARIO */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" type="number" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="% Margen" type="number" value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
        <button onClick={agregar}>➕ Agregar</button>
      </div>

      {/* 💵 PREVIEW */}
      <p style={{ marginBottom: 20 }}>
        💵 Precio estimado: <b>${precioPreview.toFixed(2)}</b>
      </p>

      {/* 📋 LISTA */}
      {productos
        .filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
        .map(p => (

          <div key={p.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10
          }}>

            {editando?.id === p.id ? (

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                <input type="number" value={editando.costo} onChange={e => setEditando({ ...editando, costo: e.target.value })} />
                <input type="number" value={editando.margen} onChange={e => setEditando({ ...editando, margen: e.target.value })} />
                <input type="number" value={editando.stock} onChange={e => setEditando({ ...editando, stock: e.target.value })} />

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={guardarEdicion}>💾 Guardar</button>
                  <button onClick={() => setEditando(null)}>✖️ Cancelar</button>
                </div>
              </div>

            ) : (

              <div>
                <b>{p.nombre}</b>

                {p.stock <= 5 && (
                  <span style={{
                    marginLeft: 10,
                    background: "#fff3cd",
                    color: "#856404",
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 12
                  }}>
                    ⚠️ Stock bajo
                  </span>
                )}

                <p>💰 ${p.costo} · 📊 {p.margen}% · 💵 ${p.precio_venta}</p>
                <p>📦 Stock: {p.stock}</p>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditando({ ...p })}>✏️ Editar</button>
                  <button
                    onClick={() => eliminar(p.id)}
                    style={{
                      background: "#e03131",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 12px"
                    }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>

            )}

          </div>
        ))}

    </div>
  )
}