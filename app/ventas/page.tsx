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
  const [iva, setIva] = useState("21")

  const [toast, setToast] = useState<any>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: c } = await supabase.from("clientes").select("*")
    const { data: p } = await supabase.from("productos").select("*")

    setClientes(c || [])
    setProductos(p || [])
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
        precio: precioFinal,
        bonificacion: 0
      }])
    }

    setProductoId("")
    setCantidad("1")
  }

  // ➕ ➖
  function sumar(i: number) {
    const nuevo = [...carrito]
    nuevo[i].cantidad++
    setCarrito(nuevo)
  }

  function restar(i: number) {
    const nuevo = [...carrito]
    if (nuevo[i].cantidad > 1) nuevo[i].cantidad--
    setCarrito(nuevo)
  }

  function eliminarItem(i: number) {
    setCarrito(carrito.filter((_, index) => index !== i))
  }

  function vaciarCarrito() {
    setCarrito([])
  }

  // 🎁 BONIFICACIÓN EN UNIDADES
  function cambiarBonificacion(i: number, valor: number) {
    const nuevo = [...carrito]
    nuevo[i].bonificacion = valor
    setCarrito(nuevo)
  }

  // 💰 SUBTOTAL
  const subtotal = carrito.reduce((acc, item) => {

    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0

    return acc + (unidadesPagas * item.precio)

  }, 0)

  const ivaNum = Number(iva)
  const total = subtotal + (subtotal * ivaNum / 100)

  // 💾 GUARDAR
  async function guardarVenta() {

    if (!clienteId || carrito.length === 0) {
      mostrarToast("⚠️ Faltan datos", "error")
      return
    }

    // 📦 DESCONTAR STOCK
    for (const item of carrito) {
      await supabase.rpc("descontar_stock", {
        p_producto_id: item.producto_id,
        p_cantidad: item.cantidad
      })
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

      <h1>💰 Ventas PRO</h1>

      {/* CLIENTE */}
      <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
        <option value="">Cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
      </select>

      {/* PRODUCTOS */}
      <div style={{ marginTop: 10 }}>
        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto</option>
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
          style={{ width: 60 }}
        />

        <button onClick={agregarAlCarrito}>➕</button>
        <button onClick={vaciarCarrito}>🧹</button>
      </div>

      {/* CARRITO */}
      <h3>🛒 Carrito</h3>

      {carrito.length === 0 && <p>No hay productos</p>}

      {carrito.map((item, i) => {

        const bonif = item.bonificacion || 0
        const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
        const subtotalItem = unidadesPagas * item.precio

        return (
          <div key={i} style={{ background: "#eee", padding: 10, marginBottom: 10 }}>

            <b>{item.nombre}</b>

            <p>
              Cantidad: {item.cantidad} | Bonificadas: {bonif} | Pagan: {unidadesPagas}
            </p>

            <p>💰 Precio unitario: ${item.precio.toFixed(2)}</p>

            <p>Subtotal: ${subtotalItem.toFixed(2)}</p>

            <p>
              Bonificación:
              <input
                type="number"
                value={bonif}
                onChange={e => cambiarBonificacion(i, Number(e.target.value))}
                style={{ width: 60, marginLeft: 5 }}
              />
            </p>

            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => sumar(i)}>➕</button>
              <button onClick={() => restar(i)}>➖</button>
              <button onClick={() => eliminarItem(i)}>❌</button>
            </div>

          </div>
        )
      })}

      {/* TOTALES */}
      <h3>Subtotal: ${subtotal.toFixed(2)}</h3>

      <div>
        IVA:
        <input
          type="number"
          value={iva}
          onChange={e => setIva(e.target.value)}
          style={{ width: 60, marginLeft: 10 }}
        /> %
      </div>

      <h2>Total: ${total.toFixed(2)}</h2>

      <button onClick={guardarVenta}>💾 Confirmar venta</button>

    </div>
  )
}