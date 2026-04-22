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

interface DatosImpresion {
  nroFactura: string
  clienteSeleccionado: any
  carrito: any[]
  subtotal: number
  ivaNum: number
  total: number
  esCuentaCorriente: boolean
}

function generarHTMLEImprimir(datos: DatosImpresion) {
  const { nroFactura, clienteSeleccionado, carrito, subtotal, ivaNum, total, esCuentaCorriente } = datos

  const logoUrl = window.location.origin + "/logo.png"
  const fecha = new Date().toLocaleDateString("es-AR")
  const fmt = (num: number) =>
    "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const filas = carrito.map(item => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    const totalItem = unidadesPagas * item.precio
    return (
      "<tr><td>" + item.cantidad + "</td>" +
      "<td style='text-align:left;'>" + item.nombre + "</td>" +
      "<td>" + fmt(item.precio) + "</td>" +
      "<td>" + bonif + "</td>" +
      "<td>" + fmt(totalItem) + "</td></tr>"
    )
  }).join("")

  const badgeCC = esCuentaCorriente
    ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>"
    : ""

  const html =
    "<!DOCTYPE html><html><head><style>" +
    "@page{margin:20px}" +
    "body{font-family:Arial;padding:20px;display:flex;flex-direction:column;min-height:95vh;box-sizing:border-box}" +
    ".logo{height:120px}" +
    ".header{display:flex;justify-content:space-between;align-items:center}" +
    ".header-right{text-align:center}" +
    ".header-right h2{margin:0}" +
    ".nro-factura{font-size:14px;color:#555;margin-top:4px}" +
    ".datos{display:flex;justify-content:space-between;margin-top:20px}" +
    ".contenido{flex:1}" +
    "table{width:100%;margin-top:30px;border-collapse:collapse}" +
    "th{border:1px solid #ccc;padding:8px;background:#eee}" +
    "td{padding:6px;text-align:center}" +
    ".totales{margin-top:40px;display:flex;justify-content:flex-end}" +
    ".box{width:280px;border-top:2px solid #ccc;padding-top:10px}" +
    ".box p,.box h2{margin:6px 0}" +
    "</style></head><body>" +
    "<div class='contenido'>" +
    "<div class='header'>" +
    "<img src='" + logoUrl + "' class='logo'/>" +
    "<div class='header-right'>" +
    "<h2>PRESUPUESTO</h2>" +
    "<div class='nro-factura'>N " + nroFactura + " | Fecha: " + fecha + "</div>" +
    badgeCC +
    "</div></div>" +
    "<div class='datos'>" +
    "<div><b>VETIX Distribuidora</b><br/>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div>" +
    "<div style='text-align:left;'><b>Cliente:</b><br/>" +
    clienteSeleccionado.nombre + " " + clienteSeleccionado.apellido + "<br/>" +
    "CUIT: " + (clienteSeleccionado.cuit || "-") + "<br/>" +
    "Direccion: " + (clienteSeleccionado.localidad || "-") + "<br/>" +
    "Tel: " + (clienteSeleccionado.telefono || "-") + "</div>" +
    "</div>" +
    "<table><thead><tr>" +
    "<th>Cant.</th><th style='width:40%'>Descripcion</th><th>Precio U.</th><th>Bonif.</th><th>Total</th>" +
    "</tr></thead><tbody>" + filas + "</tbody></table>" +
    "</div>" +
    "<div class='totales'><div class='box'>" +
    "<p><b>Subtotal:</b> " + fmt(subtotal) + "</p>" +
    "<p><b>IVA (" + ivaNum + "%):</b> " + fmt(subtotal * ivaNum / 100) + "</p>" +
    "<h2><b>Total:</b> " + fmt(total) + "</h2>" +
    "</div></div></body></html>"

  const ventana = window.open("", "_blank")
  if (!ventana) { alert("Habilita ventanas emergentes"); return }
  ventana.document.write(html)
  ventana.document.close()
  setTimeout(() => ventana.print(), 500)
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
  const [nroFactura, setNroFactura] = useState("")
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
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

  // Busca el último nro_factura y suma 1
  const { data: ultima } = await supabase
    .from("ventas")
    .select("nro_factura")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ultima?.nro_factura) {
    const num = parseInt(ultima.nro_factura, 10)
    if (!isNaN(num)) {
      const siguiente = String(num + 1).padStart(5, "0")
      setNroFactura(siguiente)
    }
  } else {
    setNroFactura("10047")
  }
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
      mostrarToast("Stock insuficiente. Disponible: " + stockDisponible, "error")
      return
    }
    const base = producto.precio_venta
    const porcentaje = clienteSeleccionado?.porcentaje || 0
    const precioFinal = base + (base * porcentaje / 100)
    if (enCarrito) {
      setCarrito(carrito.map(i =>
        i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + cant } : i
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
      mostrarToast("Stock maximo: " + item.stockDisponible, "error")
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
    mostrarToast("Faltan datos", "error")
    return
  }

  // 🔹 Validar stock
  for (const item of carrito) {
    const producto = productos.find(p => p.id === item.producto_id)
    if (!producto) continue

    if (item.cantidad > producto.stock) {
      mostrarToast("Sin stock para: " + item.nombre, "error")
      return
    }
  }

  // 🔥 1. CREAR VENTA
  const { data: venta, error: errorVenta } = await supabase
    .from("ventas")
    .insert({
      cliente_id: Number(clienteId),
      total: total,
      fecha: new Date(),
      estado: esCuentaCorriente ? "cuenta_corriente" : "cobrada",
      nro_factura: nroFactura
    })
    .select()
    .single()

  if (errorVenta || !venta) {
    mostrarToast("Error al guardar venta", "error")
    return
  }

  // 🔥 2. CREAR DETALLE
  const detalles = carrito.map(item => ({
    venta_id: venta.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    precio: item.precio
  }))

  const { error: errorDetalle } = await supabase
    .from("detalle_ventas")
    .insert(detalles)

  if (errorDetalle) {
    mostrarToast("Error al guardar detalle", "error")
    return
  }

  // 🔥 3. CUENTA CORRIENTE (AHORA SÍ FUNCIONA)
  if (esCuentaCorriente) {

    const { data: ultimo } = await supabase
      .from("cuentas_corrientes")
      .select("saldo")
      .eq("cliente_id", Number(clienteId))
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle()

    const saldoAnterior = ultimo?.saldo || 0
    const nuevoSaldo = saldoAnterior + total

    await supabase.from("cuentas_corrientes").insert({
  cliente_id: Number(clienteId),
  tipo: "venta",
  monto: total,
  saldo: nuevoSaldo,
  venta_id: venta.id,
  fecha: new Date() // 🔥 agregalo
})
  }

  // 🔹 4. ACTUALIZAR STOCK + FIFO LOTES
for (const item of carrito) {
  const producto = productos.find(p => p.id === item.producto_id)
  if (!producto) continue

  // Descontar stock general
  await supabase
    .from("productos")
    .update({ stock: producto.stock - item.cantidad })
    .eq("id", item.producto_id)

  // FIFO: descontar de lotes ordenados por vencimiento más próximo
  let cantidadRestante = item.cantidad

  const { data: lotes } = await supabase
    .from("lotes")
    .select("id, cantidad")
    .eq("producto_id", item.producto_id)
    .gt("cantidad", 0)
    .order("fecha_vencimiento", { ascending: true })

  if (lotes) {
    for (const lote of lotes) {
      if (cantidadRestante <= 0) break

      const descontar = lote.cantidad >= cantidadRestante
        ? cantidadRestante
        : lote.cantidad

      await supabase
        .from("lotes")
        .update({ cantidad: lote.cantidad - descontar })
        .eq("id", lote.id)

      cantidadRestante -= descontar
    }
  }
}

  // 🔹 5. GUARDAR FACTURA
  const datosImpresion: DatosImpresion = {
    nroFactura,
    clienteSeleccionado,
    carrito: [...carrito],
    subtotal,
    ivaNum,
    total,
    esCuentaCorriente
  }

  await supabase.from("facturas_impresion").insert([{
    nro_factura: nroFactura,
    cliente_id: Number(clienteId),
    venta_id: venta.id,
    datos: datosImpresion
  }])

  mostrarToast(
    esCuentaCorriente
      ? "Venta guardada en cuenta corriente"
      : "Venta cobrada",
    "ok"
  )

  // 🔹 limpiar
  setCarrito([])
  setClienteId("")
  setClienteSeleccionado(null)
  setEsCuentaCorriente(false)

  cargar()
}

  async function imprimirTicket() {
    if (!clienteSeleccionado || carrito.length === 0) return

    const datosImpresion: DatosImpresion = {
      nroFactura,
      clienteSeleccionado,
      carrito: [...carrito],
      subtotal,
      ivaNum,
      total,
      esCuentaCorriente
    }

    generarHTMLEImprimir(datosImpresion)
  }

  return (
    <div style={{ padding: 20 }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}
      <h1>Ventas</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}>
          <option value="">Cliente</option>
          {clientes.map(c => (
            <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>
          ))}
        </select>
        <label>
          N Presupuesto:
          <input type="text" value={nroFactura} onChange={e => setNroFactura(e.target.value)} style={{ width: 80, marginLeft: 6 }} />
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <select value={productoId} onChange={e => setProductoId(e.target.value)}>
          <option value="">Producto</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre} - {formatearPrecio(p.precio_venta)} {p.stock === 0 ? "(sin stock)" : "(stock: " + p.stock + ")"}
            </option>
          ))}
        </select>
        <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} style={{ width: 60 }} />
        <button onClick={agregarAlCarrito}>+ Agregar</button>
        <button onClick={vaciarCarrito}>Vaciar</button>
      </div>
      <h3>Carrito</h3>
      {carrito.map((item, i) => {
        const bonif = item.bonificacion || 0
        const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
        const subtotalItem = unidadesPagas * item.precio
        return (
         <div key={i} style={{ background: "white", border: "1px solid #e5e7eb", padding: 12, marginBottom: 10, borderRadius: 10 }}>
  <b style={{ color: "#111827", fontSize: 15 }}>{item.nombre}</b>
  <span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>(stock: {item.stockDisponible})</span>
  <p style={{ color: "#374151", margin: "6px 0" }}>Cantidad: {item.cantidad} | Bonificadas: {bonif} | Pagan: {unidadesPagas}</p>
            <p>
              Precio:
              <input type="number" value={item.precio} onChange={e => cambiarPrecio(i, Number(e.target.value))} />
            </p>
            <p>Subtotal: {formatearPrecio(subtotalItem)}</p>
            <p>
              Bonificacion:
              <input type="number" value={bonif} onChange={e => cambiarBonificacion(i, Number(e.target.value))} />
            </p>
            <button onClick={() => sumar(i)}>+</button>
            <button onClick={() => restar(i)}>-</button>
            <button onClick={() => eliminarItem(i)}>X</button>
          </div>
        )
      })}
      <h3>Subtotal: {formatearPrecio(subtotal)}</h3>
      <div>
        IVA:
        <input type="number" value={iva} onChange={e => setIva(e.target.value)} />
      </div>
      <h2>Total: {formatearPrecio(total)}</h2>
      <div style={{
        background: esCuentaCorriente ? "#fff3cd" : "#f8f9fa",
        border: "2px solid " + (esCuentaCorriente ? "#e67700" : "#dee2e6"),
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 10
      }}>
        <input
          type="checkbox"
          id="cuentaCorriente"
          checked={esCuentaCorriente}
          onChange={e => setEsCuentaCorriente(e.target.checked)}
          style={{ width: 18, height: 18, cursor: "pointer" }}
        />
        <label htmlFor="cuentaCorriente" style={{ cursor: "pointer", fontWeight: "bold", fontSize: 15, color: esCuentaCorriente ? "#92400e" : "#374151" }}>
  Dejar en cuenta corriente
</label>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={guardarVenta}
          style={{
            background: esCuentaCorriente ? "#e67700" : "#2f9e44",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          {esCuentaCorriente ? "Guardar en cuenta corriente" : "Confirmar venta"}
        </button>
        <button onClick={imprimirTicket}>Imprimir / PDF</button>
      </div>
    </div>
  )
}