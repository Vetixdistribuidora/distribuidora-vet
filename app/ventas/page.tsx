"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ventas() {

  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])

  const [productoId, setProductoId] = useState("")
  const [clienteId, setClienteId] = useState("")

  const [precioFinal, setPrecioFinal] = useState(0)

  async function cargar() {
    const { data: p } = await supabase.from("productos").select("*")
    const { data: c } = await supabase.from("clientes").select("*")

    setProductos(p || [])
    setClientes(c || [])
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {

    const producto = productos.find(p => p.id == productoId)
    const cliente = clientes.find(c => c.id == clienteId)

    if (producto && cliente) {
      const precio = producto.precio_venta - (producto.precio_venta * cliente.descuento / 100)
      setPrecioFinal(precio)
    }

  }, [productoId, clienteId])

  async function vender() {

    await supabase.from("ventas").insert([{
      producto_id: productoId,
      cliente_id: clienteId,
      total: precioFinal
    }])

    alert("✅ Venta realizada")
  }

  return (
    <div>

      <h1>💰 Venta</h1>

      <select onChange={e => setProductoId(e.target.value)}>
        <option>Producto</option>
        {productos.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </select>

      <select onChange={e => setClienteId(e.target.value)}>
        <option>Cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} ({c.descuento}%)
          </option>
        ))}
      </select>

      <h2>💵 Precio final: ${precioFinal.toFixed(2)}</h2>

      <button onClick={vender}>💾 Confirmar venta</button>

    </div>
  )
}