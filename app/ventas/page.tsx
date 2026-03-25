"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 30,
      right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: "bold",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

export default function Ventas() {

  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])

  const [clienteId, setClienteId] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)

  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")

  const [carrito, setCarrito] = useState<any[]>([])
  const [toast, setToast] = useState<any>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: clientesData } = await supabase.from("clientes").select("*")
    const { data: productosData } = await supabase.from("productos").select("*")

    setClientes(clientesData || [])
    setProductos(productosData || [])
  }

  function seleccionarCliente(id: string) {
    setClienteId(id)
    const cliente = clientes.find(c => String(c.id) === id)
    setClienteSeleccionado(cliente)
  }

  // ➕ AGREGAR
  function agregarAlCarrito() {

    if (!productoId || !cantidad) return

    const producto = productos.find(p => String(p.id) === productoId)
    if (!producto) return

    const cant = Number(cantidad)

    const base = producto.precio_venta
    const porcentaje = clienteSeleccionado?.porcentaje || 0
    const precioFinal = base + (base * porcentaje / 100)

    // 🔥 SI YA EXISTE, SUMA
    const existente = carrito.find(i => i.producto_id === producto.id)

    if (existente) {
      setCarrito(carrito.map(i =>
        i.producto_id === producto.id
          ? { ...i, cantidad: i.cantidad + cant }
          : i
      ))
    } else {
      setCarrito([...carrito, {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: cant,
        precio: precioFinal
      }])
    }

    setProductoId("")
    setCantidad("1")
  }

  // ➕ SUMAR
  function sumar(index: number) {
    const nuevo = [...carrito]
    nuevo[index].cantidad++
    setCarrito(nuevo)
  }

  // ➖ RESTAR
  function restar(index: number) {
    const nuevo = [...carrito]
    if (nuevo[index].cantidad > 1) {
      nuevo[index].cantidad--
      setCarrito(nuevo)
    }
  }

  // ❌ ELIMINAR
  function eliminarItem(index: number) {
    setCarrito(carrito.filter((_, i) => i !== index))
  }

  // 🧹 VACIAR
  function vaciarCarrito() {
    setCarrito([])
  }

  const total = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0)

  async function guardarVenta() {

    if (!clienteId || carrito.length === 0) {
      mostrarToast("⚠️ Seleccioná cliente y productos", "error")
      return
    }

    const { error } = await supabase.rpc("registrar_venta", {
      p_cliente_id: Number(clienteId),
      p_total: total,
      p_items: carrito
    })

    if (error) {
      mostrarToast("❌ " + error.message, "error")
      return
    }

    mostrarToast("✅ Venta realizada", "ok")

    setCarrito([])
    setClienteId("")
    setClienteSeleccionado(null)
  }

  return (
    <div style={{ padding: 20 }}>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

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

      <button onClick={vaciarCarrito} style={{ marginLeft: 10 }}>
        🧹 Vaciar
      </button>

      {/* CARRITO */}
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

          <p>
            {item.cantidad} x ${item.precio.toFixed(2)}
          </p>

          <p>Subtotal: ${(item.cantidad * item.precio).toFixed(2)}</p>

          <div style={{ display: "flex", gap: 5 }}>
            <button onClick={() => sumar(i)}>➕</button>
            <button onClick={() => restar(i)}>➖</button>
            <button onClick={() => eliminarItem(i)}>❌</button>
          </div>
        </div>
      ))}

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