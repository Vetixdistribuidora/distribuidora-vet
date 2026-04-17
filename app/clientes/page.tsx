"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(num: number) {
  return "$" + Number(num).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fechaCorta(f: string) {
  return new Date(f).toLocaleDateString("es-AR")
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ mensaje, tipo }: { mensaje: string; tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 22px", borderRadius: 10,
      fontWeight: "bold", zIndex: 9999,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)", fontSize: 15
    }}>
      {tipo === "ok" ? "✓ " : "✕ "}{mensaje}
    </div>
  )
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8,
  border: "1px solid #dee2e6", fontSize: 14,
  outline: "none", background: "white",
  width: "100%", boxSizing: "border-box"
}
const btnPrimary: React.CSSProperties = {
  background: "#1971c2", color: "white", border: "none",
  borderRadius: 8, padding: "9px 18px", fontWeight: 700,
  cursor: "pointer", fontSize: 14
}
const btnSuccess: React.CSSProperties = {
  background: "#2f9e44", color: "white", border: "none",
  borderRadius: 8, padding: "9px 18px", fontWeight: 700,
  cursor: "pointer", fontSize: 14
}
const btnDanger: React.CSSProperties = {
  background: "#e03131", color: "white", border: "none",
  borderRadius: 8, padding: "9px 18px", fontWeight: 700,
  cursor: "pointer", fontSize: 14
}
const btnGray: React.CSSProperties = {
  background: "#f1f3f5", color: "#495057", border: "1px solid #dee2e6",
  borderRadius: 8, padding: "9px 18px", fontWeight: 600,
  cursor: "pointer", fontSize: 14
}

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [busqueda, setBusqueda] = useState("")
  const [mostrarForm, setMostrarForm] = useState(false)

  // Form nuevo cliente
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [cuit, setCuit] = useState("")
  const [telefono, setTelefono] = useState("")
  const [localidad, setLocalidad] = useState("")
  const [porcentaje, setPorcentaje] = useState("")

  const [editando, setEditando] = useState<any | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [deudasPorCliente, setDeudasPorCliente] = useState<Record<number, number>>({})

  // Modal historial
  const [modalAbierto, setModalAbierto] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [ventas, setVentas] = useState<any[]>([])
  const [tabActiva, setTabActiva] = useState<"historial" | "cuentaCorriente">("historial")
  const [totalGastado, setTotalGastado] = useState(0)
  const [cantidadCompras, setCantidadCompras] = useState(0)
  const [promedioCompra, setPromedioCompra] = useState(0)
  const [productoTop, setProductoTop] = useState("")
  const [deudaTotal, setDeudaTotal] = useState(0)

  // Modal pago
  const [modalPago, setModalPago] = useState(false)
  const [ventaParaPagar, setVentaParaPagar] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [notaPago, setNotaPago] = useState("")
  const [guardando, setGuardando] = useState(false)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Carga ──────────────────────────────────────────────────────────────────
  async function cargar() {
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    setClientes(data || [])
    setCargando(false)
    await cargarDeudas(data || [])
  }

  async function cargarDeudas(lista: any[]) {
    const mapa: Record<number, number> = {}
    await Promise.all(lista.map(async (c) => {
      const { data: vv } = await supabase
        .from("ventas").select("id, total")
        .eq("cliente_id", c.id).eq("estado", "cuenta_corriente")
      if (!vv?.length) return
      let deuda = 0
      await Promise.all(vv.map(async (v) => {
        const { data: pp } = await supabase
          .from("pagos_cuenta_corriente").select("monto").eq("venta_id", v.id)
        const pagado = (pp || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        if (saldo > 0) deuda += saldo
      }))
      if (deuda > 0) mapa[c.id] = deuda
    }))
    setDeudasPorCliente(mapa)
  }

  useEffect(() => { cargar() }, [])

  // ── CRUD clientes ──────────────────────────────────────────────────────────
  async function agregar() {
    if (!nombre.trim() || !apellido.trim()) {
      mostrarToast("Nombre y apellido obligatorios", "error"); return
    }
    const { error } = await supabase.from("clientes").insert([{
      nombre: nombre.trim(), apellido: apellido.trim(),
      cuit: cuit.trim(), telefono: telefono.trim(),
      localidad: localidad.trim(), porcentaje: Number(porcentaje || 0)
    }])
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("Cliente agregado", "ok")
    setNombre(""); setApellido(""); setCuit("")
    setTelefono(""); setLocalidad(""); setPorcentaje("")
    setMostrarForm(false)
    cargar()
  }

  async function guardarEdicion() {
    if (!editando.nombre?.trim() || !editando.apellido?.trim()) {
      mostrarToast("Nombre y apellido obligatorios", "error"); return
    }
    const { error } = await supabase.from("clientes").update({
      nombre: editando.nombre, apellido: editando.apellido,
      cuit: editando.cuit, telefono: editando.telefono,
      localidad: editando.localidad, porcentaje: Number(editando.porcentaje || 0)
    }).eq("id", editando.id)
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("Cliente actualizado", "ok")
    setEditando(null); cargar()
  }

  async function eliminar(id: number) {
    const { error } = await supabase.from("clientes").delete().eq("id", id)
    if (error) { mostrarToast("Error: " + error.message, "error"); return }
    mostrarToast("Cliente eliminado", "ok")
    setConfirmEliminar(null); cargar()
  }

  // ── Historial ──────────────────────────────────────────────────────────────
  async function abrirHistorial(cliente: any) {
    setClienteSeleccionado(cliente)
    setModalAbierto(true)
    setTabActiva("historial")
    await cargarVentasCliente(cliente.id)
  }

  async function cargarVentasCliente(clienteId: number) {
    const { data: vv } = await supabase
      .from("ventas").select("id, total, estado, nro_factura, fecha")
      .eq("cliente_id", clienteId).order("id", { ascending: false })
    if (!vv) { setVentas([]); return }
    const conDetalle = await Promise.all(vv.map(async (v) => {
      const { data: detalles } = await supabase
        .from("detalle_ventas").select("cantidad, precio, productos(nombre)").eq("venta_id", v.id)
      const { data: pagos } = await supabase
        .from("pagos_cuenta_corriente").select("id, monto, fecha, nota")
        .eq("venta_id", v.id).order("fecha", { ascending: true })
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

  // ── Pago ───────────────────────────────────────────────────────────────────
  function abrirPago(venta: any) {
    setVentaParaPagar(venta)
    setMontoPago(String(venta.saldo))
    setNotaPago("")
    setModalPago(true)
  }

  async function registrarPago() {
    if (!montoPago || Number(montoPago) <= 0) {
      mostrarToast("Ingresá un monto válido", "error"); return
    }
    const monto = Number(montoPago)
    if (monto > ventaParaPagar.saldo) {
      mostrarToast("El monto supera el saldo pendiente", "error"); return
    }
    setGuardando(true)
    const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
      cliente_id: clienteSeleccionado.id,
      venta_id: ventaParaPagar.id,
      monto, nota: notaPago || null
    }])
    if (error) { mostrarToast("Error: " + error.message, "error"); setGuardando(false); return }
    if (monto >= ventaParaPagar.saldo) {
      await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaParaPagar.id)
    }
    mostrarToast("Pago registrado", "ok")
    setModalPago(false); setVentaParaPagar(null)
    setGuardando(false)
    await cargarVentasCliente(clienteSeleccionado.id)
    await cargar()
  }

  // ── Imprimir recibo ────────────────────────────────────────────────────────
  function imprimirRecibo(pago: any, venta: any) {
    const logoUrl = window.location.origin + "/logo.png"
    const fecha = pago.fecha ? fechaCorta(pago.fecha) : new Date().toLocaleDateString("es-AR")
    const saldoAnterior = Number(venta.total) - (Number(venta.totalPagado) - Number(pago.monto))
    const saldoRestante = Math.max(0, saldoAnterior - Number(pago.monto))
    const html = `<!DOCTYPE html><html><head><style>
      @page{margin:20px;size:A5}body{font-family:Arial;padding:20px;box-sizing:border-box}
      .logo{height:80px}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1971c2;padding-bottom:12px;margin-bottom:16px}
      .titulo{font-size:22px;font-weight:bold;color:#1971c2}.sub{font-size:12px;color:#555}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
      .pagado{background:#d3f9d8;border:1px solid #2f9e44;border-radius:6px;padding:10px;margin-top:14px;font-size:16px;font-weight:bold;text-align:center;color:#2f9e44}
      .saldo{background:#fff3cd;border:1px solid #e67700;border-radius:6px;padding:10px;margin-top:8px;font-size:13px;font-weight:bold;color:#e67700}
      .footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}
    </style></head><body>
    <div class="header"><img src="${logoUrl}" class="logo"/>
      <div style="text-align:right"><div class="titulo">RECIBO DE PAGO</div><div class="sub">Fecha: ${fecha}</div></div>
    </div>
    <div class="row"><span><b>Cliente:</b></span><span>${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido}</span></div>
    <div class="row"><span><b>CUIT:</b></span><span>${clienteSeleccionado.cuit || "-"}</span></div>
    <div class="row"><span><b>Tel:</b></span><span>${clienteSeleccionado.telefono || "-"}</span></div>
    <div class="row"><span><b>Factura N°:</b></span><span>${venta.nro_factura || venta.id}</span></div>
    <div class="row"><span><b>Total factura:</b></span><span>${fmt(Number(venta.total))}</span></div>
    <div class="row"><span><b>Saldo anterior:</b></span><span>${fmt(saldoAnterior)}</span></div>
    ${pago.nota ? `<div class="row"><span><b>Nota:</b></span><span>${pago.nota}</span></div>` : ""}
    <div class="pagado">Monto pagado: ${fmt(Number(pago.monto))}</div>
    <div class="saldo">${saldoRestante > 0 ? "Saldo restante: " + fmt(saldoRestante) : "✓ Factura saldada completamente"}</div>
    <div class="footer">VETIX Distribuidora — Almirante Brown 620 — Tel: 2604518157</div>
    </body></html>`
    const w = window.open("", "_blank")
    if (!w) { alert("Habilitá ventanas emergentes"); return }
    w.document.write(html); w.document.close()
    setTimeout(() => w.print(), 500)
  }

  // ── Reimprimir factura ─────────────────────────────────────────────────────
  async function reimprimirFactura(venta: any) {
    let { data } = await supabase
      .from("facturas_impresion").select("datos")
      .eq("venta_id", venta.id).maybeSingle()
    if (!data) {
      const res = await supabase
        .from("facturas_impresion").select("datos")
        .eq("nro_factura", venta.nro_factura)
        .order("id", { ascending: false }).limit(1).maybeSingle()
      data = res.data
    }
    if (!data) { mostrarToast("Factura no encontrada", "error"); return }
    const factura = data.datos
    const logoUrl = window.location.origin + "/logo.png"
    const filas = factura.carrito.map((item: any) => {
      const bonif = item.bonificacion || 0
      const unidadesPagas = Math.max(0, item.cantidad - bonif)
      const totalItem = unidadesPagas * item.precio
      return `<tr><td>${item.cantidad}</td><td style="text-align:left">${item.nombre}</td><td>${fmt(item.precio)}</td><td>${bonif}</td><td>${fmt(totalItem)}</td></tr>`
    }).join("")
    const badgeCC = venta.estado === "cuenta_corriente"
      ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>"
      : ""
    const html = `<!DOCTYPE html><html><head><style>
      @page{margin:20px}body{font-family:Arial;padding:20px;display:flex;flex-direction:column;min-height:95vh;box-sizing:border-box}
      .logo{height:120px}.header{display:flex;justify-content:space-between;align-items:center}
      .datos{display:flex;justify-content:space-between;margin-top:20px}.contenido{flex:1}
      table{width:100%;margin-top:30px;border-collapse:collapse}th{border:1px solid #ccc;padding:8px;background:#eee}
      td{padding:6px;text-align:center}.totales{margin-top:40px;display:flex;justify-content:flex-end}
      .box{width:280px;border-top:2px solid #ccc;padding-top:10px}.box p,.box h2{margin:6px 0}
    </style></head><body>
    <div class="contenido">
      <div class="header"><img src="${logoUrl}" class="logo"/>
        <div style="text-align:center"><h2>PRESUPUESTO</h2>
          <div style="font-size:14px;color:#555">N ${factura.nroFactura} | Fecha: ${factura.fecha}</div>${badgeCC}
        </div>
      </div>
      <div class="datos">
        <div><b>VETIX Distribuidora</b><br/>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div>
        <div><b>Cliente:</b><br/>${factura.clienteSeleccionado.nombre} ${factura.clienteSeleccionado.apellido}<br/>
          CUIT: ${factura.clienteSeleccionado.cuit || "-"}<br/>
          Dirección: ${factura.clienteSeleccionado.localidad || "-"}<br/>
          Tel: ${factura.clienteSeleccionado.telefono || "-"}
        </div>
      </div>
      <table><thead><tr><th>Cant.</th><th style="width:40%">Descripción</th><th>Precio U.</th><th>Bonif.</th><th>Total</th></tr></thead>
      <tbody>${filas}</tbody></table>
    </div>
    <div class="totales"><div class="box">
      <p><b>Subtotal:</b> ${fmt(factura.subtotal)}</p>
      <p><b>IVA (${factura.ivaNum}%):</b> ${fmt(factura.subtotal * factura.ivaNum / 100)}</p>
      <h2><b>Total:</b> ${fmt(factura.total)}</h2>
    </div></div></body></html>`
    const w = window.open("", "_blank")
    if (!w) { alert("Habilitá ventanas emergentes"); return }
    w.document.write(html); w.document.close()
    setTimeout(() => w.print(), 500)
  }

  // ── Derivados ──────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c =>
    (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase())
  )
  const ventasPendientes = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const ventasCobradas = ventas.filter(v => v.estado === "cobrada" || v.saldo === 0)
  const montoInput = Number(montoPago)

  if (cargando) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#868e96" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Cargando clientes...</div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", background: "#f8f9fa", minHeight: "100vh", padding: 24 }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#1a1a2e" }}>Clientes</h1>
          <p style={{ margin: "4px 0 0", color: "#868e96", fontSize: 14 }}>
            {clientes.length} clientes registrados · {Object.keys(deudasPorCliente).length} con deuda
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          style={{ ...btnPrimary, display: "flex", alignItems: "center", gap: 6 }}
        >
          {mostrarForm ? "✕ Cancelar" : "+ Nuevo cliente"}
        </button>
      </div>

      {/* ── Formulario nuevo cliente ── */}
      {mostrarForm && (
        <div style={{
          background: "white", borderRadius: 14, padding: 24,
          marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
          border: "1px solid #e7f5ff"
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#1971c2" }}>
            Nuevo cliente
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                Nombre *
              </label>
              <input style={inputStyle} placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                Apellido *
              </label>
              <input style={inputStyle} placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                CUIT
              </label>
              <input style={inputStyle} placeholder="XX-XXXXXXXX-X" value={cuit} onChange={e => setCuit(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                Teléfono
              </label>
              <input style={inputStyle} placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                Localidad
              </label>
              <input style={inputStyle} placeholder="Localidad" value={localidad} onChange={e => setLocalidad(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                % Margen
              </label>
              <input style={inputStyle} type="number" placeholder="0" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={agregar} style={btnSuccess}>Guardar cliente</button>
            <button onClick={() => setMostrarForm(false)} style={btnGray}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Buscador ── */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#adb5bd" }}>🔍</span>
        <input
          placeholder="Buscar cliente por nombre o apellido..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 36 }}
        />
      </div>

      {/* ── Lista clientes ── */}
      {clientesFiltrados.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "#adb5bd" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
          <div style={{ fontWeight: 600 }}>No hay clientes</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Agregá tu primer cliente con el botón de arriba</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clientesFiltrados.map(c => (
          <div key={c.id} style={{
            background: editando?.id === c.id ? "#fff9db" : "white",
            borderRadius: 12, padding: 18,
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            border: deudasPorCliente[c.id]
              ? "1px solid #ffc9c9"
              : editando?.id === c.id
                ? "1px solid #ffe066"
                : "1px solid #f1f3f5",
            transition: "box-shadow 0.15s"
          }}>
            {editando?.id === c.id ? (
              // ── Modo edición ──
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1971c2", marginBottom: 12 }}>
                  Editando cliente
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Nombre *", key: "nombre", type: "text" },
                    { label: "Apellido *", key: "apellido", type: "text" },
                    { label: "CUIT", key: "cuit", type: "text" },
                    { label: "Teléfono", key: "telefono", type: "text" },
                    { label: "Localidad", key: "localidad", type: "text" },
                    { label: "% Margen", key: "porcentaje", type: "number" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#495057", display: "block", marginBottom: 4 }}>
                        {f.label}
                      </label>
                      <input
                        type={f.type}
                        value={editando[f.key] ?? ""}
                        onChange={e => setEditando({ ...editando, [f.key]: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={guardarEdicion} style={btnSuccess}>Guardar</button>
                  <button onClick={() => setEditando(null)} style={btnGray}>Cancelar</button>
                </div>
              </div>
            ) : (
              // ── Vista normal ──
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>
                      {c.nombre} {c.apellido}
                    </span>
                    {deudasPorCliente[c.id] && (
                      <span style={{
                        background: "#fff0f0", color: "#e03131",
                        padding: "3px 10px", borderRadius: 20,
                        fontSize: 12, fontWeight: 700,
                        border: "1px solid #ffc9c9"
                      }}>
                        Debe {fmt(deudasPorCliente[c.id])}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#868e96" }}>
                    {c.cuit && <span>CUIT: {c.cuit}</span>}
                    {c.telefono && <span>📞 {c.telefono}</span>}
                    {c.localidad && <span>📍 {c.localidad}</span>}
                    <span>Margen: {c.porcentaje || 0}%</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => abrirHistorial(c)}
                    style={btnPrimary}
                  >
                    Historial
                  </button>
                  <button
                    onClick={() => setEditando({ ...c, porcentaje: String(c.porcentaje || "") })}
                    style={btnGray}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmEliminar(c)}
                    style={btnDanger}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal historial ── */}
      {modalAbierto && clienteSeleccionado && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100
        }}>
          <div style={{
            background: "white", borderRadius: 16,
            width: "92%", maxWidth: 680, maxHeight: "88vh",
            overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)"
          }}>
            {/* Header modal */}
            <div style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, #1971c2, #1864ab)",
              color: "white", borderRadius: "16px 16px 0 0"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                    {clienteSeleccionado.cuit && <span>CUIT: {clienteSeleccionado.cuit} &nbsp;·&nbsp; </span>}
                    {clienteSeleccionado.telefono && <span>📞 {clienteSeleccionado.telefono}</span>}
                    {clienteSeleccionado.localidad && <span> &nbsp;·&nbsp; 📍 {clienteSeleccionado.localidad}</span>}
                  </div>
                </div>
                <button
                  onClick={() => { setModalAbierto(false); setVentas([]) }}
                  style={{
                    background: "rgba(255,255,255,0.2)", border: "none",
                    color: "white", borderRadius: 8, padding: "6px 14px",
                    cursor: "pointer", fontWeight: 700, fontSize: 16
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 0, borderBottom: "1px solid #f1f3f5"
            }}>
              {[
                { label: "Total comprado", valor: fmt(totalGastado), color: "#1971c2" },
                { label: "Compras", valor: cantidadCompras, color: "#1971c2" },
                { label: "Promedio", valor: fmt(promedioCompra), color: "#1971c2" },
                { label: "Producto top", valor: productoTop, color: "#1971c2" },
              ].map((k, i) => (
                <div key={i} style={{
                  padding: "14px 16px", textAlign: "center",
                  borderRight: i < 3 ? "1px solid #f1f3f5" : "none"
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.valor}</div>
                  <div style={{ fontSize: 11, color: "#868e96", marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {deudaTotal > 0 && (
              <div style={{
                background: "#fff9f0", borderBottom: "1px solid #ffc078",
                padding: "10px 24px", display: "flex", alignItems: "center",
                justifyContent: "space-between"
              }}>
                <span style={{ fontSize: 14, color: "#e67700", fontWeight: 700 }}>
                  ⚠️ Deuda pendiente: {fmt(deudaTotal)}
                </span>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #f1f3f5", padding: "0 24px" }}>
              {[
                { key: "historial", label: "Todas las ventas" },
                { key: "cuentaCorriente", label: `Cuenta corriente${ventasPendientes.length > 0 ? ` (${ventasPendientes.length})` : ""}` },
              ].map((t: any) => (
                <button key={t.key} onClick={() => setTabActiva(t.key)} style={{
                  padding: "14px 18px", border: "none", background: "none",
                  cursor: "pointer", fontSize: 14, fontWeight: 600,
                  color: tabActiva === t.key ? "#1971c2" : "#868e96",
                  borderBottom: tabActiva === t.key ? "2px solid #1971c2" : "2px solid transparent",
                  marginBottom: -1
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Tab historial */}
              {tabActiva === "historial" && (
                <div>
                  {ventas.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>
                      Sin ventas registradas
                    </div>
                  )}
                  {ventas.map(v => (
                    <div key={v.id} style={{
                      border: "1px solid #f1f3f5", borderRadius: 10, padding: 14,
                      marginBottom: 10, background: "#fafafa"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <b style={{ fontSize: 15, color: "#111827" }}>Factura #{v.nro_factura || v.id}</b>
<span style={{
  background: v.estado === "cobrada" ? "#d3f9d8" : "#ffd8a8",
  color: v.estado === "cobrada" ? "#2f9e44" : "#e67700",
  fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700
}}>
                            {v.estado === "cobrada" ? "Cobrada" : "CC"}
                          </span>
                        </div>
                        <b style={{ fontSize: 15, color: "#111827" }}>{fmt(Number(v.total))}</b>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {(v.detalle_ventas || []).map((d: any, i: number) => (
  <div key={i} style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>
    · {d.productos?.nombre} × {d.cantidad}
  </div>
))}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <button onClick={() => reimprimirFactura(v)} style={{ ...btnPrimary, fontSize: 12, padding: "6px 14px" }}>
                          Reimprimir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab cuenta corriente */}
              {tabActiva === "cuentaCorriente" && (
                <div>
                  {ventasPendientes.length === 0 && ventasCobradas.filter(v => v.pagos?.length > 0).length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, background: "#f8fff8", borderRadius: 12, border: "1px solid #b2f2bb" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div style={{ fontWeight: 600, color: "#2f9e44" }}>Sin deudas pendientes</div>
                    </div>
                  )}

                  {ventasPendientes.map(v => {
                    const progreso = v.total > 0 ? (v.totalPagado / v.total) * 100 : 0
                    return (
                      <div key={v.id} style={{
                        border: "1px solid #ffc078", borderRadius: 12,
                        padding: 16, marginBottom: 14, background: "#fffbf0"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <b style={{ fontSize: 15, color: "#111827" }}>Factura #{v.nro_factura || v.id}</b>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, color: "#868e96" }}>Total: {fmt(v.total)}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#e67700" }}>
                              Saldo: {fmt(v.saldo)}
                            </div>
                          </div>
                        </div>
                        {/* Barra progreso */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#868e96", marginBottom: 3 }}>
                            <span>Pagado: {fmt(v.totalPagado)}</span>
                            <span>{Math.round(progreso)}%</span>
                          </div>
                          <div style={{ background: "#f1f3f5", borderRadius: 100, height: 5 }}>
                            <div style={{
                              width: `${progreso}%`, height: "100%",
                              background: "linear-gradient(90deg, #f59f00, #e67700)",
                              borderRadius: 100, transition: "width 0.4s"
                            }} />
                          </div>
                        </div>
                        {(v.detalle_ventas || []).map((d: any, i: number) => (
  <div key={i} style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>· {d.productos?.nombre} × {d.cantidad}</div>
))}
                        {v.pagos.length > 0 && (
                          <div style={{ marginTop: 10, background: "white", borderRadius: 8, padding: "8px 12px", border: "1px solid #f1f3f5" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#111827" }}>Pagos registrados:</div>
                            {v.pagos.map((p: any, i: number) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: i < v.pagos.length - 1 ? "1px solid #f8f9fa" : "none" }}>
                                <span style={{ color: "#111827" }}>
  {fechaCorta(p.fecha)} — <b style={{ color: "#2f9e44" }}>{fmt(p.monto)}</b>
  {p.nota ? <span style={{ color: "#495057", fontWeight: 500 }}> ({p.nota})</span> : ""}
</span>
                                <button onClick={() => imprimirRecibo(p, v)} style={{ background: "#e7f5ff", color: "#1971c2", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  Recibo
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button onClick={() => abrirPago(v)} style={{ ...btnSuccess, flex: 1, fontSize: 13 }}>
                            + Registrar pago
                          </button>
                          <button onClick={() => reimprimirFactura(v)} style={{ ...btnPrimary, fontSize: 13 }}>
                            Reimprimir
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {ventasCobradas.filter(v => v.pagos?.length > 0).map(v => (
                    <div key={v.id} style={{ border: "1px solid #b2f2bb", borderRadius: 10, padding: 12, marginBottom: 8, background: "#f8fff8", opacity: 0.85 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <b style={{ color: "#111827" }}>Factura #{v.nro_factura || v.id}</b>
                        <span style={{ background: "#d3f9d8", color: "#2f9e44", fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                          Saldada
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#374151", marginTop: 4, fontWeight: 500 }}>Total: {fmt(Number(v.total))}</div>
                      <div style={{ marginTop: 8 }}>
                        {v.pagos.map((p: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0" }}>
                            <span style={{ color: "#111827" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#2f9e44" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#495057" }}> ({p.nota})</span> : ""}</span>
                            <button onClick={() => imprimirRecibo(p, v)} style={{ background: "#e7f5ff", color: "#1971c2", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>
                              Recibo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pago ── */}
      {modalPago && ventaParaPagar && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200
        }}>
          <div style={{
            background: "white", borderRadius: 18, width: "90%", maxWidth: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden"
          }}>
            <div style={{ background: "linear-gradient(135deg, #2f9e44, #2b8a3e)", padding: "20px 24px", color: "white" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Registrar Pago</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
                Factura #{ventaParaPagar.nro_factura || ventaParaPagar.id}
              </div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "#fff9f0", borderRadius: 10, padding: "12px 16px", marginBottom: 18, border: "1px solid #ffc078" }}>
                <div style={{ fontSize: 13, color: "#868e96" }}>
                  Total factura<br />
                  <b style={{ fontSize: 16, color: "#1a1a2e" }}>{fmt(ventaParaPagar.total)}</b>
                </div>
                <div style={{ fontSize: 13, color: "#868e96", textAlign: "right" }}>
                  Saldo pendiente<br />
                  <b style={{ fontSize: 16, color: "#e67700" }}>{fmt(ventaParaPagar.saldo)}</b>
                </div>
              </div>

              {/* Pagos rápidos */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, marginBottom: 6 }}>Pago rápido:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = Math.round(ventaParaPagar.saldo * pct / 100)
                    return (
                      <button key={pct} onClick={() => setMontoPago(String(val))} style={{
                        flex: 1, padding: "7px 0", border: "1px solid #dee2e6", borderRadius: 8,
                        background: montoInput === val ? "#1971c2" : "white",
                        color: montoInput === val ? "white" : "#495057",
                        fontSize: 12, fontWeight: 600, cursor: "pointer"
                      }}>
                        {pct}%
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                    Monto a pagar
                  </label>
                  <input
                    type="number" value={montoPago}
                    onChange={e => setMontoPago(e.target.value)}
                    style={{ ...inputStyle, fontSize: 16, fontWeight: 700, border: "2px solid #dee2e6" }}
                  />
                  {montoInput > 0 && (
                    <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: montoInput >= ventaParaPagar.saldo ? "#2f9e44" : "#e67700" }}>
                      {montoInput >= ventaParaPagar.saldo
                        ? "✓ Salda la deuda completa"
                        : `Quedarán ${fmt(ventaParaPagar.saldo - montoInput)} pendientes`}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#495057", display: "block", marginBottom: 5 }}>
                    Nota (opcional)
                  </label>
                  <input
                    type="text" value={notaPago}
                    placeholder="Ej: efectivo, transferencia..."
                    onChange={e => setNotaPago(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button
                  onClick={() => { setModalPago(false); setVentaParaPagar(null) }}
                  style={{ ...btnGray, flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarPago}
                  disabled={guardando || !montoPago || montoInput <= 0}
                  style={{
                    ...btnSuccess, flex: 2,
                    opacity: guardando || !montoPago || montoInput <= 0 ? 0.6 : 1,
                    cursor: guardando ? "not-allowed" : "pointer"
                  }}
                >
                  {guardando ? "Guardando..." : "Confirmar pago"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm eliminar ── */}
      {confirmEliminar && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 300, padding: 16
        }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>¿Eliminar cliente?</div>
            <p style={{ color: "#868e96", fontSize: 14, margin: "0 0 24px" }}>
              Vas a eliminar a <b>{confirmEliminar.nombre} {confirmEliminar.apellido}</b>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)} style={btnGray}>Cancelar</button>
              <button onClick={() => eliminar(confirmEliminar.id)} style={btnDanger}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}