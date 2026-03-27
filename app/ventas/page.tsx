"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

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

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [nroFactura, setNroFactura] = useState("0001")

  const [tipoPago, setTipoPago] = useState("pagado") // 🔥 NUEVO

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

  function agregarAlCarrito() {
    if (!productoId || !cantidad) return
    const producto = productos.find(p => String(p.id) === productoId)
    if (!producto) return

    const cant = Number(cantidad)

    const enCarrito = carrito.find(i => i.producto_id === producto.id)
    const cantidadEnCarrito = enCarrito?.cantidad || 0
    const stockDisponible = producto.stock - cantidadEnCarrito

    if (cant > stockDisponible) {
      mostrarToast(`⚠️ Stock insuficiente. Disponible: ${stockDisponible}`, "error")
      return
    }

    const base = producto.precio_venta
    const porcentaje = clienteSeleccionado?.porcentaje || 0
    const precioFinal = base + (base * porcentaje / 100)

    if (enCarrito) {
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
        bonificacion: 0,
        stockDisponible: producto.stock
      }])
    }

    setProductoId("")
    setCantidad("1")
  }

  function sumar(i: number) {
    const nuevo = [...carrito]
    const item = nuevo[i]

    if (item.cantidad >= item.stockDisponible) {
      mostrarToast(`⚠️ Stock máximo: ${item.stockDisponible}`, "error")
      return
    }

    item.cantidad++
    setCarrito([...nuevo])
  }

  function restar(i: number) {
    const nuevo = [...carrito]
    if (nuevo[i].cantidad > 1) nuevo[i].cantidad--
    setCarrito([...nuevo])
  }

  function eliminarItem(i: number) {
    setCarrito(carrito.filter((_, index) => index !== i))
  }

  function vaciarCarrito() {
    setCarrito([])
  }

  function cambiarBonificacion(i: number, valor: number) {
    const nuevo = [...carrito]
    nuevo[i].bonificacion = valor
    setCarrito([...nuevo])
  }

  function cambiarPrecio(i: number, valor: number) {
    const nuevo = [...carrito]
    nuevo[i].precio = valor
    setCarrito([...nuevo])
  }

  const subtotal = carrito.reduce((acc, item) => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    return acc + (unidadesPagas * item.precio)
  }, 0)

  const ivaNum = Number(iva)
  const total = subtotal + (subtotal * ivaNum / 100)

  async function guardarVenta() {
    if (!clienteId || carrito.length === 0) {
      mostrarToast("⚠️ Faltan datos", "error")
      return
    }

    // stock
    for (const item of carrito) {
      const producto = productos.find(p => p.id === item.producto_id)
      if (!producto) continue

      const nuevoStock = producto.stock - item.cantidad

      if (nuevoStock < 0) {
        mostrarToast(`❌ Sin stock para: ${item.nombre}`, "error")
        return
      }

      const { error } = await supabase
        .from("productos")
        .update({ stock: nuevoStock })
        .eq("id", item.producto_id)

      if (error) {
        mostrarToast("❌ Error al actualizar stock", "error")
        return
      }
    }

    // venta
    const { error } = await supabase.rpc("registrar_venta", {
      p_cliente_id: Number(clienteId),
      p_total: total,
      p_items: carrito
    })

    if (error) {
      mostrarToast("❌ " + error.message, "error")
      return
    }

    // 🔥 CUENTA CORRIENTE
    if (tipoPago === "cta_cte") {
      await supabase.from("cuenta_corriente").insert([{
        cliente_id: Number(clienteId),
        tipo: "venta",
        monto: total,
        descripcion: "Venta"
      }])
    }

    mostrarToast("✅ Venta realizada", "ok")

    setCarrito([])
    setClienteId("")
    setClienteSeleccionado(null)
    setTipoPago("pagado")

    cargar()
  }

  return (
    <div style={{ padding: 20 }}>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>💰 Ventas</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
          <option value="">Cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido}
            </option>
          ))}
        </select>

        {/* 🔥 NUEVO */}
        <select value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
          <option value="pagado">💵 Pagado</option>
          <option value="cta_cte">📒 Cuenta corriente</option>
        </select>
      </div>

      {/* resto igual */}
      <h2>Total: {formatearPrecio(total)}</h2>

      <button onClick={guardarVenta}>💾 Confirmar venta</button>

    </div>
  )
}