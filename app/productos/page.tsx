"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])

  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")

  async function cargar() {
    const { data } = await supabase.from("productos").select("*")
    setProductos(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {

    if (!nombre || !costo || !margen || !stock) {
      alert("Completar todo")
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
      alert(error.message)
      return
    }

    setNombre("")
    setCosto("")
    setMargen("")
    setStock("")

    cargar()
  }

  return (
    <div>

      <h1>📦 Productos</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="% Margen" value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} />

        <button onClick={agregar}>➕ Agregar</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {productos.map(p => (
          <div key={p.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10
          }}>
            <b>{p.nombre}</b>
            <p>💰 Costo: ${p.costo}</p>
            <p>📊 Margen: {p.margen}%</p>
            <p>💵 Venta: ${p.precio_venta}</p>
            <p>📦 Stock: {p.stock}</p>
          </div>
        ))}
      </div>

    </div>
  )
}