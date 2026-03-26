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

  function imprimirTicket() {

  if (!clienteSeleccionado || carrito.length === 0) return

  const fecha = new Date().toLocaleString()
  const numero = Math.floor(Math.random() * 100000)

  const filas = carrito.map(item => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    const totalItem = unidadesPagas * item.precio

    return `
      <tr>
        <td>${item.cantidad}</td>
        <td style="text-align:left;">${item.nombre}</td>
        <td>$${item.precio.toFixed(2)}</td>
        <td>${bonif}</td>
        <td>$${totalItem.toFixed(2)}</td>
      </tr>
    `
  }).join("")

  const logoUrl = window.location.origin + "/logo.png"

  const html = `
  <html>
  <head>
    <style>
      body { font-family: Arial; padding: 30px; }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .logo { height: 90px; }

      .datos {
        display: flex;
        justify-content: space-between;
        margin-top: 20px;
      }

      table {
        width: 100%;
        margin-top: 30px;
        border-collapse: collapse;
      }

      th {
        border: 1px solid #ccc;
        padding: 8px;
        background: #eee;
      }

      td {
        padding: 6px;
        text-align: center;
      }

      .totales {
        margin-top: 20px;
        text-align: right;
      }
    </style>
  </head>

  <body>

    <div class="header">
      <img src="${logoUrl}" class="logo"/>
      <div>
        <h2>PRESUPUESTO</h2>
        <div>N° ${numero}</div>
      </div>
    </div>

    <div class="datos">
      <div>
        <b>VETIX Distribuidora</b><br/>
        Almirante Brown 620<br/>
        Tel: 2604518157<br/>
        Email: clauforte@gmail.com
      </div>

      <div style="text-align:right;">
        <b>Cliente:</b><br/>
        ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}<br/>
        CUIT: ${clienteSeleccionado.cuit || "-"}<br/>
        Dirección: ${clienteSeleccionado.localidad || "-"}<br/>
        Tel: ${clienteSeleccionado.telefono || "-"}
      </div>
    </div>

    <p><b>Fecha:</b> ${fecha}</p>

    <table>
      <thead>
        <tr>
          <th>Cant.</th>
          <th style="width:40%">Descripción</th>
          <th>Precio U.</th>
          <th>Bonif.</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
      </tbody>
    </table>

    <div class="totales">
      <p><b>Subtotal:</b> $${subtotal.toFixed(2)}</p>
      <p><b>IVA (${ivaNum}%):</b> $${(subtotal * ivaNum / 100).toFixed(2)}</p>
      <h2><b>Total:</b> $${total.toFixed(2)}</h2>
    </div>

  </body>
  </html>
  `

  const ventana = window.open("", "_blank")
  if (!ventana) return

  ventana.document.write(html)
  ventana.document.close()

  setTimeout(() => ventana.print(), 500)
}

  return (
    <div style={{ padding: 20 }}>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>💰 Ventas</h1>

      <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
        <option value="">Cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 10 }}>
        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre} - ${p.precio_venta}
            </option>
          ))}
        </select>

        <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} style={{ width: 60 }} />

        <button onClick={agregarAlCarrito}>➕</button>
        <button onClick={vaciarCarrito}>🧹</button>
      </div>

      <h3>🛒 Carrito</h3>

      {carrito.map((item, i) => (
        <div key={i} style={{ background: "#eee", padding: 10, marginBottom: 10 }}>
          <b>{item.nombre}</b>

          <p>Cantidad: {item.cantidad} | Bonif: {item.bonificacion}</p>

          <input type="number" value={item.precio} onChange={e => cambiarPrecio(i, Number(e.target.value))} />
          <input type="number" value={item.bonificacion} onChange={e => cambiarBonificacion(i, Number(e.target.value))} />

          <button onClick={() => sumar(i)}>➕</button>
          <button onClick={() => restar(i)}>➖</button>
          <button onClick={() => eliminarItem(i)}>❌</button>
        </div>
      ))}

      <h3>Subtotal: ${subtotal.toFixed(2)}</h3>

      IVA:
      <input type="number" value={iva} onChange={e => setIva(e.target.value)} />

      <h2>Total: ${total.toFixed(2)}</h2>

      <button onClick={guardarVenta}>💾 Confirmar venta</button>
      <button onClick={imprimirTicket}>🧾 Imprimir</button>

    </div>
  )
}