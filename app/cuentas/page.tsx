"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { imprimirReciboCC } from "@/lib/impresion"
import { getSaldoCliente } from "@/lib/saldo"

function fmt(n: number) {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fechaCorta(f: string) {
  if (!f) return "-"
  const d = f.includes("T") ? new Date(f) : new Date(f + "T00:00:00")
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
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
  const [cargando, setCargando] = useState(false)
  const [cargandoVentas, setCargandoVentas] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<"deudores" | "todos">("deudores")
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes")
  const [toast, setToast] = useState<any>(null)
  const [vistaMovil, setVistaMovil] = useState<"lista" | "detalle">("lista")

  const [ventaPago, setVentaPago] = useState<any>(null)
  const [montoPago, setMontoPago] = useState("")
  const [metodoPago, setMetodoPago] = useState("efectivo")
  const [notaPago, setNotaPago] = useState("")
  const [descuentoPago, setDescuentoPago] = useState("")
  const [guardando, setGuardando] = useState(false)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { inicializar() }, [])

  async function inicializar() {
    setCargando(true)
    try {
      const { data } = await supabase.from("clientes").select("*").order("nombre")
      const lista = data || []
      setClientes(lista)
      await calcularResumen(lista)
    } catch (e) {
      console.error("Error cargando cuentas:", e)
    } finally {
      setCargando(false)
    }
  }

  async function calcularResumen(lista: any[]) {
    const mapa: Record<number, { deuda: number; ventasPendientes: number }> = {}
    const clienteIds = lista.map(c => c.id)
    if (!clienteIds.length) { setResumen({}); return }
    const { data: todasVentas } = await supabase
      .from("ventas").select("id, total, cliente_id")
      .in("cliente_id", clienteIds).eq("estado", "cuenta_corriente")
    if (!todasVentas?.length) { setResumen({}); return }
    const ventaIds = todasVentas.map(v => v.id)
    const { data: todosPagos } = await supabase
      .from("pagos_cuenta_corriente").select("venta_id, monto").in("venta_id", ventaIds)
    const pagosPorVenta: Record<number, number> = {}
    ;(todosPagos || []).forEach((p: any) => {
      pagosPorVenta[p.venta_id] = (pagosPorVenta[p.venta_id] || 0) + Number(p.monto)
    })
    for (const v of todasVentas) {
      const pagado = pagosPorVenta[v.id] || 0
      const saldo = Number(v.total) - pagado
      if (saldo > 0) {
        if (!mapa[v.cliente_id]) mapa[v.cliente_id] = { deuda: 0, ventasPendientes: 0 }
        mapa[v.cliente_id].deuda += saldo
        mapa[v.cliente_id].ventasPendientes++
      }
    }
    setResumen(mapa)
  }

  async function seleccionarCliente(c: any) {
    setClienteActivo(c)
    setTab("pendientes")
    setCargandoVentas(true)
    setVistaMovil("detalle")
    try {
      await cargarVentas(c.id)
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setCargandoVentas(false)
    }
  }

  async function cargarVentas(clienteId: number) {
    const { data: vv } = await supabase.from("ventas").select("id, total, estado, nro_factura, fecha").eq("cliente_id", clienteId).order("id", { ascending: false })
    if (!vv) { setVentas([]); return }
    const ventaIds = vv.map(v => v.id)
    // Two-step: no FK declarada entre detalle_ventas y productos
    const [{ data: detallesRaw }, { data: todosPagos }] = await Promise.all([
      supabase.from("detalle_ventas").select("venta_id, producto_id, cantidad, precio").in("venta_id", ventaIds),
      supabase.from("pagos_cuenta_corriente").select("id, venta_id, monto, fecha, nota, nro_recibo").in("venta_id", ventaIds).order("fecha", { ascending: true })
    ])
    // Resolver nombres de productos en un solo query
    const prodIds = [...new Set((detallesRaw || []).map((d: any) => d.producto_id))]
    const { data: prodsData } = prodIds.length
      ? await supabase.from("productos").select("id, nombre").in("id", prodIds)
      : { data: [] }
    const prodsMap: Record<number, string> = {}
    ;(prodsData || []).forEach((p: any) => { prodsMap[p.id] = p.nombre })
    const todosDetalles = (detallesRaw || []).map((d: any) => ({
      ...d, productos: { nombre: prodsMap[d.producto_id] || "" }
    }))
    const detallesPorVenta: Record<number, any[]> = {}
    todosDetalles.forEach((d: any) => {
      if (!detallesPorVenta[d.venta_id]) detallesPorVenta[d.venta_id] = []
      detallesPorVenta[d.venta_id].push(d)
    })
    const pagosPorVenta: Record<number, any[]> = {}
    ;(todosPagos || []).forEach((p: any) => {
      if (!pagosPorVenta[p.venta_id]) pagosPorVenta[p.venta_id] = []
      pagosPorVenta[p.venta_id].push(p)
    })
    const conDetalle = vv.map(v => {
      const detalles = detallesPorVenta[v.id] || []
      const pagos = pagosPorVenta[v.id] || []
      const totalPagado = pagos.reduce((s: number, p: any) => s + Number(p.monto), 0)
      const saldo = Math.max(0, Number(v.total) - totalPagado)
      return { ...v, total: Number(v.total), detalle_ventas: detalles, pagos, totalPagado, saldo }
    })
    setVentas(conDetalle)
  }

  async function registrarPago() {
    if (!ventaPago) { mostrarToast("Seleccioná una factura", "error"); return }
    const monto = Number(montoPago) || 0
    const pctDesc = Number(descuentoPago) || 0
    // El descuento perdona parte del saldo (reduce el total de la factura)
    const montoDesc = pctDesc > 0 ? Math.round(ventaPago.saldo * (pctDesc / 100) * 100) / 100 : 0
    const saldoPagable = Math.round((ventaPago.saldo - montoDesc) * 100) / 100  // a pagar tras descuento
    const totalCubre = Math.round((monto + montoDesc) * 100) / 100  // cuánto de la deuda se cancela
    if (totalCubre <= 0) { mostrarToast("Ingresá un monto o descuento válido", "error"); return }
    if (monto > saldoPagable + 0.01) { mostrarToast("El monto supera el saldo pendiente (con descuento)", "error"); return }
    setGuardando(true)
    try {
      // Generar número de recibo con secuencia atómica
      let nroRecibo: string
      const { data: nroData, error: nroError } = await supabase.rpc('get_next_nro_recibo')
      if (nroError || !nroData) {
        // Fallback
        const { data: ultimoRecibo } = await supabase
          .from("pagos_cuenta_corriente").select("nro_recibo")
          .not("nro_recibo", "is", null)
          .order("id", { ascending: false }).limit(1).maybeSingle()
        let nextNum = 6520
        if (ultimoRecibo?.nro_recibo) {
          const m = ultimoRecibo.nro_recibo.match(/(\d+)$/)
          if (m) nextNum = parseInt(m[1], 10) + 1
        }
        nroRecibo = "001-" + String(nextNum).padStart(6, "0")
      } else {
        // nroData es bigint → formatear como "001-006520"
        nroRecibo = "001-" + String(Number(nroData)).padStart(6, "0")
      }

      // Si hay descuento → reducir el total de la factura (perdona parte de la deuda)
      if (montoDesc > 0) {
        const nuevoTotalVenta = Math.max(0, Number(ventaPago.total) - montoDesc)
        await supabase.from("ventas").update({ total: nuevoTotalVenta }).eq("id", ventaPago.id)
      }

      const notaFinal = [
        notaPago || null,
        montoDesc > 0 ? `Descuento ${pctDesc}% aplicado: ${fmt(montoDesc)}` : null,
      ].filter(Boolean).join(" | ") || null

      // Registrar el pago en plata (solo si hubo monto en efectivo)
      if (monto > 0) {
        const { error } = await supabase.from("pagos_cuenta_corriente").insert([{
          cliente_id: clienteActivo.id, venta_id: ventaPago.id, monto, metodo_pago: metodoPago || null, nota: notaFinal, nro_recibo: nroRecibo
        }])
        if (error) { mostrarToast("Error: " + error.message, "error"); return }
      }
      // Registrar movimientos en cuentas_corrientes para mantener el saldo sincronizado
      const { data: ultimoCC } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", clienteActivo.id).order("id", { ascending: false }).limit(1).maybeSingle()
      let saldoCC = Number(ultimoCC?.saldo ?? 0)
      if (montoDesc > 0) {
        saldoCC = Math.max(0, saldoCC - montoDesc)
        await supabase.from("cuentas_corrientes").insert({ cliente_id: clienteActivo.id, venta_id: ventaPago.id, tipo: "descuento", monto: -montoDesc, saldo: saldoCC, fecha: new Date() })
      }
      if (monto > 0) {
        saldoCC = Math.max(0, saldoCC - monto)
        await supabase.from("cuentas_corrientes").insert({ cliente_id: clienteActivo.id, venta_id: ventaPago.id, tipo: "pago", monto: -monto, saldo: saldoCC, fecha: new Date() })
      }
      if (totalCubre >= ventaPago.saldo - 0.01) {
        await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", ventaPago.id)
      }
      mostrarToast("✅ Pago registrado — Recibo " + nroRecibo, "ok")
      // Imprimir recibo automáticamente (solo si hubo pago en efectivo)
      if (monto > 0) {
        const saldoTotalCliente = await getSaldoCliente(clienteActivo.id)
        imprimirReciboCC(
          { monto, nota: notaFinal, nro_recibo: nroRecibo, fecha: new Date().toISOString() },
          ventaPago,
          clienteActivo,
          ventaPago.saldo,
          saldoTotalCliente
        )
      }
      setVentaPago(null); setMontoPago(""); setNotaPago(""); setMetodoPago("efectivo"); setDescuentoPago("")
      await cargarVentas(clienteActivo.id)
      await calcularResumen(clientes)
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setGuardando(false)
    }
  }

  async function imprimirRecibo(pago: any, venta: any) {
    const saldoAnterior = Number(venta.total) - (Number(venta.totalPagado) - Number(pago.monto))
    const saldoTotalCliente = clienteActivo ? await getSaldoCliente(clienteActivo.id) : 0
    imprimirReciboCC(pago, venta, clienteActivo, saldoAnterior, saldoTotalCliente)
  }

  const clientesFiltrados = clientes
    .filter(c => filtro === "todos" || resumen[c.id])
    .filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busqueda.toLowerCase()))
  const deudaTotal = Object.values(resumen).reduce((s, r) => s + r.deuda, 0)
  const pendientesList = ventas.filter(v => v.estado === "cuenta_corriente" && v.saldo > 0)
  const montoInput = Number(montoPago)
  const pctDescInput = Number(descuentoPago) || 0
  const montoDescInput = ventaPago && pctDescInput > 0 ? Math.round(ventaPago.saldo * (pctDescInput / 100) * 100) / 100 : 0
  const saldoPagableInput = ventaPago ? Math.round((ventaPago.saldo - montoDescInput) * 100) / 100 : 0

  if (cargando) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
      <p style={{ color: "#9ca3af", fontFamily: "DM Sans, sans-serif" }}>⏳ Cargando...</p>
    </div>
  )

  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Deuda total", valor: fmt(deudaTotal), color: "#f87171", icon: "💰" },
          { label: "Clientes deudores", valor: Object.keys(resumen).length, color: "#fbbf24", icon: "👥" },
          { label: "Total clientes", valor: clientes.length, color: "#3b82f6", icon: "📋" },
        ].map((k, i) => (
          <div key={i} style={{
            background: "white", border: "1px solid #e2e8f0",
            borderRadius: 14, padding: "14px 16px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: k.color, borderRadius: "14px 0 0 14px" }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.valor}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Layout: en mobile muestra solo una columna a la vez */}
      <style>{`
        @media (max-width: 768px) {
          .cc-layout { grid-template-columns: 1fr !important; }
          .cc-panel-lista { display: ${vistaMovil === "lista" ? "block" : "none"} !important; }
          .cc-panel-detalle { display: ${vistaMovil === "detalle" ? "block" : "none"} !important; }
        }
      `}</style>

      <div className="cc-layout" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

        {/* Panel izquierdo — lista clientes */}
        <div className="cc-panel-lista" style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
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
        <div className="cc-panel-detalle">
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Botón volver — solo mobile */}
                    <button onClick={() => setVistaMovil("lista")}
                      style={{ display: "none", background: "rgba(255,255,255,0.08)", border: "none", color: "#9ca3af", borderRadius: 7, padding: "4px 10px", fontSize: 11, cursor: "pointer", marginBottom: 10 }}
                      className="cc-btn-volver">
                      ← Volver
                    </button>
                    <style>{`@media (max-width: 768px) { .cc-btn-volver { display: inline-block !important; } }`}</style>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{clienteActivo.nombre} {clienteActivo.apellido}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, flexWrap: "wrap", display: "flex", gap: 8 }}>
                      {clienteActivo.cuit && <span>CUIT: {clienteActivo.cuit}</span>}
                      {clienteActivo.telefono && <span>📞 {clienteActivo.telefono}</span>}
                      {clienteActivo.localidad && <span>📍 {clienteActivo.localidad}</span>}
                    </div>
                  </div>
                  {resumen[clienteActivo.id] && (
                    <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
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
                  { key: "historial", label: "Historial" },
                ].map((t: any) => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    padding: "14px 16px", border: "none", background: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    color: tab === t.key ? "#3b82f6" : "#6b7280",
                    borderBottom: tab === t.key ? "2px solid #3b82f6" : "2px solid transparent",
                    marginBottom: -1, whiteSpace: "nowrap"
                  }}>{t.label}</button>
                ))}
              </div>

              <div style={{ padding: "20px 24px", maxHeight: 520, overflowY: "auto" }}>
                {cargandoVentas ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Cargando...</div>
                ) : (
                  <>
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
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
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
                                      <span style={{ color: "#d1d5db", flex: 1, minWidth: 0 }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#6b7280" }}> ({p.nota})</span> : ""}</span>
                                      <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>Recibo</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button onClick={() => { setVentaPago(v); setMontoPago(String(v.saldo)); setNotaPago(""); setDescuentoPago("") }}
                                style={{ width: "100%", marginTop: 12, padding: "10px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 9, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                + Registrar pago
                              </button>
                            </div>
                          )
                        })}
                      </>
                    )}

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
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
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
                                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "3px 0", flexWrap: "wrap", gap: 4 }}>
                                      <span style={{ color: "#9ca3af" }}>{fechaCorta(p.fecha)} — <b style={{ color: "#4ade80" }}>{fmt(p.monto)}</b>{p.nota ? <span style={{ color: "#6b7280" }}> ({p.nota})</span> : ""}</span>
                                      <button onClick={() => imprimirRecibo(p, v)} style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "none", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Recibo</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Fallback: cobrada sin registros de pago (ventas anteriores al sistema de recibos) */}
                              {cobrada && v.pagos.length === 0 && (
                                <button onClick={() => imprimirRecibo(
                                  { monto: v.total, nota: null, nro_recibo: undefined, fecha: v.fecha },
                                  { ...v, totalPagado: v.total }
                                )} style={{ marginTop: 8, background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                                  🖨️ Recibo
                                </button>
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
          onClick={() => { setVentaPago(null); setMontoPago(""); setNotaPago(""); setDescuentoPago("") }}>
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
                const val = Math.round(saldoPagableInput * pct / 100)
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
              {(montoInput + montoDescInput) > 0 && (
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: (montoInput + montoDescInput) >= ventaPago.saldo - 0.01 ? "#4ade80" : "#fbbf24" }}>
                  {(montoInput + montoDescInput) >= ventaPago.saldo - 0.01 ? "✓ Salda la deuda completa" : `Quedarán ${fmt(ventaPago.saldo - montoInput - montoDescInput)} pendientes`}
                </div>
              )}
            </div>

            {/* Descuento por pronto pago */}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Descuento (opcional)</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="number" min="0" max="100" step="0.01" value={descuentoPago}
                  onChange={e => setDescuentoPago(e.target.value)}
                  placeholder="0" style={{ ...inputDarkStyle, width: 90, textAlign: "center" }} />
                <span style={{ color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>%</span>
                {montoDescInput > 0 && (
                  <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 600 }}>
                    − {fmt(montoDescInput)} · a pagar {fmt(saldoPagableInput)}
                  </span>
                )}
              </div>
              {montoDescInput > 0 && (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  El descuento reduce la deuda del cliente. Con {fmt(saldoPagableInput)} la factura queda saldada.
                </div>
              )}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ ...inputDarkStyle, cursor: "pointer", background: "#1e293b" }}>
                <option value="efectivo" style={{ color: "#000" }}>Efectivo</option>
                <option value="transferencia" style={{ color: "#000" }}>Transferencia</option>
                <option value="cheque" style={{ color: "#000" }}>Cheque</option>
                <option value="echeq" style={{ color: "#000" }}>E-Cheq</option>
                <option value="tarjeta" style={{ color: "#000" }}>Tarjeta</option>
                <option value="otro" style={{ color: "#000" }}>Otro</option>
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Nota (opcional)</label>
              <input type="text" value={notaPago} onChange={e => setNotaPago(e.target.value)} placeholder="Ej: transferencia mayo, banco Galicia..." style={inputDarkStyle} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setVentaPago(null); setMontoPago(""); setNotaPago(""); setMetodoPago("efectivo"); setDescuentoPago("") }} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={registrarPago} disabled={guardando || (montoInput <= 0 && montoDescInput <= 0)} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardando || (montoInput <= 0 && montoDescInput <= 0) ? 0.5 : 1 }}>
                {guardando ? "Guardando..." : "Confirmar pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}