"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

// 🔔 Componente de toast simple
function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 20px",
      borderRadius: 10, fontWeight: "bold",
      boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

export default function Ventas() {

  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productoId, setProductoId] = useState("")
  const [clienteId, setClienteId] = useState("")
  const [carrito, setCarrito] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [vendiendo, setVendiendo] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string, tipo: "ok" | "error" } | null>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    setCargando(true)
    const { data: p } = await supabase.from("productos").select("*")
    const { data: c } = await supabase.from("clientes").select("*")
    setProductos(p || [])
    setClientes(c || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const guardado = localStorage.getItem("clienteId")
    if (guardado) setClienteId(guardado)
  }, [])

  function agregarProducto() {
    const producto = productos.find(p => p.id == productoId)
    const cliente = clientes.find(c => c.id == clienteId)

    if (!producto || !cliente) {
      mostrarToast("⚠️ Seleccioná cliente y producto", "error")
      return
    }
    if (producto.stock <= 0) {
      mostrarToast("❌ Sin stock disponible", "error")
      return
    }

    const precio = producto.costo + (producto.costo * cliente.porcentaje / 100)
    const existente = carrito.find(p => p.id === producto.id)

    if (existente) {
      actualizarCantidad(producto.id, existente.cantidad + 1)
      return
    }

    setCarrito(prev => [...prev, {
      id: producto.id,
      nombre: producto.nombre,
      precioFinal: precio,
      cantidad: 1,
      stock: producto.stock
    }])
    setProductoId("")
  }

  function actualizarCantidad(id: number, nuevaCantidad: number) {
    const producto = productos.find(p => p.id === id)
    if (!producto) return
    if (nuevaCantidad > producto.stock) {
      mostrarToast("⚠️ No hay suficiente stock", "error")
      return
    }
    if (nuevaCantidad <= 0) {
      eliminarItem(id)
      return
    }
    setCarrito(carrito.map(p => p.id === id ? { ...p, cantidad: nuevaCantidad } : p))
  }

  function eliminarItem(id: number) {
    setCarrito(carrito.filter(p => p.id !== id))
  }

  function total() {
    return carrito.reduce((acc, p) => acc + p.precioFinal * p.cantidad, 0)
  }

  async function vender() {
    if (!clienteId || carrito.length === 0) {
      mostrarToast("⚠️ Seleccioná cliente y agregá productos", "error")
      return
    }

    setVendiendo(true)

    const items = carrito.map(item => ({
      producto_id: item.id,
      cantidad: item.cantidad,
      precio: item.precioFinal
    }))

    const { error } = await supabase.rpc("registrar_venta", {
      p_cliente_id: clienteId,
      p_total: total(),
      p_items: items
    })

    setVendiendo(false)

    if (error) {
      mostrarToast("❌ Error: " + error.message, "error")
      return
    }

    mostrarToast("✅ Venta registrada con éxito", "ok")
    setCarrito([])
    cargar()
  }

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando datos...</p>

  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>💰 Venta</h1>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select value={clienteId} onChange={e => {
          setClienteId(e.target.value)
          localStorage.setItem("clienteId", e.target.value)
        }}>
          <option value="">Seleccionar cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
          ))}
        </select>

        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Seleccionar producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id} disabled={p.stock === 0}>
              {p.nombre} (Stock: {p.stock}){p.stock === 0 ? " — SIN STOCK" : ""}
            </option>
          ))}
        </select>

        <button onClick={agregarProducto}>➕ Agregar</button>
        <button onClick={() => setCarrito([])}>🧹 Vaciar</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {carrito.length === 0 && (
          <p style={{ color: "#888" }}>El carrito está vacío. Agregá productos arriba.</p>
        )}
        {carrito.map(p => (
          <div key={p.id} style={{
            background: "white", padding: 10,
            marginBottom: 10, borderRadius: 8
          }}>
            <b>{p.nombre}</b>
            <p>💵 ${p.precioFinal.toFixed(2)} c/u</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => actualizarCantidad(p.id, p.cantidad - 1)}>➖</button>
              <span>{p.cantidad}</span>
              <button onClick={() => actualizarCantidad(p.id, p.cantidad + 1)}>➕</button>
              <button onClick={() => eliminarItem(p.id)}>❌</button>
            </div>
            <p style={{ color: "#555", fontSize: 13 }}>
              Subtotal: ${(p.precioFinal * p.cantidad).toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <h2>Total: ${total().toFixed(2)}</h2>

      <button
        onClick={vender}
        disabled={vendiendo}
        style={{ opacity: vendiendo ? 0.6 : 1 }}
      >
        {vendiendo ? "⏳ Procesando..." : "💾 Confirmar venta"}
      </button>
    </div>
  )
}