"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 8,
  border: "1px solid #dee2e6", fontSize: 14,
  outline: "none", background: "white",
  width: "100%", boxSizing: "border-box"
}

export default function CuentasCorrientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [resumen, setResumen] = useState<Record<number, { deuda: number; ventasPendientes: number }>>({})
  const [clienteActivo, setClienteActivo] = useState<any | null>(null)
  const [ventas, setVentas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoVentas, setCargandoVentas] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<"deudores" | "todos">("deudores")
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes")
  const [toast, setToast] = useState<any>(null)

  // Modal pago
  const [ventaPago, setVentaPago] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [notaPago, setNotaPago] = useState("")
  const [guardando, setGuardando] = useState(false)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { inicializar() }, [])

  async function inicializar() {
    setCargando(true)
    const { data } = await supabase.from("clientes").select("*").order("nombre")
    const lista = data || []
    setClientes(lista)
    await calcularResumen(lista)
    setCargando(false)
  }

  async function calcularResumen(lista: any[]) {
    const mapa: Record<number, { deuda: number; ventasPendientes: number }> = {}
    await Promise.all(lista.map(async (c) => {
      const { data: vv } = await supabase
        .from("ventas").select("id, total")
        .eq("cliente_id", c.id).eq("estado", "cuenta_corriente")
      if (!vv?.length) return
      let deuda = 0; let pendientes = 0
      await Promise.all(vv.map(async (v) => {
        const { data: pp } = await supabase
          .from("pagos_cuenta_corriente").select("monto").eq("venta_id", v.id)
        const pagado = (pp || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        if (saldo > 0) { deuda += saldo; pendientes++ }
      }))
      if (deuda > 0) mapa[c.id] = { deuda, ventasPendientes: pendientes }
    }))
    setResumen(mapa)
  }

  // ── Seleccionar cliente ────────────────────────────────────────────────────
  async function seleccionarCliente(c: any) {
    setClienteActivo(c)
    setTab("pendientes")
    setCargandoVentas(true)
    await cargarVentas(c.id)
    setCargandoVentas(false)
  }

  async function cargarVentas(clienteId: number) {
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
      return { ...v, total: Number(v.total), detalle_ventas: detalles || [], pagos: pagos || [], totalPagado, saldo }
    }))
    setVentas(conDetalle)
  }

  // ── Registrar pago ─────────────────────────────────────────────────────────
  async function registrarPago() {
    if (!ventaPago || !montoPago || Number(montoPago) <= 0) {
      mostrarToast("Ingresá un monto válido", "error"); return
    }
    const monto = Number(montoPago)
    if (monto > ventaPago.saldo) {
      mostrarToast("El monto supera el saldo pendiente", "error"); return
    }
    setGuardando(true)
    const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
      cliente_id: clienteActivo.id,
      venta_id: ventaPago.id,
      monto, nota: notaPago || null
    }])
    if (error) { mostrarToast("Error: " + error.message, "error"); setGuardando(false); return }
    if (monto >= ventaPago.saldo) {
      await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaPago.id)
    }
    mostrarToast("Pago registrado correctamente", "ok")
    setVentaPago(null); setMontoPago(""); setNotaPago("")
    setGuardando(false)
    await cargarVentas(clienteActivo.id)
    await calcularResumen(clientes)
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
    <div class="row"><span><b>Cliente:</b></span><span>${clienteActivo.nombre} ${clienteActivo.apellido}</span></div>
    <div class="row"><span><b>CUIT:</b></span><span>${clienteActivo.cuit || "-"}</span></div>
    <div class="row"><span><b>Tel:</b></span><span>${clienteActivo.telefono || "-"}</span></div>
    <div class="row"><span><b>Factura N°:</b></span><span>${venta.nro_factura || venta.id}</span></div>
    <div class="row"><span><b>Total factura:</b></span><span>${fmt(venta.total)}</span></div>
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

  // ── Derivados ──────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes
    .filter(c => filtro === "todos" || resumen[c.id])
    .filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase()))
  const deudaTotal = Object.values(resumen).reduce((s, r) => s + r.deuda, 0)
  const pendientesList = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const cobradasCC = ventas.filter(v => v.estado === "cobrada" && v.pagos?.length > 0)
  const montoInput = Number(montoPago)

  if (cargando) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#868e96" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Cargando cuentas corrientes...</div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", background: "#f8f9fa", minHeight: "100vh", padding: 24 }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#1a1a2e" }}>Cuentas Corrientes</h1>
        <p style={{ margin: "4px 0 0", color: "#868e96", fontSize: 14 }}>
          Gestión de deudas y pagos por cliente
        </p>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Deuda total", valor: fmt(deudaTotal), color: "#e03131", bg: "#fff5f5", icono: "💰" },
          { label: "Clientes deudores", valor: Object.keys(resumen).length, color: "#e67700", bg: "#fff9f0", icono: "👥" },
          { label: "Total clientes", valor: clientes.length, color: "#1971c2", bg: "#e7f5ff", icono: "📋" },
        ].map((k, i) => (
          <div key={i} style={{
            background: k.bg, border: `1px solid ${k.color}30`,
            borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)"
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{k.icono}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.valor}</div>
            <div style={{ fontSize: 12, color: "#868e96", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Layout dos columnas ── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Panel izquierdo ── */}
        <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #f1f3f5" }}>
            <input
              placeholder="🔍 Buscar cliente..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {(["deudores", "todos"] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 8, border: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: filtro === f ? "#1971c2" : "#f1f3f5",
                  color: filtro === f ? "white" : "#495057"
                }}>
                  {f === "deudores" ? "Con deuda" : "Todos"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 540, overflowY: "auto" }}>
            {clientesFiltrados.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#adb5bd", fontSize: 13 }}>
                Sin clientes {filtro === "deudores" ? "con deuda" : ""}
              </div>
            )}
            {clientesFiltrados.map(c => {
              const info = resumen[c.id]
              const activo = clienteActivo?.id === c.id
              return (
                <div key={c.id} onClick={() => seleccionarCliente(c)} style={{
                  padding: "13px 16px", cursor: "pointer",
                  borderBottom: "1px solid #f8f9fa",
                  background: activo ? "#e7f5ff" : "white",
                  borderLeft: activo ? "3px solid #1971c2" : "3px solid transparent"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a2e" }}>
                        {c.nombre} {c.apellido}
                      </div>
                      {c.telefono && (
                        <div style={{ fontSize: 12, color: "#868e96", marginTop: 2 }}>📞 {c.telefono}</div>
                      )}
                    </div>
                    {info ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ background: "#fff0f0", color: "#e03131", fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>
                          {fmt(info.deuda)}
                        </div>
                        <div style={{ fontSize: 11, color: "#adb5bd", marginTop: 2 }}>
                          {info.ventasPendientes} factura{info.ventasPendientes > 1 ? "s" : ""}
                        </div>
                      </div>
                    ) : (
                      <span style={{ background: "#f1f3f5", color: "#adb5bd", fontSize: 11, padding: "3px 8px", borderRadius: 20 }}>
                        Al día
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Panel derecho ── */}
        <div>
          {!clienteActivo ? (
            <div style={{
              background: "white", borderRadius: 16, padding: 60,
              textAlign: "center", color: "#adb5bd",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Seleccioná un cliente</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>para ver su cuenta corriente</div>
            </div>
          ) : (
            <div style={{ background: "white", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", overflow: "hidden" }}>

              {/* Header cliente activo */}
              <div style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #1971c2, #1864ab)",
                color: "white"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {clienteActivo.nombre} {clienteActivo.apellido}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                      {clienteActivo.cuit && <span>CUIT: {clienteActivo.cuit} &nbsp;·&nbsp; </span>}
                      {clienteActivo.telefono && <span>📞 {clienteActivo.telefono}</span>}
                      {clienteActivo.localidad && <span> &nbsp;·&nbsp; 📍 {clienteActivo.localidad}</span>}
                    </div>
                  </div>
                  {resumen[clienteActivo.id] && (
                    <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 12, padding: "10px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{fmt(resumen[clienteActivo.id].deuda)}</div>
                      <div style={{ fontSize: 11, opacity: 0.85 }}>deuda total</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid #f1f3f5", padding: "0 24px" }}>
                {[
                  { key: "pendientes", label: `Pendientes${pendientesList.length ? ` (${pendientesList.length})` : ""}` },
                  { key: "historial", label: "Historial completo" },
                ].map((t: any) => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    padding: "14px 18px", border: "none", background: "none",
                    cursor: "pointer", fontSize: 14, fontWeight: 600,
                    color: tab === t.key ? "#1971c2" : "#868e96",
                    borderBottom: tab === t.key ? "2px solid #1971c2" : "2px solid transparent",
                    marginBottom: -1
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ padding: "20px 24px", maxHeight: 520, overflowY: "auto" }}>
                {cargandoVentas ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#868e96" }}>Cargando...</div>
                ) : (
                  <>
                    {/* Tab pendientes */}
                    {tab === "pendientes" && (
                      <>
                        {pendientesList.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 40, background: "#f8fff8", borderRadius: 12, border: "1px solid #b2f2bb" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                            <div style={{ fontWeight: 600, color: "#2f9e44" }}>Sin deudas pendientes</div>
                          </div>
                        ) : pendientesList.map(v => {
                          const progreso = v.total > 0 ? (v.totalPagado / v.total) * 100 : 0
                          return (
                            <div key={v.id} style={{
                              border: "1px solid #ffc078", borderRadius: 12,
                              padding: 18, marginBottom: 14,
                              background: "linear-gradient(135deg, #fffbf0, #fff9f0)"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                <div>
                                  <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>Factura #{v.nro_factura || v.id}</span>
<div style={{ fontSize: 12, color: "#374151", marginTop: 2 }}>
  {v.fecha ? fechaCorta(v.fecha) : ""}
</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 13, color: "#868e96" }}>Total: {fmt(v.total)}</div>
                                  <div style={{ background: "#e67700", color: "white", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 4 }}>
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
                                <div style={{ background: "#f1f3f5", borderRadius: 100, height: 6 }}>
                                  <div style={{
                                    width: `${progreso}%`, height: "100%",
                                    background: "linear-gradient(90deg, #f59f00, #e67700)",
                                    borderRadius: 100, transition: "width 0.4s"
                                  }} />
                                </div>
                              </div>

                              {/* Productos */}
                              <div style={{ marginBottom: 10 }}>
                                {v.detalle_ventas.map((d: any, i: number) => (
  <div key={i} style={{ fontSize: 12, color: "#1a1a2e", fontWeight: 500 }}>· {d.productos?.nombre} × {d.cantidad}</div>
))}
                              </div>

                              {/* Pagos previos */}
                              {v.pagos.length > 0 && (
                                <div style={{ background: "white", borderRadius: 8, padding: "10px 12px", marginBottom: 10, border: "1px solid #f1f3f5" }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#111827" }}>Pagos registrados:</div>
                                  {v.pagos.map((p: any, i: number) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: i < v.pagos.length - 1 ? "1px solid #f8f9fa" : "none" }}>
                                      <span>
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

                              <button
                                onClick={() => { setVentaPago(v); setMontoPago(String(v.saldo)); setNotaPago("") }}
                                style={{ width: "100%", background: "#2f9e44", color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                              >
                                + Registrar pago
                              </button>
                            </div>
                          )
                        })}
                      </>
                    )}

                    {/* Tab historial */}
                    {tab === "historial" && (
                      <>
                        {ventas.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 40, color: "#adb5bd" }}>Sin ventas registradas</div>
                        ) : ventas.map(v => {
                          const cobrada = v.estado === "cobrada" || v.saldo === 0
                          return (
                            <div key={v.id} style={{
                              border: `1px solid ${cobrada ? "#b2f2bb" : "#ffc078"}`,
                              borderRadius: 10, padding: 14, marginBottom: 10,
                              background: cobrada ? "#f8fff8" : "#fffbf0"
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <b style={{ color: "#111827" }}>Factura #{v.nro_factura || v.id}</b>
                                  <span style={{
                                    fontSize: 11, padding: "2px 8px", borderRadius: 10,
                                    background: cobrada ? "#d3f9d8" : "#ffd8a8",
                                    color: cobrada ? "#2f9e44" : "#e67700", fontWeight: 700
                                  }}>
                                    {cobrada ? "Saldada" : "Pendiente"}
                                  </span>
                                </div>
                                <b>{fmt(v.total)}</b>
                              </div>
                              {v.fecha && <div style={{ fontSize: 12, color: "#374151", marginTop: 4 }}>{fechaCorta(v.fecha)}</div>}
                              <div style={{ marginTop: 8 }}>
                                {v.detalle_ventas.map((d: any, i: number) => (
  <div key={i} style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>· {d.productos?.nombre} × {d.cantidad}</div>
))}
                              </div>
                              {v.pagos.length > 0 && (
                                <div style={{ marginTop: 10, borderTop: "1px solid #f1f3f5", paddingTop: 8 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#111827" }}>Pagos:</div>
                                  {v.pagos.map((p: any, i: number) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                                      <span style={{ color: "#1a1a2e" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#2f9e44" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#495057" }}> ({p.nota})</span> : ""}</span>
                                      <button onClick={() => imprimirRecibo(p, v)} style={{ background: "#e7f5ff", color: "#1971c2", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11 }}>
                                        Recibo
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal pago ── */}
      {ventaPago && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9000
        }}>
          <div style={{ background: "white", borderRadius: 18, width: "90%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(135deg, #2f9e44, #2b8a3e)", padding: "20px 24px", color: "white" }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Registrar Pago</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>Factura #{ventaPago.nro_factura || ventaPago.id}</div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", background: "#fff9f0", borderRadius: 10, padding: "12px 16px", marginBottom: 18, border: "1px solid #ffc078" }}>
                <div style={{ fontSize: 13, color: "#868e96" }}>
                  Total factura<br /><b style={{ fontSize: 16, color: "#1a1a2e" }}>{fmt(ventaPago.total)}</b>
                </div>
                <div style={{ fontSize: 13, color: "#868e96", textAlign: "right" }}>
                  Saldo pendiente<br /><b style={{ fontSize: 16, color: "#e67700" }}>{fmt(ventaPago.saldo)}</b>
                </div>
              </div>

              {/* Pagos rápidos */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#868e96", fontWeight: 600, marginBottom: 6 }}>Pago rápido:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = Math.round(ventaPago.saldo * pct / 100)
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
                    <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: montoInput >= ventaPago.saldo ? "#2f9e44" : "#e67700" }}>
                      {montoInput >= ventaPago.saldo
                        ? "✓ Salda la deuda completa"
                        : `Quedarán ${fmt(ventaPago.saldo - montoInput)} pendientes`}
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
                  onClick={() => { setVentaPago(null); setMontoPago(""); setNotaPago("") }}
                  style={{ flex: 1, padding: "11px 0", border: "1px solid #dee2e6", borderRadius: 10, background: "white", color: "#495057", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarPago}
                  disabled={guardando || !montoPago || montoInput <= 0}
                  style={{
                    flex: 2, padding: "11px 0", border: "none", borderRadius: 10,
                    background: guardando || !montoPago || montoInput <= 0 ? "#adb5bd" : "#2f9e44",
                    color: "white", fontSize: 14, fontWeight: 700,
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
    </div>
  )
}