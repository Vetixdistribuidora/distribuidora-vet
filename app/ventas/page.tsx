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
  const [nroFactura, setNroFactura] = useState("0001")

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

    const logoUrl = window.location.origin + "/logo.png"
    const fecha = new Date().toLocaleDateString()

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

    const html = `
    <html>
    <head>
      <style>
        @page { margin: 20px; }

        body {
          font-family: Arial;
          padding: 20px;
          /* Usamos flex column para empujar totales al fondo */
          display: flex;
          flex-direction: column;
          min-height: 95vh;
          box-sizing: border-box;
        }

        .logo { height: 120px; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-right {
          text-align: center;
        }

        .header-right h2 {
          margin: 0;
        }

        .nro-factura {
          font-size: 14px;
          color: #555;
          margin-top: 4px;
        }

        .datos {
          display: flex;
          justify-content: space-between;
          margin-top: 20px;
        }

        /* El contenido principal crece y empuja los totales abajo */
        .contenido {
          flex: 1;
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
          margin-top: 40px;
          display: flex;
          justify-content: flex-end;
          /* Se queda al fondo gracias al flex del body */
        }

        .box {
          width: 280px;
          border-top: 2px solid #ccc;
          padding-top: 10px;
        }

        .box p, .box h2 {
          margin: 6px 0;
        }
      </style>
    </head>

    <body>

      <div class="contenido">

        <div class="header">
          <img src="${logoUrl}" class="logo"/>
          <div class="header-right">
            <h2>PRESUPUESTO</h2>
            <div class="nro-factura">Nº ${nroFactura} &nbsp;|&nbsp; Fecha: ${fecha}</div>
          </div>
        </div>

        <div class="datos">
          <div>
            <b>VETIX Distribuidora</b><br/>
            Almirante Brown 620<br/>
            Tel: 2604518157<br/>
            Email: clauforte@gmail.com
          </div>

          <div style="text-align:left;">
            <b>Cliente:</b><br/>
            ${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}<br/>
            CUIT: ${clienteSeleccionado.cuit || "-"}<br/>
            Dirección: ${clienteSeleccionado.localidad || "-"}<br/>
            Tel: ${clienteSeleccionado.telefono || "-"}
          </div>
        </div>

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

      </div>

      <div class="totales">
        <div class="box">
          <p><b>Subtotal:</b> $${subtotal.toFixed(2)}</p>
          <p><b>IVA (${ivaNum}%):</b> $${(subtotal * ivaNum / 100).toFixed(2)}</p>
          <h2><b>Total:</b> $${total.toFixed(2)}</h2>
        </div>
      </div>

    </body>
    </html>
    `

    const ventana = window.open("", "_blank")
    if (!ventana) {
      alert("⚠️ Habilitá ventanas emergentes")
      return
    }

    ventana.document.write(html)
    ventana.document.close()
    setTimeout(() => ventana.print(), 500)
  }

  return (
    <div style={{ padding: 20 }}>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <h1>💰 Ventas</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
          <option value="">Cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>
              {c.nombre} {c.apellido}
            </option>
          ))}
        </select>

        <label>
          Nº Presupuesto:
          <input
            type="text"
            value={nroFactura}
            onChange={e => setNroFactura(e.target.value)}
            style={{ width: 80, marginLeft: 6 }}
          />
        </label>
      </div>

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

      {carrito.map((item, i) => {
        const bonif = item.bonificacion || 0
        const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
        const subtotalItem = unidadesPagas * item.precio

        return (
          <div key={i} style={{ background: "#eee", padding: 10, marginBottom: 10 }}>
            <b>{item.nombre}</b>

            <p>Cantidad: {item.cantidad} | Bonificadas: {bonif} | Pagan: {unidadesPagas}</p>

            <p>
              Precio:
              <input type="number" value={item.precio} onChange={e => cambiarPrecio(i, Number(e.target.value))} />
            </p>

            <p>Subtotal: ${subtotalItem.toFixed(2)}</p>

            <p>
              Bonificación:
              <input type="number" value={bonif} onChange={e => cambiarBonificacion(i, Number(e.target.value))} />
            </p>

            <button onClick={() => sumar(i)}>➕</button>
            <button onClick={() => restar(i)}>➖</button>
            <button onClick={() => eliminarItem(i)}>❌</button>
          </div>
        )
      })}

      <h3>Subtotal: ${subtotal.toFixed(2)}</h3>

      <div>
        IVA:
        <input type="number" value={iva} onChange={e => setIva(e.target.value)} />
      </div>

      <h2>Total: ${total.toFixed(2)}</h2>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={guardarVenta}>💾 Confirmar venta</button>
        <button onClick={imprimirTicket}>🧾 Imprimir / PDF</button>
      </div>

    </div>
  )
}