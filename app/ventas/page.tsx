"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ventas() {

  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])

  const [productoId, setProductoId] = useState("")
  const [clienteId, setClienteId] = useState("")

  const [carrito, setCarrito] = useState<any[]>([])

  async function cargar() {
    const { data: p } = await supabase.from("productos").select("*")
    const { data: c } = await supabase.from("clientes").select("*")

    setProductos(p || [])
    setClientes(c || [])
  }

  useEffect(() => { cargar() }, [])

  function agregarProducto() {

    const producto = productos.find(p => p.id == productoId)
    const cliente = clientes.find(c => c.id == clienteId)

    if (!producto || !cliente) {
      alert("Seleccionar cliente y producto")
      return
    }

    const precio = producto.costo + (producto.costo * cliente.porcentaje / 100)

    setCarrito([...carrito, {
      nombre: producto.nombre,
      precioFinal: precio
    }])
  }

  function total() {
    return carrito.reduce((acc, p) => acc + p.precioFinal, 0)
  }

  async function vender() {

    if (!clienteId || carrito.length === 0) {
      alert("Faltan datos")
      return
    }

    const { error } = await supabase.from("ventas").insert([{
      cliente_id: clienteId,
      total: total()
    }])

    if (error) {
      alert(error.message)
      return
    }

    alert("✅ Venta realizada")
    setCarrito([])
  }

  return (
    <div>

      <h1>💰 Venta</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        
        {/* 👇 CLIENTE SIN % */}
        <select onChange={e => setClienteId(e.target.value)}>
          <option value="">Seleccionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select onChange={e => setProductoId(e.target.value)}>
          <option value="">Seleccionar producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <button onClick={agregarProducto}>➕ Agregar</button>

      </div>

      {/* 🛒 CARRITO */}
      <div style={{ marginTop: 20 }}>
        {carrito.map((p, i) => (
          <div key={i} style={{
            background: "white",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8
          }}>
            {p.nombre} - 💵 ${p.precioFinal.toFixed(2)}
          </div>
        ))}
      </div>

      <h2>Total: ${total().toFixed(2)}</h2>

      <button onClick={vender}>💾 Confirmar venta</button>

    </div>
  )
}