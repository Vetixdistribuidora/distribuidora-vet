"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { imprimirReciboCobroMasivo } from "@/lib/impresion"
import { getSaldoCliente } from "@/lib/saldo"

function fmt(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

const responsiveStyles = `
  @media (max-width: 768px) {
    .deudores-header { flex-direction: column !important; gap: 8px !important; }
    .deudores-kpis { grid-template-columns: 1fr 1fr !important; }
    .deudor-card-top { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .deudor-monto-badge { align-self: flex-start !important; }
  }
`

export default function Deudores() {
  const [deudores, setDeudores] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

  // ── Modal cobro masivo ──────────────────────────────────────────────────────
  const [modalCobro, setModalCobro] = useState<any | null>(null)
  const [montoCobro, setMontoCobro] = useState("")
  const [metodoCobro, setMetodoCobro] = useState("efectivo")
  const [notaCobro, setNotaCobro] = useState("")
  const [procesando, setProcesando] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const [exitoCobro, setExitoCobro] = useState<string | null>(null)
  const [ultimoRecibo, setUltimoRecibo] = useState<{ totalCobrado: number; nroReciboBase: string; afectadas: any[]; cliente: any; nota?: string; saldoTotal?: number; creditoAplicado?: number } | null>(null)
  const [facturasSeleccionadas, setFacturasSeleccionadas] = useState<Set<number>>(new Set())
  // Saldo a favor del cliente (notas de crédito por devolución)
  const [usarSaldo, setUsarSaldo] = useState(false)

  // ── Modal nota de crédito / devolución ─────────────────────────────────────
  const [modalNC, setModalNC] = useState<any | null>(null)
  const [ncMonto, setNcMonto] = useState("")
  const [ncMotivo, setNcMotivo] = useState("")
  const [guardandoNC, setGuardandoNC] = useState(false)
  const [errorNC, setErrorNC] = useState<string | null>(null)

  useEffect(() => { cargarDeudores() }, [])

  async function cargarDeudores() {
    setCargando(true)
    try {
      const [{ data: ventas }, { data: creditos }] = await Promise.all([
        supabase
          .from("ventas")
          .select("id, total, nro_factura, fecha, cliente_id, clientes(nombre, apellido, telefono, localidad)")
          .eq("estado", "cuenta_corriente")
          .order("id", { ascending: true }),   // ascendente: más antigua primero
        supabase.from("saldo_clientes").select("cliente_id, monto"),
      ])
      if (!ventas) { setDeudores([]); return }
      // Crédito a favor por cliente (notas de crédito / devoluciones)
      const creditoPorCliente: Record<number, number> = {}
      ;(creditos || []).forEach((c: any) => {
        creditoPorCliente[c.cliente_id] = (creditoPorCliente[c.cliente_id] || 0) + Number(c.monto)
      })
      const ventaIds = ventas.map(v => v.id)
      const { data: todosPagos } = await supabase
        .from("pagos_cuenta_corriente").select("venta_id, monto").in("venta_id", ventaIds)
      const pagosPorVenta: Record<number, number> = {}
      ;(todosPagos || []).forEach((p: any) => {
        pagosPorVenta[p.venta_id] = (pagosPorVenta[p.venta_id] || 0) + Number(p.monto)
      })
      const conSaldo = ventas.map(v => {
        const pagado = pagosPorVenta[v.id] || 0
        const saldo = Number(v.total) - pagado
        return { ...v, saldo: saldo > 0 ? saldo : 0 }
      })
      const conDeuda = conSaldo.filter(v => v.saldo > 0)
      const mapaClientes: Record<number, any> = {}
      for (const v of conDeuda) {
        const cid = v.cliente_id
        if (!mapaClientes[cid]) {
          mapaClientes[cid] = {
            cliente_id: cid,
            nombre: (v.clientes as any)?.nombre || "",
            apellido: (v.clientes as any)?.apellido || "",
            telefono: (v.clientes as any)?.telefono || "",
            localidad: (v.clientes as any)?.localidad || "",
            totalDeuda: 0,
            creditoDisponible: creditoPorCliente[cid] || 0,
            facturas: []
          }
        }
        mapaClientes[cid].totalDeuda += v.saldo
        mapaClientes[cid].facturas.push(v)   // ya vienen ordenadas ASC por id
      }
      const lista = Object.values(mapaClientes).sort((a: any, b: any) => b.totalDeuda - a.totalDeuda)
      setDeudores(lista)
    } catch (e) {
      console.error("Error cargando deudores:", e)
    } finally {
      setCargando(false)
    }
  }

  // ── Nota de crédito / devolución ───────────────────────────────────────────
  function abrirNC(d: any) {
    setModalNC(d)
    setNcMonto("")
    setNcMotivo("")
    setErrorNC(null)
  }

  async function guardarNC() {
    if (!modalNC) return
    const monto = parseFloat(ncMonto.replace(",", ".")) || 0
    if (monto <= 0) { setErrorNC("Ingresá un monto válido."); return }
    setGuardandoNC(true)
    setErrorNC(null)
    try {
      const fechaTxt = new Date().toLocaleDateString("es-AR")
      const { error } = await supabase.from("saldo_clientes").insert({
        cliente_id: modalNC.cliente_id,
        monto: Math.round(monto * 100) / 100,
        notas: `Nota de crédito / devolución${ncMotivo.trim() ? " — " + ncMotivo.trim() : ""} (${fechaTxt})`,
      })
      if (error) throw error
      setModalNC(null)
      await cargarDeudores()
    } catch (e: any) {
      setErrorNC(e.message || "Error al guardar la nota de crédito.")
    } finally {
      setGuardandoNC(false)
    }
  }

  // ── Cobro masivo ────────────────────────────────────────────────────────────
  function abrirCobro(d: any) {
    setModalCobro(d)
    setMontoCobro("")
    setMetodoCobro("efectivo")
    setNotaCobro("")
    setErrorCobro(null)
    setExitoCobro(null)
    setFacturasSeleccionadas(new Set())
    setUsarSaldo(false)
  }

  function cerrarCobro() {
    setModalCobro(null)
    setMontoCobro("")
    setNotaCobro("")
    setErrorCobro(null)
    setExitoCobro(null)
    setUltimoRecibo(null)
    setFacturasSeleccionadas(new Set())
    setUsarSaldo(false)
  }

  // Efectivo a cobrar en modo selección = suma de facturas seleccionadas − crédito a favor (si se usa)
  function recomputarMontoCobro(sel: Set<number>, facturas: any[], usarCred: boolean) {
    if (sel.size === 0) { setMontoCobro(""); return }
    const suma = facturas.filter(f => sel.has(f.id)).reduce((s, f) => s + f.saldo, 0)
    const credito = usarCred ? (Number(modalCobro?.creditoDisponible) || 0) : 0
    setMontoCobro(String(Math.max(0, Math.round((suma - credito) * 100) / 100)))
  }

  function toggleSaldoCobro() {
    const nuevo = !usarSaldo
    setUsarSaldo(nuevo)
    setExitoCobro(null)
    if (facturasSeleccionadas.size > 0) {
      recomputarMontoCobro(facturasSeleccionadas, modalCobro?.facturas || [], nuevo)
    }
  }

  function toggleFactura(id: number, facturas: any[]) {
    setFacturasSeleccionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      recomputarMontoCobro(next, facturas, usarSaldo)
      setErrorCobro(null)
      return next
    })
  }

  function calcularPreviewSeleccionado(facturas: any[], seleccionadas: Set<number>) {
    return facturas.map(f => {
      if (!seleccionadas.has(f.id)) return { ...f, pago: 0, resultado: "sin_cambio" }
      return { ...f, pago: Math.round(f.saldo * 100) / 100, resultado: "pagado" }
    })
  }

  function calcularPreview(facturas: any[], monto: number) {
    if (monto <= 0) return []
    let restante = monto
    return facturas.map(f => {
      const saldo = Math.round(f.saldo * 100) / 100
      if (restante <= 0) return { ...f, pago: 0, resultado: "sin_cambio" }
      const pago = Math.min(restante, saldo)
      restante = Math.round((restante - pago) * 100) / 100
      return { ...f, pago: Math.round(pago * 100) / 100, resultado: pago >= saldo ? "pagado" : "parcial" }
    })
  }

  async function confirmarCobro() {
    if (!modalCobro) return
    const monto = parseFloat(montoCobro.replace(",", ".")) || 0
    const creditoDisp = usarSaldo ? (Number(modalCobro.creditoDisponible) || 0) : 0
    if (monto <= 0 && creditoDisp <= 0) { setErrorCobro("Ingresá un monto o usá el saldo a favor."); return }

    setProcesando(true)
    setErrorCobro(null)

    const preview = facturasSeleccionadas.size > 0
      ? calcularPreviewSeleccionado(modalCobro.facturas, facturasSeleccionadas)
      : calcularPreview(modalCobro.facturas, monto + creditoDisp)
    const afectadas = preview.filter((f: any) => f.pago > 0)

    try {
      // Generar número de recibo con secuencia atómica
      let nroReciboBase: string
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
        nroReciboBase = "001-" + String(nextNum).padStart(6, "0")
      } else {
        // nroData es bigint → formatear como "001-006520"
        nroReciboBase = "001-" + String(Number(nroData)).padStart(6, "0")
      }
      const baseNum = parseInt(nroReciboBase.replace(/^.*-/, ""), 10)
      let offsetRecibo = 0

      // Saldo de cuenta corriente actual (lo decrementamos a medida que aplicamos)
      const { data: ccIni } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", modalCobro.cliente_id).order("id", { ascending: false }).limit(1).maybeSingle()
      let saldoCC = Number(ccIni?.saldo ?? 0)

      let creditoRestante = creditoDisp
      let totalCash = 0, totalCredito = 0

      for (const f of afectadas) {
        const nroRecibo = "001-" + String(baseNum + offsetRecibo).padStart(6, "0")
        offsetRecibo++
        // Cubrir esta factura con el crédito (nota de crédito) primero, y el resto en efectivo
        const credUsado = Math.min(creditoRestante, f.pago)
        creditoRestante = Math.round((creditoRestante - credUsado) * 100) / 100
        const cashUsado = Math.round((f.pago - credUsado) * 100) / 100
        totalCredito = Math.round((totalCredito + credUsado) * 100) / 100
        totalCash = Math.round((totalCash + cashUsado) * 100) / 100
        const notaBase = [
          notaCobro.trim() || null,
          credUsado > 0 ? `Nota de crédito aplicada: ${fmt(credUsado)}` : null,
        ].filter(Boolean).join(" | ") || null

        if (credUsado > 0) {
          const { error: e1 } = await supabase.from("pagos_cuenta_corriente").insert([{
            cliente_id: modalCobro.cliente_id, venta_id: f.id, monto: credUsado,
            metodo_pago: "otro", nota: notaBase, nro_recibo: nroRecibo,
          }])
          if (e1) throw new Error("Error en factura N°" + (f.nro_factura || f.id) + ": " + e1.message)
          saldoCC = Math.max(0, Math.round((saldoCC - credUsado) * 100) / 100)
          // tipo "pago" porque cuentas_corrientes tiene constraint que solo permite 'venta'/'pago';
          // el detalle de que fue nota de crédito queda en pagos_cuenta_corriente (metodo_pago)
          await supabase.from("cuentas_corrientes").insert({ cliente_id: modalCobro.cliente_id, venta_id: f.id, tipo: "pago", monto: -credUsado, saldo: saldoCC, fecha: new Date() })
        }
        if (cashUsado > 0) {
          const { error: e2 } = await supabase.from("pagos_cuenta_corriente").insert([{
            cliente_id: modalCobro.cliente_id, venta_id: f.id, monto: cashUsado,
            metodo_pago: metodoCobro || null, nota: notaBase, nro_recibo: nroRecibo,
          }])
          if (e2) throw new Error("Error en factura N°" + (f.nro_factura || f.id) + ": " + e2.message)
          saldoCC = Math.max(0, Math.round((saldoCC - cashUsado) * 100) / 100)
          await supabase.from("cuentas_corrientes").insert({ cliente_id: modalCobro.cliente_id, venta_id: f.id, tipo: "pago", monto: -cashUsado, saldo: saldoCC, fecha: new Date() })
        }

        // Si queda saldada, marcar la venta como cobrada
        if (f.resultado === "pagado") {
          await supabase.from("ventas").update({ estado: "cobrada" }).eq("id", f.id)
        }
      }

      // Consumir el crédito usado de saldo_clientes (FIFO)
      if (totalCredito > 0.01) {
        const { data: registros } = await supabase.from("saldo_clientes")
          .select("id, monto").eq("cliente_id", modalCobro.cliente_id)
          .gt("monto", 0).order("fecha", { ascending: true })
        let aDescontar = totalCredito
        for (const reg of (registros || [])) {
          if (aDescontar <= 0.001) break
          if (reg.monto <= aDescontar + 0.001) {
            await supabase.from("saldo_clientes").delete().eq("id", reg.id)
            aDescontar -= reg.monto
          } else {
            await supabase.from("saldo_clientes").update({ monto: Math.round((reg.monto - aDescontar) * 100) / 100 }).eq("id", reg.id)
            aDescontar = 0
          }
        }
      }

      const totalCobrado = Math.round((totalCash + totalCredito) * 100) / 100
      const saldadas = afectadas.filter((f: any) => f.resultado === "pagado").length
      const parciales = afectadas.filter((f: any) => f.resultado === "parcial").length

      // Saldo total del cliente después de aplicar este cobro
      const saldoTotalCliente = await getSaldoCliente(modalCobro.cliente_id)

      // Guardar datos del recibo para poder reimprimir
      const datosRecibo = {
        totalCobrado,
        creditoAplicado: totalCredito,
        nroReciboBase,
        afectadas,
        cliente: { nombre: modalCobro.nombre, apellido: modalCobro.apellido, telefono: modalCobro.telefono },
        nota: notaCobro.trim() || undefined,
        saldoTotal: saldoTotalCliente,
      }
      setUltimoRecibo(datosRecibo)

      // Imprimir recibo automáticamente
      imprimirReciboCobroMasivo(
        totalCobrado,
        nroReciboBase,
        afectadas,
        { nombre: modalCobro.nombre, apellido: modalCobro.apellido, telefono: modalCobro.telefono },
        notaCobro.trim() || undefined,
        saldoTotalCliente,
        totalCredito
      )

      setExitoCobro(
        `✅ ${fmt(totalCobrado)} aplicado.` +
        (totalCredito > 0 ? ` Nota de crédito usada: ${fmt(totalCredito)}.` : "") +
        (saldadas > 0 ? ` ${saldadas} factura${saldadas !== 1 ? "s" : ""} saldada${saldadas !== 1 ? "s" : ""}.` : "") +
        (parciales > 0 ? ` ${parciales} parcial.` : "")
      )
      setMontoCobro("")
      setUsarSaldo(false)

      // Recargar lista completa — el useEffect([deudores]) maneja el cierre del modal
      await cargarDeudores()
    } catch (e: any) {
      setErrorCobro(e.message || "Error al registrar el cobro.")
    } finally {
      setProcesando(false)
    }
  }

  // Después de recargar deudores: actualizar datos del modal o cerrarlo si el cliente saldó todo
  useEffect(() => {
    if (!modalCobro) return
    const actualizado = deudores.find((d: any) => d.cliente_id === modalCobro.cliente_id)
    if (actualizado) {
      setModalCobro((prev: any) => prev ? { ...actualizado } : prev)
    } else {
      // Cliente ya no tiene deuda — cerrar automáticamente
      const t = setTimeout(cerrarCobro, 1800)
      return () => clearTimeout(t)
    }
  }, [deudores])

  const filtrados = deudores.filter(d =>
    (d.nombre + " " + d.apellido).toLowerCase().includes(busqueda.toLowerCase())
  )
  const totalGeneral = deudores.reduce((acc, d) => acc + d.totalDeuda, 0)
  const totalFacturas = deudores.reduce((acc, d) => acc + d.facturas.length, 0)

  function toggleExpandir(id: number) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (cargando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 14 }}>
      Cargando...
    </div>
  )

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* KPIs */}
      <div className="deudores-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: deudores.length === 0 ? "white" : "#0f172a", borderRadius: 14, padding: "18px 20px", border: deudores.length === 0 ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.08)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Clientes con deuda</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: deudores.length === 0 ? "#22c55e" : "#f87171" }}>{deudores.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{deudores.length === 0 ? "Sin deudores" : "activos"}</div>
        </div>
        <div style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Facturas pendientes</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f59e0b" }}>{totalFacturas}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>sin cobrar</div>
        </div>
        <div style={{ background: totalGeneral > 0 ? "#0f172a" : "white", borderRadius: 14, padding: "18px 20px", border: totalGeneral > 0 ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Total adeudado</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: totalGeneral > 0 ? "#f87171" : "#22c55e", lineHeight: 1.1 }}>{fmt(totalGeneral)}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>acumulado</div>
        </div>
      </div>

      {/* Buscador */}
      {deudores.length > 0 && (
        <input
          placeholder="🔍 Buscar por nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", marginBottom: 16, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      )}

      {deudores.length === 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>Sin deudores activos</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Todos los clientes están al día</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(d => {
            const expandido = expandidos.has(d.cliente_id)
            return (
              <div key={d.cliente_id} style={{
                background: "white", borderRadius: 14, border: "1px solid #fecaca",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden"
              }}>
                <div className="deudor-card-top" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #dc2626, #ef4444)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 800, color: "white"
                    }}>
                      {(d.nombre.charAt(0) + d.apellido.charAt(0)).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{d.nombre} {d.apellido}</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6b7280", marginTop: 2, alignItems: "center" }}>
                        {d.telefono && <span>📞 {d.telefono}</span>}
                        {d.localidad && <span>📍 {d.localidad}</span>}
                        <span>{d.facturas.length} factura{d.facturas.length !== 1 ? "s" : ""}</span>
                        {(d.creditoDisponible || 0) > 0 && (
                          <span style={{ background: "#dcfce7", color: "#16a34a", fontWeight: 700, padding: "1px 8px", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                            💚 Crédito: {fmt(d.creditoDisponible)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="deudor-monto-badge" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{
                      background: "#fef2f2", color: "#dc2626", fontSize: 14, fontWeight: 800,
                      padding: "6px 14px", borderRadius: 20, border: "1px solid #fecaca", whiteSpace: "nowrap"
                    }}>
                      {fmt(d.totalDeuda)}
                    </div>
                    <button
                      onClick={() => abrirCobro(d)}
                      style={{
                        background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "white",
                        border: "none", borderRadius: 8, padding: "7px 13px",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(34,197,94,0.3)", whiteSpace: "nowrap", flexShrink: 0
                      }}>
                      💰 Cobrar
                    </button>
                    <button
                      onClick={() => abrirNC(d)}
                      title="Registrar nota de crédito / devolución"
                      style={{
                        background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
                        borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        whiteSpace: "nowrap", flexShrink: 0
                      }}>
                      ↩️ NC
                    </button>
                    <button onClick={() => toggleExpandir(d.cliente_id)} style={{
                      background: "#f1f5f9", border: "none", borderRadius: 8,
                      padding: "6px 10px", cursor: "pointer", fontSize: 12, color: "#6b7280", flexShrink: 0
                    }}>
                      {expandido ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div style={{ borderTop: "1px solid #fef2f2", padding: "12px 20px 16px", background: "#fffbfb" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                      Facturas pendientes — de más antigua a más nueva
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {d.facturas.map((f: any) => (
                        <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #fee2e2", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#374151" }}>N° {f.nro_factura || f.id}</span>
                            {f.fecha && <span style={{ color: "#9ca3af", marginLeft: 10, fontSize: 11 }}>{new Date(f.fecha).toLocaleDateString("es-AR")}</span>}
                          </div>
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmt(f.saldo)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal cobro masivo ── */}
      {modalCobro && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={cerrarCobro}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 500,
            maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }} onClick={e => e.stopPropagation()}>

            {/* Título */}
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
              💰 Registrar cobro
            </h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
              {modalCobro.nombre} {modalCobro.apellido} · Deuda total:{" "}
              <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(modalCobro.totalDeuda)}</span>
            </p>

            {/* Éxito */}
            {exitoCobro && (
              <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ color: "#4ade80", fontSize: 13, padding: "10px 14px" }}>{exitoCobro}</div>
                {ultimoRecibo && (
                  <button
                    onClick={() => imprimirReciboCobroMasivo(ultimoRecibo.totalCobrado, ultimoRecibo.nroReciboBase, ultimoRecibo.afectadas, ultimoRecibo.cliente, ultimoRecibo.nota, ultimoRecibo.saldoTotal, ultimoRecibo.creditoAplicado)}
                    style={{ width: "100%", padding: "8px 14px", background: "rgba(34,197,94,0.15)", border: "none", borderTop: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" }}>
                    🖨️ Reimprimir recibo
                  </button>
                )}
              </div>
            )}

            {/* Saldo a favor / nota de crédito disponible */}
            {(modalCobro.creditoDisponible || 0) > 0 && (
              <div onClick={toggleSaldoCobro}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 16,
                  background: usarSaldo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
                  border: usarSaldo ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid", borderColor: usarSaldo ? "#22c55e" : "#4b5563",
                  background: usarSaldo ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {usarSaldo && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ color: "#4ade80", fontSize: 13, fontWeight: 700 }}>💚 Usar nota de crédito / saldo a favor: {fmt(modalCobro.creditoDisponible)}</div>
                  {usarSaldo && <div style={{ color: "#86efac", fontSize: 11, marginTop: 2 }}>
                    {facturasSeleccionadas.size > 0 ? "Cubre las facturas seleccionadas; el resto lo cobrás en efectivo" : "Se aplica al cobro automáticamente"}
                  </div>}
                </div>
              </div>
            )}

            {/* Inputs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Monto cobrado</label>
                <input
                  type="number" min="0" step="0.01"
                  value={montoCobro}
                  onChange={e => { setMontoCobro(e.target.value); setErrorCobro(null); setExitoCobro(null) }}
                  placeholder={`Máx: ${fmt(modalCobro.totalDeuda)}`}
                  style={inputDarkStyle}
                  autoFocus
                />
                {/* Atajos rápidos */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {[25, 50, 75, 100].map(pct => {
                    const val = Math.round(modalCobro.totalDeuda * pct / 100)
                    const activo = Math.abs((parseFloat(montoCobro) || 0) - val) < 1
                    return (
                      <button key={pct} onClick={() => setMontoCobro(String(val))} style={{
                        flex: 1, padding: "6px 0", borderRadius: 8,
                        border: activo ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
                        background: activo ? "#3b82f6" : "rgba(255,255,255,0.05)",
                        color: activo ? "white" : "#9ca3af",
                        fontSize: 11, fontWeight: 600, cursor: "pointer"
                      }}>{pct}%</button>
                    )
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Método de pago</label>
                <select value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)}
                  style={{ ...inputDarkStyle, cursor: "pointer", background: "#1e293b" }}>
                  <option value="efectivo" style={{ color: "#000" }}>Efectivo</option>
                  <option value="transferencia" style={{ color: "#000" }}>Transferencia</option>
                  <option value="cheque" style={{ color: "#000" }}>Cheque</option>
                  <option value="echeq" style={{ color: "#000" }}>E-Cheq</option>
                  <option value="tarjeta" style={{ color: "#000" }}>Tarjeta</option>
                  <option value="otro" style={{ color: "#000" }}>Otro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nota (opcional)</label>
                <input type="text" value={notaCobro} onChange={e => setNotaCobro(e.target.value)}
                  placeholder="Ej: transferencia mayo, banco Galicia..." style={inputDarkStyle} />
              </div>
            </div>

            {/* Preview facturas */}
            {modalCobro.facturas.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase" }}>
                    {facturasSeleccionadas.size > 0
                      ? `${facturasSeleccionadas.size} factura${facturasSeleccionadas.size !== 1 ? "s" : ""} seleccionada${facturasSeleccionadas.size !== 1 ? "s" : ""}`
                      : "Tocá las facturas a cobrar"}
                  </div>
                  {facturasSeleccionadas.size > 0 && (
                    <button onClick={() => { setFacturasSeleccionadas(new Set()); setMontoCobro("") }}
                      style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      Limpiar
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {(() => {
                    const monto = parseFloat(montoCobro.replace(",", ".")) || 0
                    const preview = facturasSeleccionadas.size > 0
                      ? calcularPreviewSeleccionado(modalCobro.facturas, facturasSeleccionadas)
                      : monto > 0
                        ? calcularPreview(modalCobro.facturas, monto)
                        : modalCobro.facturas.map((f: any) => ({ ...f, pago: 0, resultado: "sin_cambio" }))
                    const colorMap: Record<string, { bg: string; border: string; color: string; label: string }> = {
                      pagado:     { bg: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.35)",   color: "#4ade80", label: "✓ Saldada" },
                      parcial:    { bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.35)",  color: "#fbbf24", label: "~ Parcial" },
                      sin_cambio: { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.06)", color: "#6b7280", label: "" },
                    }
                    return preview.map((f: any) => {
                      const sel = facturasSeleccionadas.has(f.id)
                      const est = colorMap[f.resultado] ?? colorMap.sin_cambio
                      return (
                        <div key={f.id}
                          onClick={() => toggleFactura(f.id, modalCobro.facturas)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                            background: sel ? "rgba(59,130,246,0.18)" : est.bg,
                            border: `1px solid ${sel ? "rgba(59,130,246,0.5)" : est.border}`,
                            transition: "all 0.12s",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {/* Checkbox visual */}
                            <div style={{
                              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                              border: `2px solid ${sel ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
                              background: sel ? "#3b82f6" : "transparent",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {sel && <span style={{ color: "white", fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                            <div>
                              <div style={{ color: "white", fontSize: 12, fontWeight: 600 }}>
                                N° {f.nro_factura || f.id}
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 11, marginTop: 1 }}>
                                {f.fecha ? new Date(f.fecha).toLocaleDateString("es-AR") : ""} · Saldo: {fmt(f.saldo)}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {f.pago > 0 && <div style={{ color: est.color, fontWeight: 700, fontSize: 13 }}>−{fmt(f.pago)}</div>}
                            {est.label && <div style={{ color: est.color, fontSize: 10, fontWeight: 600 }}>{est.label}</div>}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>

                {/* Resumen */}
                {(() => {
                  const monto = parseFloat(montoCobro.replace(",", ".")) || 0
                  const creditoDisp = usarSaldo ? (Number(modalCobro.creditoDisponible) || 0) : 0
                  if (monto <= 0 && creditoDisp <= 0) return null
                  const seleccion = facturasSeleccionadas.size > 0
                  const preview = seleccion
                    ? calcularPreviewSeleccionado(modalCobro.facturas, facturasSeleccionadas)
                    : calcularPreview(modalCobro.facturas, monto + creditoDisp)
                  const totalAplicado = preview.reduce((s: number, f: any) => s + f.pago, 0)
                  const creditoUsado = Math.min(creditoDisp, totalAplicado)
                  const cashReal = Math.max(0, Math.round((totalAplicado - creditoUsado) * 100) / 100)
                  const excedente = seleccion ? 0 : Math.max(0, Math.round((monto + creditoDisp - totalAplicado) * 100) / 100)
                  const saldadas = preview.filter((f: any) => f.resultado === "pagado").length
                  const parciales = preview.filter((f: any) => f.resultado === "parcial").length
                  return (
                    <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", fontSize: 12 }}>
                      {facturasSeleccionadas.size === 0 && (
                        <div style={{ color: "#4b5563", fontSize: 11, marginBottom: 6, fontStyle: "italic" }}>
                          Distribución automática: de la más antigua a la más nueva
                        </div>
                      )}
                      {creditoUsado > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Nota de crédito / saldo a favor:</span>
                          <span style={{ color: "#4ade80", fontWeight: 700 }}>−{fmt(creditoUsado)}</span>
                        </div>
                      )}
                      {creditoUsado > 0.01 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Cobrás en efectivo:</span>
                          <span style={{ color: "white", fontWeight: 700 }}>{fmt(cashReal)}</span>
                        </div>
                      )}
                      {saldadas > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Facturas a saldar:</span>
                          <span style={{ color: "#4ade80", fontWeight: 700 }}>{saldadas}</span>
                        </div>
                      )}
                      {parciales > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: 4 }}>
                          <span>Facturas parciales:</span>
                          <span style={{ color: "#fbbf24", fontWeight: 700 }}>{parciales}</span>
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af", marginBottom: excedente > 0 ? 4 : 0 }}>
                        <span>Total aplicado:</span>
                        <span style={{ color: "white", fontWeight: 700 }}>{fmt(totalAplicado)}</span>
                      </div>
                      {excedente > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#9ca3af" }}>
                          <span>Excedente (supera la deuda):</span>
                          <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(excedente)}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}

            {errorCobro && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                ⚠️ {errorCobro}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={cerrarCobro} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cerrar</button>
              <button
                onClick={confirmarCobro}
                disabled={procesando || ((parseFloat(montoCobro.replace(",", ".")) || 0) <= 0 && !(usarSaldo && (modalCobro.creditoDisponible || 0) > 0))}
                style={{
                  flex: 2, padding: "11px",
                  background: "linear-gradient(135deg, #16a34a, #22c55e)",
                  border: "none", borderRadius: 10, color: "white",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: procesando || ((parseFloat(montoCobro.replace(",", ".")) || 0) <= 0 && !(usarSaldo && (modalCobro.creditoDisponible || 0) > 0)) ? 0.5 : 1,
                }}>
                {procesando ? "Registrando..." : "Confirmar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal nota de crédito / devolución ── */}
      {modalNC && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalNC(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>↩️ Nota de crédito / devolución</h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>{modalNC.nombre} {modalNC.apellido}</p>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Monto de la devolución *</label>
              <input type="number" min="0" step="0.01" value={ncMonto}
                onChange={e => { setNcMonto(e.target.value); setErrorNC(null) }}
                placeholder="Ej: 50000" style={inputDarkStyle} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Motivo (opcional)</label>
              <input type="text" value={ncMotivo} onChange={e => setNcMotivo(e.target.value)}
                placeholder="Ej: devolución mercadería" style={inputDarkStyle} />
            </div>

            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#86efac" }}>
              💡 Se guarda como <b>crédito a favor</b> del cliente. Después lo aplicás a las facturas que elijas desde el botón 💰 Cobrar.
            </div>

            {errorNC && (
              <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 13, padding: "10px 14px", borderRadius: 8, marginBottom: 16 }}>
                ⚠️ {errorNC}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalNC(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarNC} disabled={guardandoNC || (parseFloat(ncMonto) || 0) <= 0} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardandoNC || (parseFloat(ncMonto) || 0) <= 0 ? 0.5 : 1 }}>
                {guardandoNC ? "Guardando..." : "Registrar nota de crédito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
