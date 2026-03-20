"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ventas() {

  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])

  const [productoId, setProductoId] = useState("")
  const [clienteId, setClienteId] = useState("")

  const [carrito, setCarrito] = useState<any[]>([])

  // 🔄 CARGAR
  async function cargar() {
    const { data: p } = await supabase.from("productos").select("*")
    const { data: c } = await supabase.from("clientes").select("*")

    setProductos(p || [])
    setClientes(c || [])
  }

  useEffect(() => {
    cargar()
  }, [])

  // 💾 CLIENTE GUARDADO
  useEffect(() => {
    const guardado = localStorage.getItem("clienteId")
    if (guardado) setClienteId(guardado)
  }, [])

  // ➕ AGREGAR PRODUCTO
  function agregarProducto() {

    const producto = productos.find(p => p.id == productoId)
    const cliente = clientes.find(c => c.id == clienteId)

    if (!producto || !cliente) {
      alert("Seleccionar cliente y producto")
      return
    }

    // 🔴 SI NO HAY STOCK
    if (producto.stock <= 0) {
      alert("❌ Sin stock")
      return
    }

    const precio = producto.costo + (producto.costo * cliente.porcentaje / 100)

    // 👉 SI YA EXISTE EN CARRITO
    const existente = carrito.find(p => p.id === producto.id)

    if (existente) {
      actualizarCantidad(producto.id, existente.cantidad + 1)
      return
    }

    setCarrito(prev => [
      ...prev,
      {
        id: producto.id,
        nombre: producto.nombre,
        precioFinal: precio,
        cantidad: 1,
        stock: producto.stock
      }
    ])

    setProductoId("")
  }

  // ➕➖ ACTUALIZAR CANTIDAD
  function actualizarCantidad(id: number, nuevaCantidad: number) {

    const producto = productos.find(p => p.id === id)

    if (!producto) return

    if (nuevaCantidad > producto.stock) {
      alert("⚠️ No hay suficiente stock")
      return
    }

    if (nuevaCantidad <= 0) {
      eliminarItem(id)
      return
    }

    setCarrito(carrito.map(p =>
      p.id === id ? { ...p, cantidad: nuevaCantidad } : p
    ))
  }

  // ❌ ELIMINAR
  function eliminarItem(id: number) {
    setCarrito(carrito.filter(p => p.id !== id))
  }

  // 🧹 VACIAR
  function vaciarCarrito() {
    setCarrito([])
  }

  // 💰 TOTAL
  function total() {
    return carrito.reduce((acc, p) => acc + p.precioFinal * p.cantidad, 0)
  }

  // 💾 VENDER
  async function vender() {

    if (!clienteId || carrito.length === 0) {
      alert("Faltan datos")
      return
    }

    // 🔴 VALIDAR STOCK FINAL
    for (const item of carrito) {
      const producto = productos.find(p => p.id === item.id)
      if (producto && item.cantidad > producto.stock) {
        alert(`Stock insuficiente: ${producto.nombre}`)
        return
      }
    }

    const { data: venta, error } = await supabase
      .from("ventas")
      .insert([{ cliente_id: clienteId, total: total() }])
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

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

    alert("✅ Venta realizada")

    setCarrito([])
    cargar()
  }

  return (
    <div>

      <h1>💰 Venta</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        
        {/* 👤 CLIENTE */}
        <select
          value={clienteId}
          onChange={e => {
            setClienteId(e.target.value)
            localStorage.setItem("clienteId", e.target.value)
          }}
        >
          <option value="">Seleccionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        {/* 📦 PRODUCTO */}
        <select
          value={productoId}
          onChange={e => setProductoId(e.target.value)}
        >
          <option value="">Seleccionar producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre} (Stock: {p.stock})
            </option>
          ))}
        </select>

        <button onClick={agregarProducto}>
          ➕ Agregar
        </button>

        <button onClick={vaciarCarrito}>
          🧹 Vaciar
        </button>

      </div>

      {/* 🛒 CARRITO */}
      <div style={{ marginTop: 20 }}>
        {carrito.map(p => (
          <div key={p.id} style={{
            background: "white",
            padding: 10,
            marginBottom: 10,
            borderRadius: 8
          }}>
            <b>{p.nombre}</b>

            <p>💵 ${p.precioFinal.toFixed(2)}</p>
            <p>📦 Stock disponible: {p.stock}</p>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => actualizarCantidad(p.id, p.cantidad - 1)}>
                ➖
              </button>

              <span>{p.cantidad}</span>

              <button onClick={() => actualizarCantidad(p.id, p.cantidad + 1)}>
                ➕
              </button>
            </div>

            <button onClick={() => eliminarItem(p.id)}>
              ❌ Eliminar
            </button>

          </div>
        ))}
      </div>

      <h2>Total: ${total().toFixed(2)}</h2>

      <button onClick={vender}>
        💾 Confirmar venta
      </button>

    </div>
  )
}