"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ── Helpers ────────────────────────────────────────────────────────────────
function fmt(num: number) {
  return "$" + Math.round(num).toLocaleString("es-AR")
}
function fmtFecha(f: string | null | undefined): string {
  if (!f) return ""
  const d = f.includes("T") ? new Date(f) : new Date(f + "T00:00:00")
  return d.toLocaleDateString("es-AR")
}
function fechaOrden(f: string | null | undefined): number {
  if (!f) return 0
  const d = f.includes("T") ? new Date(f) : new Date(f + "T00:00:00")
  return d.getTime()
}

// Métodos de pago (ingresos) ─────────────────────────────────────────────────
const METODOS: Record<string, { label: string; icon: string; color: string }> = {
  efectivo:       { label: "Efectivo",       icon: "💵", color: "#16a34a" },
  transferencia:  { label: "Transferencia",  icon: "🏦", color: "#2563eb" },
  cheque:         { label: "Cheque",         icon: "🧾", color: "#7c3aed" },
  echeq:          { label: "E-Cheq",         icon: "📲", color: "#0891b2" },
  tarjeta:        { label: "Tarjeta",        icon: "💳", color: "#ea580c" },
  otro:           { label: "Otro",           icon: "➕", color: "#64748b" },
  sin_especificar:{ label: "Sin especificar",icon: "❔", color: "#94a3b8" },
}
const ORDEN_METODOS = ["efectivo", "transferencia", "cheque", "echeq", "tarjeta", "otro", "sin_especificar"]

// Categorías de egreso ───────────────────────────────────────────────────────
const CAT_EGRESO: Record<string, { label: string; icon: string; color: string; auto?: boolean }> = {
  proveedores:         { label: "Proveedores",        icon: "🚚", color: "#f59e0b", auto: true },
  retiro:              { label: "Retiros",            icon: "🏧", color: "#ef4444" },
  flete:               { label: "Fletes",             icon: "🚛", color: "#d97706" },
  gasto_distribuidora: { label: "Gasto Distribuidora",icon: "🏢", color: "#0ea5e9" },
  gasto_casa:          { label: "Gasto Casa",         icon: "🏠", color: "#a855f7" },
  gasto_camioneta:     { label: "Gasto Camioneta",    icon: "🚐", color: "#14b8a6" },
  otro_egreso:         { label: "Otros egresos",      icon: "📤", color: "#64748b" },
}
const ORDEN_CAT_EGRESO = ["proveedores", "retiro", "flete", "gasto_distribuidora", "gasto_casa", "gasto_camioneta", "otro_egreso"]

// Metadata de una categoría de egreso — si es custom (escrita por el usuario) usa un default
const metaCatEgreso = (k: string) => CAT_EGRESO[k] || { label: k, icon: "📝", color: "#64748b" }

// Categorías de ingreso manual
const CAT_INGRESO: Record<string, { label: string; icon: string }> = {
  otro_ingreso: { label: "Otro ingreso", icon: "📥" },
}

// Inferir método desde la nota libre (cobros viejos sin metodo_pago estructurado)
function inferirMetodo(nota: string | null | undefined): string | null {
  if (!nota) return null
  const t = nota.toLowerCase()
  if (t.includes("e-cheq") || t.includes("echeq") || t.includes("e cheq")) return "echeq"
  if (t.includes("transf")) return "transferencia"
  if (t.includes("efect") || t.includes("efvo") || t.includes("efe ")) return "efectivo"
  if (t.includes("cheq")) return "cheque"
  if (t.includes("tarj")) return "tarjeta"
  return null
}
function normMetodo(m: string | null | undefined): string {
  if (!m) return "sin_especificar"
  const k = m.toLowerCase().trim()
  return METODOS[k] ? k : "otro"
}

// Tipos de fila de la planilla
type FilaCaja = {
  id: string
  fecha: string | null
  detalle: string
  categoriaKey: string   // método (ingresos) o categoría de egreso
  grupoLabel: string
  metodo: string         // método normalizado (para ingresos)
  ingreso: number
  egreso: number
  origen: "venta" | "cobro_cc" | "compra" | "manual"
  editable: boolean
  raw?: any
}

const inputDark: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "white",
  fontSize: 14, outline: "none", boxSizing: "border-box",
}
// Los <select> van con fondo claro y texto oscuro para que se lean bien
// (sobre el modal oscuro un select oscuro queda ilegible).
const selectClaro: React.CSSProperties = {
  width: "100%", padding: "10px 12px", background: "#ffffff",
  border: "1px solid #cbd5e1", borderRadius: 10, color: "#0f172a",
  fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box", cursor: "pointer",
}

