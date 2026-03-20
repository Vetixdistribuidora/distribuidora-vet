"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [nombre, setNombre] = useState("")
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")
  const [editando, setEditando] = useState<number | null>(null)

  async function cargar() {
    const { data } = await supabase.from("productos").select("*")
    setProductos(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {
    await supabase.from("productos").insert([{
      nombre,
      precio: Number(precio),
      stock: Number(stock)
    }])
    setNombre(""); setPrecio(""); setStock("")
    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from("productos").delete().eq("id", id)
    cargar()
  }

  async function guardar(id: number) {
    await supabase.from("productos").update({
      precio: Number(precio),
      stock: Number(stock)
    }).eq("id", id)

    setEditando(null)
    cargar()
  }

  return (
    <div>

      <h1>📦 Productos</h1>

      <button onClick={() => window.history.back()}>🔙 Volver</button>

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Precio" value={precio} onChange={e => setPrecio(e.target.value)} />
        <input placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} />
        <button onClick={agregar}>➕ Agregar</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {productos.map(p => (
          <div key={p.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 15,
            borderRadius: 10,
            boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
          }}>

            <h3>{p.nombre}</h3>

            {editando === p.id ? (
              <>
                <input value={precio} onChange={e => setPrecio(e.target.value)} />
                <input value={stock} onChange={e => setStock(e.target.value)} />
                <button onClick={() => guardar(p.id)}>💾 Guardar</button>
              </>
            ) : (
              <>
                <p>💰 ${p.precio}</p>
                <p>📦 Stock: {p.stock}</p>

                <button onClick={() => {
                  setEditando(p.id)
                  setPrecio(String(p.precio))
                  setStock(String(p.stock))
                }}>✏️ Editar</button>

                <button onClick={() => eliminar(p.id)} style={{ marginLeft: 10 }}>
                  ❌ Eliminar
                </button>
              </>
            )}

          </div>
        ))}
      </div>

    </div>
  )
}