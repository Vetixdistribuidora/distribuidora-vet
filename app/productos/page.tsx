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

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)

  const [busqueda, setBusqueda] = useState("")

  // ➕ FORM
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

  // ➕ AGREGAR
  async function agregar() {

    if (!nombre || !costo || !margen || !stock) {
      mostrarToast("⚠️ Completá todos los campos", "error")
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

    if (error) return mostrarToast("❌ " + error.message, "error")

    mostrarToast("✅ Producto agregado", "ok")

    setNombre("")
    setCosto("")
    setMargen("")
    setStock("")

    cargar()
  }

  // ✏️ GUARDAR
  async function guardarEdicion() {

    if (!editando.nombre || !editando.costo || !editando.margen) {
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
    }

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

    mostrarToast("🗑️ Producto eliminado", "ok")
    cargar()
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando productos...</p>

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>📦 Productos</h1>

      {/* 🔍 BUSCADOR */}
      <input
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: "100%", marginBottom: 20, padding: 10 }}
      />

      {/* ➕ FORM */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" type="number" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="% Margen" type="number" value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
        <button onClick={agregar}>➕ Agregar</button>
      </div>

      {/* LISTA */}
      {productosFiltrados.map(p => {

        // 🔥 cálculo en vivo
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

                <label><b>🏷️ Nombre</b></label>
                <input value={editando.nombre || ""} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />

                <label><b>💰 Costo</b></label>
                <input type="number" value={editando.costo || ""} onChange={e => setEditando({ ...editando, costo: e.target.value })} />

                <label><b>📊 % Margen</b></label>
                <input type="number" value={editando.margen || ""} onChange={e => setEditando({ ...editando, margen: e.target.value })} />

                <label><b>📦 Stock</b></label>
                <input type="number" value={editando.stock || ""} onChange={e => setEditando({ ...editando, stock: e.target.value })} />

                {/* 💥 PRECIO EN VIVO */}
                <div style={{
                  background: "#f1f3f5",
                  padding: 10,
                  borderRadius: 8,
                  marginTop: 10
                }}>
                  💵 <b>Precio estimado:</b> ${precioEstimado.toFixed(2)}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={guardarEdicion}>💾 Guardar</button>
                  <button onClick={() => setEditando(null)}>✖️ Cancelar</button>
                </div>

              </div>

            ) : (

              <div>
                <b>{p.nombre}</b>

                {p.stock <= 5 && <span style={{ marginLeft: 10 }}>⚠️ Stock bajo</span>}

                <p>💰 Costo: ${p.costo} · 📊 Margen: {p.margen}% · 💵 Venta: ${p.precio_venta}</p>
                <p>📦 Stock: {p.stock}</p>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditando({ ...p })}>✏️ Editar</button>
                  <button onClick={() => eliminar(p.id)} style={{ background: "red", color: "white" }}>🗑️</button>
                </div>
              </div>

            )}

          </div>
        )
      })}

    </div>
  )
}