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
      const precio = producto.costo + (producto.costo * cliente.porcentaje / 100)
      setPrecioFinal(precio)
    }

  }, [productoId, clienteId])

  async function vender() {

    const { error } = await supabase.from("ventas").insert([{
      producto_id: productoId,
      cliente_id: clienteId,
      total: precioFinal
    }])

    if (error) {
      alert(error.message)
      return
    }

    alert("✅ Venta realizada")
  }

  return (
    <div>

      <h1>💰 Venta</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select onChange={e => setProductoId(e.target.value)}>
          <option value="">Seleccionar producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>

        <select onChange={e => setClienteId(e.target.value)}>
          <option value="">Seleccionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} ({c.porcentaje}%)
            </option>
          ))}
        </select>
      </div>

      <h2 style={{ marginTop: 20 }}>
        💵 Precio final: ${precioFinal.toFixed(2)}
      </h2>

      <button onClick={vender}>💾 Confirmar venta</button>

    </div>
  )
}