// Bloques separados del detalle (cada uno es como una planilla aparte)
const BLOQUES: { key: string; label: string; icon: string; color: string; modo: "ingreso" | "egreso" }[] = [
  { key: "ingresos",            label: "Ingresos",             icon: "💵", color: "#16a34a", modo: "ingreso" },
  { key: "proveedores",         label: "Pagos a proveedores",  icon: "🚚", color: "#f59e0b", modo: "egreso" },
  { key: "gasto_distribuidora", label: "Gastos Distribuidora", icon: "🏢", color: "#0ea5e9", modo: "egreso" },
  { key: "gasto_casa",          label: "Gastos Casa",          icon: "🏠", color: "#a855f7", modo: "egreso" },
  { key: "gasto_camioneta",     label: "Gastos Camioneta",     icon: "🚐", color: "#14b8a6", modo: "egreso" },
  { key: "retiro",              label: "Retiros",              icon: "🏧", color: "#ef4444", modo: "egreso" },
  { key: "flete",               label: "Fletes",               icon: "🚛", color: "#d97706", modo: "egreso" },
  { key: "otro_egreso",         label: "Otros egresos",        icon: "📤", color: "#64748b", modo: "egreso" },
]

export default function CajaPage() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth()) // 0-indexed

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [saldoInicial, setSaldoInicial] = useState(0)
  const [mesInicial, setMesInicial] = useState<string>(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`)
  const [configId, setConfigId] = useState<number | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Obtiene el id de la organización del usuario. Lo mandamos explícito en los
  // INSERT para que la política RLS (organizacion_id = get_my_org_id()) siempre
  // se cumpla, sin depender de que el trigger tg_set_org_id esté instalado.
  async function obtenerOrgId(): Promise<string | null> {
    if (orgId) return orgId
    const { data } = await supabase.from("organizaciones").select("id").maybeSingle()
    const id = (data as any)?.id ?? null
    setOrgId(id)
    return id
  }

  const [apertura, setApertura] = useState(0)
  const [filas, setFilas] = useState<FilaCaja[]>([])
  const [ingresosPorMetodo, setIngresosPorMetodo] = useState<Record<string, { total: number; ventas: number; cc: number; manual: number }>>({})
  const [egresosPorCat, setEgresosPorCat] = useState<Record<string, number>>({})

  // Modales
  const [modalMov, setModalMov] = useState<null | "nuevo" | "editar">(null)
  const [movForm, setMovForm] = useState<any>({ id: null, tipo: "egreso", categoria: "retiro", categoriaTexto: "Retiros", metodo_pago: "efectivo", monto: "", fecha: "", descripcion: "" })
  const [guardandoMov, setGuardandoMov] = useState(false)
  const [confirmDel, setConfirmDel] = useState<any>(null)

  const [modalSaldo, setModalSaldo] = useState(false)
  const [saldoForm, setSaldoForm] = useState({ saldo_inicial: "", mes_inicial: "" })
  const [guardandoSaldo, setGuardandoSaldo] = useState(false)

  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "error" } | null>(null)
  function mostrarToast(msg: string, tipo: "ok" | "error" = "ok") {
    setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000)
  }

  const ingresosMes = Object.values(ingresosPorMetodo).reduce((s, m) => s + m.total, 0)
  const egresosMes = Object.values(egresosPorCat).reduce((s, v) => s + v, 0)
  const netoMes = ingresosMes - egresosMes
  const cierre = apertura + netoMes

  // ── Carga principal ───────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // 1. Config (saldo inicial)
      const { data: cfg } = await supabase.from("caja_config").select("*").order("id", { ascending: true }).limit(1).maybeSingle()
      let sInicial = 0
      let mInicial = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
      if (cfg) {
        sInicial = Number(cfg.saldo_inicial) || 0
        mInicial = cfg.mes_inicial || mInicial
        setConfigId(cfg.id)
      } else {
        setConfigId(null)
      }
      setSaldoInicial(sInicial)
      setMesInicial(mInicial)

      // ── Rangos de fecha ──
      const selStart = new Date(anio, mes, 1)
      const selEnd = new Date(anio, mes + 1, 1)
      const [iniY, iniM] = mInicial.split("-").map(Number)
      const iniStart = new Date(iniY, (iniM || 1) - 1, 1)
      // Cubrimos desde el más temprano entre arranque y mes visto, hasta fin del mes visto
      const fetchStart = iniStart < selStart ? iniStart : selStart
      const fetchEnd = selEnd

      const dStr = (d: Date) => d.toLocaleDateString("sv-SE")        // 'YYYY-MM-DD' local
      const uStr = (d: Date) => d.toISOString()                       // UTC para timestamptz
      const fStartDate = dStr(fetchStart), fEndDate = dStr(fetchEnd)
      const fStartUTC = uStr(fetchStart),  fEndUTC = uStr(fetchEnd)
      const selStartMs = selStart.getTime()

      // 2. Fuentes (en paralelo)
      const [ventasRes, pagosRes, comprasPagosRes, movsRes] = await Promise.all([
        // Ventas DIRECTAS cobradas (metodo_cobro NO null = no es cuenta corriente)
        supabase.from("ventas")
          .select("id, total, metodo_cobro, fecha, nro_factura, clientes(nombre, apellido)")
          .eq("estado", "cobrada").not("metodo_cobro", "is", null)
          .gte("fecha", fStartUTC).lt("fecha", fEndUTC).range(0, 99999),
        // Pagos de cuenta corriente (luego filtramos los que correspondan a ventas CC)
        supabase.from("pagos_cuenta_corriente")
          .select("id, venta_id, monto, fecha, metodo_pago, nota, nro_recibo")
          .gte("fecha", fStartUTC).lt("fecha", fEndUTC).range(0, 99999),
        // Pagos a proveedores
        supabase.from("compras_pagos")
          .select("id, compra_id, monto, metodo_pago, fecha, notas")
          .gte("fecha", fStartDate).lt("fecha", fEndDate).range(0, 99999),
        // Movimientos manuales
        supabase.from("movimientos_caja")
          .select("*")
          .gte("fecha", fStartDate).lt("fecha", fEndDate).range(0, 99999),
      ])

      if (ventasRes.error) throw ventasRes.error
      if (pagosRes.error) throw pagosRes.error
      if (comprasPagosRes.error) throw comprasPagosRes.error
      if (movsRes.error) throw movsRes.error

      const ventas = ventasRes.data || []
      const pagos = pagosRes.data || []
      const comprasPagos = comprasPagosRes.data || []
      const movs = movsRes.data || []

      // 2b. Para los pagos: traer info de su venta (metodo_cobro + cliente) → quedarnos con los CC
      const ventaIds = [...new Set(pagos.map((p: any) => p.venta_id).filter((x: any) => x != null))]
      const ventasInfo: Record<number, any> = {}
      if (ventaIds.length) {
        const { data: vInfo } = await supabase.from("ventas")
          .select("id, metodo_cobro, nro_factura, clientes(nombre, apellido)")
          .in("id", ventaIds)
        ;(vInfo || []).forEach((v: any) => { ventasInfo[v.id] = v })
      }
      // Cobros CC reales = pagos cuya venta tiene metodo_cobro NULL (era cuenta corriente)
      const cobrosCC = pagos.filter((p: any) => {
        const v = ventasInfo[p.venta_id]
        return v && (v.metodo_cobro == null)
      })

      // 2c. Para pagos a proveedores: nombre de proveedor (vía compra)
      const compraIds = [...new Set(comprasPagos.map((p: any) => p.compra_id).filter((x: any) => x != null))]
      const proveedorPorCompra: Record<number, string> = {}
      if (compraIds.length) {
        const { data: cInfo } = await supabase.from("compras")
          .select("id, numero_remito, proveedores(nombre)").in("id", compraIds)
        ;(cInfo || []).forEach((c: any) => {
          proveedorPorCompra[c.id] = c.proveedores?.nombre || (c.numero_remito ? "Remito " + c.numero_remito : "Proveedor")
        })
      }

      // ── Construir filas + acumular ──
      const filasMes: FilaCaja[] = []
      let previoNeto = 0  // neto de meses anteriores (desde mes_inicial hasta el mes visto)
      const ingMet: Record<string, { total: number; ventas: number; cc: number; manual: number }> = {}
      const egCat: Record<string, number> = {}
      const addIng = (metodo: string, monto: number, src: "ventas" | "cc" | "manual") => {
        if (!ingMet[metodo]) ingMet[metodo] = { total: 0, ventas: 0, cc: 0, manual: 0 }
        ingMet[metodo].total += monto; ingMet[metodo][src] += monto
      }
      const enMesVisto = (f: string | null | undefined) => {
        if (!f) return false
        const t = fechaOrden(f)
        return t >= selStartMs && t < selEnd.getTime()
      }
      const enPrevio = (f: string | null | undefined) => {
        if (!f) return false
        const t = fechaOrden(f)
        return t >= iniStart.getTime() && t < selStartMs
      }

      // Ventas directas
      for (const v of ventas) {
        const metodo = normMetodo(v.metodo_cobro)
        const monto = Number(v.total) || 0
        if (enMesVisto(v.fecha)) {
          addIng(metodo, monto, "ventas")
          const cli = (v as any).clientes
          filasMes.push({
            id: "v-" + v.id, fecha: v.fecha, detalle: `Venta N° ${v.nro_factura}${cli ? " · " + (cli.nombre || "") + " " + (cli.apellido || "") : ""}`.trim(),
            categoriaKey: metodo, grupoLabel: "Venta directa", metodo, ingreso: monto, egreso: 0,
            origen: "venta", editable: false,
          })
        } else if (enPrevio(v.fecha)) {
          previoNeto += monto
        }
      }
      // Cobros de cuenta corriente
      for (const p of cobrosCC) {
        const metodo = normMetodo(p.metodo_pago || inferirMetodo(p.nota))
        const monto = Number(p.monto) || 0
        if (enMesVisto(p.fecha)) {
          addIng(metodo, monto, "cc")
          const v = ventasInfo[p.venta_id]
          const cli = v?.clientes
          filasMes.push({
            id: "p-" + p.id, fecha: p.fecha,
            detalle: `Cobro CC${cli ? " · " + (cli.nombre || "") + " " + (cli.apellido || "") : ""}${p.nro_recibo ? " · Rec " + p.nro_recibo : ""}`.trim(),
            categoriaKey: metodo, grupoLabel: "Cobro cuenta corriente", metodo, ingreso: monto, egreso: 0,
            origen: "cobro_cc", editable: false,
          })
        } else if (enPrevio(p.fecha)) {
          previoNeto += monto
        }
      }
      // Pagos a proveedores (egreso)
      for (const cp of comprasPagos) {
        const monto = Number(cp.monto) || 0
        if (enMesVisto(cp.fecha)) {
          egCat["proveedores"] = (egCat["proveedores"] || 0) + monto
          filasMes.push({
            id: "cp-" + cp.id, fecha: cp.fecha,
            detalle: `Pago a ${proveedorPorCompra[cp.compra_id] || "proveedor"}${cp.notas ? " · " + cp.notas : ""}`,
            categoriaKey: "proveedores", grupoLabel: "Pago a proveedor", metodo: normMetodo(cp.metodo_pago),
            ingreso: 0, egreso: monto, origen: "compra", editable: false,
          })
        } else if (enPrevio(cp.fecha)) {
          previoNeto -= monto
        }
      }
      // Movimientos manuales
      for (const m of movs) {
        const monto = Number(m.monto) || 0
        const esIngreso = m.tipo === "ingreso"
        if (enMesVisto(m.fecha)) {
          if (esIngreso) {
            addIng(normMetodo(m.metodo_pago), monto, "manual")
          } else {
            egCat[m.categoria] = (egCat[m.categoria] || 0) + monto
          }
          const catLabel = esIngreso
            ? (CAT_INGRESO[m.categoria]?.label || "Ingreso manual")
            : metaCatEgreso(m.categoria).label
          filasMes.push({
            id: "m-" + m.id, fecha: m.fecha,
            detalle: m.descripcion || catLabel,
            categoriaKey: esIngreso ? normMetodo(m.metodo_pago) : m.categoria,
            grupoLabel: catLabel,
            metodo: normMetodo(m.metodo_pago),
            ingreso: esIngreso ? monto : 0, egreso: esIngreso ? 0 : monto,
            origen: "manual", editable: true, raw: m,
          })
        } else if (enPrevio(m.fecha)) {
          previoNeto += esIngreso ? monto : -monto
        }
      }

      // Ordenar planilla por fecha asc
      filasMes.sort((a, b) => fechaOrden(a.fecha) - fechaOrden(b.fecha))

      setApertura(sInicial + previoNeto)
      setIngresosPorMetodo(ingMet)
      setEgresosPorCat(egCat)
      setFilas(filasMes)
    } catch (e: any) {
      console.error("Error cargando caja:", e)
      setError("Error al cargar la caja: " + (e?.message || "desconocido"))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes])

  useEffect(() => { cargar() }, [cargar])

  // ── Navegación de mes ──
  function cambiarMes(delta: number) {
    const d = new Date(anio, mes + delta, 1)
    setAnio(d.getFullYear()); setMes(d.getMonth())
  }
  const mesLabel = new Date(anio, mes, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" })
  const mesInputValue = `${anio}-${String(mes + 1).padStart(2, "0")}`

  // ── Guardar movimiento manual ──
  function abrirNuevoMov() {
    setMovForm({
      id: null, tipo: "egreso", categoria: "retiro", categoriaTexto: "Retiros", metodo_pago: "efectivo", monto: "",
      fecha: new Date(anio, mes, Math.min(hoy.getDate(), 28)).toLocaleDateString("sv-SE"),
      descripcion: "",
    })
    setModalMov("nuevo")
  }
  function abrirEditarMov(m: any) {
    setMovForm({
      id: m.id, tipo: m.tipo, categoria: m.categoria, metodo_pago: m.metodo_pago || "efectivo",
      // Para egresos, el combobox muestra la etiqueta de la categoría (o el nombre custom)
      categoriaTexto: m.tipo === "egreso" ? metaCatEgreso(m.categoria).label : "",
      monto: String(m.monto), fecha: m.fecha, descripcion: m.descripcion || "",
    })
    setModalMov("editar")
  }
  async function guardarMov() {
    const monto = parseFloat(String(movForm.monto).replace(",", ".")) || 0
    if (monto <= 0) { mostrarToast("Ingresá un monto válido", "error"); return }
    if (!movForm.fecha) { mostrarToast("Elegí una fecha", "error"); return }
    setGuardandoMov(true)
    try {
      // Para egresos: resolver la categoría escrita o elegida en el combobox.
      let categoriaFinal = movForm.categoria
      let descripcionFinal = (movForm.descripcion || "").trim()
      if (movForm.tipo === "egreso") {
        const txt = (movForm.categoriaTexto || "").trim()
        const conocida = ORDEN_CAT_EGRESO.find(k => k !== "proveedores" && CAT_EGRESO[k].label.toLowerCase() === txt.toLowerCase())
        if (conocida) {
          categoriaFinal = conocida
        } else if (txt) {
          // Egreso nuevo escrito por el usuario → categoría propia con ese nombre
          categoriaFinal = txt
        } else {
          categoriaFinal = "otro_egreso"
        }
      }
      const payload = {
        fecha: movForm.fecha, tipo: movForm.tipo, categoria: categoriaFinal,
        metodo_pago: movForm.metodo_pago || null, monto, descripcion: descripcionFinal || null,
      }
      if (movForm.id) {
        const { error } = await supabase.from("movimientos_caja").update(payload).eq("id", movForm.id)
        if (error) throw error
        mostrarToast("✅ Movimiento actualizado")
      } else {
        const oid = await obtenerOrgId()
        const { error } = await supabase.from("movimientos_caja").insert({ ...payload, organizacion_id: oid })
        if (error) throw error
        mostrarToast("✅ Movimiento agregado")
      }
      setModalMov(null)
      await cargar()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "desconocido"), "error")
    } finally {
      setGuardandoMov(false)
    }
  }
  async function eliminarMov() {
    if (!confirmDel) return
    setGuardandoMov(true)
    try {
      const { error } = await supabase.from("movimientos_caja").delete().eq("id", confirmDel.id)
      if (error) throw error
      mostrarToast("🗑️ Movimiento eliminado")
      setConfirmDel(null)
      await cargar()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "desconocido"), "error")
    } finally {
      setGuardandoMov(false)
    }
  }

  // ── Guardar saldo inicial ──
  function abrirSaldo() {
    // Arranca vacío si es 0 (que no moleste); si ya hay saldo, lo muestra con puntos de miles.
    setSaldoForm({ saldo_inicial: saldoInicial ? saldoInicial.toLocaleString("es-AR") : "", mes_inicial: mesInicial })
    setModalSaldo(true)
  }
  async function guardarSaldo() {
    // Quitar puntos de miles y normalizar coma decimal antes de parsear
    const s = Number(String(saldoForm.saldo_inicial).replace(/\./g, "").replace(",", ".")) || 0
    if (!saldoForm.mes_inicial) { mostrarToast("Elegí el mes de arranque", "error"); return }
    setGuardandoSaldo(true)
    try {
      const oid = await obtenerOrgId()
      if (!oid) throw new Error("No se pudo identificar tu organización. Recargá la página e intentá de nuevo.")
      // Buscar la fila de config existente (RLS solo ve la de tu organización) y
      // actualizar por id, o insertar si no hay. Sin ON CONFLICT (no depende de un
      // índice único en la base).
      const { data: existente } = await supabase.from("caja_config").select("id").limit(1).maybeSingle()
      if (existente?.id) {
        const { data, error } = await supabase.from("caja_config")
          .update({ saldo_inicial: s, mes_inicial: saldoForm.mes_inicial, updated_at: new Date().toISOString() })
          .eq("id", existente.id).select().maybeSingle()
        if (error) throw error
        if (!data) throw new Error("No se pudo actualizar (revisá permisos / conexión).")
        setConfigId(data.id)
      } else {
        const { data, error } = await supabase.from("caja_config")
          .insert({ saldo_inicial: s, mes_inicial: saldoForm.mes_inicial, organizacion_id: oid })
          .select().maybeSingle()
        if (error) throw error
        if (!data) throw new Error("No se pudo guardar (revisá permisos / conexión).")
        setConfigId(data.id)
      }
      mostrarToast("✅ Saldo inicial guardado")
      setModalSaldo(false)
      await cargar()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "desconocido"), "error")
    } finally {
      setGuardandoSaldo(false)
    }
  }

  // ── Exportar Excel ──
  async function exportar() {
    const XLSX = await import("xlsx")
    const datos = filas.map(f => ({
      "Fecha": fmtFecha(f.fecha),
      "Detalle": f.detalle,
      "Concepto": f.grupoLabel,
      "Método": METODOS[f.metodo]?.label || "",
      "Ingreso": f.ingreso || "",
      "Egreso": f.egreso || "",
    }))
    datos.push({ "Fecha": "", "Detalle": "SALDO APERTURA", "Concepto": "", "Método": "", "Ingreso": apertura, "Egreso": "" as any })
    datos.push({ "Fecha": "", "Detalle": "TOTAL INGRESOS", "Concepto": "", "Método": "", "Ingreso": ingresosMes, "Egreso": "" as any })
    datos.push({ "Fecha": "", "Detalle": "TOTAL EGRESOS", "Concepto": "", "Método": "", "Ingreso": "" as any, "Egreso": egresosMes })
    datos.push({ "Fecha": "", "Detalle": "SALDO FINAL", "Concepto": "", "Método": "", "Ingreso": cierre, "Egreso": "" as any })
    const ws = XLSX.utils.json_to_sheet(datos)
    ws["!cols"] = [{ wch: 12 }, { wch: 40 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Caja")
    XLSX.writeFile(wb, `caja_${mesInputValue}.xlsx`)
  }

  // ── Agrupar movimientos en bloques separados (cada uno = una planilla) ──
  const filasPorBloque: Record<string, FilaCaja[]> = {}
  for (const f of filas) {
    const bk = f.ingreso > 0 ? "ingresos" : f.categoriaKey
    if (!filasPorBloque[bk]) filasPorBloque[bk] = []
    filasPorBloque[bk].push(f)
  }
  // Bloques a renderizar = los fijos + las categorías de egreso custom que aparezcan
  const bloquesCustom = Object.keys(filasPorBloque)
    .filter(k => k !== "ingresos" && !BLOQUES.some(b => b.key === k))
    .map(k => { const m = metaCatEgreso(k); return { key: k, label: m.label, icon: m.icon, color: m.color, modo: "egreso" as const } })
  const bloquesRender = [...BLOQUES, ...bloquesCustom]

  // ── Render ─────────────────────────────────────────────────────────────────
  const cardBase: React.CSSProperties = {
    background: "white", borderRadius: 16, padding: "18px 20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
  }

  return (
    <div>
      <style>{`
        @media (max-width: 768px) {
          .caja-cards { grid-template-columns: 1fr 1fr !important; }
          .caja-paneles { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 76, right: 20, zIndex: 200,
          background: toast.tipo === "ok" ? "#16a34a" : "#dc2626", color: "white",
          padding: "12px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>{toast.msg}</div>
      )}

      {/* ── Barra superior: mes + acciones ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 160, alignItems: "center" }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", textTransform: "capitalize" }}>{mesLabel}</span>
            <input type="month" value={mesInputValue}
              onChange={e => { const [y, m] = e.target.value.split("-").map(Number); if (y && m) { setAnio(y); setMes(m - 1) } }}
              style={{ marginTop: 4, fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 6px", color: "#64748b", cursor: "pointer" }} />
          </div>
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={abrirSaldo} style={btnSec}>⚙️ Saldo inicial</button>
          <button onClick={exportar} style={btnSec}>📊 Excel</button>
          <button onClick={abrirNuevoMov} style={btnPri}>+ Agregar movimiento</button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardBase, borderColor: "#fecaca", background: "#fef2f2", marginBottom: 16 }}>
          <p style={{ color: "#dc2626", fontWeight: 700, margin: 0 }}>{error}</p>
          <button onClick={cargar} style={{ ...btnPri, marginTop: 10 }}>Reintentar</button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Cargando caja...</p>
      ) : (
      <>
      {/* ── Cards de saldo ── */}
      <div className="caja-cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 22 }}>
        <SaldoCard titulo="Saldo de apertura" valor={apertura} sub="Arrastre del mes anterior" color="#6366f1" icon="📥" />
        <SaldoCard titulo="Ingresos del mes" valor={ingresosMes} sub="Plata que entró" color="#16a34a" icon="💵" />
        <SaldoCard titulo="Egresos del mes" valor={egresosMes} sub="Plata que salió" color="#ef4444" icon="📤" />
        <SaldoCard titulo="Saldo final" valor={cierre} sub="Pasa al mes siguiente" color={cierre >= 0 ? "#0ea5e9" : "#ef4444"} icon="🏦" destacado />
      </div>

      {/* ── Paneles ingresos / egresos ── */}
      <div className="caja-paneles" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        {/* Ingresos por método */}
        <div style={cardBase}>
          <h3 style={panelTitle}>💵 Ingresos por método</h3>
          {ingresosMes === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Sin ingresos este mes.</p>
          ) : ORDEN_METODOS.filter(k => ingresosPorMetodo[k]?.total).map(k => {
            const m = ingresosPorMetodo[k]
            const meta = METODOS[k]
            const partes: string[] = []
            if (m.ventas) partes.push("Ventas " + fmt(m.ventas))
            if (m.cc) partes.push("Cobros CC " + fmt(m.cc))
            if (m.manual) partes.push("Manual " + fmt(m.manual))
            return (
              <div key={k} style={lineaPanel}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{meta.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{partes.join(" · ")}</div>
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: meta.color, flexShrink: 0 }}>{fmt(m.total)}</span>
              </div>
            )
          })}
          <div style={totalPanel}>
            <span style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>Total ingresos</span>
            <span style={{ color: "#16a34a", fontWeight: 800, fontSize: 17 }}>{fmt(ingresosMes)}</span>
          </div>
        </div>

        {/* Egresos por categoría */}
        <div style={cardBase}>
          <h3 style={panelTitle}>📤 Egresos por categoría</h3>
          {egresosMes === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>Sin egresos este mes.</p>
          ) : [
            ...ORDEN_CAT_EGRESO.filter(k => egresosPorCat[k]),
            ...Object.keys(egresosPorCat).filter(k => egresosPorCat[k] && !ORDEN_CAT_EGRESO.includes(k)),
          ].map(k => {
            const meta = metaCatEgreso(k)
            return (
              <div key={k} style={lineaPanel}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                    {meta.label}{meta.auto && <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6, fontWeight: 600 }}>AUTO</span>}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{fmt(egresosPorCat[k])}</span>
              </div>
            )
          })}
          <div style={totalPanel}>
            <span style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>Total egresos</span>
            <span style={{ color: "#ef4444", fontWeight: 800, fontSize: 17 }}>{fmt(egresosMes)}</span>
          </div>
        </div>
      </div>

      {/* ── Detalle separado por planilla ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ ...panelTitle, margin: 0 }}>📋 Detalle del mes — por planilla</h3>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{filas.length} movimiento{filas.length !== 1 ? "s" : ""}</span>
      </div>
      {filas.length === 0 ? (
        <div style={{ ...cardBase, textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 30 }}>Sin movimientos en este mes.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bloquesRender.map(b => {
            const rows = filasPorBloque[b.key]
            if (!rows || rows.length === 0) return null
            const subtotal = rows.reduce((s, r) => s + (b.modo === "ingreso" ? r.ingreso : r.egreso), 0)
            return (
              <div key={b.key} style={{ ...cardBase, padding: 0, overflow: "hidden", borderLeft: `4px solid ${b.color}` }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{b.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{b.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{rows.length} movimiento{rows.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 800, color: b.color, whiteSpace: "nowrap" }}>
                    {b.modo === "ingreso" ? "+ " : "− "}{fmt(subtotal)}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Fecha", "Detalle", "Método", "Monto"].map((h, i) => (
                          <th key={h} style={{ textAlign: i === 3 ? "right" : "left", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(f => (
                        <tr key={f.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{fmtFecha(f.fecha)}</td>
                          <td style={{ padding: "8px 14px", fontSize: 13, color: "#0f172a", maxWidth: 320 }}>{f.detalle}</td>
                          <td style={{ padding: "8px 14px", fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>{METODOS[f.metodo]?.label || ""}</td>
                          <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: b.modo === "ingreso" ? "#16a34a" : "#ef4444", whiteSpace: "nowrap" }}>{fmt(b.modo === "ingreso" ? f.ingreso : f.egreso)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            {f.editable && (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => abrirEditarMov(f.raw)} title="Editar" style={iconBtn}>✏️</button>
                                <button onClick={() => setConfirmDel(f.raw)} title="Eliminar" style={iconBtn}>🗑️</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mesInputValue < mesInicial && (
        <p style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
          ℹ️ Este mes es anterior al mes de arranque configurado ({mesInicial}). El saldo de apertura muestra el saldo inicial.
        </p>
      )}
      </>
      )}

      {/* ── Modal movimiento manual ── */}
      {modalMov && (
        <ModalShell onClose={() => setModalMov(null)} titulo={modalMov === "nuevo" ? "Nuevo movimiento" : "Editar movimiento"}>
          {/* Tipo */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["egreso", "Egreso", "#ef4444"], ["ingreso", "Ingreso", "#16a34a"]].map(([val, lab, col]) => (
              <button key={val} onClick={() => setMovForm((p: any) => ({ ...p, tipo: val, categoria: val === "ingreso" ? "otro_ingreso" : "retiro", categoriaTexto: val === "egreso" ? "Retiros" : "" }))}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: movForm.tipo === val ? `2px solid ${col}` : "1px solid rgba(255,255,255,0.15)", background: movForm.tipo === val ? `${col}22` : "rgba(255,255,255,0.04)", color: movForm.tipo === val ? "white" : "#9ca3af", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {lab}
              </button>
            ))}
          </div>
          {movForm.tipo === "egreso" && (
            <Campo label="Categoría (elegí una o escribí una nueva)">
              {/* Categorías existentes (fijas + las custom ya usadas) — tocá una para elegirla */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {[
                  ...ORDEN_CAT_EGRESO.filter(k => k !== "proveedores"),
                  ...Object.keys(egresosPorCat).filter(k => egresosPorCat[k] && !ORDEN_CAT_EGRESO.includes(k)),
                ].map(k => {
                  const meta = metaCatEgreso(k)
                  const activa = (movForm.categoriaTexto || "").trim().toLowerCase() === meta.label.toLowerCase()
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMovForm((p: any) => ({ ...p, categoriaTexto: meta.label }))}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 10px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        border: activa ? `2px solid ${meta.color}` : "1px solid rgba(255,255,255,0.15)",
                        background: activa ? `${meta.color}22` : "rgba(255,255,255,0.04)",
                        color: activa ? "white" : "#cbd5e1",
                      }}>
                      <span>{meta.icon}</span> {meta.label}
                    </button>
                  )
                })}
              </div>
              <input
                value={movForm.categoriaTexto ?? ""}
                onChange={e => setMovForm((p: any) => ({ ...p, categoriaTexto: e.target.value }))}
                placeholder="…o escribí una nueva (ej: Internet, Alquiler, Sueldos)"
                style={inputDark}
                autoComplete="off"
              />
            </Campo>
          )}
          {movForm.tipo === "ingreso" && (
            <Campo label="Nombre del ingreso">
              <input type="text" value={movForm.descripcion} onChange={e => setMovForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: aporte de socio, venta de rezago, reintegro..." style={inputDark} />
            </Campo>
          )}
          <Campo label="Método de pago">
            <select value={movForm.metodo_pago} onChange={e => setMovForm((p: any) => ({ ...p, metodo_pago: e.target.value }))} style={selectClaro}>
              {ORDEN_METODOS.filter(k => k !== "sin_especificar").map(k => <option key={k} value={k}>{METODOS[k].label}</option>)}
            </select>
          </Campo>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Campo label="Monto">
              <input type="number" inputMode="decimal" value={movForm.monto} onChange={e => setMovForm((p: any) => ({ ...p, monto: e.target.value }))} placeholder="0" style={inputDark} />
            </Campo>
            <Campo label="Fecha">
              <input type="date" value={movForm.fecha} onChange={e => setMovForm((p: any) => ({ ...p, fecha: e.target.value }))} style={inputDark} />
            </Campo>
          </div>
          {movForm.tipo === "egreso" && (
            <Campo label="Descripción (opcional)">
              <input type="text" value={movForm.descripcion} onChange={e => setMovForm((p: any) => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: pago de luz, nafta, retiro para sueldo..." style={inputDark} />
            </Campo>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setModalMov(null)} style={btnModalSec}>Cancelar</button>
            <button onClick={guardarMov} disabled={guardandoMov} style={{ ...btnModalPri, opacity: guardandoMov ? 0.5 : 1 }}>{guardandoMov ? "Guardando..." : "Guardar"}</button>
          </div>
        </ModalShell>
      )}

      {/* ── Modal confirmar eliminar ── */}
      {confirmDel && (
        <ModalShell onClose={() => setConfirmDel(null)} titulo="Eliminar movimiento">
          <p style={{ color: "#cbd5e1", fontSize: 14, marginBottom: 18 }}>
            ¿Seguro que querés eliminar este movimiento de {fmt(Number(confirmDel.monto))}? Esta acción no se puede deshacer.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setConfirmDel(null)} style={btnModalSec}>Cancelar</button>
            <button onClick={eliminarMov} disabled={guardandoMov} style={{ ...btnModalPri, background: "#dc2626", opacity: guardandoMov ? 0.5 : 1 }}>{guardandoMov ? "Eliminando..." : "Eliminar"}</button>
          </div>
        </ModalShell>
      )}

      {/* ── Modal saldo inicial ── */}
      {modalSaldo && (
        <ModalShell onClose={() => setModalSaldo(false)} titulo="Saldo inicial de caja">
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>
            Definí desde qué mes empezás a acumular y con cuánta plata arrancás. El saldo se irá sumando mes a mes desde ahí.
          </p>
          <Campo label="Mes de arranque">
            <input type="month" value={saldoForm.mes_inicial} onChange={e => setSaldoForm(p => ({ ...p, mes_inicial: e.target.value }))} style={inputDark} />
          </Campo>
          <Campo label="Saldo inicial ($)">
            <input
              type="text" inputMode="numeric" value={saldoForm.saldo_inicial}
              onChange={e => {
                const raw = e.target.value.replace(/[^\d]/g, "")           // solo dígitos
                const formateado = raw ? Number(raw).toLocaleString("es-AR") : ""  // puntos de miles
                setSaldoForm(p => ({ ...p, saldo_inicial: formateado }))
              }}
              placeholder="Ej: 1.500.000" style={inputDark} />
          </Campo>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => setModalSaldo(false)} style={btnModalSec}>Cancelar</button>
            <button onClick={guardarSaldo} disabled={guardandoSaldo} style={{ ...btnModalPri, opacity: guardandoSaldo ? 0.5 : 1 }}>{guardandoSaldo ? "Guardando..." : "Guardar"}</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

// ── Subcomponentes / estilos ─────────────────────────────────────────────────
function SaldoCard({ titulo, valor, sub, color, icon, destacado }: { titulo: string; valor: number; sub: string; color: string; icon: string; destacado?: boolean }) {
  return (
    <div style={{
      background: destacado ? "#0f172a" : "white", borderRadius: 16, padding: "18px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: destacado ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingLeft: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: destacado ? "#94a3b8" : "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</span>
        <span style={{ fontSize: 17 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, color: destacado ? "white" : "#0f172a", paddingLeft: 6, lineHeight: 1 }}>{fmt(valor)}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, paddingLeft: 6 }}>{sub}</div>
    </div>
  )
}

function ModalShell({ children, titulo, onClose }: { children: React.ReactNode; titulo: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "26px 24px", width: "100%", maxWidth: 440, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: "0 0 18px" }}>{titulo}</h2>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 10, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 14, cursor: "pointer", fontWeight: 700 }
const btnPri: React.CSSProperties = { padding: "9px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }
const btnSec: React.CSSProperties = { padding: "9px 14px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }
const btnModalPri: React.CSSProperties = { flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }
const btnModalSec: React.CSSProperties = { flex: 1, padding: "11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", color: "#9ca3af", fontSize: 14, fontWeight: 600, cursor: "pointer" }
const iconBtn: React.CSSProperties = { background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: 2 }
const panelTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14, marginTop: 0 }
const lineaPanel: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f1f5f9", gap: 10 }
const totalPanel: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginTop: 4 }
