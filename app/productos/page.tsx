"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

// 🧩 TIPO
type Producto = {
  id: number
  nombre: string
  descripcion: string
  precio: number
  stock: number
}

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoDescripcion, setNuevoDescripcion] = useState("")
  const [nuevoPrecio, setNuevoPrecio] = useState("")
  const [nuevoStock, setNuevoStock] = useState("")

  const [editando, setEditando] = useState<number | null>(null)
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")

  const [busqueda, setBusqueda] = useState("")

  // 🔄 TRAER PRODUCTOS
  async function fetchProductos() {
    const { data, error } = await supabase
      .from("productos")
      .select("*")

    if (error) {
      console.log("ERROR FETCH:", error)
    } else {
      setProductos(data || [])
    }
  }

  useEffect(() => {
    fetchProductos()
  }, [])

  // ➕ AGREGAR
  async function agregarProducto() {

    if (!nuevoNombre || !nuevoPrecio || !nuevoStock) {
      alert("Completar todos los campos")
      return
    }

    const { error } = await supabase
      .from("productos")
      .insert([
        {
          nombre: nuevoNombre,
          descripcion: nuevoDescripcion,
          precio: Number(nuevoPrecio),
          stock: Number(nuevoStock)
        }
      ])

    if (error) {
      console.log("ERROR AL AGREGAR:", error)
      alert("Error al agregar producto")
      return
    }

    setNuevoNombre("")
    setNuevoDescripcion("")
    setNuevoPrecio("")
    setNuevoStock("")

    fetchProductos()
  }

  // ✏️ EDITAR
  async function guardarCambios(id: number) {

    if (!precio || !stock) {
      alert("Completar todos los campos")
      return
    }

    const precioNum = Number(precio)
    const stockNum = Number(stock)

    if (isNaN(precioNum) || isNaN(stockNum)) {
      alert("Precio y stock deben ser números")
      return
    }

    const { error } = await supabase
      .from("productos")
      .update({
        precio: precioNum,
        stock: stockNum
      })
      .eq("id", id)

    if (error) {
      console.log("ERROR AL GUARDAR:", error)
      alert("Error al guardar: " + error.message)
      return
    }

    alert("✅ Producto actualizado")

    setEditando(null)
    fetchProductos()
  }

  // ❌ ELIMINAR
  async function eliminarProducto(id: number) {

    const confirmar = confirm("¿Seguro que querés eliminar este producto?")
    if (!confirmar) return

    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id", id)

    if (error) {
      console.log("ERROR AL ELIMINAR:", error)
      alert("Error al eliminar")
      return
    }

    fetchProductos()
  }

  // 🔍 FILTRO
  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (

    <main style={{ padding: "40px", maxWidth: "800px", margin: "auto" }}>

      <h1>🐾 Productos</h1>

      {/* 🔍 BUSCADOR */}
      <input
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: "100%", marginBottom: "20px", padding: "10px" }}
      />

      <h2>Agregar producto</h2>

      <input
        placeholder="Nombre"
        value={nuevoNombre}
        onChange={(e) => setNuevoNombre(e.target.value)}
      />

      <input
        placeholder="Descripción"
        value={nuevoDescripcion}
        onChange={(e) => setNuevoDescripcion(e.target.value)}
      />

      <input
        type="number"
        placeholder="Precio"
        value={nuevoPrecio}
        onChange={(e) => setNuevoPrecio(e.target.value)}
      />

      <input
        type="number"
        placeholder="Stock"
        value={nuevoStock}
        onChange={(e) => setNuevoStock(e.target.value)}
      />

      <button onClick={agregarProducto}>
        ➕ Agregar producto
      </button>

      <hr />

      {productosFiltrados.map((producto) => (

        <div
          key={producto.id}
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            marginBottom: "15px",
            borderRadius: "10px"
          }}
        >

          <h3>{producto.nombre}</h3>
          <p>{producto.descripcion}</p>

          {editando === producto.id ? (

            <>
              <input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />

              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />

              <br /><br />

              <button
                onClick={() => guardarCambios(producto.id)}
                style={{ backgroundColor: "green", color: "white" }}
              >
                Guardar
              </button>
            </>

          ) : (

            <>
              <p>💰 Precio: ${producto.precio}</p>
              <p>📦 Stock: {producto.stock}</p>

              {producto.stock < 5 && (
                <p style={{ color: "red" }}>⚠️ Stock bajo</p>
              )}

              <button
                onClick={() => {
                  setEditando(producto.id)
                  setPrecio(String(producto.precio))
                  setStock(String(producto.stock))
                }}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarProducto(producto.id)}
                style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}
              >
                Eliminar
              </button>
            </>

          )}

        </div>

      ))}

    </main>
  )
}