"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ventas() {

  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])

  const [productoSeleccionado, setProductoSeleccionado] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [cantidad, setCantidad] = useState("")

  useEffect(() => {
    fetchProductos()
    fetchClientes()
  }, [])

  async function fetchProductos() {

    const { data } = await supabase
      .from("productos")
      .select("*")

    setProductos(data || [])
  }

  async function fetchClientes() {

    const { data } = await supabase
      .from("clientes")
      .select("*")

    setClientes(data || [])
  }

  async function vender() {

    const producto = productos.find(p => p.id == productoSeleccionado)

    if (!producto) return

    const nuevoStock = producto.stock - cantidad

    await supabase
      .from("productos")
      .update({
        stock: nuevoStock
      })
      .eq("id", producto.id)

    await supabase
      .from("ventas")
      .insert([
        {
          producto_id: productoSeleccionado,
          cliente_id: clienteSeleccionado,
          cantidad: cantidad,
          precio: producto.precio
        }
      ])

    setCantidad("")
    fetchProductos()

    alert("Venta registrada")
  }

  return (

    <main style={{ padding: "40px" }}>

      <h1>Registrar Venta</h1>

      <h3>Cliente</h3>

      <select
        value={clienteSeleccionado}
        onChange={(e) => setClienteSeleccionado(e.target.value)}
      >

        <option value="">Seleccionar cliente</option>

        {clientes.map(cliente => (

          <option key={cliente.id} value={cliente.id}>
            {cliente.nombre}
          </option>

        ))}

      </select>

      <h3>Producto</h3>

      <select
        value={productoSeleccionado}
        onChange={(e) => setProductoSeleccionado(e.target.value)}
      >

        <option value="">Seleccionar producto</option>

        {productos.map(producto => (

          <option key={producto.id} value={producto.id}>
            {producto.nombre}
          </option>

        ))}

      </select>

      <h3>Cantidad</h3>

      <input
        placeholder="Cantidad"
        value={cantidad}
        onChange={(e) => setCantidad(e.target.value)}
      />

      <br /><br />

      <button onClick={vender}>
        Registrar venta
      </button>

    </main>

  )

}