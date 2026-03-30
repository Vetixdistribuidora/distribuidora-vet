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

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [busqueda, setBusqueda] = useState("")
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [cuit, setCuit] = useState("")
  const [telefono, setTelefono] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [porcentaje, setPorcentaje] = useState("")
  const [editando, setEditando] = useState<any | null>(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])
  const [tabActiva, setTabActiva] = useState<"historial" | "cuentaCorriente">("historial")
  const [totalGastado, setTotalGastado] = useState(0)
  const [cantidadCompras, setCantidadCompras] = useState(0)
  const [promedioCompra, setPromedioCompra] = useState(0)
  const [productoTop, setProductoTop] = useState("")
  const [deudaTotal, setDeudaTotal] = useState(0)
  const [deudasPorCliente, setDeudasPorCliente] = useState<Record<number, number>>({})
  const [modalPago, setModalPago] = useState(false)
  const [ventaParaPagar, setVentaParaPagar] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [notaPago, setNotaPago] = useState("")

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    setClientes(data || [])
    setCargando(false)
    await cargarDeudas(data || [])
  }

  async function cargarDeudas(listaClientes: any[]) {
    const mapa: Record<number, number> = {}
    for (const c of listaClientes) {
      const { data: ventasPendientes } = await supabase
        .from("ventas")
        .select("id, total")
        .eq("cliente_id", c.id)
        .eq("estado", "cuenta_corriente")
      if (!ventasPendientes) continue
      let deuda = 0
      for (const v of ventasPendientes) {
        const { data: pagos } = await supabase
          .from("pagos_cuenta_corriente")
          .select("monto")
          .eq("venta_id", v.id)
        const pagado = (pagos || []).reduce((acc, p) => acc + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        if (saldo > 0) deuda += saldo
      }
      if (deuda > 0) mapa[c.id] = deuda
    }
    setDeudasPorCliente(mapa)
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {
    if (!nombre || !apellido) {
      mostrarToast("Nombre y apellido obligatorios", "error")
      return
    }
    const { error } = await supabase.from("clientes").insert([{
      nombre, apellido, cuit, telefono, localidad,
      porcentaje: Number(porcentaje || 0)
    }])
    if (error) return mostrarToast("Error: " + error.message, "error")
    mostrarToast("Cliente agregado", "ok")
    setNombre(""); setApellido(""); setCuit(""); setTelefono(""); setLocalidad(""); setPorcentaje("")
    cargar()
  }

  async function guardarEdicion() {
    if (!editando.nombre || !editando.apellido) {
      mostrarToast("Nombre y apellido obligatorios", "error")
      return
    }
    const { error } = await supabase
      .from("clientes")
      .update({
        nombre: editando.nombre,
        apellido: editando.apellido,
        cuit: editando.cuit,
        telefono: editando.telefono,
        localidad: editando.localidad,
        porcentaje: Number(editando.porcentaje || 0)
      })
      .eq("id", editando.id)
    if (error) return mostrarToast("Error: " + error.message, "error")
    mostrarToast("Cliente actualizado", "ok")
    setEditando(null)
    cargar()
  }

  async function eliminar(id: number) {
    if (!confirm("Eliminar este cliente?")) return
    const { error } = await supabase.from("clientes").delete().eq("id", id)
    if (error) return mostrarToast("Error: " + error.message, "error")
    mostrarToast("Cliente eliminado", "ok")
    cargar()
  }

  async function abrirHistorial(cliente: any) {
    setClienteSeleccionado(cliente)
    setModalAbierto(true)
    setTabActiva("historial")
    await cargarVentasCliente(cliente.id)
  }

  async function cargarVentasCliente(clienteId: number) {
    const { data: ventasData } = await supabase
      .from("ventas")
      .select("id, total, estado, nro_factura, fecha")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: false })
    if (!ventasData) return setVentas([])
    const conDetalle = await Promise.all(
      ventasData.map(async (v) => {
        const { data: detalles } = await supabase
          .from("detalle_ventas")
          .select("cantidad, precio, productos(nombre)")
          .eq("venta_id", v.id)
        const { data: pagos } = await supabase
          .from("pagos_cuenta_corriente")
          .select("id, monto, fecha, nota")
          .eq("venta_id", v.id)
          .order("fecha", { ascending: true })
        const totalPagado = (pagos || []).reduce((acc, p) => acc + Number(p.monto), 0)
        const saldo = Number(v.total) - totalPagado
        return {
          ...v,
          detalle_ventas: detalles || [],
          pagos: pagos || [],
          totalPagado,
          saldo: saldo > 0 ? saldo : 0
        }
      })
    )
    setVentas(conDetalle)
    const total = conDetalle.reduce((acc, v) => acc + Number(v.total), 0)
    setTotalGastado(total)
    setCantidadCompras(conDetalle.length)
    setPromedioCompra(conDetalle.length ? total / conDetalle.length : 0)
    const deuda = conDetalle
      .filter(v => v.estado === "cuenta_corriente")
      .reduce((acc, v) => acc + v.saldo, 0)
    setDeudaTotal(deuda)
    const contador: any = {}
    conDetalle.forEach(v => {
      v.detalle_ventas?.forEach((d: any) => {
        const nom = d.productos?.nombre || "Sin nombre"
        contador[nom] = (contador[nom] || 0) + d.cantidad
      })
    })
    const top = Object.entries(contador).sort((a: any, b: any) => b[1] - a[1])[0]
    setProductoTop(top ? top[0] : "Ninguno")
  }

  function cerrarModal() {
    setModalAbierto(false)
    setVentas([])
  }

  function abrirPago(venta: any) {
    setVentaParaPagar(venta)
    setMontoPago(String(venta.saldo))
    setNotaPago("")
    setModalPago(true)
  }

  async function registrarPago() {
    if (!montoPago || Number(montoPago) <= 0) {
      mostrarToast("Ingresa un monto valido", "error")
      return
    }
    const monto = Number(montoPago)
    if (monto > ventaParaPagar.saldo) {
      mostrarToast("El monto supera el saldo pendiente", "error")
      return
    }
    const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
      cliente_id: clienteSeleccionado.id,
      venta_id: ventaParaPagar.id,
      monto,
      nota: notaPago
    }])
    if (error) return mostrarToast("Error: " + error.message, "error")
    if (monto >= ventaParaPagar.saldo) {
      await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaParaPagar.id)
    }
    mostrarToast("Pago registrado", "ok")
    setModalPago(false)
    setVentaParaPagar(null)
    await cargarVentasCliente(clienteSeleccionado.id)
    await cargar()
  }

 async function reimprimirFactura(venta: any) {
  const { data, error } = await supabase
    .from("facturas_impresion")
    .select("datos")
    .eq("nro_factura", venta.nro_factura)
    .order("id", { ascending: false })
.limit(1)
.maybeSingle()

  if (error || !data) {
    mostrarToast("Factura no encontrada", "error")
    return
  }

  const factura = data.datos
    const fmt = (num: number) =>
      "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const logoUrl = window.location.origin + "/logo.png"
    const filas = factura.carrito.map((item: any) => {
      const bonif = item.bonificacion || 0
      const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
      const totalItem = unidadesPagas * item.precio
      return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + fmt(item.precio) + "</td><td>" + bonif + "</td><td>" + fmt(totalItem) + "</td></tr>"
    }).join("")
    const badgeCC = venta.estado === "cuenta_corriente"
      ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>"
      : ""
    const html = "<!DOCTYPE html><html><head><style>@page{margin:20px}body{font-family:Arial;padding:20px;display:flex;flex-direction:column;min-height:95vh;box-sizing:border-box}.logo{height:120px}.header{display:flex;justify-content:space-between;align-items:center}.header-right{text-align:center}.nro-factura{font-size:14px;color:#555;margin-top:4px}.datos{display:flex;justify-content:space-between;margin-top:20px}.contenido{flex:1}table{width:100%;margin-top:30px;border-collapse:collapse}th{border:1px solid #ccc;padding:8px;background:#eee}td{padding:6px;text-align:center}.totales{margin-top:40px;display:flex;justify-content:flex-end}.box{width:280px;border-top:2px solid #ccc;padding-top:10px}.box p,.box h2{margin:6px 0}</style></head><body><div class='contenido'><div class='header'><img src='" + logoUrl + "' class='logo'/><div class='header-right'><h2>PRESUPUESTO</h2><div class='nro-factura'>N " + factura.nroFactura + " | Fecha: " + factura.fecha + "</div>" + badgeCC + "</div></div><div class='datos'><div><b>VETIX Distribuidora</b><br/>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div><div style='text-align:left;'><b>Cliente:</b><br/>" + factura.cliente.nombre + " " + factura.cliente.apellido + "<br/>CUIT: " + (factura.cliente.cuit || "-") + "<br/>Direccion: " + (factura.cliente.localidad || "-") + "<br/>Tel: " + (factura.cliente.telefono || "-") + "</div></div><table><thead><tr><th>Cant.</th><th style='width:40%'>Descripcion</th><th>Precio U.</th><th>Bonif.</th><th>Total</th></tr></thead><tbody>" + filas + "</tbody></table></div><div class='totales'><div class='box'><p><b>Subtotal:</b> " + fmt(factura.subtotal) + "</p><p><b>IVA (" + factura.iva + "%):</b> " + fmt(factura.subtotal * factura.iva / 100) + "</p><h2><b>Total:</b> " + fmt(factura.total) + "</h2></div></div></body></html>"
    const ventana = window.open("", "_blank")
    if (!ventana) { alert("Habilita ventanas emergentes"); return }
    ventana.document.write(html)
    ventana.document.close()
    setTimeout(() => ventana.print(), 500)
  }

  if (cargando) return <p style={{ padding: 30 }}>Cargando clientes...</p>

  const ventasPendientes = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const ventasCobradas = ventas.filter(v => v.estado === "cobrada" || v.saldo === 0)

  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}
      <h1>Clientes</h1>
      <input
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ marginBottom: 20, padding: 8, width: "100%" }}
      />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
        <input placeholder="CUIT" value={cuit} onChange={e => setCuit(e.target.value)} />
        <input placeholder="Telefono" value={telefono} onChange={e => setTelefono(e.target.value)} />
        <input placeholder="Localidad" value={localidad} onChange={e => setLocalidad(e.target.value)} />
        <input placeholder="% Margen" type="number" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
        <button onClick={agregar}>Agregar</button>
      </div>
      {clientes
        .filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase()))
        .map(c => (
          <div key={c.id} style={{
            background: editando?.id === c.id ? "#fff9db" : "white",
            padding: 15,
            marginBottom: 10,
            borderRadius: 10,
            border: deudasPorCliente[c.id] ? "2px solid #e03131" : "2px solid transparent"
          }}>
            {editando?.id === c.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={editando.nombre || ""} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                <input value={editando.apellido || ""} onChange={e => setEditando({ ...editando, apellido: e.target.value })} />
                <input value={editando.cuit || ""} onChange={e => setEditando({ ...editando, cuit: e.target.value })} />
                <input value={editando.telefono || ""} onChange={e => setEditando({ ...editando, telefono: e.target.value })} />
                <input value={editando.localidad || ""} onChange={e => setEditando({ ...editando, localidad: e.target.value })} />
                <input type="number" value={editando.porcentaje ?? ""} onChange={e => setEditando({ ...editando, porcentaje: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={guardarEdicion}>Guardar</button>
                  <button onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <b>{c.nombre} {c.apellido}</b>
                  {deudasPorCliente[c.id] && (
                    <span style={{
                      background: "#e03131",
                      color: "white",
                      padding: "2px 10px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: "bold"
                    }}>
                      Debe {formatearPrecio(deudasPorCliente[c.id])}
                    </span>
                  )}
                </div>
                <p>CUIT: {c.cuit || "-"}</p>
                <p>Tel: {c.telefono || "-"}</p>
                <p>Localidad: {c.localidad || "-"}</p>
                <p>Margen: {c.porcentaje || 0}%</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditando({ ...c, porcentaje: String(c.porcentaje || "") })}>Editar</button>
                  <button onClick={() => abrirHistorial(c)}>Historial</button>
                  <button onClick={() => eliminar(c.id)} style={{ background: "#e03131", color: "white" }}>Eliminar</button>
                </div>
              </div>
            )}
          </div>
        ))}

      {modalAbierto && (
        <div style={{
          position: "fixed", top: 0, left: 0,
          width: "100%", height: "100%",
          background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 100
        }}>
          <div style={{
            background: "white", padding: 20, borderRadius: 10,
            width: "90%", maxWidth: 650,
            maxHeight: "85%", overflowY: "auto"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>{clienteSeleccionado?.nombre} {clienteSeleccionado?.apellido}</h2>
              <button onClick={cerrarModal}>Cerrar</button>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 10, marginBottom: 20,
              background: "#f8f9fa", padding: 12, borderRadius: 8
            }}>
              <div>Total comprado: {formatearPrecio(totalGastado)}</div>
              <div>Compras: {cantidadCompras}</div>
              <div>Promedio: {formatearPrecio(promedioCompra)}</div>
              <div>Top: {productoTop}</div>
              {deudaTotal > 0 && (
                <div style={{
                  gridColumn: "1 / -1",
                  background: "#fff3cd",
                  border: "1px solid #e67700",
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontWeight: "bold",
                  color: "#e67700"
                }}>
                  Deuda pendiente: {formatearPrecio(deudaTotal)}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => setTabActiva("historial")}
                style={{
                  background: tabActiva === "historial" ? "#1971c2" : "#dee2e6",
                  color: tabActiva === "historial" ? "white" : "#333",
                  border: "none", borderRadius: 6, padding: "8px 16px",
                  fontWeight: "bold", cursor: "pointer"
                }}
              >
                Todas las ventas
              </button>
              <button
                onClick={() => setTabActiva("cuentaCorriente")}
                style={{
                  background: tabActiva === "cuentaCorriente" ? "#e67700" : "#dee2e6",
                  color: tabActiva === "cuentaCorriente" ? "white" : "#333",
                  border: "none", borderRadius: 6, padding: "8px 16px",
                  fontWeight: "bold", cursor: "pointer"
                }}
              >
                Cuenta corriente {ventasPendientes.length > 0 && "(" + ventasPendientes.length + ")"}
              </button>
            </div>

            {tabActiva === "historial" && (
              <div>
                {ventas.length === 0 && <p style={{ color: "#888" }}>Sin ventas registradas.</p>}
                {ventas.map(v => (
                  <div key={v.id} style={{ border: "1px solid #dee2e6", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <b>Factura #{v.nro_factura || v.id}</b>
                        <span style={{
                          marginLeft: 8,
                          background: v.estado === "cobrada" ? "#2f9e44" : "#e67700",
                          color: "white", fontSize: 11,
                          padding: "2px 8px", borderRadius: 10
                        }}>
                          {v.estado === "cobrada" ? "Cobrada" : "CC"}
                        </span>
                      </div>
                      <b>{formatearPrecio(Number(v.total))}</b>
                    </div>
                    {(v.detalle_ventas || []).map((d: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, color: "#555" }}>
                        - {d.productos?.nombre} x {d.cantidad}
                      </div>
                    ))}
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => reimprimirFactura(v)}
                        style={{ background: "#1971c2", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}
                      >
                        Reimprimir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tabActiva === "cuentaCorriente" && (
              <div>
                {ventasPendientes.length === 0 && (
                  <p style={{ color: "#2f9e44", fontWeight: "bold" }}>Sin deudas pendientes</p>
                )}
                {ventasPendientes.map(v => (
                  <div key={v.id} style={{
                    border: "2px solid #e67700", borderRadius: 8,
                    padding: 12, marginBottom: 14, background: "#fff9f0"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <b>Factura #{v.nro_factura || v.id}</b>
                      <span style={{ color: "#888", fontSize: 13 }}>Total: {formatearPrecio(Number(v.total))}</span>
                    </div>
                    {(v.detalle_ventas || []).map((d: any, i: number) => (
                      <div key={i} style={{ fontSize: 13, color: "#555" }}>
                        - {d.productos?.nombre} x {d.cantidad}
                      </div>
                    ))}
                    {v.pagos.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 13, color: "#555" }}>
                        <b>Pagos:</b>
                        {v.pagos.map((p: any, i: number) => (
                          <div key={i}>Pago: {formatearPrecio(Number(p.monto))}{p.nota ? " - " + p.nota : ""}</div>
                        ))}
                      </div>
                    )}
                    <div style={{
                      marginTop: 8, background: "#fff3cd", borderRadius: 6,
                      padding: "6px 10px", fontWeight: "bold", color: "#e67700", fontSize: 15
                    }}>
                      Saldo pendiente: {formatearPrecio(v.saldo)}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => abrirPago(v)}
                        style={{ background: "#2f9e44", color: "white", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        Registrar pago
                      </button>
                      <button
                        onClick={() => reimprimirFactura(v)}
                        style={{ background: "#1971c2", color: "white", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" }}
                      >
                        Reimprimir
                      </button>
                    </div>
                  </div>
                ))}
                {ventasCobradas.filter(v => v.pagos?.length > 0).map(v => (
                  <div key={v.id} style={{ border: "1px solid #dee2e6", borderRadius: 8, padding: 10, marginBottom: 8, opacity: 0.7 }}>
                    <b>Factura #{v.nro_factura || v.id}</b> - {formatearPrecio(Number(v.total))} - Saldada
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modalPago && ventaParaPagar && (
        <div style={{
          position: "fixed", top: 0, left: 0,
          width: "100%", height: "100%",
          background: "rgba(0,0,0,0.6)",
          display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 200
        }}>
          <div style={{ background: "white", padding: 24, borderRadius: 12, width: "90%", maxWidth: 380 }}>
            <h3>Registrar pago</h3>
            <p>Factura #{ventaParaPagar.nro_factura || ventaParaPagar.id}</p>
            <p style={{ color: "#e67700", fontWeight: "bold" }}>
              Saldo pendiente: {formatearPrecio(ventaParaPagar.saldo)}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <label><b>Monto a pagar</b></label>
              <input
                type="number"
                value={montoPago}
                onChange={e => setMontoPago(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
              />
              <label><b>Nota (opcional)</b></label>
              <input
                type="text"
                value={notaPago}
                placeholder="Ej: efectivo, transferencia..."
                onChange={e => setNotaPago(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={registrarPago}
                  style={{ background: "#2f9e44", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: "bold", cursor: "pointer", flex: 1 }}
                >
                  Confirmar pago
                </button>
                <button
                  onClick={() => { setModalPago(false); setVentaParaPagar(null) }}
                  style={{ background: "#dee2e6", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}