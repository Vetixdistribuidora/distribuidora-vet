"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Ventas() {

  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])

  const [clienteId, setClienteId] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)

  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")

  const [carrito, setCarrito] = useState<any[]>([])
  const [iva, setIva] = useState("21")

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

    const existente = carrito.find(i => i.producto_id === producto.id)

    if (existente) {
      existente.cantidad += cant
      setCarrito([...carrito])
    } else {
      setCarrito([...carrito, {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: cant,
        precio: producto.precio_venta,
        bonificacion: 0
      }])
    }

    setProductoId("")
    setCantidad("1")
  }

  function cambiarBonificacion(i: number, val: number) {
    const nuevo = [...carrito]
    nuevo[i].bonificacion = val
    setCarrito(nuevo)
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

  function eliminar(i: number) {
    setCarrito(carrito.filter((_, idx) => idx !== i))
  }

  const subtotal = carrito.reduce((acc, item) => {
    const pagado = Math.max(item.cantidad - item.bonificacion, 0)
    return acc + pagado * item.precio
  }, 0)

  const ivaNum = Number(iva)
  const total = subtotal + (subtotal * ivaNum / 100)

  function imprimirTicket() {

    if (!clienteSeleccionado || carrito.length === 0) return

    const logoUrl = window.location.origin + "/logo.png"

    const filas = carrito.map(item => {
      const pagado = Math.max(item.cantidad - item.bonificacion, 0)
      const totalItem = pagado * item.precio

      return `
        <tr>
          <td>${item.cantidad}</td>
          <td style="text-align:left;">${item.nombre}</td>
          <td>$${item.precio.toFixed(2)}</td>
          <td>${item.bonificacion}</td>
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
        }

        .logo { height: 120px; }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

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

        /* 🔥 SOLUCIÓN TOTAL ABAJO SIN CORTARSE */
        .totales {
          margin-top: 40px;
          display: flex;
          justify-content: flex-end;
        }

        .box {
          width: 250px;
        }

      </style>
    </head>

    <body>

      <div class="header">
        <img src="${logoUrl}" class="logo"/>
        <div>
          <h2>PRESUPUESTO</h2>
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
    if (!ventana) return

    ventana.document.write(html)
    ventana.document.close()

    setTimeout(() => ventana.print(), 500)
  }

  return (
    <div style={{ padding: 20 }}>

      <h1>💰 Ventas</h1>

      <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
        <option value="">Cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
      </select>

      <div>
        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} />

        <button onClick={agregarAlCarrito}>Agregar</button>
      </div>

      <h3>Carrito</h3>

      {carrito.map((item, i) => {
        const pagado = Math.max(item.cantidad - item.bonificacion, 0)

        return (
          <div key={i} style={{ background: "#eee", margin: 10, padding: 10 }}>
            <b>{item.nombre}</b>

            <p>
              Cantidad: {item.cantidad} | Bonificado: {item.bonificacion} | Pagado: {pagado}
            </p>

            <button onClick={() => sumar(i)}>+</button>
            <button onClick={() => restar(i)}>-</button>

            Bonif:
            <input
              type="number"
              value={item.bonificacion}
              onChange={e => cambiarBonificacion(i, Number(e.target.value))}
            />

            <button onClick={() => eliminar(i)}>Eliminar</button>
          </div>
        )
      })}

      <h3>Subtotal: ${subtotal.toFixed(2)}</h3>
      <h2>Total: ${total.toFixed(2)}</h2>

      <button onClick={imprimirTicket}>🧾 Imprimir</button>

    </div>
  )
}