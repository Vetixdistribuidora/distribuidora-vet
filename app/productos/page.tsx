"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [precioVenta, setPrecioVenta] = useState("")
  const [stock, setStock] = useState("")

  async function cargar() {
    const { data } = await supabase.from("productos").select("*")
    setProductos(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {

    await supabase.from("productos").insert([{
      nombre,
      costo: Number(costo),
      precio_venta: Number(precioVenta),
      stock: Number(stock)
    }])

    setNombre("")
    setCosto("")
    setPrecioVenta("")
    setStock("")

    cargar()
  }

  async function eliminar(id: number) {
    await supabase.from("productos").delete().eq("id", id)
    cargar()
  }

  return (
    <div>

      <h1>📦 Productos</h1>

      <div style={{ display: "flex", gap: 10 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="Precio Venta" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} />
        <input placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} />

        <button onClick={agregar}>➕ Agregar</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {productos.map(p => (
          <div key={p.id} style={{ background: "white", padding: 15, marginBottom: 10 }}>
            <b>{p.nombre}</b>
            <p>💰 Costo: ${p.costo}</p>
            <p>💵 Venta: ${p.precio_venta}</p>
            <p>📦 Stock: {p.stock}</p>

            <button onClick={() => eliminar(p.id)}>❌ Eliminar</button>
          </div>
        ))}
      </div>

    </div>
  )
}