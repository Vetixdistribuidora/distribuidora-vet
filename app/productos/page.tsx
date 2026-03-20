"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Producto = {
  id: number
  nombre: string
  descripcion: string
  precio: number
  stock: number
}

export default function Productos() {

  const [productos, setProductos] = useState<Producto[]>([])
  const [nombre, setNombre] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")

  useEffect(() => {
    fetchProductos()
  }, [])

  async function fetchProductos() {
    const { data } = await supabase.from("productos").select("*")
    setProductos(data || [])
  }

  async function agregarProducto() {

    const { error } = await supabase.from("productos").insert([
      {
        nombre,
        descripcion,
        precio: Number(precio),
        stock: Number(stock)
      }
    ])

    if (error) {
      alert(error.message)
      return
    }

    setNombre("")
    setDescripcion("")
    setPrecio("")
    setStock("")

    fetchProductos()
  }

  async function eliminar(id: number) {
    await supabase.from("productos").delete().eq("id", id)
    fetchProductos()
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Productos</h1>

      <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
      <input placeholder="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      <input placeholder="Precio" value={precio} onChange={e => setPrecio(e.target.value)} />
      <input placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} />

      <button onClick={agregarProducto}>Agregar</button>

      <hr />

      {productos.map(p => (
        <div key={p.id}>
          <h3>{p.nombre}</h3>
          <p>${p.precio}</p>
          <p>Stock: {p.stock}</p>
          <button onClick={() => eliminar(p.id)}>Eliminar</button>
        </div>
      ))}
    </main>
  )
}