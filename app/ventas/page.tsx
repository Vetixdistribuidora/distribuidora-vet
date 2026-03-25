"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Ventas() {

  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])

  const [clienteId, setClienteId] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)

  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")

  const [carrito, setCarrito] = useState<any[]>([])

  // 🔄 CARGA
  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data: clientesData } = await supabase.from("clientes").select("*")
    const { data: productosData } = await supabase.from("productos").select("*")

    setClientes(clientesData || [])
    setProductos(productosData || [])
  }

  // 👤 CLIENTE
  function seleccionarCliente(id: string) {
    setClienteId(id)
    const cliente = clientes.find(c => String(c.id) === id)
    setClienteSeleccionado(cliente)
  }

  // ➕ AGREGAR AL CARRITO
  function agregarAlCarrito() {

    if (!productoId || !cantidad) return

    const producto = productos.find(p => String(p.id) === productoId)
    if (!producto) return

    const cant = Number(cantidad)

    // 💰 PRECIO CON CLIENTE
    const base = producto.precio_venta
    const porcentaje = clienteSeleccionado?.porcentaje || 0
    const precioFinal = base + (base * porcentaje / 100)

    const item = {
      producto_id: producto.id,
      nombre: producto.nombre,
      cantidad: cant,
      precio: precioFinal
    }

    setCarrito([...carrito, item])
    setProductoId("")
    setCantidad("1")
  }

  // ❌ ELIMINAR ITEM
  function eliminarItem(index: number) {
    const nuevo = carrito.filter((_, i) => i !== index)
    setCarrito(nuevo)
  }

  // 💰 TOTAL
  const total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

  // 💾 GUARDAR VENTA
  async function guardarVenta() {

    if (!clienteId || carrito.length === 0) {
      alert("Seleccionar cliente y productos")
      return
    }

    const { data, error } = await supabase.rpc("registrar_venta", {
      p_cliente_id: Number(clienteId),
      p_total: total,
      p_items: carrito
    })

    if (error) {
      alert("❌ Error: " + error.message)
      return
    }

    alert("✅ Venta registrada")

    setCarrito([])
    setClienteId("")
    setClienteSeleccionado(null)
  }

  return (
    <div style={{ padding: 20 }}>

      <h1>💰 Ventas</h1>

      {/* CLIENTE */}
      <h3>Cliente</h3>
      <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
        <option value="">Seleccionar cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
      </select>

      {/* PRODUCTOS */}
      <h3>Agregar producto</h3>

      <select value={productoId} onChange={e => setProductoId(e.target.value)}>
        <option value="">Seleccionar producto</option>
        {productos.map(p => (
          <option key={p.id} value={p.id}>
            {p.nombre} - ${p.precio_venta}
          </option>
        ))}
      </select>

      <input
        type="number"
        value={cantidad}
        onChange={e => setCantidad(e.target.value)}
        style={{ width: 60, marginLeft: 10 }}
      />

      <button onClick={agregarAlCarrito} style={{ marginLeft: 10 }}>
        ➕ Agregar
      </button>

      {/* 🛒 CARRITO */}
      <h3 style={{ marginTop: 30 }}>🛒 Carrito</h3>

      {carrito.length === 0 && <p>No hay productos</p>}

      {carrito.map((item, i) => (
        <div key={i} style={{
          background: "#f1f3f5",
          padding: 10,
          marginBottom: 10,
          borderRadius: 8
        }}>
          <b>{item.nombre}</b>
          <p>{item.cantidad} x ${item.precio.toFixed(2)}</p>
          <p>Subtotal: ${(item.cantidad * item.precio).toFixed(2)}</p>

          <button onClick={() => eliminarItem(i)}>
            ❌ Quitar
          </button>
        </div>
      ))}

      {/* TOTAL */}
      <h2>💰 Total: ${total.toFixed(2)}</h2>

      <button
        onClick={guardarVenta}
        style={{
          background: "#2f9e44",
          color: "white",
          padding: "10px 20px",
          borderRadius: 8
        }}
      >
        💾 Confirmar venta
      </button>

    </div>
  )
}