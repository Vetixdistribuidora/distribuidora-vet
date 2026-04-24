"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function fmt(n: number) {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  const [ventaPago, setVentaPago] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [notaPago, setNotaPago] = useState("")
  const [guardando, setGuardando] = useState(false)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

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
      const { data: vv } = await supabase.from("ventas").select("id, total").eq("cliente_id", c.id).eq("estado", "cuenta_corriente")
      if (!vv?.length) return
      let deuda = 0; let pendientes = 0
      await Promise.all(vv.map(async (v) => {
        const { data: pp } = await supabase.from("pagos_cuenta_corriente").select("monto").eq("venta_id", v.id)
        const pagado = (pp || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        if (saldo > 0) { deuda += saldo; pendientes++ }
      }))
      if (deuda > 0) mapa[c.id] = { deuda, ventasPendientes: pendientes }
    }))
    setResumen(mapa)
  }

  async function seleccionarCliente(c: any) {
    setClienteActivo(c)
    setTab("pendientes")
    setCargandoVentas(true)
    await cargarVentas(c.id)
    setCargandoVentas(false)
  }

  async function cargarVentas(clienteId: number) {
    const { data: vv } = await supabase.from("ventas").select("id, total, estado, nro_factura, fecha").eq("cliente_id", clienteId).order("id", { ascending: false })
    if (!vv) { setVentas([]); return }
    const conDetalle = await Promise.all(vv.map(async (v) => {
      const { data: detalles } = await supabase.from("detalle_ventas").select("cantidad, precio, productos(nombre)").eq("venta_id", v.id)
      const { data: pagos } = await supabase.from("pagos_cuenta_corriente").select("id, monto, fecha, nota").eq("venta_id", v.id).order("fecha", { ascending: true })
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
      const saldo = Math.max(0, Number(v.total) - totalPagado)
      return { ...v, total: Number(v.total), detalle_ventas: detalles || [], pagos: pagos || [], totalPagado, saldo }
    }))
    setVentas(conDetalle)
  }

  async function registrarPago() {
    if (!ventaPago || !montoPago || Number(montoPago) <= 0) { mostrarToast("Ingresá un monto válido", "error"); return }
    const monto = Number(montoPago)
    if (monto > ventaPago.saldo) { mostrarToast("El monto supera el saldo pendiente", "error"); return }
    setGuardando(true)
    const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
      cliente_id: clienteActivo.id, venta_id: ventaPago.id, monto, nota: notaPago || null
    }])
    if (error) { mostrarToast("Error: " + error.message, "error"); setGuardando(false); return }
    if (monto >= ventaPago.saldo) {
      await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaPago.id)
    }
    mostrarToast("✅ Pago registrado", "ok")
    setVentaPago(null); setMontoPago(""); setNotaPago(""); setGuardando(false)
    await cargarVentas(clienteActivo.id)
    await calcularResumen(clientes)
  }

  function imprimirRecibo(pago: any, venta: any) {
    const logoUrl = window.location.origin + "/logo.png"
    const fecha = pago.fecha ? fechaCorta(pago.fecha) : new Date().toLocaleDateString("es-AR")
    const saldoAnterior = Number(venta.total) - (Number(venta.totalPagado) - Number(pago.monto))
    const saldoRestante = Math.max(0, saldoAnterior - Number(pago.monto))
    const html = `<!DOCTYPE html><html><head><style>@page{margin:20px;size:A5}body{font-family:Arial;padding:20px;box-sizing:border-box}.logo{height:80px}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1971c2;padding-bottom:12px;margin-bottom:16px}.titulo{font-size:22px;font-weight:bold;color:#1971c2}.sub{font-size:12px;color:#555}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}.pagado{background:#d3f9d8;border:1px solid #2f9e44;border-radius:6px;padding:10px;margin-top:14px;font-size:16px;font-weight:bold;text-align:center;color:#2f9e44}.saldo{background:#fff3cd;border:1px solid #e67700;border-radius:6px;padding:10px;margin-top:8px;font-size:13px;font-weight:bold;color:#e67700}.footer{margin-top:40px;font-size:11px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:10px}</style></head><body><div class="header"><img src="${logoUrl}" class="logo"/><div style="text-align:right"><div class="titulo">RECIBO DE PAGO</div><div class="sub">Fecha: ${fecha}</div></div></div><div class="row"><span><b>Cliente:</b></span><span>${clienteActivo.nombre} ${clienteActivo.apellido}</span></div><div class="row"><span><b>CUIT:</b></span><span>${clienteActivo.cuit || "-"}</span></div><div class="row"><span><b>Tel:</b></span><span>${clienteActivo.telefono || "-"}</span></div><div class="row"><span><b>Factura N°:</b></span><span>${venta.nro_factura || venta.id}</span></div><div class="row"><span><b>Total factura:</b></span><span>${fmt(venta.total)}</span></div><div class="row"><span><b>Saldo anterior:</b></span><span>${fmt(saldoAnterior)}</span></div>${pago.nota ? `<div class="row"><span><b>Nota:</b></span><span>${pago.nota}</span></div>` : ""}<div class="pagado">Monto pagado: ${fmt(Number(pago.monto))}</div><div class="saldo">${saldoRestante > 0 ? "Saldo restante: " + fmt(saldoRestante) : "✓ Factura saldada completamente"}</div><div class="footer">VETIX Distribuidora — Almirante Brown 620 — Tel: 2604518157</div></body></html>`
    const w = window.open("", "_blank")
    if (!w) { alert("Habilitá ventanas emergentes"); return }
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500)
  }

  const clientesFiltrados = clientes
    .filter(c => filtro === "todos" || resumen[c.id])
    .filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase()))
  const deudaTotal = Object.values(resumen).reduce((s, r) => s + r.deuda, 0)
  const pendientesList = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const montoInput = Number(montoPago)

  if (cargando) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <p style={{ color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>⏳ Cargando...</p>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "Deuda total", valor: fmt(deudaTotal), color: "#f87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.15)", icon: "💰" },
          { label: "Clientes deudores", valor: Object.keys(resumen).length, color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.15)", icon: "👥" },
          { label: "Total clientes", valor: clientes.length, color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", icon: "📋" },
        ].map((k, i) => (
          <div key={i} style={{
            background: "white", border: "1px solid #e2e8f0",
            borderRadius: 14, padding: "16px 20px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: k.color, borderRadius: "14px 0 0 14px" }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.valor}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Layout dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* Panel izquierdo */}
        <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
            <input placeholder="🔍 Buscar cliente..." value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {(["deudores", "todos"] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)} style={{
                  flex: 1, padding: "6px 0", borderRadius: 8, border: "none",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: filtro === f ? "#0f172a" : "#f1f5f9",
                  color: filtro === f ? "white" : "#6b7280"
                }}>
                  {f === "deudores" ? "Con deuda" : "Todos"}
                </button>
              ))}
            </div>
          </div>
          <div style={{ maxHeight: 560, overflowY: "auto" }}>
            {clientesFiltrados.length === 0 && (
              <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                Sin clientes {filtro === "deudores" ? "con deuda" : ""}
              </div>
            )}
            {clientesFiltrados.map(c => {
              const info = resumen[c.id]
              const activo = clienteActivo?.id === c.id
              return (
                <div key={c.id} onClick={() => seleccionarCliente(c)} style={{
                  padding: "12px 14px", cursor: "pointer",
                  borderBottom: "1px solid #f8fafc",
                  background: activo ? "#eff6ff" : "white",
                  borderLeft: activo ? "3px solid #3b82f6" : "3px solid transparent",
                  transition: "background 0.15s"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{c.nombre} {c.apellido}</div>
                      {c.telefono && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>📞 {c.telefono}</div>}
                    </div>
                    {info ? (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #fecaca" }}>
                          {fmt(info.deuda)}
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{info.ventasPendientes} fact.</div>
                      </div>
                    ) : (
                      <span style={{ background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, border: "1px solid #bbf7d0" }}>✓ Al día</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel derecho */}
        <div>
          {!clienteActivo ? (
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", padding: 60, textAlign: "center", color: "#9ca3af", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>Seleccioná un cliente</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>para ver su cuenta corriente</div>
            </div>
          ) : (
            <div style={{ background: "#0f172a", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", overflow: "hidden" }}>

              {/* Header cliente */}
              <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{clienteActivo.nombre} {clienteActivo.apellido}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {clienteActivo.cuit && <span>CUIT: {clienteActivo.cuit} · </span>}
                      {clienteActivo.telefono && <span>📞 {clienteActivo.telefono}</span>}
                      {clienteActivo.localidad && <span> · 📍 {clienteActivo.localidad}</span>}
                    </div>
                  </div>
                  {resumen[clienteActivo.id] && (
                    <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#f87171" }}>{fmt(resumen[clienteActivo.id].deuda)}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>deuda total</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", padding: "0 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {[
                  { key: "pendientes", label: `Pendientes${pendientesList.length ? ` (${pendientesList.length})` : ""}` },
                  { key: "historial", label: "Historial completo" },
                ].map((t: any) => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    padding: "14px 18px", border: "none", background: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    color: tab === t.key ? "#3b82f6" : "#6b7280",
                    borderBottom: tab === t.key ? "2px solid #3b82f6" : "2px solid transparent",
                    marginBottom: -1
                  }}>{t.label}</button>
                ))}
              </div>

              <div style={{ padding: "20px 24px", maxHeight: 520, overflowY: "auto" }}>
                {cargandoVentas ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Cargando...</div>
                ) : (
                  <>
                    {/* Tab pendientes */}
                    {tab === "pendientes" && (
                      <>
                        {pendientesList.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 40, background: "rgba(74,222,128,0.05)", borderRadius: 12, border: "1px solid rgba(74,222,128,0.15)" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                            <div style={{ fontWeight: 600, color: "#4ade80" }}>Sin deudas pendientes</div>
                          </div>
                        ) : pendientesList.map(v => {
                          const progreso = v.total > 0 ? (v.totalPagado / v.total) * 100 : 0
                          return (
                            <div key={v.id} style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                <div>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: "white" }}>#{v.nro_factura || v.id}</span>
                                  {v.fecha && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{fechaCorta(v.fecha)}</div>}
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: 11, color: "#6b7280" }}>Total: {fmt(v.total)}</div>
                                  <div style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginTop: 4, border: "1px solid rgba(251,191,36,0.3)" }}>
                                    Saldo: {fmt(v.saldo)}
                                  </div>
                                </div>
                              </div>
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>
                                  <span>Pagado: {fmt(v.totalPagado)}</span>
                                  <span>{Math.round(progreso)}%</span>
                                </div>
                                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 100, height: 5 }}>
                                  <div style={{ width: `${progreso}%`, height: "100%", background: "linear-gradient(90deg, #f59f00, #e67700)", borderRadius: 100, transition: "width 0.4s" }} />
                                </div>
                              </div>
                              {v.detalle_ventas.map((d: any, i: number) => (
                                <div key={i} style={{ fontSize: 12, color: "#9ca3af", marginBottom: 1 }}>· {d.productos?.nombre} × {d.cantidad}</div>
                              ))}
                              {v.pagos.length > 0 && (
                                <div style={{ marginTop: 10, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: "#9ca3af" }}>Pagos registrados:</div>
                                  {v.pagos.map((p: any, i: number) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "4px 0", borderBottom: i < v.pagos.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                                      <span style={{ color: "#d1d5db" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#6b7280" }}> ({p.nota})</span> : ""}</span>
                                      <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Recibo</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => { setVentaPago(v); setMontoPago(String(v.saldo)); setNotaPago("") }}
                                style={{ width: "100%", marginTop: 12, padding: "10px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 9, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
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
                          <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Sin ventas registradas</div>
                        ) : ventas.map(v => {
                          const cobrada = v.estado === "cobrada" || v.saldo === 0
                          return (
                            <div key={v.id} style={{
                              background: cobrada ? "rgba(74,222,128,0.04)" : "rgba(251,191,36,0.04)",
                              border: cobrada ? "1px solid rgba(74,222,128,0.12)" : "1px solid rgba(251,191,36,0.15)",
                              borderRadius: 10, padding: 14, marginBottom: 8
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <b style={{ color: "white", fontSize: 13 }}>#{v.nro_factura || v.id}</b>
                                  <span style={{
                                    background: cobrada ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
                                    color: cobrada ? "#4ade80" : "#fbbf24",
                                    fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700
                                  }}>{cobrada ? "Saldada" : "Pendiente"}</span>
                                </div>
                                <b style={{ color: "white", fontSize: 13 }}>{fmt(v.total)}</b>
                              </div>
                              {v.fecha && <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>{fechaCorta(v.fecha)}</div>}
                              {v.detalle_ventas.map((d: any, i: number) => (
                                <div key={i} style={{ fontSize: 12, color: "#9ca3af" }}>· {d.productos?.nombre} × {d.cantidad}</div>
                              ))}
                              {v.pagos.length > 0 && (
                                <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                                  {v.pagos.map((p: any, i: number) => (
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                                      <span style={{ color: "#9ca3af" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#6b7280" }}> ({p.nota})</span> : ""}</span>
                                      <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Recibo</button>
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

      {/* Modal pago */}
      {ventaPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => { setVentaPago(null); setMontoPago(""); setNotaPago("") }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>Registrar pago</h2>
            <p style={{ color: "#6b7280", fontSize: 12, marginBottom: 20 }}>Factura #{ventaPago.nro_factura || ventaPago.id}</p>
            <div style={{ display: "flex", justifyContent: "space-between", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div><div style={{ fontSize: 11, color: "#6b7280" }}>Total</div><div style={{ fontSize: 16, fontWeight: 800, color: "white" }}>{fmt(ventaPago.total)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: "#6b7280" }}>Saldo</div><div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{fmt(ventaPago.saldo)}</div></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[25, 50, 75, 100].map(pct => {
                const val = Math.round(ventaPago.saldo * pct / 100)
                return (
                  <button key={pct} onClick={() => setMontoPago(String(val))} style={{
                    flex: 1, padding: "7px 0", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                    background: montoInput === val ? "#3b82f6" : "rgba(255,255,255,0.05)",
                    color: montoInput === val ? "white" : "#9ca3af",
                    fontSize: 12, fontWeight: 600, cursor: "pointer"
                  }}>{pct}%</button>
                )
              })}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Monto</label>
              <input type="number" value={montoPago} onChange={e => setMontoPago(e.target.value)} style={inputDarkStyle} />
              {montoInput > 0 && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: montoInput >= ventaPago.saldo ? "#4ade80" : "#fbbf24" }}>
                  {montoInput >= ventaPago.saldo ? "✓ Salda la deuda completa" : `Quedarán ${fmt(ventaPago.saldo - montoInput)} pendientes`}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nota (opcional)</label>
              <input type="text" value={notaPago} onChange={e => setNotaPago(e.target.value)} placeholder="Ej: efectivo, transferencia..." style={inputDarkStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setVentaPago(null); setMontoPago(""); setNotaPago("") }} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={registrarPago} disabled={guardando || !montoPago || montoInput <= 0} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando || !montoPago || montoInput <= 0 ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}