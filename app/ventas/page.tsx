"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 20px",
      borderRadius: 10, fontWeight: "bold", zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

function fmt(num: number) {
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
  const f = (num: number) => "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const filas = carrito.map(item => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + f(item.precio) + "</td><td>" + bonif + "</td><td>" + f(unidadesPagas * item.precio) + "</td></tr>"
  }).join("")
  const badgeCC = esCuentaCorriente ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>" : ""
  const html = "<!DOCTYPE html><html><head><style>@page{margin:20px}body{font-family:Arial;padding:20px;display:flex;flex-direction:column;min-height:95vh;box-sizing:border-box}.logo{height:120px}.header{display:flex;justify-content:space-between;align-items:center}.header-right{text-align:center}.header-right h2{margin:0}.nro-factura{font-size:14px;color:#555;margin-top:4px}.datos{display:flex;justify-content:space-between;margin-top:20px}.contenido{flex:1}table{width:100%;margin-top:30px;border-collapse:collapse}th{border:1px solid #ccc;padding:8px;background:#eee}td{padding:6px;text-align:center}.totales{margin-top:40px;display:flex;justify-content:flex-end}.box{width:280px;border-top:2px solid #ccc;padding-top:10px}.box p,.box h2{margin:6px 0}</style></head><body><div class='contenido'><div class='header'><img src='" + logoUrl + "' class='logo'/><div class='header-right'><h2>PRESUPUESTO</h2><div class='nro-factura'>N " + nroFactura + " | Fecha: " + fecha + "</div>" + badgeCC + "</div></div><div class='datos'><div><b>VETIX Distribuidora</b><br/>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div><div style='text-align:left;'><b>Cliente:</b><br/>" + clienteSeleccionado.nombre + " " + clienteSeleccionado.apellido + "<br/>CUIT: " + (clienteSeleccionado.cuit || "-") + "<br/>Direccion: " + (clienteSeleccionado.localidad || "-") + "<br/>Tel: " + (clienteSeleccionado.telefono || "-") + "</div></div><table><thead><tr><th>Cant.</th><th style='width:40%'>Descripcion</th><th>Precio U.</th><th>Bonif.</th><th>Total</th></tr></thead><tbody>" + filas + "</tbody></table></div><div class='totales'><div class='box'><p><b>Subtotal:</b> " + f(subtotal) + "</p><p><b>IVA (" + ivaNum + "%):</b> " + f(subtotal * ivaNum / 100) + "</p><h2><b>Total:</b> " + f(total) + "</h2></div></div></body></html>"
  const ventana = window.open("", "_blank")
  if (!ventana) { alert("Habilita ventanas emergentes"); return }
  ventana.document.write(html)
  ventana.document.close()
  setTimeout(() => ventana.print(), 500)
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase"
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "white", fontSize: 14, outline: "none",
  boxSizing: "border-box"
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer"
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
  const [guardando, setGuardando] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState("")

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data: c } = await supabase.from("clientes").select("*").order("nombre")

    // Traer todos los productos paginando
    let todosProductos: any[] = []
    let desde = 0
    while (true) {
      const { data: p } = await supabase.from("productos").select("*").order("nombre").range(desde, desde + 999)
      if (!p || p.length === 0) break
      todosProductos = [...todosProductos, ...p]
      if (p.length < 1000) break
      desde += 1000
    }

    setClientes(c || [])
    setProductos(todosProductos)

    const { data: ultima } = await supabase.from("ventas").select("nro_factura").order("id", { ascending: false }).limit(1).maybeSingle()
    if (ultima?.nro_factura) {
      const num = parseInt(ultima.nro_factura, 10)
      if (!isNaN(num)) setNroFactura(String(num + 1).padStart(5, "0"))
    } else {
      setNroFactura("10047")
    }
  }

  function seleccionarCliente(id: string) {
    setClienteId(id)
    setClienteSeleccionado(clientes.find(c => String(c.id) === id) || null)
  }

  function agregarAlCarrito() {
    if (!productoId || !cantidad) return
    const producto = productos.find(p => String(p.id) === productoId)
    if (!producto) return
    const cant = Number(cantidad)
    const enCarrito = carrito.find(i => i.producto_id === producto.id)
    const cantidadEnCarrito = enCarrito?.cantidad || 0
    const stockDisponible = producto.stock - cantidadEnCarrito
    if (cant > stockDisponible) { mostrarToast("Stock insuficiente. Disponible: " + stockDisponible, "error"); return }
    const base = producto.precio_venta
    const porcentaje = clienteSeleccionado?.porcentaje || 0
    const precioFinal = base + (base * porcentaje / 100)
    if (enCarrito) {
      setCarrito(carrito.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + cant } : i))
    } else {
      setCarrito([...carrito, { producto_id: producto.id, nombre: producto.nombre, cantidad: cant, precio: precioFinal, bonificacion: 0, stockDisponible: producto.stock }])
    }
    setProductoId("")
    setBusquedaProducto("")
    setCantidad("1")
  }

  function sumar(i: number) {
    const nuevo = [...carrito]
    if (nuevo[i].cantidad >= nuevo[i].stockDisponible) { mostrarToast("Stock máximo: " + nuevo[i].stockDisponible, "error"); return }
    nuevo[i].cantidad++
    setCarrito([...nuevo])
  }

  function restar(i: number) {
    const nuevo = [...carrito]
    if (nuevo[i].cantidad > 1) nuevo[i].cantidad--
    setCarrito([...nuevo])
  }

  function eliminarItem(i: number) { setCarrito(carrito.filter((_, idx) => idx !== i)) }
  function vaciarCarrito() { setCarrito([]) }
  function cambiarBonificacion(i: number, valor: number) { const n = [...carrito]; n[i].bonificacion = valor; setCarrito([...n]) }
  function cambiarPrecio(i: number, valor: number) { const n = [...carrito]; n[i].precio = valor; setCarrito([...n]) }

  const subtotal = carrito.reduce((acc, item) => {
    const bonif = item.bonificacion || 0
    const pagan = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    return acc + pagan * item.precio
  }, 0)
  const ivaNum = Number(iva)
  const total = subtotal + subtotal * ivaNum / 100

  async function guardarVenta() {
    if (!clienteId || carrito.length === 0) { mostrarToast("Faltan datos", "error"); return }
    for (const item of carrito) {
      const producto = productos.find(p => p.id === item.producto_id)
      if (producto && item.cantidad > producto.stock) { mostrarToast("Sin stock para: " + item.nombre, "error"); return }
    }
    setGuardando(true)
    const { data: venta, error: errorVenta } = await supabase.from("ventas").insert({
      cliente_id: Number(clienteId), total, fecha: new Date(),
      estado: esCuentaCorriente ? "cuenta_corriente" : "cobrada", nro_factura: nroFactura
    }).select().single()
    if (errorVenta || !venta) { mostrarToast("Error al guardar venta", "error"); setGuardando(false); return }

    const { error: errorDetalle } = await supabase.from("detalle_ventas").insert(
      carrito.map(item => ({ venta_id: venta.id, producto_id: item.producto_id, cantidad: item.cantidad, precio: item.precio }))
    )
    if (errorDetalle) { mostrarToast("Error al guardar detalle", "error"); setGuardando(false); return }

    if (esCuentaCorriente) {
      const { data: ultimo } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", Number(clienteId)).order("id", { ascending: false }).limit(1).maybeSingle()
      const nuevoSaldo = (ultimo?.saldo || 0) + total
      await supabase.from("cuentas_corrientes").insert({ cliente_id: Number(clienteId), tipo: "venta", monto: total, saldo: nuevoSaldo, venta_id: venta.id, fecha: new Date() })
    }

    for (const item of carrito) {
      const producto = productos.find(p => p.id === item.producto_id)
      if (!producto) continue
      await supabase.from("productos").update({ stock: producto.stock - item.cantidad }).eq("id", item.producto_id)
      let cantidadRestante = item.cantidad
      const { data: lotes } = await supabase.from("lotes").select("id, cantidad").eq("producto_id", item.producto_id).gt("cantidad", 0).order("fecha_vencimiento", { ascending: true })
      if (lotes) {
        for (const lote of lotes) {
          if (cantidadRestante <= 0) break
          const descontar = lote.cantidad >= cantidadRestante ? cantidadRestante : lote.cantidad
          await supabase.from("lotes").update({ cantidad: lote.cantidad - descontar }).eq("id", lote.id)
          cantidadRestante -= descontar
        }
      }
    }

    await supabase.from("facturas_impresion").insert([{ nro_factura: nroFactura, cliente_id: Number(clienteId), venta_id: venta.id, datos: { nroFactura, clienteSeleccionado, carrito: [...carrito], subtotal, ivaNum, total, esCuentaCorriente } }])

    mostrarToast(esCuentaCorriente ? "✅ Guardado en cuenta corriente" : "✅ Venta confirmada", "ok")
    setCarrito([]); setClienteId(""); setClienteSeleccionado(null); setEsCuentaCorriente(false)
    setGuardando(false)
    cargar()
  }

  function imprimirTicket() {
    if (!clienteSeleccionado || carrito.length === 0) return
    generarHTMLEImprimir({ nroFactura, clienteSeleccionado, carrito: [...carrito], subtotal, ivaNum, total, esCuentaCorriente })
  }

  const productosFiltrados = productos.filter(p =>
    !carrito.find(i => i.producto_id === p.id) &&
    p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())
  ).slice(0, 50)

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

        {/* ── COLUMNA IZQUIERDA ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Cliente + Factura */}
          <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Datos de la venta</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Cliente *</label>
                <select value={clienteId} onChange={e => seleccionarCliente(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", background: "white" }}>
                  <option value="">Seleccioná un cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>N° Presupuesto</label>
                <input type="text" value={nroFactura} onChange={e => setNroFactura(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box" }} />
              </div>
            </div>
            {clienteSeleccionado && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd", fontSize: 12, color: "#0369a1" }}>
                📍 {clienteSeleccionado.localidad || "—"} · 📞 {clienteSeleccionado.telefono || "—"}
                {clienteSeleccionado.porcentaje > 0 && <span style={{ marginLeft: 8, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>+{clienteSeleccionado.porcentaje}%</span>}
              </div>
            )}
          </div>

          {/* Buscador de productos */}
          <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Agregar producto</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px", gap: 10, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Buscar producto</label>
                <input
                  type="text"
                  placeholder="Escribí para buscar..."
                  value={busquedaProducto}
                  onChange={e => { setBusquedaProducto(e.target.value); setProductoId("") }}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
                {busquedaProducto && productosFiltrados.length > 0 && !productoId && (
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 4, left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 10, maxHeight: 220, overflowY: "auto" }}>
                      {productosFiltrados.map(p => (
                        <div key={p.id}
                          onClick={() => { setProductoId(String(p.id)); setBusquedaProducto(p.nombre) }}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f0f9ff"}
                          onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "white"}
                        >
                          <span style={{ color: "#111827", fontWeight: 500 }}>{p.nombre}</span>
                          <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 8, flexShrink: 0 }}>
                            {p.stock === 0 ? <span style={{ color: "#ef4444" }}>Sin stock</span> : `Stock: ${p.stock}`} · ${p.precio_venta?.toLocaleString("es-AR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Cantidad</label>
                <input type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agregarAlCarrito()}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
              </div>
              <button onClick={agregarAlCarrito} disabled={!productoId}
                style={{ padding: "10px 16px", background: productoId ? "linear-gradient(135deg, #2563eb, #3b82f6)" : "#e2e8f0", color: productoId ? "white" : "#94a3b8", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: productoId ? "pointer" : "not-allowed", boxShadow: productoId ? "0 2px 8px rgba(59,130,246,0.3)" : "none" }}>
                + Agregar
              </button>
            </div>
          </div>

          {/* Carrito */}
          {carrito.length > 0 && (
            <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", margin: 0 }}>
                  Carrito · {carrito.length} producto{carrito.length !== 1 ? "s" : ""}
                </p>
                <button onClick={vaciarCarrito} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Vaciar
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {carrito.map((item, i) => {
                  const bonif = item.bonificacion || 0
                  const pagan = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
                  const subtotalItem = pagan * item.precio
                  return (
                    <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827", marginBottom: 2 }}>{item.nombre}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>Stock disponible: {item.stockDisponible}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
                          <button onClick={() => restar(i)} style={{ width: 28, height: 28, border: "1px solid #e2e8f0", background: "white", borderRadius: 7, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#374151" }}>−</button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", minWidth: 24, textAlign: "center" }}>{item.cantidad}</span>
                          <button onClick={() => sumar(i)} style={{ width: 28, height: 28, border: "1px solid #e2e8f0", background: "white", borderRadius: 7, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#374151" }}>+</button>
                          <button onClick={() => eliminarItem(i)} style={{ width: 28, height: 28, border: "none", background: "#fef2f2", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#dc2626", marginLeft: 4 }}>✕</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" }}>Precio u.</label>
                          <input type="number" value={item.precio} onChange={e => cambiarPrecio(i, Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" }}>Bonif.</label>
                          <input type="number" min="0" value={bonif} onChange={e => cambiarBonificacion(i, Number(e.target.value))}
                            style={{ width: "100%", padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 7, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" }}>Subtotal</label>
                          <div style={{ padding: "6px 10px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 7, fontSize: 12, fontWeight: 700, color: "#0369a1" }}>{fmt(subtotalItem)}</div>
                        </div>
                      </div>
                      {bonif > 0 && (
                        <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
                          {item.cantidad} u. · {bonif} bonif. · <span style={{ fontWeight: 600, color: "#374151" }}>{pagan} pagan</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── COLUMNA DERECHA — RESUMEN ── */}
        <div style={{ position: "sticky", top: 20 }}>
          <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>Resumen</p>

            {/* IVA */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>IVA (%)</label>
              <input type="number" value={iva} onChange={e => setIva(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>

            {/* Totales */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "#6b7280", fontSize: 13 }}>Subtotal</span>
                <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{fmt(subtotal)}</span>
              </div>
              {ivaNum > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: "#6b7280", fontSize: 13 }}>IVA {ivaNum}%</span>
                  <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600 }}>{fmt(subtotal * ivaNum / 100)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "white", fontSize: 15, fontWeight: 700 }}>Total</span>
                <span style={{ color: "white", fontSize: 20, fontWeight: 800 }}>{fmt(total)}</span>
              </div>
            </div>

            {/* Cuenta corriente toggle */}
            <div
              onClick={() => setEsCuentaCorriente(!esCuentaCorriente)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 10, cursor: "pointer", marginBottom: 16,
                background: esCuentaCorriente ? "rgba(230,119,0,0.15)" : "rgba(255,255,255,0.04)",
                border: esCuentaCorriente ? "1px solid rgba(230,119,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                transition: "all 0.2s"
              }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                background: esCuentaCorriente ? "#e67700" : "rgba(255,255,255,0.1)",
                border: esCuentaCorriente ? "none" : "1px solid rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {esCuentaCorriente && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: esCuentaCorriente ? "#fb923c" : "#9ca3af" }}>Cuenta corriente</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>Queda pendiente de pago</div>
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={guardarVenta} disabled={guardando || !clienteId || carrito.length === 0}
                style={{
                  width: "100%", padding: "13px",
                  background: guardando || !clienteId || carrito.length === 0 ? "rgba(255,255,255,0.05)"
                    : esCuentaCorriente ? "linear-gradient(135deg, #c2410c, #ea580c)"
                    : "linear-gradient(135deg, #16a34a, #22c55e)",
                  border: "none", borderRadius: 10, color: "white",
                  fontSize: 14, fontWeight: 700, cursor: guardando || !clienteId || carrito.length === 0 ? "not-allowed" : "pointer",
                  opacity: guardando || !clienteId || carrito.length === 0 ? 0.5 : 1,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3)", transition: "opacity 0.2s"
                }}>
                {guardando ? "Guardando..." : esCuentaCorriente ? "📋 Guardar en CC" : "✅ Confirmar venta"}
              </button>
              <button onClick={imprimirTicket} disabled={!clienteSeleccionado || carrito.length === 0}
                style={{
                  width: "100%", padding: "11px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, color: "#9ca3af",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: !clienteSeleccionado || carrito.length === 0 ? 0.4 : 1
                }}>
                🖨️ Imprimir / PDF
              </button>
            </div>

            {carrito.length > 0 && (
              <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Resumen carrito</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>
                  {carrito.reduce((acc, i) => acc + i.cantidad, 0)} unidades · {carrito.length} producto{carrito.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}