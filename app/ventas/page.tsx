"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

export default function Ventas() {

  const router = useRouter()

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
      id: producto.id,
      nombre: producto.nombre,
      precioFinal: precio,
      cantidad: 1
    }])
  }

  function eliminarItem(index: number) {
    const nuevo = [...carrito]
    nuevo.splice(index, 1)
    setCarrito(nuevo)
  }

  function total() {
    return carrito.reduce((acc, p) => acc + p.precioFinal * p.cantidad, 0)
  }

  async function vender() {

    if (!clienteId || carrito.length === 0) {
      alert("Faltan datos")
      return
    }

    // 🟢 1. CREAR VENTA
    const { data: venta, error } = await supabase
      .from("ventas")
      .insert([{ cliente_id: clienteId, total: total() }])
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    // 🟢 2. GUARDAR DETALLE + DESCONTAR STOCK
    for (const item of carrito) {

      await supabase.from("detalle_ventas").insert([{
        venta_id: venta.id,
        producto_id: item.id,
        cantidad: item.cantidad,
        precio: item.precioFinal
      }])

      const producto = productos.find(p => p.id === item.id)

      if (producto) {
        await supabase.from("productos").update({
          stock: producto.stock - item.cantidad
        }).eq("id", item.id)
      }
    }

    setCarrito([])

    // 🧾 IR A FACTURA
    router.push(`/factura/${venta.id}`)
  }

  return (
    <div>

      <h1>💰 Venta</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        
        <select onChange={e => setClienteId(e.target.value)}>
          <option value="">Cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto</option>
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
            {p.nombre} - ${p.precioFinal.toFixed(2)}

            <button
              onClick={() => eliminarItem(i)}
              style={{ marginLeft: 10 }}
            >
              ❌
            </button>
          </div>
        ))}
      </div>

      <h2>Total: ${total().toFixed(2)}</h2>

      <button onClick={vender}>💾 Confirmar venta</button>

    </div>
  )
}