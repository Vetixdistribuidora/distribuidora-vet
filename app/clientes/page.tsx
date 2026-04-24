"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function fmt(num: number) {
  return "$" + Number(num).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fechaCorta(f: string) {
  return new Date(f).toLocaleDateString("es-AR")
}

function Toast({ mensaje, tipo }: { mensaje: string; tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 22px", borderRadius: 10,
      fontWeight: "bold", zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", fontSize: 15
    }}>
      {tipo === "ok" ? "✓ " : "✕ "}{mensaje}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase"
}
const inputDarkStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box"
}
const inputLightStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1px solid #e2e8f0",
  borderRadius: 10, fontSize: 14, color: "#111827", outline: "none",
  boxSizing: "border-box", background: "white"
}

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [busqueda, setBusqueda] = useState("")
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalEditar, setModalEditar] = useState<any>(null)
  const [formNuevo, setFormNuevo] = useState({ nombre: "", apellido: "", cuit: "", telefono: "", localidad: "", porcentaje: "" })
  const [guardando, setGuardando] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState<any>(null)
  const [deudasPorCliente, setDeudasPorCliente] = useState<Record<number, number>>({})

  // Historial
  const [modalHistorial, setModalHistorial] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])
  const [tabActiva, setTabActiva] = useState<"historial" | "cuentaCorriente">("historial")
  const [totalGastado, setTotalGastado] = useState(0)
  const [cantidadCompras, setCantidadCompras] = useState(0)
  const [promedioCompra, setPromedioCompra] = useState(0)
  const [productoTop, setProductoTop] = useState("")
  const [deudaTotal, setDeudaTotal] = useState(0)

  // Pago
  const [modalPago, setModalPago] = useState(false)
  const [ventaParaPagar, setVentaParaPagar] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [notaPago, setNotaPago] = useState("")
  const [guardandoPago, setGuardandoPago] = useState(false)

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

  async function cargarDeudas(lista: any[]) {
    const mapa: Record<number, number> = {}
    await Promise.all(lista.map(async (c) => {
      const { data: vv } = await supabase.from("ventas").select("id, total").eq("cliente_id", c.id).eq("estado", "cuenta_corriente")
      if (!vv?.length) return
      let deuda = 0
      await Promise.all(vv.map(async (v) => {
        const { data: pp } = await supabase.from("pagos_cuenta_corriente").select("monto").eq("venta_id", v.id)
        const pagado = (pp || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        if (saldo > 0) deuda += saldo
      }))
      if (deuda > 0) mapa[c.id] = deuda
    }))
    setDeudasPorCliente(mapa)
  }

  useEffect(() => { cargar() }, [])

  async function agregarCliente() {
    if (!formNuevo.nombre.trim() || !formNuevo.apellido.trim()) { mostrarToast("Nombre y apellido obligatorios", "error"); return }
    setGuardando(true)
    const { error } = await supabase.from("clientes").insert([{
      nombre: formNuevo.nombre.trim(), apellido: formNuevo.apellido.trim(),
      cuit: formNuevo.cuit.trim(), telefono: formNuevo.telefono.trim(),
      localidad: formNuevo.localidad.trim(), porcentaje: Number(formNuevo.porcentaje || 0)
    }])
    setGuardando(false)
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("✅ Cliente agregado", "ok")
    setFormNuevo({ nombre: "", apellido: "", cuit: "", telefono: "", localidad: "", porcentaje: "" })
    setModalNuevo(false)
    cargar()
  }

  async function guardarEdicion() {
    if (!modalEditar?.nombre?.trim() || !modalEditar?.apellido?.trim()) { mostrarToast("Nombre y apellido obligatorios", "error"); return }
    setGuardando(true)
    const { error } = await supabase.from("clientes").update({
      nombre: modalEditar.nombre, apellido: modalEditar.apellido,
      cuit: modalEditar.cuit, telefono: modalEditar.telefono,
      localidad: modalEditar.localidad, porcentaje: Number(modalEditar.porcentaje || 0)
    }).eq("id", modalEditar.id)
    setGuardando(false)
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("✅ Cliente actualizado", "ok")
    setModalEditar(null)
    cargar()
  }

  async function eliminar(id: number) {
    const { error } = await supabase.from("clientes").delete().eq("id", id)
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("🗑️ Cliente eliminado", "ok")
    setConfirmEliminar(null)
    cargar()
  }

  async function abrirHistorial(cliente: any) {
    setModalHistorial(cliente)
    setTabActiva("historial")
    await cargarVentasCliente(cliente.id)
  }

  async function cargarVentasCliente(clienteId: number) {
    const { data: vv } = await supabase.from("ventas").select("id, total, estado, nro_factura, fecha").eq("cliente_id", clienteId).order("id", { ascending: false })
    if (!vv) { setVentas([]); return }
    const conDetalle = await Promise.all(vv.map(async (v) => {
      const { data: detalles } = await supabase.from("detalle_ventas").select("cantidad, precio, productos(nombre)").eq("venta_id", v.id)
      const { data: pagos } = await supabase.from("pagos_cuenta_corriente").select("id, monto, fecha, nota").eq("venta_id", v.id).order("fecha", { ascending: true })
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
      const saldo = Math.max(0, Number(v.total) - totalPagado)
      return { ...v, detalle_ventas: detalles || [], pagos: pagos || [], totalPagado, saldo }
    }))
    setVentas(conDetalle)
    const total = conDetalle.reduce((s, v) => s + Number(v.total), 0)
    setTotalGastado(total)
    setCantidadCompras(conDetalle.length)
    setPromedioCompra(conDetalle.length ? total / conDetalle.length : 0)
    setDeudaTotal(conDetalle.filter(v => v.estado === "cuenta_corriente").reduce((s, v) => s + v.saldo, 0))
    const contador: any = {}
    conDetalle.forEach(v => v.detalle_ventas?.forEach((d: any) => {
      const n = d.productos?.nombre || "Sin nombre"
      contador[n] = (contador[n] || 0) + d.cantidad
    }))
    const top = Object.entries(contador).sort((a: any, b: any) => b[1] - a[1])[0]
    setProductoTop(top ? top[0] as string : "Ninguno")
  }

  function abrirPago(venta: any) {
    setVentaParaPagar(venta)
    setMontoPago(String(venta.saldo))
    setNotaPago("")
    setModalPago(true)
  }

  async function registrarPago() {
    if (!montoPago || Number(montoPago) <= 0) { mostrarToast("Ingresá un monto válido", "error"); return }
    const monto = Number(montoPago)
    if (monto > ventaParaPagar.saldo) { mostrarToast("El monto supera el saldo pendiente", "error"); return }
    setGuardandoPago(true)
    const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
      cliente_id: modalHistorial.id, venta_id: ventaParaPagar.id, monto, nota: notaPago || null
    }])
    if (error) { mostrarToast("Error: " + error.message, "error"); setGuardandoPago(false); return }
    if (monto >= ventaParaPagar.saldo) {
      await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaParaPagar.id)
    }
    mostrarToast("✅ Pago registrado", "ok")
    setModalPago(false); setVentaParaPagar(null); setGuardandoPago(false)
    await cargarVentasCliente(modalHistorial.id)
    await cargar()
  }

  function imprimirRecibo(pago: any, venta: any) {
    const logoUrl = window.location.origin + "/logo.png"
    const fecha = pago.fecha ? fechaCorta(pago.fecha) : new Date().toLocaleDateString("es-AR")
    const saldoAnterior = Number(venta.total) - (Number(venta.totalPagado) - Number(pago.monto))
    const saldoRestante = Math.max(0, saldoAnterior - Number(pago.monto))
    const html = `<!DOCTYPE html><html><head><style>@page{margin:20px;size:A5}body{font-family:Arial;padding:20px;box-sizing:border-box}.logo{height:80px}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1971c2;padding-bottom:12px;margin-bottom:16px}.titulo{font-size:22px;font-weight:bold;color:#1971c2}.sub{font-size:12px;color:#555}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}.pagado{background:#d3f9d8;border:1px solid #2f9e44;border-radius:6px;padding:10px;margin-top:14px;font-size:16px;font-weight:bold;text-align:center;color:#2f9e44}.saldo{background:#fff3cd;border:1px solid #e67700;border-radius:6px;padding:10px;margin-top:8px;font-size:13px;font-weight:bold;color:#e67700}.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}</style></head><body><div class="header"><img src="${logoUrl}" class="logo"/><div style="text-align:right"><div class="titulo">RECIBO DE PAGO</div><div class="sub">Fecha: ${fecha}</div></div></div><div class="row"><span><b>Cliente:</b></span><span>${modalHistorial.nombre} ${modalHistorial.apellido}</span></div><div class="row"><span><b>CUIT:</b></span><span>${modalHistorial.cuit || "-"}</span></div><div class="row"><span><b>Tel:</b></span><span>${modalHistorial.telefono || "-"}</span></div><div class="row"><span><b>Factura N°:</b></span><span>${venta.nro_factura || venta.id}</span></div><div class="row"><span><b>Total factura:</b></span><span>${fmt(Number(venta.total))}</span></div><div class="row"><span><b>Saldo anterior:</b></span><span>${fmt(saldoAnterior)}</span></div>${pago.nota ? `<div class="row"><span><b>Nota:</b></span><span>${pago.nota}</span></div>` : ""}<div class="pagado">Monto pagado: ${fmt(Number(pago.monto))}</div><div class="saldo">${saldoRestante > 0 ? "Saldo restante: " + fmt(saldoRestante) : "✓ Factura saldada completamente"}</div><div class="footer">VETIX Distribuidora — Almirante Brown 620 — Tel: 2604518157</div></body></html>`
    const w = window.open("", "_blank")
    if (!w) { alert("Habilitá ventanas emergentes"); return }
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  async function reimprimirFactura(venta: any) {
    let { data } = await supabase.from("facturas_impresion").select("datos").eq("venta_id", venta.id).maybeSingle()
    if (!data) {
      const res = await supabase.from("facturas_impresion").select("datos").eq("nro_factura", venta.nro_factura).order("id", { ascending: false }).limit(1).maybeSingle()
      data = res.data
    }
    if (!data) { mostrarToast("Factura no encontrada", "error"); return }
    const factura = data.datos
    const logoUrl = window.location.origin + "/logo.png"
    const f = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const filas = factura.carrito.map((item: any) => {
      const bonif = item.bonificacion || 0
      const pagan = Math.max(0, item.cantidad - bonif)
      return `<tr><td>${item.cantidad}</td><td style="text-align:left">${item.nombre}</td><td>${f(item.precio)}</td><td>${bonif}</td><td>${f(pagan * item.precio)}</td></tr>`
    }).join("")
    const html = `<!DOCTYPE html><html><head><style>@page{margin:20px}body{font-family:Arial;padding:20px;display:flex;flex-direction:column;min-height:95vh;box-sizing:border-box}.logo{height:120px}.header{display:flex;justify-content:space-between;align-items:center}.datos{display:flex;justify-content:space-between;margin-top:20px}.contenido{flex:1}table{width:100%;margin-top:30px;border-collapse:collapse}th{border:1px solid #ccc;padding:8px;background:#eee}td{padding:6px;text-align:center}.totales{margin-top:40px;display:flex;justify-content:flex-end}.box{width:280px;border-top:2px solid #ccc;padding-top:10px}.box p,.box h2{margin:6px 0}</style></head><body><div class="contenido"><div class="header"><img src="${logoUrl}" class="logo"/><div style="text-align:center"><h2>PRESUPUESTO</h2><div style="font-size:14px;color:#555">N ${factura.nroFactura} | Fecha: ${factura.fecha || ""}</div></div></div><div class="datos"><div><b>VETIX Distribuidora</b><br/>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div><div><b>Cliente:</b><br/>${factura.clienteSeleccionado.nombre} ${factura.clienteSeleccionado.apellido}<br/>CUIT: ${factura.clienteSeleccionado.cuit || "-"}<br/>Dirección: ${factura.clienteSeleccionado.localidad || "-"}<br/>Tel: ${factura.clienteSeleccionado.telefono || "-"}</div></div><table><thead><tr><th>Cant.</th><th style="width:40%">Descripción</th><th>Precio U.</th><th>Bonif.</th><th>Total</th></tr></thead><tbody>${filas}</tbody></table></div><div class="totales"><div class="box"><p><b>Subtotal:</b> ${f(factura.subtotal)}</p><p><b>IVA (${factura.ivaNum}%):</b> ${f(factura.subtotal * factura.ivaNum / 100)}</p><h2><b>Total:</b> ${f(factura.total)}</h2></div></div></body></html>`
    const w = window.open("", "_blank")
    if (!w) { alert("Habilitá ventanas emergentes"); return }
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  const clientesFiltrados = clientes.filter(c =>
    (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase())
  )
  const ventasPendientes = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const ventasCobradas = ventas.filter(v => v.estado === "cobrada" || v.saldo === 0)

  if (cargando) return <p style={{ padding: 30, color: "#9ca3af" }}>⏳ Cargando clientes...</p>

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          <span style={{ fontWeight: 700, color: "#374151" }}>{clientes.length}</span> clientes
          {Object.keys(deudasPorCliente).length > 0 && (
            <span style={{ marginLeft: 8, color: "#dc2626", fontWeight: 600 }}>· {Object.keys(deudasPorCliente).length} con deuda</span>
          )}
        </p>
        <button onClick={() => setModalNuevo(true)} style={{
          background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
          border: "none", borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
        }}>+ Nuevo cliente</button>
      </div>

      {/* Buscador */}
      <input placeholder="🔍 Buscar cliente por nombre o apellido..."
        value={busqueda} onChange={e => setBusqueda(e.target.value)}
        style={{ ...inputLightStyle, marginBottom: 16 }} />

      {/* Lista */}
      {clientesFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <div style={{ fontWeight: 600 }}>No hay clientes</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clientesFiltrados.map(c => (
            <div key={c.id} style={{
              background: "white", borderRadius: 14, padding: "16px 20px",
              border: deudasPorCliente[c.id] ? "1px solid #fecaca" : "1px solid #e2e8f0",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap"
            }}>
              {/* Avatar + info */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                  background: deudasPorCliente[c.id]
                    ? "linear-gradient(135deg, #dc2626, #ef4444)"
                    : "linear-gradient(135deg, #1e40af, #3b82f6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, color: "white"
                }}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{c.nombre} {c.apellido}</span>
                    {deudasPorCliente[c.id] && (
                      <span style={{
                        background: "#fef2f2", color: "#dc2626", fontSize: 11,
                        fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #fecaca"
                      }}>Debe {fmt(deudasPorCliente[c.id])}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "#6b7280" }}>
                    {c.cuit && <span>CUIT: {c.cuit}</span>}
                    {c.telefono && <span>📞 {c.telefono}</span>}
                    {c.localidad && <span>📍 {c.localidad}</span>}
                    <span>Margen: {c.porcentaje || 0}%</span>
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => abrirHistorial(c)} style={{
                  background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white",
                  border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                }}>Historial</button>
                <button onClick={() => setModalEditar({ ...c, porcentaje: String(c.porcentaje || "") })} style={{
                  background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>✏️</button>
                <button onClick={() => setConfirmEliminar(c)} style={{
                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                  borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL NUEVO CLIENTE ── */}
      {modalNuevo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalNuevo(false)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>Nuevo cliente</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Nombre *", key: "nombre", type: "text" },
                { label: "Apellido *", key: "apellido", type: "text" },
                { label: "CUIT", key: "cuit", type: "text" },
                { label: "Teléfono", key: "telefono", type: "text" },
                { label: "Localidad", key: "localidad", type: "text" },
                { label: "% Margen", key: "porcentaje", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={(formNuevo as any)[f.key]}
                    onChange={e => setFormNuevo({ ...formNuevo, [f.key]: e.target.value })}
                    style={inputDarkStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalNuevo(false)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={agregarCliente} disabled={guardando} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR CLIENTE ── */}
      {modalEditar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalEditar(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 480, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>Editar cliente</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Nombre *", key: "nombre", type: "text" },
                { label: "Apellido *", key: "apellido", type: "text" },
                { label: "CUIT", key: "cuit", type: "text" },
                { label: "Teléfono", key: "telefono", type: "text" },
                { label: "Localidad", key: "localidad", type: "text" },
                { label: "% Margen", key: "porcentaje", type: "number" },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={modalEditar[f.key] ?? ""}
                    onChange={e => setModalEditar({ ...modalEditar, [f.key]: e.target.value })}
                    style={inputDarkStyle} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalEditar(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardando} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #2563eb, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HISTORIAL ── */}
      {modalHistorial && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, width: "100%", maxWidth: 660, maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

            {/* Header modal */}
            <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "white" }}>{modalHistorial.nombre} {modalHistorial.apellido}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                    {modalHistorial.cuit && <span>CUIT: {modalHistorial.cuit} · </span>}
                    {modalHistorial.telefono && <span>📞 {modalHistorial.telefono}</span>}
                    {modalHistorial.localidad && <span> · 📍 {modalHistorial.localidad}</span>}
                  </div>
                </div>
                <button onClick={() => { setModalHistorial(null); setVentas([]) }}
                  style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 16 }}>✕</button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {[
                { label: "Total comprado", valor: fmt(totalGastado) },
                { label: "Compras", valor: cantidadCompras },
                { label: "Promedio", valor: fmt(promedioCompra) },
                { label: "Producto top", valor: productoTop },
              ].map((k, i) => (
                <div key={i} style={{ padding: "14px 16px", textAlign: "center", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>{k.valor}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {deudaTotal > 0 && (
              <div style={{ background: "rgba(251,191,36,0.08)", borderBottom: "1px solid rgba(251,191,36,0.2)", padding: "10px 24px" }}>
                <span style={{ fontSize: 13, color: "#fbbf24", fontWeight: 700 }}>⚠️ Deuda pendiente: {fmt(deudaTotal)}</span>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "0 24px" }}>
              {[
                { key: "historial", label: "Todas las ventas" },
                { key: "cuentaCorriente", label: `Cuenta corriente${ventasPendientes.length > 0 ? ` (${ventasPendientes.length})` : ""}` },
              ].map((t: any) => (
                <button key={t.key} onClick={() => setTabActiva(t.key)} style={{
                  padding: "14px 18px", border: "none", background: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                  color: tabActiva === t.key ? "#3b82f6" : "#6b7280",
                  borderBottom: tabActiva === t.key ? "2px solid #3b82f6" : "2px solid transparent",
                  marginBottom: -1
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Tab historial */}
              {tabActiva === "historial" && (
                <div>
                  {ventas.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Sin ventas registradas</div>}
                  {ventas.map(v => (
                    <div key={v.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 14, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <b style={{ fontSize: 14, color: "white" }}>#{v.nro_factura || v.id}</b>
                          <span style={{
                            background: v.estado === "cobrada" ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
                            color: v.estado === "cobrada" ? "#4ade80" : "#fbbf24",
                            fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700
                          }}>{v.estado === "cobrada" ? "Cobrada" : "CC"}</span>
                        </div>
                        <b style={{ fontSize: 14, color: "white" }}>{fmt(Number(v.total))}</b>
                      </div>
                      {(v.detalle_ventas || []).map((d: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: "#9ca3af" }}>· {d.productos?.nombre} × {d.cantidad}</div>
                      ))}
                      <button onClick={() => reimprimirFactura(v)} style={{ marginTop: 10, background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                        🖨️ Reimprimir
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab cuenta corriente */}
              {tabActiva === "cuentaCorriente" && (
                <div>
                  {ventasPendientes.length === 0 && ventasCobradas.filter(v => v.pagos?.length > 0).length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, background: "rgba(74,222,128,0.05)", borderRadius: 12, border: "1px solid rgba(74,222,128,0.15)" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ fontWeight: 600, color: "#4ade80" }}>Sin deudas pendientes</div>
                    </div>
                  )}
                  {ventasPendientes.map(v => {
                    const progreso = v.total > 0 ? (v.totalPagado / v.total) * 100 : 0
                    return (
                      <div key={v.id} style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <b style={{ color: "white", fontSize: 14 }}>#{v.nro_factura || v.id}</b>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>Total: {fmt(v.total)}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>Saldo: {fmt(v.saldo)}</div>
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                            <span>Pagado: {fmt(v.totalPagado)}</span>
                            <span>{Math.round(progreso)}%</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 100, height: 5 }}>
                            <div style={{ width: `${progreso}%`, height: "100%", background: "linear-gradient(90deg, #f59f00, #e67700)", borderRadius: 100 }} />
                          </div>
                        </div>
                        {(v.detalle_ventas || []).map((d: any, i: number) => (
                          <div key={i} style={{ fontSize: 12, color: "#9ca3af" }}>· {d.productos?.nombre} × {d.cantidad}</div>
                        ))}
                        {v.pagos.length > 0 && (
                          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#9ca3af" }}>Pagos registrados:</div>
                            {v.pagos.map((p: any, i: number) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: i < v.pagos.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                <span style={{ color: "#d1d5db" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#6b7280" }}> ({p.nota})</span> : ""}</span>
                                <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Recibo</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button onClick={() => abrirPago(v)} style={{ flex: 1, padding: "9px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Registrar pago</button>
                          <button onClick={() => reimprimirFactura(v)} style={{ padding: "9px 14px", background: "rgba(59,130,246,0.15)", border: "none", borderRadius: 8, color: "#3b82f6", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>🖨️ Reimprimir</button>
                        </div>
                      </div>
                    )
                  })}
                  {ventasCobradas.filter(v => v.pagos?.length > 0).map(v => (
                    <div key={v.id} style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.12)", borderRadius: 10, padding: 12, marginBottom: 8, opacity: 0.85 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <b style={{ color: "white", fontSize: 13 }}>#{v.nro_factura || v.id}</b>
                        <span style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>Saldada</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Total: {fmt(Number(v.total))}</div>
                      {v.pagos.map((p: any, i: number) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                          <span style={{ color: "#9ca3af" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span> ({p.nota})</span> : ""}</span>
                          <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Recibo</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAGO ── */}
      {modalPago && ventaParaPagar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Registrar pago</h2>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Factura #{ventaParaPagar.nro_factura || ventaParaPagar.id}</p>
            <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Total</div><div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{fmt(ventaParaPagar.total)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "#6b7280" }}>Saldo</div><div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{fmt(ventaParaPagar.saldo)}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[25, 50, 75, 100].map(pct => {
                const val = Math.round(ventaParaPagar.saldo * pct / 100)
                return (
                  <button key={pct} onClick={() => setMontoPago(String(val))} style={{
                    flex: 1, padding: "7px 0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    background: Number(montoPago) === val ? "#3b82f6" : "rgba(255,255,255,0.05)",
                    color: Number(montoPago) === val ? "white" : "#9ca3af",
                    fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>{pct}%</button>
                )
              })}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Monto</label>
              <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} style={inputDarkStyle} />
              {Number(montoPago) > 0 && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: Number(montoPago) >= ventaParaPagar.saldo ? "#4ade80" : "#fbbf24" }}>
                  {Number(montoPago) >= ventaParaPagar.saldo ? "✓ Salda la deuda completa" : `Quedarán ${fmt(ventaParaPagar.saldo - Number(montoPago))} pendientes`}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nota (opcional)</label>
              <input type="text" value={notaPago} onChange={e => setNotaPago(e.target.value)} placeholder="Ej: efectivo, transferencia..." style={inputDarkStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setModalPago(false); setVentaParaPagar(null) }} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={registrarPago} disabled={guardandoPago || !montoPago || Number(montoPago) <= 0} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardandoPago || !montoPago || Number(montoPago) <= 0 ? 0.5 : 1 }}>
                {guardandoPago ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR ── */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setConfirmEliminar(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>¿Eliminar cliente?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Vas a eliminar a <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminar.nombre} {confirmEliminar.apellido}</span>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => eliminar(confirmEliminar.id)} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}