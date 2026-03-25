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

  function cambiarBonificacion(i: number, valor: number) {
    const nuevo = [...carrito]
    nuevo[i].bonificacion = valor
    setCarrito(nuevo)
  }

  function cambiarPrecio(i: number, valor: number) {
    const nuevo = [...carrito]
    nuevo[i].precio = valor
    setCarrito(nuevo)
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

  // 🧾 TICKET
function imprimirTicket() {

  if (!clienteSeleccionado || carrito.length === 0) return

  const fecha = new Date().toLocaleString()

  const filas = carrito.map(item => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    const totalItem = unidadesPagas * item.precio

    return `
      <tr>
        <td>${item.producto_id}</td>
        <td>${item.nombre}</td>
        <td>${item.cantidad}</td>
        <td>$${item.precio.toFixed(2)}</td>
        <td>${bonif}</td>
        <td>$${totalItem.toFixed(2)}</td>
      </tr>
    `
  }).join("")

  const subtotalCalc = carrito.reduce((acc, item) => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    return acc + (unidadesPagas * item.precio)
  }, 0)

  const ivaNum = Number(iva)
  const totalFinal = subtotalCalc + (subtotalCalc * ivaNum / 100)

  const html = `
  <html>
  <head>
    <title>Factura</title>
    <style>
      body { font-family: Arial; padding: 20px; }
      .header { display: flex; justify-content: space-between; align-items: center; }
      .logo { height: 80px; }
      .datos { display: flex; justify-content: space-between; margin-top: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
      th { background: #eee; }
      .totales { margin-top: 20px; text-align: right; }
    </style>
  </head>

  <body>

    <div class="header">
      <img src="/logo.png" class="logo"/>
      <h2>Factura</h2>
    </div>

    <div class="datos">
      <div>
        <b>Cliente:</b><br/>
        ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}<br/>
        CUIT: ${clienteSeleccionado.cuit || "-"}<br/>
        Dirección: ${clienteSeleccionado.localidad || "-"}<br/>
        Tel: ${clienteSeleccionado.telefono || "-"}
      </div>

      <div>
        <b>Distribuidora:</b><br/>
        Vetix Distribuidora<br/>
        Dirección: Almirante Brown 620<br/>
        Tel: 2604518157<br/>
        Email: clauforte@gmail.com
      </div>
    </div>

    <p><b>Fecha:</b> ${fecha}</p>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Artículo</th>
          <th>Cantidad</th>
          <th>Precio Unitario</th>
          <th>Bonificación</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
      </tbody>
    </table>

    <div class="totales">
      <p>Subtotal: $${subtotalCalc.toFixed(2)}</p>
      <p>IVA (${ivaNum}%): $${(subtotalCalc * ivaNum / 100).toFixed(2)}</p>
      <h2>Total: $${totalFinal.toFixed(2)}</h2>
    </div>

  </body>
  </html>
  `

  // ✅ FIX TYPESCRIPT + POPUP
  if (typeof window !== "undefined") {
    const ventana = window.open("", "_blank")

    if (!ventana) {
      alert("⚠️ Permití ventanas emergentes para imprimir el ticket")
      return
    }

    ventana.document.write(html)
    ventana.document.close()
    ventana.print()
  }
}
}