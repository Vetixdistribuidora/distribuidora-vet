"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Productos() {

  const [productos, setProductos] = useState([])

  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevoPrecio, setNuevoPrecio] = useState("")
  const [nuevoStock, setNuevoStock] = useState("")

  const [editando, setEditando] = useState(null)
  const [precio, setPrecio] = useState("")
  const [stock, setStock] = useState("")

  async function fetchProductos() {
    const { data } = await supabase
      .from("productos")
      .select("*")

    setProductos(data || [])
  }

  useEffect(() => {
    fetchProductos()
  }, [])

  async function agregarProducto() {

    const { error } = await supabase
      .from("productos")
      .insert([
        {
          nombre: nuevoNombre,
          precio: nuevoPrecio,
          stock: nuevoStock
        }
      ])

    if (error) {
      console.log(error)
    }

    setNuevoNombre("")
    setNuevoPrecio("")
    setNuevoStock("")

    fetchProductos()
  }

  async function guardarCambios(id) {

    await supabase
      .from("productos")
      .update({
        precio: precio,
        stock: stock
      })
      .eq("id", id)

    setEditando(null)

    fetchProductos()
  }

  async function eliminarProducto(id) {

    await supabase
      .from("productos")
      .delete()
      .eq("id", id)

    fetchProductos()
  }

  return (

    <main style={{ padding: "40px" }}>

      <h1>Productos</h1>

      <h2>Agregar producto</h2>

      <input
        placeholder="Nombre"
        value={nuevoNombre}
        onChange={(e) => setNuevoNombre(e.target.value)}
      />

      <input
        placeholder="Precio"
        value={nuevoPrecio}
        onChange={(e) => setNuevoPrecio(e.target.value)}
      />

      <input
        placeholder="Stock"
        value={nuevoStock}
        onChange={(e) => setNuevoStock(e.target.value)}
      />

      <button onClick={agregarProducto}>
        Agregar producto
      </button>

      <hr />

      {productos.map((producto) => (

        <div
          key={producto.id}
          style={{
            border: "1px solid gray",
            padding: "15px",
            marginBottom: "15px",
            borderRadius: "10px"
          }}
        >

          <h3>{producto.nombre}</h3>

          {editando === producto.id ? (

            <>

              <input
                placeholder="Precio"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
              />

              <input
                placeholder="Stock"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />

              <br /><br />

              <button onClick={() => guardarCambios(producto.id)}>
                Guardar
              </button>

            </>

          ) : (

            <>

              <p>Precio: ${producto.precio}</p>
              <p>Stock: {producto.stock}</p>

              <button
                onClick={() => {
                  setEditando(producto.id)
                  setPrecio(producto.precio)
                  setStock(producto.stock)
                }}
              >
                Editar
              </button>

              <button
                onClick={() => eliminarProducto(producto.id)}
                style={{ marginLeft: "10px" }}
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