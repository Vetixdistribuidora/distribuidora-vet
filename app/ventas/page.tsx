"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { supabase } from "../../lib/supabase"
import * as XLSX from "xlsx"

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
// Convierte timestamp de Supabase (UTC) a fecha local YYYY-MM-DD
function fechaLocal(f: string | null | undefined): string {
  if (!f) return ""
  return new Date(f).toLocaleDateString("sv-SE")
}

interface DatosImpresion {
  nroFactura: string; clienteSeleccionado: any; carrito: any[]
  subtotal: number; ivaNum: number; total: number; esCuentaCorriente: boolean
  metodoCobro?: string
}

function generarHTMLEImprimir(datos: DatosImpresion, tipo: "presupuesto" | "remito" = "presupuesto") {
  const { nroFactura, clienteSeleccionado, carrito, subtotal, ivaNum, total, esCuentaCorriente, metodoCobro } = datos
  const logoUrl = window.location.origin + "/logo.png"
  const fecha = new Date().toLocaleDateString("es-AR")
  const f = (num: number) => "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const esRemito = tipo === "remito"
  const titulo = esRemito ? "REMITO DE ENTREGA" : "PRESUPUESTO"
  const filas = carrito.map(item => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    if (esRemito) {
      return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + bonif + "</td><td>&nbsp;</td></tr>"
    }
    return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + f(item.precio) + "</td><td>" + bonif + "</td><td>" + f(unidadesPagas * item.precio) + "</td></tr>"
  }).join("")
  const theadCols = esRemito
    ? "<tr><th style='width:7%'>Cant.</th><th style='width:65%'>Descripcion</th><th style='width:10%'>Bonif.</th><th style='width:18%'>Recibido</th></tr>"
    : "<tr><th style='width:6%'>Cant.</th><th style='width:54%'>Descripcion</th><th style='width:16%'>Precio U.</th><th style='width:8%'>Bonif.</th><th style='width:16%'>Total</th></tr>"
  const badgeCC = esCuentaCorriente && !esRemito ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>" : ""
  const metodoStr = metodoCobro && metodoCobro !== "sin_especificar" && !esRemito && !esCuentaCorriente ? "<p style='margin:6px 0'><b>Método de cobro:</b> " + metodoCobro.replace("_", " ").toUpperCase() + "</p>" : ""
  const totalesHTML = esRemito
    ? "<div class='totales'><div class='box'><p>Firma y aclaración: ___________________________</p></div></div>"
    : "<div class='totales'><div class='box'>" + metodoStr + "<p><b>Subtotal:</b> " + f(subtotal) + "</p><p><b>IVA (" + ivaNum + "%):</b> " + f(subtotal * ivaNum / 100) + "</p><h2><b>Total:</b> " + f(total) + "</h2></div></div>"
  const html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;background:#e5e7eb}.acciones{display:flex;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}.page{width:180mm;min-height:267mm;margin:16px auto;background:white;padding:16px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.12)}.logo{height:130px;display:block}.empresa-info{font-size:11px;color:#555;margin-top:1px;line-height:1.5}.header{display:flex;justify-content:space-between;align-items:flex-start}.header-right{text-align:center;padding-top:4px}.header-right h2{margin:0;font-size:18px}.nro-factura{font-size:13px;color:#555;margin-top:4px}.cliente-row{margin-top:12px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;line-height:1.9}.contenido{flex:1}table{width:100%;margin-top:14px;border-collapse:collapse;table-layout:fixed}th{border:1px solid #ccc;padding:4px 4px;background:#eee;font-size:10px;white-space:nowrap;overflow:hidden}td{padding:5px 6px;text-align:center;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-word}.totales{margin-top:16px;display:flex;justify-content:flex-end;page-break-inside:avoid;break-inside:avoid}.box{width:250px;border-top:2px solid #333;padding-top:8px}.box p{margin:4px 0;font-size:12px}.box h2{margin:10px 0 4px;font-size:20px}@media print{body{background:white}.acciones{display:none}.page{width:100%;min-height:calc(297mm - 30mm);margin:0;padding:0;box-shadow:none}tr{page-break-inside:avoid;break-inside:avoid}.totales{break-inside:avoid;page-break-inside:avoid}}</style></head><body><div class='acciones'><button onclick='window.close()' style='background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:10px 18px;font-size:14px;font-family:Arial;cursor:pointer;color:#374151;font-weight:600'>&#8592; Cerrar</button><button onclick='window.print()' style='background:#0f172a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-family:Arial;cursor:pointer;color:white;font-weight:700'>&#128438; Imprimir</button></div><div class='page'><div class='contenido'><div class='header'><div><img src='" + logoUrl + "' class='logo'/><div class='empresa-info'>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div></div><div class='header-right'><h2>" + titulo + "</h2><div class='nro-factura'><b style='font-size:15px;color:#111'>N° 001-" + nroFactura + "</b><br/><span style='font-size:12px;color:#555'>Fecha: " + fecha + "</span></div>" + badgeCC + "</div></div><div class='cliente-row'><b>Cliente:</b> " + clienteSeleccionado.nombre + " " + clienteSeleccionado.apellido + " &nbsp;|&nbsp; <b>CUIT:</b> " + (clienteSeleccionado.cuit || "-") + " &nbsp;|&nbsp; <b>Dir:</b> " + (clienteSeleccionado.localidad || "-") + " &nbsp;|&nbsp; <b>Tel:</b> " + (clienteSeleccionado.telefono || "-") + "</div><table><thead>" + theadCols + "</thead><tbody>" + filas + "</tbody></table></div>" + totalesHTML + "</div></body></html>"
  const ventana = window.open("", "_blank")
  if (!ventana) { alert("Habilita ventanas emergentes"); return }
  ventana.document.write(html); ventana.document.close()
}

const ESTADO_VENTA: Record<string, { label: string, color: string, bg: string }> = {
  cobrada:          { label: "Cobrada",          color: "#16a34a", bg: "#f0fdf4" },
  cuenta_corriente: { label: "Cuenta corriente", color: "#d97706", bg: "#fffbeb" },
  anulada:          { label: "Anulada",          color: "#dc2626", bg: "#fef2f2" },
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .ventas-grid { grid-template-columns: 1fr !important; }
    .ventas-borrador-grid { grid-template-columns: 1fr !important; }
    .ventas-resumen-sticky { position: static !important; }
    .ventas-agregar-grid { grid-template-columns: 1fr !important; }
    .ventas-datos-grid { grid-template-columns: 1fr !important; }
    .ventas-item-controles { flex-wrap: wrap !important; }
    .ventas-item-precio { flex: 1 1 120px !important; }
    .ventas-historial-filtros { flex-direction: column !important; }
    .ventas-historial-row { flex-direction: column !important; align-items: flex-start !important; }
    .ventas-historial-row .acciones { width: 100% !important; justify-content: flex-end !important; display: flex !important; }
    .ventas-resumen-cards { flex-wrap: wrap !important; }
  }
`

export default function Ventas() {
  const [tab, setTab] = useState<"nueva" | "historial" | "borradores" | "notascredito">("nueva")

  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clienteId, setClienteId] = useState("")
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [productoId, setProductoId] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [carrito, setCarrito] = useState<any[]>([])
  const [iva, setIva] = useState("")
  const [nroFactura, setNroFactura] = useState("")
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [productoIndice, setProductoIndice] = useState(-1)
  const [busquedaCliente, setBusquedaCliente] = useState("")
  const [clienteDropdown, setClienteDropdown] = useState(false)
  const [clienteIndice, setClienteIndice] = useState(-1)
  const inputProductoRef = useRef<HTMLInputElement>(null)
  const inputCantidadRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<any>(null)

  const [ventas, setVentas] = useState<any[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [busquedaHistorial, setBusquedaHistorial] = useState("")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [ventaDetalle, setVentaDetalle] = useState<any>(null)
  const [detalleItems, setDetalleItems] = useState<any[]>([])
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [confirmAnular, setConfirmAnular] = useState<any>(null)
  const [confirmEliminarVenta, setConfirmEliminarVenta] = useState<any>(null)
  const [eliminandoVenta, setEliminandoVenta] = useState(false)
  const [anulando, setAnulando] = useState(false)
  const [reimprimiendo, setReimprimiendo] = useState(false)
  const [metodoCobro, setMetodoCobro] = useState("efectivo")

  // ── NOTAS DE CRÉDITO ─────────────────────────────────────────────────────────
  const [notasCredito, setNotasCredito] = useState<any[]>([])
  const [loadingNC, setLoadingNC] = useState(false)
  const [modalNC, setModalNC] = useState<{ venta: any, items: any[] } | null>(null)
  const [ncCantidades, setNcCantidades] = useState<Record<number, number>>({})
  const [ncMotivo, setNcMotivo] = useState("")
  const [guardandoNC, setGuardandoNC] = useState(false)
  const [cargandoItemsNC, setCargandoItemsNC] = useState(false)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── BORRADORES ──────────────────────────────────────────────────────────────
  const [borradores, setBorradores] = useState<any[]>([])
  const [loadingBorradores, setLoadingBorradores] = useState(false)
  const [borradorAbierto, setBorradorAbierto] = useState<any | null>(null)
  const [borrTitulo, setBorrTitulo] = useState("")
  const [borrClienteObj, setBorrClienteObj] = useState<any>(null)
  const [borrBusqCliente, setBorrBusqCliente] = useState("")
  const [borrDropCliente, setBorrDropCliente] = useState(false)
  const [borrItems, setBorrItems] = useState<any[]>([])
  const [borrNotas, setBorrNotas] = useState("")
  const [borrBusqProducto, setBorrBusqProducto] = useState("")
  const [borrGuardando, setBorrGuardando] = useState(false)
  // ────────────────────────────────────────────────────────────────────────────

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { cargar() }, [])
  useEffect(() => {
    if (!loadingHistorial) return
    const w = setTimeout(() => supabase.auth.signOut(), 60000)
    return () => clearTimeout(w)
  }, [loadingHistorial])
  useEffect(() => {
    if (tab === "historial") cargarHistorial()
    if (tab === "borradores") cargarBorradores()
    if (tab === "notascredito") cargarNotasCredito()
  }, [tab])
  useEffect(() => { if (tab === "historial") cargarHistorial() }, [fechaDesde, fechaHasta])

  // Borrador automático en localStorage
  useEffect(() => {
    if (carrito.length === 0 && !clienteId) return
    localStorage.setItem("vetix_borrador", JSON.stringify({ carrito, clienteId, clienteSeleccionado, iva, esCuentaCorriente, busquedaCliente }))
  }, [carrito, clienteId, iva, esCuentaCorriente])

  useEffect(() => {
    const guardado = localStorage.getItem("vetix_borrador")
    if (!guardado) return
    try {
      const b = JSON.parse(guardado)
      if (b.carrito?.length > 0) {
        setCarrito(b.carrito)
        setClienteId(b.clienteId || "")
        setClienteSeleccionado(b.clienteSeleccionado || null)
        setBusquedaCliente(b.busquedaCliente || "")
        setIva(b.iva || "")
        setEsCuentaCorriente(b.esCuentaCorriente || false)
      }
    } catch {}
  }, [])

  // ── FUNCIONES NOTAS DE CRÉDITO ───────────────────────────────────────────────
  async function cargarNotasCredito() {
    setLoadingNC(true)
    try {
      const { data } = await supabase.from("notas_credito").select("*, clientes(nombre, apellido), ventas(nro_factura)").order("id", { ascending: false }).limit(200)
      setNotasCredito(data || [])
    } catch (e) {
      console.error("Error cargando notas de crédito:", e)
    } finally {
      setLoadingNC(false)
    }
  }

  async function abrirModalNC(venta: any) {
    setCargandoItemsNC(true)
    try {
      let items = detalleItems
      // Siempre re-fetchar para asegurarse de tener los items de ESTA venta
      if (!items.length || !items[0]?.venta_id || items[0]?.venta_id !== venta.id) {
        const { data, error } = await supabase
          .from("detalle_ventas")
          .select("*, productos(nombre, codigo)")
          .eq("venta_id", venta.id)
        if (error) { mostrarToast("Error al cargar productos de la venta: " + error.message, "error"); return }
        items = data || []
        setDetalleItems(items)
      }
      // Arrancar con TODAS las cantidades al máximo (devolución total por defecto)
      // El usuario reduce con − si quiere devolver menos
      const cantInit: Record<number, number> = {}
      items.forEach((it: any) => { cantInit[it.producto_id] = it.cantidad })
      setNcCantidades(cantInit)
      setNcMotivo("")
      setModalNC({ venta, items })
      setVentaDetalle(null)
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setCargandoItemsNC(false)
    }
  }

  async function confirmarNC() {
    if (!modalNC) return
    const itemsDevueltos = modalNC.items.filter((it: any) => (ncCantidades[it.producto_id] || 0) > 0)
    if (!itemsDevueltos.length) { mostrarToast("Seleccioná al menos un producto a devolver", "error"); return }
    // Validar contra NCs previas — calcular cuánto ya fue devuelto por NCs activas anteriores
    const { data: ncsExistentes } = await supabase
      .from("notas_credito").select("items")
      .eq("venta_id", modalNC.venta.id).eq("estado", "activa")
    const yaDevuelto: Record<number, number> = {}
    ncsExistentes?.forEach((nc: any) => {
      ;(nc.items || []).forEach((it: any) => {
        yaDevuelto[it.producto_id] = (yaDevuelto[it.producto_id] || 0) + it.cantidad
      })
    })
    for (const it of itemsDevueltos) {
      const cantDev = ncCantidades[it.producto_id] || 0
      const yaDev = yaDevuelto[it.producto_id] || 0
      const maxDevolvible = it.cantidad - yaDev
      if (cantDev > maxDevolvible) {
        mostrarToast(`❌ Máximo ${maxDevolvible} u. disponibles de "${it.productos?.nombre}" (ya devueltas: ${yaDev})`, "error")
        return
      }
    }
    setGuardandoNC(true)
    try {
      // Generar número de NC
      const { data: ultima } = await supabase.from("notas_credito").select("nro_nota").order("id", { ascending: false }).limit(1).maybeSingle()
      let nextNum = 1
      if (ultima?.nro_nota) { const m = ultima.nro_nota.match(/(\d+)$/); if (m) nextNum = parseInt(m[1], 10) + 1 }
      const nroNota = "NC-" + String(nextNum).padStart(5, "0")

      const totalNC = itemsDevueltos.reduce((acc: number, it: any) => acc + it.precio * (ncCantidades[it.producto_id] || 0), 0)
      const ncItemsData = itemsDevueltos.map((it: any) => ({
        producto_id: it.producto_id,
        nombre: it.productos?.nombre || "",
        cantidad: ncCantidades[it.producto_id] || 0,
        precio: it.precio
      }))

      const { error } = await supabase.from("notas_credito").insert({
        nro_nota: nroNota,
        venta_id: modalNC.venta.id,
        cliente_id: modalNC.venta.cliente_id,
        items: ncItemsData,
        total: totalNC,
        motivo: ncMotivo || null,
        estado: "activa"
      })
      if (error) { mostrarToast("❌ " + error.message, "error"); return }

      // Devolver stock
      for (const it of itemsDevueltos) {
        const qty = ncCantidades[it.producto_id] || 0
        const { data: prod } = await supabase.from("productos").select("stock").eq("id", it.producto_id).single()
        if (prod) await supabase.from("productos").update({ stock: (prod.stock || 0) + qty }).eq("id", it.producto_id)
        await supabase.from("lotes").insert({ producto_id: it.producto_id, cantidad: qty, fecha_vencimiento: null, nro_remito: "NC " + nroNota })
      }

      // Descontar de la venta original
      const nuevoTotalVenta = Math.max(0, Number(modalNC.venta.total) - totalNC)
      await supabase.from("ventas").update({ total: nuevoTotalVenta }).eq("id", modalNC.venta.id)
      // Si era cuenta corriente, actualizar el movimiento de CC
      if (modalNC.venta.estado === "cuenta_corriente") {
        const { data: ultimo } = await supabase.from("cuentas_corrientes").select("id, saldo").eq("cliente_id", modalNC.venta.cliente_id).order("id", { ascending: false }).limit(1).maybeSingle()
        if (ultimo) {
          const nuevoSaldoCC = Math.max(0, Number(ultimo.saldo) - totalNC)
          await supabase.from("cuentas_corrientes").insert({ cliente_id: modalNC.venta.cliente_id, tipo: "nota_credito", monto: -totalNC, saldo: nuevoSaldoCC, venta_id: modalNC.venta.id, fecha: new Date() })
        }
      }

      setModalNC(null)
      mostrarToast("✅ Nota de crédito " + nroNota + " creada — total de la venta actualizado", "ok")
      if (tab === "notascredito") cargarNotasCredito()
    } catch (e: any) {
      mostrarToast("❌ Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setGuardandoNC(false)
    }
  }

  async function anularNC(nc: any) {
    // Revertir stock y eliminar los lotes de devolución creados por esta NC
    const items: any[] = nc.items || []
    for (const it of items) {
      const { data: prod } = await supabase.from("productos").select("stock").eq("id", it.producto_id).single()
      if (prod) await supabase.from("productos").update({ stock: Math.max(0, (prod.stock || 0) - it.cantidad) }).eq("id", it.producto_id)
    }
    await supabase.from("lotes").delete().eq("nro_remito", "NC " + nc.nro_nota)
    // Restaurar total de la venta original
    const { data: ventaOrig } = await supabase.from("ventas").select("total, estado, cliente_id").eq("id", nc.venta_id).single()
    if (ventaOrig) {
      const totalRestaurado = Number(ventaOrig.total) + Number(nc.total)
      await supabase.from("ventas").update({ total: totalRestaurado }).eq("id", nc.venta_id)
      if (ventaOrig.estado === "cuenta_corriente") {
        const { data: ultimo } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", ventaOrig.cliente_id).order("id", { ascending: false }).limit(1).maybeSingle()
        if (ultimo) {
          const nuevoSaldoCC = Number(ultimo.saldo) + Number(nc.total)
          await supabase.from("cuentas_corrientes").insert({ cliente_id: ventaOrig.cliente_id, tipo: "anulacion_nc", monto: Number(nc.total), saldo: nuevoSaldoCC, venta_id: nc.venta_id, fecha: new Date() })
        }
      }
    }
    await supabase.from("notas_credito").update({ estado: "anulada" }).eq("id", nc.id)
    setNotasCredito(prev => prev.map(n => n.id === nc.id ? { ...n, estado: "anulada" } : n))
    mostrarToast("🗑️ Nota de crédito anulada y venta original restaurada", "ok")
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // ── FUNCIONES BORRADORES ────────────────────────────────────────────────────
  async function cargarBorradores() {
    setLoadingBorradores(true)
    try {
      const { data } = await supabase.from("borradores").select("*").order("updated_at", { ascending: false })
      setBorradores(data || [])
    } catch (e) {
      console.error("Error cargando borradores:", e)
    } finally {
      setLoadingBorradores(false)
    }
  }

  async function crearBorrador() {
    const titulo = "Borrador " + new Date().toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    const { data, error } = await supabase.from("borradores").insert({ titulo, items: [], notas: "" }).select().single()
    if (error || !data) return mostrarToast("❌ Error al crear borrador", "error")
    setBorradores(prev => [data, ...prev])
    abrirBorrador(data)
  }

  function abrirBorrador(b: any) {
    setBorradorAbierto(b)
    setBorrTitulo(b.titulo || "")
    setBorrClienteObj(b.cliente_id ? clientes.find((c: any) => c.id === b.cliente_id) || null : null)
    setBorrBusqCliente(b.cliente_nombre || "")
    setBorrItems(b.items || [])
    setBorrNotas(b.notas || "")
    setBorrBusqProducto("")
  }

  function cerrarBorrador() {
    setBorradorAbierto(null)
    setBorrBusqCliente("")
    setBorrBusqProducto("")
  }

  async function guardarBorrador() {
    if (!borradorAbierto) return
    setBorrGuardando(true)
    const patch = {
      titulo: borrTitulo,
      cliente_id: borrClienteObj?.id || null,
      cliente_nombre: borrClienteObj ? `${borrClienteObj.nombre} ${borrClienteObj.apellido || ""}`.trim() : "",
      items: borrItems,
      notas: borrNotas,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from("borradores").update(patch).eq("id", borradorAbierto.id)
    if (error) { setBorrGuardando(false); return mostrarToast("❌ " + error.message, "error") }
    setBorradores(prev => prev.map(b => b.id === borradorAbierto.id ? { ...b, ...patch } : b))
    setBorrGuardando(false)
    mostrarToast("✅ Borrador guardado", "ok")
  }

  async function eliminarBorrador(id: number) {
    await supabase.from("borradores").delete().eq("id", id)
    setBorradores(prev => prev.filter(b => b.id !== id))
    if (borradorAbierto?.id === id) cerrarBorrador()
    mostrarToast("🗑️ Borrador eliminado", "ok")
  }

  function agregarProductoABorrador(prod: any) {
    setBorrItems(prev => {
      const existe = prev.find((i: any) => i.producto_id === prod.id)
      if (existe) return prev.map((i: any) => i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { producto_id: prod.id, nombre: prod.nombre, precio: prod.precio_venta, cantidad: 1, bonificacion: 0 }]
    })
    setBorrBusqProducto("")
  }

  function pasarAVenta(b?: any) {
    const items = b ? (b.items || []) : borrItems
    const clienteObj = b ? (b.cliente_id ? clientes.find((c: any) => c.id === b.cliente_id) || null : null) : borrClienteObj
    if (items.length === 0) { mostrarToast("⚠️ El borrador no tiene productos", "error"); return }
    const porcentajeCliente = clienteObj?.porcentaje || 0
    setCarrito(items.map((it: any) => {
      const prod = productos.find((p: any) => p.id === it.producto_id)
      const precioFinal = porcentajeCliente > 0
        ? Math.round((it.precio * (1 + porcentajeCliente / 100)) * 100) / 100
        : it.precio
      return {
        producto_id: it.producto_id, nombre: it.nombre,
        precio: precioFinal, cantidad: it.cantidad, bonificacion: it.bonificacion || 0,
        subtotal: precioFinal * Math.max(0, it.cantidad - (it.bonificacion || 0)),
        stockDisponible: prod?.stock ?? 0
      }
    }))
    if (clienteObj) {
      setClienteSeleccionado(clienteObj)
      setClienteId(String(clienteObj.id))
      setBusquedaCliente(`${clienteObj.nombre} ${clienteObj.apellido || ""}`.trim())
    } else {
      setClienteSeleccionado(null); setClienteId(""); setBusquedaCliente("")
    }
    cerrarBorrador()
    setTab("nueva")
    mostrarToast("✅ Pedido cargado — revisá y confirmá la venta", "ok")
  }
  // ────────────────────────────────────────────────────────────────────────────

  async function cargar() {
    try {
      const { data: c } = await supabase.from("clientes").select("*").order("nombre")
      let todosProductos: any[] = []
      let desde = 0
      while (true) {
        const { data: p } = await supabase.from("productos").select("*").order("nombre").range(desde, desde + 999)
        if (!p || p.length === 0) break
        todosProductos = [...todosProductos, ...p]
        if (p.length < 1000) break
        desde += 1000
      }
      setClientes(c || []); setProductos(todosProductos)
      const { data: ultima } = await supabase.from("ventas").select("nro_factura").order("id", { ascending: false }).limit(1).maybeSingle()
      if (ultima?.nro_factura) {
        const num = parseInt(ultima.nro_factura, 10)
        if (!isNaN(num)) setNroFactura(String(num + 1).padStart(5, "0"))
      } else { setNroFactura("10047") }
    } catch (e) {
      console.error("Error cargando datos de venta:", e)
    }
  }

  async function cargarHistorial() {
    setLoadingHistorial(true)
    try {
      const desdeUTC = fechaDesde ? new Date(fechaDesde + "T00:00:00").toISOString() : null
      const hastaUTC = fechaHasta ? new Date(fechaHasta + "T23:59:59").toISOString() : null
      let query = supabase.from("ventas").select("*, clientes(nombre, apellido)").order("id", { ascending: false })
      if (desdeUTC) query = query.gte("fecha", desdeUTC)
      if (hastaUTC) query = query.lte("fecha", hastaUTC)
      if (!fechaDesde && !fechaHasta) query = query.limit(200)
      const { data } = await query
      if (!data || data.some((v: any) => v.clientes === undefined)) {
        let q2 = supabase.from("ventas").select("*").order("id", { ascending: false })
        if (desdeUTC) q2 = q2.gte("fecha", desdeUTC)
        if (hastaUTC) q2 = q2.lte("fecha", hastaUTC)
        if (!fechaDesde && !fechaHasta) q2 = q2.limit(200)
        const { data: ventasSolas } = await q2
        const clienteIds = [...new Set(ventasSolas?.map((v: any) => v.cliente_id) || [])]
        const { data: clientesData } = await supabase.from("clientes").select("id, nombre, apellido").in("id", clienteIds)
        const clientesMap: Record<number, any> = {}
        clientesData?.forEach((c: any) => { clientesMap[c.id] = c })
        setVentas(ventasSolas?.map((v: any) => ({ ...v, clientes: clientesMap[v.cliente_id] || null })) || [])
      } else { setVentas(data || []) }
    } catch (e) {
      console.error("Error cargando historial:", e)
    } finally {
      setLoadingHistorial(false)
    }
  }

  async function verDetalle(v: any) {
    setVentaDetalle(v); setLoadingDetalle(true)
    const { data } = await supabase.from("detalle_ventas").select("*, productos(nombre)").eq("venta_id", v.id)
    setDetalleItems(data || []); setLoadingDetalle(false)
  }

  async function anularVenta() {
    if (!confirmAnular) return
    setAnulando(true)
    try {
      // Revertir stock de NCs activas ANTES de restaurar el stock original
      // (sin esto el stock queda sobre-restaurado por las cantidades ya devueltas)
      const { data: ncsActivas } = await supabase
        .from("notas_credito").select("nro_nota, items")
        .eq("venta_id", confirmAnular.id).eq("estado", "activa")
      if (ncsActivas?.length) {
        for (const nc of ncsActivas) {
          for (const it of (nc.items || [])) {
            const { data: prod } = await supabase.from("productos").select("stock").eq("id", it.producto_id).single()
            if (prod) await supabase.from("productos").update({ stock: Math.max(0, (prod.stock || 0) - it.cantidad) }).eq("id", it.producto_id)
          }
          await supabase.from("lotes").delete().eq("nro_remito", "NC " + nc.nro_nota)
        }
        await supabase.from("notas_credito").update({ estado: "anulada" }).eq("venta_id", confirmAnular.id)
      }
      // Restaurar stock
      const { data: detalle } = await supabase.from("detalle_ventas").select("producto_id, cantidad").eq("venta_id", confirmAnular.id)
      if (detalle) {
        for (const d of detalle) {
          const { data: prod } = await supabase.from("productos").select("stock").eq("id", d.producto_id).single()
          if (prod) await supabase.from("productos").update({ stock: prod.stock + d.cantidad }).eq("id", d.producto_id)
        }
      }
      // Si era cuenta corriente, registrar el crédito real pendiente (descontando pagos ya hechos)
      if (confirmAnular.estado === "cuenta_corriente") {
        const { data: pagosVenta } = await supabase.from("pagos_cuenta_corriente").select("monto").eq("venta_id", confirmAnular.id)
        const yaPageado = (pagosVenta || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
        const saldoPendiente = Math.max(0, Number(confirmAnular.total) - yaPageado)
        if (saldoPendiente > 0) {
          const { data: ultimo } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", confirmAnular.cliente_id).order("id", { ascending: false }).limit(1).maybeSingle()
          const saldoActualCC = Number(ultimo?.saldo || 0)
          const nuevoSaldo = Math.max(0, saldoActualCC - saldoPendiente)
          await supabase.from("cuentas_corrientes").insert({ cliente_id: confirmAnular.cliente_id, tipo: "anulacion", monto: -saldoPendiente, saldo: nuevoSaldo, venta_id: confirmAnular.id, fecha: new Date() })
        }
      }
      await supabase.from("ventas").update({ estado: "anulada" }).eq("id", confirmAnular.id)
      setConfirmAnular(null)
      if (ventaDetalle?.id === confirmAnular.id) setVentaDetalle({ ...ventaDetalle, estado: "anulada" })
      mostrarToast("🗑️ Venta anulada y stock restaurado", "ok")
      cargarHistorial()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setAnulando(false)
    }
  }

  async function eliminarVenta() {
    if (!confirmEliminarVenta) return
    setEliminandoVenta(true)
    try {
      // Eliminar lotes de devolución y revertir stock de NCs activas asociadas
      const { data: ncsAsociadas } = await supabase.from("notas_credito").select("nro_nota, items").eq("venta_id", confirmEliminarVenta.id).eq("estado", "activa")
      if (ncsAsociadas?.length) {
        for (const nc of ncsAsociadas) {
          // Revertir stock de cada item de la NC
          const items: any[] = nc.items || []
          for (const it of items) {
            const { data: prod } = await supabase.from("productos").select("stock").eq("id", it.producto_id).single()
            if (prod) await supabase.from("productos").update({ stock: Math.max(0, (prod.stock || 0) - it.cantidad) }).eq("id", it.producto_id)
          }
          await supabase.from("lotes").delete().eq("nro_remito", "NC " + nc.nro_nota)
        }
        await supabase.from("notas_credito").update({ estado: "anulada" }).eq("venta_id", confirmEliminarVenta.id)
      }
      await supabase.from("pagos_cuenta_corriente").delete().eq("venta_id", confirmEliminarVenta.id)
      await supabase.from("cuentas_corrientes").delete().eq("venta_id", confirmEliminarVenta.id)
      await supabase.from("detalle_ventas").delete().eq("venta_id", confirmEliminarVenta.id)
      await supabase.from("facturas_impresion").delete().eq("venta_id", confirmEliminarVenta.id)
      await supabase.from("ventas").delete().eq("id", confirmEliminarVenta.id)
      setConfirmEliminarVenta(null)
      if (ventaDetalle?.id === confirmEliminarVenta.id) setVentaDetalle(null)
      mostrarToast("🗑️ Venta eliminada", "ok")
      cargarHistorial()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setEliminandoVenta(false)
    }
  }

  async function reimprimir(venta: any, itemsCargados?: any[], tipo: "presupuesto" | "remito" = "presupuesto") {
    setReimprimiendo(true)
    const { data: guardada } = await supabase
      .from("facturas_impresion").select("datos").eq("venta_id", venta.id).maybeSingle()
    if (guardada?.datos) {
      // Normalizar nro_factura a 5 dígitos por si fue guardado sin padding (ej: "26" → "00026")
      const datosNorm = { ...guardada.datos }
      if (datosNorm.nroFactura && !isNaN(parseInt(datosNorm.nroFactura, 10))) {
        datosNorm.nroFactura = String(parseInt(datosNorm.nroFactura, 10)).padStart(5, "0")
      }
      generarHTMLEImprimir(datosNorm, tipo)
    } else {
      // Reconstruir desde datos de la venta
      const items = itemsCargados?.length
        ? itemsCargados
        : (await supabase.from("detalle_ventas").select("*, productos(nombre)").eq("venta_id", venta.id)).data || []
      const { data: clienteData } = await supabase
        .from("clientes").select("*").eq("id", venta.cliente_id).maybeSingle()
      const carritoReconstruido = items.map((d: any) => ({
        producto_id: d.producto_id, nombre: d.productos?.nombre || "",
        cantidad: d.cantidad, precio: d.precio, bonificacion: d.bonificacion || 0
      }))
      const subtotalCalc = carritoReconstruido.reduce((acc: number, it: any) => {
        const pagan = it.cantidad - (it.bonificacion || 0)
        return acc + Math.max(0, pagan) * it.precio
      }, 0)
      const totalCalc = Number(venta.total)
      // Reconstruir IVA: si el cálculo da un valor inusual (< 0 o > 30), usar 21%
      const ivaRaw = subtotalCalc > 0 ? Math.round((totalCalc / subtotalCalc - 1) * 100) : 21
      const ivaCalc = (ivaRaw >= 0 && ivaRaw <= 30) ? ivaRaw : 21
      // Normalizar nro_factura a 5 dígitos para reimprimir
      const nroParaImprimir = venta.nro_factura
        ? (isNaN(parseInt(venta.nro_factura, 10)) ? venta.nro_factura : String(parseInt(venta.nro_factura, 10)).padStart(5, "0"))
        : ""
      generarHTMLEImprimir({
        nroFactura: nroParaImprimir,
        clienteSeleccionado: clienteData || venta.clientes || {},
        carrito: carritoReconstruido,
        subtotal: subtotalCalc,
        ivaNum: ivaCalc,
        total: totalCalc,
        esCuentaCorriente: venta.estado === "cuenta_corriente",
        metodoCobro: venta.metodo_cobro,
      }, tipo)
    }
    setReimprimiendo(false)
  }

  function exportarVentas() {
    const datos = ventasFiltradas.map(v => ({
      "N° Presupuesto": v.nro_factura,
      "Fecha": fechaLocal(v.fecha),
      "Cliente": (v.clientes?.nombre || "") + " " + (v.clientes?.apellido || ""),
      "Estado": ESTADO_VENTA[v.estado]?.label || v.estado,
      "Método de cobro": v.metodo_cobro || "",
      "Total": Number(v.total),
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    ws["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Ventas")
    XLSX.writeFile(wb, "ventas_" + new Date().toISOString().slice(0, 10) + ".xlsx")
  }

  function seleccionarCliente(c: any) {
    setClienteId(String(c.id))
    setClienteSeleccionado(c)
    setBusquedaCliente(c.nombre + " " + c.apellido)
    setClienteDropdown(false)
    setClienteIndice(-1)
  }

  function limpiarCliente() {
    setClienteId(""); setClienteSeleccionado(null)
    setBusquedaCliente(""); setClienteDropdown(false); setClienteIndice(-1)
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
    const precioFinal = Math.round((base + (base * porcentaje / 100)) * 100) / 100
    if (enCarrito) {
      setCarrito(carrito.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + cant } : i))
    } else {
      setCarrito([...carrito, { producto_id: producto.id, nombre: producto.nombre, cantidad: cant, precio: precioFinal, bonificacion: 0, descuento: 0, tipoDescuento: "pesos", stockDisponible: producto.stock }])
    }
    setProductoId(""); setBusquedaProducto(""); setCantidad("1")
  }

  function sumar(i: number) { const n = [...carrito]; if (n[i].cantidad >= n[i].stockDisponible) { mostrarToast("Stock máximo: " + n[i].stockDisponible, "error"); return }; n[i].cantidad++; setCarrito([...n]) }
  function restar(i: number) { const n = [...carrito]; if (n[i].cantidad > 1) n[i].cantidad--; setCarrito([...n]) }
  function eliminarItem(i: number) { setCarrito(carrito.filter((_, idx) => idx !== i)) }
  function vaciarCarrito() { setCarrito([]) }
  function cambiarBonificacion(i: number, v: number) { const n = [...carrito]; n[i].bonificacion = v; setCarrito([...n]) }
  function cambiarPrecio(i: number, v: number) { const n = [...carrito]; n[i].precio = v; setCarrito([...n]) }
  function cambiarDescuento(i: number, v: number) { const n = [...carrito]; n[i].descuento = v; setCarrito([...n]) }
  function cambiarNombre(i: number, v: string) { const n = [...carrito]; n[i].nombre = v; setCarrito([...n]) }
  function cambiarTipoDescuento(i: number, tipo: "pesos" | "porcentaje") { const n = [...carrito]; n[i].tipoDescuento = tipo; n[i].descuento = 0; setCarrito([...n]) }
  function precioEfectivo(item: any): number {
    const desc = item.descuento || 0
    if (!desc) return item.precio
    if (item.tipoDescuento === "porcentaje") return Math.max(0, item.precio * (1 - desc / 100))
    return Math.max(0, item.precio - desc)
  }

  const subtotal = carrito.reduce((acc, item) => {
    const bonif = item.bonificacion || 0
    const pagan = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    return acc + pagan * precioEfectivo(item)
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
    try {
    // Asegurar que nroFactura esté disponible — si cargar() todavía no terminó, buscar en el momento
    let nroFacturaSave = nroFactura
    if (!nroFacturaSave || nroFacturaSave === "00000") {
      const { data: ultimaV } = await supabase.from("ventas").select("nro_factura").order("id", { ascending: false }).limit(1).maybeSingle()
      if (ultimaV?.nro_factura) {
        const n = parseInt(ultimaV.nro_factura, 10)
        nroFacturaSave = String(isNaN(n) ? 1 : n + 1).padStart(5, "0")
      } else {
        nroFacturaSave = "10047"
      }
      setNroFactura(nroFacturaSave)
    }
    // Normalizar siempre a 5 dígitos con ceros
    const numParsed = parseInt(nroFacturaSave, 10)
    if (!isNaN(numParsed)) nroFacturaSave = String(numParsed).padStart(5, "0")
    const { data: venta, error: errorVenta } = await supabase.from("ventas").insert({
      cliente_id: Number(clienteId), total, fecha: new Date(),
      estado: esCuentaCorriente ? "cuenta_corriente" : "cobrada", nro_factura: nroFacturaSave,
      metodo_cobro: esCuentaCorriente ? null : metodoCobro
    }).select().single()
    if (errorVenta || !venta) { mostrarToast("Error al guardar venta", "error"); return }
      const { error: errorDetalle } = await supabase.from("detalle_ventas").insert(
        carrito.map(item => {
          const prod = productos.find(p => p.id === item.producto_id)
          return {
            venta_id: venta.id,
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio: precioEfectivo(item),
            bonificacion: item.bonificacion || 0,
            costo_unitario: prod?.costo ?? 0,
          }
        })
      )
      if (errorDetalle) { mostrarToast("Error al guardar detalle", "error"); return }
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
      const carritoEfectivo = carrito.map(item => ({ ...item, precio: precioEfectivo(item) }))
      // nroFacturaSave ya está normalizado (5 dígitos con ceros), lo usamos directo
      const { error: errorFI } = await supabase.from("facturas_impresion").insert([{ nro_factura: nroFacturaSave, cliente_id: Number(clienteId), venta_id: venta.id, datos: { nroFactura: nroFacturaSave, clienteSeleccionado, carrito: carritoEfectivo, subtotal, ivaNum, total, esCuentaCorriente, metodoCobro: esCuentaCorriente ? null : metodoCobro } }])
      if (errorFI) console.error("Error guardando factura_impresion:", errorFI)
      mostrarToast(esCuentaCorriente ? "✅ Guardado en cuenta corriente" : "✅ Venta confirmada", "ok")
      setCarrito([]); setClienteId(""); setClienteSeleccionado(null); setBusquedaCliente(""); setEsCuentaCorriente(false)
      localStorage.removeItem("vetix_borrador")
      cargar()
    } catch (e: any) {
      mostrarToast("Error: " + (e?.message || "error desconocido"), "error")
    } finally {
      setGuardando(false)
    }
  }

  function imprimirTicket(tipo: "presupuesto" | "remito" = "presupuesto") {
    if (!clienteSeleccionado || carrito.length === 0) return
    const carritoEfectivo = carrito.map(item => ({ ...item, precio: precioEfectivo(item) }))
    generarHTMLEImprimir({ nroFactura, clienteSeleccionado, carrito: carritoEfectivo, subtotal, ivaNum, total, esCuentaCorriente, metodoCobro }, tipo)
  }

  const terminoBusqVentas = busquedaProducto.trim().replace(/\s+/g, " ").toLowerCase()
  const palabrasBusqVentas = terminoBusqVentas.split(" ").filter(Boolean)
  const productosFiltrados = productos.filter(p => {
    if (!palabrasBusqVentas.length) return false
    const campo = p.nombre.toLowerCase() + " " + (p.laboratorio || "").toLowerCase()
    return (campo.includes(terminoBusqVentas) || palabrasBusqVentas.every(w => campo.includes(w))) &&
      !carrito.find(i => i.producto_id === p.id)
  })

  const ventasFiltradas = ventas.filter(v => {
    const texto = [v.clientes?.nombre, v.clientes?.apellido, v.nro_factura].join(" ").toLowerCase()
    return texto.includes(busquedaHistorial.toLowerCase()) && (filtroEstado === "todos" || v.estado === filtroEstado)
  })
  const totalHistorial = ventasFiltradas.reduce((acc, v) => acc + Number(v.total), 0)

  return (
    <div>
      <style>{responsiveStyles}</style>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "white", padding: 4, borderRadius: 12, border: "1px solid #e2e8f0", width: "fit-content", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {([{ key: "nueva", label: "➕ Nueva venta" }, { key: "historial", label: "📋 Historial" }, { key: "borradores", label: "📝 Borradores" }, { key: "notascredito", label: "↩️ Notas de Crédito" }] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 20px", borderRadius: 9, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s",
            background: tab === t.key ? "#0f172a" : "transparent",
            color: tab === t.key ? "white" : "#6b7280",
            boxShadow: tab === t.key ? "0 2px 8px rgba(0,0,0,0.15)" : "none"
          }}>{t.label}{t.key === "borradores" && borradores.length > 0 && tab !== "borradores" && (
            <span style={{ marginLeft: 6, background: "#f59e0b", color: "white", borderRadius: 99, fontSize: 10, padding: "1px 6px", fontWeight: 800 }}>{borradores.length}</span>
          )}</button>
        ))}
      </div>

      {/* ══ TAB NUEVA VENTA ══ */}
      {tab === "nueva" && carrito.length > 0 && clienteSeleccionado && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13 }}>
          <span style={{ color: "#92400e" }}>📋 Borrador restaurado — {carrito.length} producto{carrito.length !== 1 ? "s" : ""} para <b>{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</b></span>
          <button onClick={() => { setCarrito([]); setClienteId(""); setClienteSeleccionado(null); setBusquedaCliente(""); localStorage.removeItem("vetix_borrador") }}
            style={{ background: "none", border: "none", color: "#b45309", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Descartar ×</button>
        </div>
      )}
      {tab === "nueva" && (
        <div className="ventas-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Cliente + Factura */}
            <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Datos de la venta</p>
              <div className="ventas-datos-grid" style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12 }}>
                {/* Buscador de clientes */}
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Cliente *</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      value={busquedaCliente}
                      onChange={e => {
                        setBusquedaCliente(e.target.value)
                        setClienteDropdown(true)
                        setClienteIndice(-1)
                        if (!e.target.value) limpiarCliente()
                      }}
                      onFocus={() => setClienteDropdown(true)}
                      onBlur={() => setTimeout(() => setClienteDropdown(false), 150)}
                      onKeyDown={e => {
                        const filtrados = clientes.filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busquedaCliente.trim().toLowerCase())).slice(0, 8)
                        if (e.key === "ArrowDown") { e.preventDefault(); setClienteIndice(i => Math.min(i + 1, filtrados.length - 1)) }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setClienteIndice(i => Math.max(i - 1, 0)) }
                        else if (e.key === "Enter" && clienteIndice >= 0) { e.preventDefault(); seleccionarCliente(filtrados[clienteIndice]) }
                        else if (e.key === "Escape") { setClienteDropdown(false) }
                      }}
                      style={{ width: "100%", padding: "10px 36px 10px 14px", border: clienteSeleccionado ? "1px solid #3b82f6" : "1px solid #d1d5db", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box", background: clienteSeleccionado ? "#f0f9ff" : "white" }}
                    />
                    {clienteSeleccionado && (
                      <button onClick={limpiarCliente} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
                    )}
                  </div>
                  {clienteDropdown && busquedaCliente && !clienteSeleccionado && (() => {
                    const filtrados = clientes.filter(c => (c.nombre + " " + c.apellido).toLowerCase().includes(busquedaCliente.trim().toLowerCase())).slice(0, 8)
                    if (!filtrados.length) return null
                    return (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" }}>
                        {filtrados.map((c, idx) => (
                          <div key={c.id} onMouseDown={() => seleccionarCliente(c)}
                            style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f8fafc", background: idx === clienteIndice ? "#eff6ff" : "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, color: "#111827" }}>{c.nombre} {c.apellido}</span>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>{c.localidad || ""}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                  {clienteSeleccionado && (
                    <div style={{ marginTop: 6, padding: "6px 10px", background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd", fontSize: 12, color: "#0369a1", display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {clienteSeleccionado.localidad && <span>📍 {clienteSeleccionado.localidad}</span>}
                      {clienteSeleccionado.telefono && <span>📞 {clienteSeleccionado.telefono}</span>}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>N° Presupuesto</label>
                  <input type="text" value={nroFactura} readOnly
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box", background: "#f8fafc", cursor: "default" }} />
                </div>
              </div>
            </div>

            {/* Buscador productos */}
            <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>Agregar producto</p>
              <div className="ventas-agregar-grid" style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10, alignItems: "end" }}>
                <div style={{ position: "relative" }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Buscar producto</label>
                  <input
                    ref={inputProductoRef}
                    type="text"
                    placeholder="Escribí para buscar..."
                    value={busquedaProducto}
                    onChange={e => { setBusquedaProducto(e.target.value); setProductoId(""); setProductoIndice(-1) }}
                    onKeyDown={e => {
                      if (e.key === "ArrowDown") { e.preventDefault(); setProductoIndice(i => Math.min(i + 1, productosFiltrados.length - 1)) }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setProductoIndice(i => Math.max(i - 1, 0)) }
                      else if (e.key === "Enter") {
                        e.preventDefault()
                        if (productoIndice >= 0 && productosFiltrados[productoIndice]) {
                          const p = productosFiltrados[productoIndice]
                          setProductoId(String(p.id)); setBusquedaProducto(p.nombre); setProductoIndice(-1)
                          setTimeout(() => inputCantidadRef.current?.focus(), 50)
                        } else if (productoId) {
                          agregarAlCarrito()
                        }
                      }
                      else if (e.key === "Escape") { setBusquedaProducto(""); setProductoId(""); setProductoIndice(-1) }
                    }}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                  />
                  {busquedaProducto && productosFiltrados.length > 0 && !productoId && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, maxHeight: 240, overflowY: "auto" }}>
                      {productosFiltrados.map((p, idx) => (
                        <div key={p.id}
                          onMouseDown={() => { setProductoId(String(p.id)); setBusquedaProducto(p.nombre); setProductoIndice(-1); setTimeout(() => inputCantidadRef.current?.focus(), 50) }}
                          style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: idx === productoIndice ? "#eff6ff" : "white" }}>
                          <span style={{ color: "#111827", fontWeight: 500 }}>{p.nombre}</span>
                          <span style={{ color: p.stock === 0 ? "#ef4444" : "#6b7280", fontSize: 12, marginLeft: 8, flexShrink: 0 }}>
                            {p.stock === 0 ? "Sin stock" : `Stock: ${p.stock}`} · ${p.precio_venta?.toLocaleString("es-AR")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Cantidad</label>
                  <input
                    ref={inputCantidadRef}
                    type="number" min="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && agregarAlCarrito()}
                    style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", textAlign: "center" }} />
                </div>
              </div>
              <button onClick={agregarAlCarrito} disabled={!productoId}
                style={{
                  marginTop: 10, width: "100%", padding: "11px",
                  background: productoId ? "#0f172a" : "#f1f5f9",
                  color: productoId ? "white" : "#94a3b8",
                  border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700,
                  cursor: productoId ? "pointer" : "not-allowed", letterSpacing: 0.3
                }}>
                + Agregar al carrito
              </button>
            </div>

            {/* Carrito */}
            {carrito.length > 0 && (
              <div style={{ background: "white", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f1f5f9", background: "#fafafa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Carrito</span>
                    <span style={{ background: "#0f172a", color: "white", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                      {carrito.length} producto{carrito.length !== 1 ? "s" : ""}
                    </span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>· {carrito.reduce((acc, i) => acc + i.cantidad, 0)} u.</span>
                  </div>
                  <button onClick={vaciarCarrito} style={{ background: "transparent", color: "#94a3b8", border: "none", borderRadius: 7, padding: "4px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Vaciar ✕
                  </button>
                </div>

                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {carrito.map((item, i) => {
                    const bonif = item.bonificacion || 0
                    const pagan = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
                    const pEfectivo = precioEfectivo(item)
                    const subtotalItem = pagan * pEfectivo
                    const tieneDescuento = (item.descuento || 0) > 0
                    return (
                      <div key={i} style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        {/* Fila principal */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "white" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input
                              type="text"
                              value={item.nombre}
                              onChange={e => cambiarNombre(i, e.target.value)}
                              style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", border: "none", outline: "none", background: "transparent", width: "100%", padding: 0, fontFamily: "inherit" }}
                            />
                            {bonif > 0 && <div style={{ fontSize: 11, color: "#d97706", fontWeight: 600, marginTop: 2 }}>{item.cantidad} u. · {bonif} bonif. · {pagan} pagan</div>}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{fmt(subtotalItem)}</div>
                            <div style={{ fontSize: 11, color: tieneDescuento ? "#16a34a" : "#94a3b8", marginTop: 1 }}>
                              {tieneDescuento
                                ? <span><s style={{ color: "#94a3b8" }}>{fmt(item.precio)}</s> → {fmt(pEfectivo)} c/u</span>
                                : <span>{fmt(item.precio)} c/u</span>}
                            </div>
                          </div>
                          <button onClick={() => eliminarItem(i)} style={{ width: 28, height: 28, border: "none", background: "#fef2f2", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#dc2626", flexShrink: 0 }}>✕</button>
                        </div>

                        {/* Fila controles */}
                        <div className="ventas-item-controles" style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
                          {/* Cantidad */}
                          <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                            <button onClick={() => restar(i)} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#374151" }}>−</button>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 28, textAlign: "center", borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0", height: 30, lineHeight: "30px" }}>{item.cantidad}</span>
                            <button onClick={() => sumar(i)} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#374151" }}>+</button>
                          </div>
                          {/* Precio */}
                          <div className="ventas-item-precio" style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 100 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>Precio u.</label>
                            <input type="number" step="0.01" value={Math.round(item.precio * 100) / 100} onChange={e => cambiarPrecio(i, Number(e.target.value))}
                              style={{ flex: 1, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", boxSizing: "border-box", background: "white", minWidth: 60 }} />
                          </div>
                          {/* Bonificación */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>Bonif.</label>
                            <input type="number" min="0" value={bonif} onChange={e => cambiarBonificacion(i, Number(e.target.value))}
                              style={{ width: 46, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, outline: "none", boxSizing: "border-box", background: "white", textAlign: "center" }} />
                          </div>
                          {/* Descuento */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: tieneDescuento ? "#16a34a" : "#94a3b8", textTransform: "uppercase", whiteSpace: "nowrap" }}>Desc.</label>
                            <div style={{ display: "flex", border: "1px solid #e2e8f0", borderRadius: 7, overflow: "hidden" }}>
                              <button onClick={() => cambiarTipoDescuento(i, "pesos")}
                                style={{ padding: "4px 7px", border: "none", background: (item.tipoDescuento || "pesos") !== "porcentaje" ? "#0f172a" : "white", color: (item.tipoDescuento || "pesos") !== "porcentaje" ? "white" : "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>$</button>
                              <button onClick={() => cambiarTipoDescuento(i, "porcentaje")}
                                style={{ padding: "4px 7px", border: "none", background: item.tipoDescuento === "porcentaje" ? "#0f172a" : "white", color: item.tipoDescuento === "porcentaje" ? "white" : "#6b7280", fontSize: 10, fontWeight: 700, cursor: "pointer", borderLeft: "1px solid #e2e8f0" }}>%</button>
                            </div>
                            <input type="number" min="0" value={item.descuento || ""} placeholder="0"
                              onChange={e => cambiarDescuento(i, Number(e.target.value))}
                              style={{ width: 80, padding: "5px 10px", border: tieneDescuento ? "1px solid #86efac" : "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, outline: "none", boxSizing: "border-box", background: tieneDescuento ? "#f0fdf4" : "white", textAlign: "center", color: tieneDescuento ? "#16a34a" : "#111827", fontWeight: tieneDescuento ? 700 : 400 }} />
                          </div>
                          <div style={{ fontSize: 10, color: "#cbd5e1", whiteSpace: "nowrap" }}>stock: {item.stockDisponible}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Resumen sticky */}
          <div className="ventas-resumen-sticky" style={{ position: "sticky", top: 20 }}>
            <div style={{ background: "#0f172a", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 }}>Resumen</p>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>IVA (%)</label>
                  <input type="number" value={iva} onChange={e => setIva(e.target.value)}
                    style={{ width: "100%", padding: "10px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>Cobro</label>
                  <select value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)} disabled={esCuentaCorriente}
                    style={{ width: "100%", padding: "10px 10px", background: esCuentaCorriente ? "rgba(255,255,255,0.03)" : "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: esCuentaCorriente ? "#4b5563" : "white", fontSize: 13, outline: "none", boxSizing: "border-box", cursor: esCuentaCorriente ? "not-allowed" : "pointer" }}>
                    <option value="efectivo" style={{ background: "#1e293b", color: "white" }}>Efectivo</option>
                    <option value="transferencia" style={{ background: "#1e293b", color: "white" }}>Transferencia</option>
                    <option value="cheque" style={{ background: "#1e293b", color: "white" }}>Cheque</option>
                    <option value="tarjeta" style={{ background: "#1e293b", color: "white" }}>Tarjeta</option>
                    <option value="otro" style={{ background: "#1e293b", color: "white" }}>Otro</option>
                  </select>
                </div>
              </div>
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
              <div onClick={() => setEsCuentaCorriente(!esCuentaCorriente)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer", marginBottom: 16, background: esCuentaCorriente ? "rgba(230,119,0,0.15)" : "rgba(255,255,255,0.04)", border: esCuentaCorriente ? "1px solid rgba(230,119,0,0.4)" : "1px solid rgba(255,255,255,0.08)", transition: "all 0.2s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: esCuentaCorriente ? "#e67700" : "rgba(255,255,255,0.1)", border: esCuentaCorriente ? "none" : "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {esCuentaCorriente && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: esCuentaCorriente ? "#fb923c" : "#9ca3af" }}>Cuenta corriente</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Queda pendiente de pago</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={guardarVenta} disabled={guardando || !clienteId || carrito.length === 0}
                  style={{ width: "100%", padding: "13px", background: guardando || !clienteId || carrito.length === 0 ? "rgba(255,255,255,0.05)" : esCuentaCorriente ? "linear-gradient(135deg, #c2410c, #ea580c)" : "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: guardando || !clienteId || carrito.length === 0 ? "not-allowed" : "pointer", opacity: guardando || !clienteId || carrito.length === 0 ? 0.5 : 1, boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}>
                  {guardando ? "Guardando..." : esCuentaCorriente ? "📋 Guardar en CC" : "✅ Confirmar venta"}
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button onClick={() => imprimirTicket("presupuesto")} disabled={!clienteSeleccionado || carrito.length === 0}
                    style={{ padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !clienteSeleccionado || carrito.length === 0 ? 0.4 : 1 }}>
                    🖨️ Presupuesto
                  </button>
                  <button onClick={() => imprimirTicket("remito")} disabled={!clienteSeleccionado || carrito.length === 0}
                    style={{ padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: !clienteSeleccionado || carrito.length === 0 ? 0.4 : 1 }}>
                    📦 Remito
                  </button>
                </div>
              </div>
              {carrito.length > 0 && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>Resumen carrito</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{carrito.reduce((acc, i) => acc + i.cantidad, 0)} unidades · {carrito.length} producto{carrito.length !== 1 ? "s" : ""}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB HISTORIAL ══ */}
      {tab === "historial" && (
        <div>
          <div className="ventas-historial-filtros" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              style={{ padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", color: "#111827" }} />
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              style={{ padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", color: "#111827" }} />
            <input type="text" placeholder="Buscar cliente o N° presupuesto..." value={busquedaHistorial}
              onChange={e => setBusquedaHistorial(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none" }} />
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", background: "white", color: "#111827" }}>
              <option value="todos">Todos los estados</option>
              <option value="cobrada">Cobradas</option>
              <option value="cuenta_corriente">Cuenta corriente</option>
              <option value="anulada">Anuladas</option>
            </select>
            <button onClick={cargarHistorial} style={{ padding: "10px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
              🔄 Actualizar
            </button>
            <button onClick={exportarVentas} disabled={ventasFiltradas.length === 0} style={{ padding: "10px 16px", background: "#16a34a", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: ventasFiltradas.length === 0 ? "not-allowed" : "pointer", color: "white", opacity: ventasFiltradas.length === 0 ? 0.5 : 1 }}>
              📊 Excel
            </button>
          </div>

          {ventasFiltradas.length > 0 && (
            <div className="ventas-resumen-cards" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {[
                { label: "Ventas", valor: ventasFiltradas.length, color: "#3b82f6" },
                { label: "Total", valor: fmt(totalHistorial), color: "#16a34a" },
                { label: "Cobradas", valor: ventasFiltradas.filter(v => v.estado === "cobrada").length, color: "#16a34a" },
                { label: "En CC", valor: ventasFiltradas.filter(v => v.estado === "cuenta_corriente").length, color: "#d97706" },
              ].map(s => (
                <div key={s.label} style={{ background: "white", borderRadius: 10, padding: "10px 16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.valor}</div>
                </div>
              ))}
            </div>
          )}

          {loadingHistorial ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
          ) : ventasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No hay ventas registradas.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ventasFiltradas.map(v => {
                const est = ESTADO_VENTA[v.estado] ?? ESTADO_VENTA.cobrada
                return (
                  <div key={v.id} className="ventas-historial-row" style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{v.clientes?.nombre} {v.clientes?.apellido}</span>
                        <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{est.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>📅 {fechaLocal(v.fecha)} · N° {v.nro_factura}</div>
                    </div>
                    <div className="acciones" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{fmt(Number(v.total))}</span>
                      <button onClick={() => verDetalle(v)} style={{ padding: "6px 12px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Ver</button>
                      <button onClick={() => reimprimir(v)} disabled={reimprimiendo} style={{ padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#2563eb" }}>🖨️</button>
                      {v.estado !== "anulada" && (
                        <button onClick={() => setConfirmAnular(v)} style={{ padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626" }}>Anular</button>
                      )}
                      {v.estado === "anulada" && (
                        <button onClick={() => setConfirmEliminarVenta(v)} style={{ padding: "6px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#dc2626" }}>🗑️ Borrar</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB BORRADORES ══ */}
      {tab === "borradores" && (
        <div>
          {!borradorAbierto ? (
            /* ── LISTA DE BORRADORES ── */
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#111827" }}>📝 Borradores</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>Pedidos guardados que todavía no se confirmaron como ventas</p>
                </div>
                <button onClick={crearBorrador} style={{ padding: "10px 20px", background: "#0f172a", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  ➕ Nuevo borrador
                </button>
              </div>

              {loadingBorradores ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Cargando...</div>
              ) : borradores.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
                  <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No hay borradores guardados</p>
                  <p style={{ fontSize: 13 }}>Creá uno nuevo para ir armando pedidos antes de confirmarlos como ventas.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {borradores.map(b => {
                    const nItems = (b.items || []).length
                    const totalEstimado = (b.items || []).reduce((acc: number, it: any) => acc + (it.precio || 0) * (it.cantidad || 1), 0)
                    const fechaUpd = b.updated_at ? new Date(b.updated_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""
                    return (
                      <div key={b.id} style={{ background: "white", borderRadius: 14, padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 4 }}>{b.titulo || "Sin título"}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {b.cliente_nombre && <span>👤 {b.cliente_nombre}</span>}
                            <span>📦 {nItems} producto{nItems !== 1 ? "s" : ""}</span>
                            {totalEstimado > 0 && <span>💰 {fmt(totalEstimado)}</span>}
                            {fechaUpd && <span>🕐 {fechaUpd}</span>}
                          </div>
                          {b.notas && <div style={{ marginTop: 6, fontSize: 12, color: "#4b5563", fontStyle: "italic", background: "#f9fafb", borderRadius: 6, padding: "4px 8px", display: "inline-block" }}>📝 {b.notas.slice(0, 80)}{b.notas.length > 80 ? "…" : ""}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                          <button onClick={() => abrirBorrador(b)} style={{ padding: "8px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>✏️ Editar</button>
                          <button onClick={() => pasarAVenta(b)} disabled={nItems === 0} style={{ padding: "8px 16px", background: nItems === 0 ? "#f3f4f6" : "#0f172a", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: nItems === 0 ? "not-allowed" : "pointer", color: nItems === 0 ? "#9ca3af" : "white" }}>✅ Pasar a venta</button>
                          <button onClick={() => eliminarBorrador(b.id)} style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#dc2626" }}>🗑️</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── EDITOR DE BORRADOR ── */
            <div>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <button onClick={cerrarBorrador} style={{ padding: "8px 14px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>← Volver</button>
                <input
                  type="text"
                  value={borrTitulo}
                  onChange={e => setBorrTitulo(e.target.value)}
                  placeholder="Título del borrador..."
                  style={{ flex: 1, minWidth: 200, padding: "9px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 15, fontWeight: 700, color: "#111827", outline: "none" }}
                />
              </div>

              <div className="ventas-borrador-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
                {/* Columna izquierda: cliente + producto + notas */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Cliente */}
                  <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Cliente (opcional)</p>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={borrBusqCliente}
                        onChange={e => { setBorrBusqCliente(e.target.value); setBorrDropCliente(true); if (!e.target.value) setBorrClienteObj(null) }}
                        onFocus={() => setBorrDropCliente(true)}
                        onBlur={() => setTimeout(() => setBorrDropCliente(false), 150)}
                        style={{ width: "100%", padding: "10px 36px 10px 14px", border: borrClienteObj ? "1px solid #3b82f6" : "1px solid #d1d5db", borderRadius: 10, fontSize: 14, color: "#111827", outline: "none", boxSizing: "border-box", background: borrClienteObj ? "#f0f9ff" : "white" }}
                      />
                      {borrClienteObj && (
                        <button onClick={() => { setBorrClienteObj(null); setBorrBusqCliente("") }} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18, padding: 0 }}>×</button>
                      )}
                      {borrDropCliente && borrBusqCliente && !borrClienteObj && (() => {
                        const filtrados = clientes.filter((c: any) => (c.nombre + " " + c.apellido).toLowerCase().includes(borrBusqCliente.trim().toLowerCase())).slice(0, 6)
                        if (!filtrados.length) return null
                        return (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" }}>
                            {filtrados.map((c: any) => (
                              <div key={c.id} onMouseDown={() => { setBorrClienteObj(c); setBorrBusqCliente(`${c.nombre} ${c.apellido || ""}`.trim()); setBorrDropCliente(false) }}
                                style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 600, color: "#111827" }}>{c.nombre} {c.apellido}</span>
                                <span style={{ fontSize: 11, color: "#9ca3af" }}>{c.localidad || ""}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                    {borrClienteObj && (
                      <div style={{ marginTop: 8, padding: "6px 10px", background: "#f0f9ff", borderRadius: 8, border: "1px solid #bae6fd", fontSize: 12, color: "#0369a1", display: "flex", gap: 12 }}>
                        {borrClienteObj.localidad && <span>📍 {borrClienteObj.localidad}</span>}
                        {borrClienteObj.telefono && <span>📞 {borrClienteObj.telefono}</span>}
                      </div>
                    )}
                  </div>

                  {/* Buscador de productos */}
                  <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Agregar producto</p>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder="Buscar producto..."
                        value={borrBusqProducto}
                        onChange={e => setBorrBusqProducto(e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}
                      />
                      {borrBusqProducto && (() => {
                        const termino = borrBusqProducto.trim().toLowerCase()
                        const palabras = termino.split(" ").filter(Boolean)
                        const filtrados = productos.filter(p => {
                          if (!palabras.length) return false
                          const campo = p.nombre.toLowerCase() + " " + (p.laboratorio || "").toLowerCase()
                          return campo.includes(termino) || palabras.every((w: string) => campo.includes(w))
                        }).slice(0, 8)
                        if (!filtrados.length) return null
                        return (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "white", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, overflow: "hidden" }}>
                            {filtrados.map((p: any) => (
                              <div key={p.id} onMouseDown={() => agregarProductoABorrador(p)}
                                style={{ padding: "10px 14px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontWeight: 600, color: "#111827" }}>{p.nombre}</span>
                                <span style={{ fontSize: 12, color: "#6b7280" }}>{fmt(p.precio_venta)} · stock: {p.stock}</span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Notas */}
                  <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Notas internas</p>
                    <textarea
                      value={borrNotas}
                      onChange={e => setBorrNotas(e.target.value)}
                      placeholder="Observaciones, aclaraciones del cliente, condiciones especiales..."
                      rows={3}
                      style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", color: "#374151" }}
                    />
                  </div>
                </div>

                {/* Columna derecha: lista de items + acciones */}
                <div style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Productos del pedido</p>

                    {borrItems.length === 0 ? (
                      <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", padding: "20px 0" }}>Buscá productos a la izquierda para agregarlos</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {borrItems.map((item: any, idx: number) => (
                          <div key={item.producto_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</div>
                              <div style={{ fontSize: 12, color: "#6b7280" }}>{fmt(item.precio)} c/u</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button onClick={() => setBorrItems(prev => prev.map((i: any, ix: number) => ix === idx ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i))}
                                style={{ width: 26, height: 26, border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                              <span style={{ fontSize: 13, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{item.cantidad}</span>
                              <button onClick={() => setBorrItems(prev => prev.map((i: any, ix: number) => ix === idx ? { ...i, cantidad: i.cantidad + 1 } : i))}
                                style={{ width: 26, height: 26, border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                            </div>
                            <button onClick={() => setBorrItems(prev => prev.filter((_: any, ix: number) => ix !== idx))}
                              style={{ width: 26, height: 26, border: "1px solid #fecaca", borderRadius: 6, background: "#fef2f2", cursor: "pointer", fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                          </div>
                        ))}
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>Total estimado</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{fmt(borrItems.reduce((acc: number, i: any) => acc + i.precio * i.cantidad, 0))}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <button onClick={guardarBorrador} disabled={borrGuardando}
                    style={{ width: "100%", padding: "12px", background: borrGuardando ? "#94a3b8" : "#0f172a", border: "none", borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: borrGuardando ? "not-allowed" : "pointer" }}>
                    {borrGuardando ? "Guardando..." : "💾 Guardar borrador"}
                  </button>
                  <button onClick={() => pasarAVenta()} disabled={borrItems.length === 0}
                    style={{ width: "100%", padding: "12px", background: borrItems.length === 0 ? "#f3f4f6" : "#16a34a", border: "none", borderRadius: 10, color: borrItems.length === 0 ? "#9ca3af" : "white", fontSize: 14, fontWeight: 700, cursor: borrItems.length === 0 ? "not-allowed" : "pointer" }}>
                    ✅ Pasar a venta
                  </button>
                  <button onClick={() => eliminarBorrador(borradorAbierto.id)}
                    style={{ width: "100%", padding: "10px", background: "white", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    🗑️ Eliminar borrador
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB NOTAS DE CRÉDITO ══ */}
      {tab === "notascredito" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>Notas de Crédito</h2>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Devoluciones de productos — generá una desde el detalle de cualquier venta</p>
            </div>
          </div>
          {loadingNC ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>Cargando...</p>
          ) : notasCredito.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>↩️</div>
              <p style={{ fontSize: 15, fontWeight: 600 }}>No hay notas de crédito</p>
              <p style={{ fontSize: 13 }}>Para crear una, abrí el detalle de una venta y hacé clic en "Nota de Crédito"</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notasCredito.map((nc: any) => {
                const estadoColor = nc.estado === "anulada" ? { bg: "#fef2f2", color: "#dc2626" } : { bg: "#f0fdf4", color: "#16a34a" }
                const items: any[] = nc.items || []
                return (
                  <div key={nc.id} style={{ background: "white", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{nc.nro_nota}</span>
                        <span style={{ background: estadoColor.bg, color: estadoColor.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{nc.estado === "anulada" ? "Anulada" : "Activa"}</span>
                      </div>
                      <p style={{ margin: "0 0 4px", fontSize: 13, color: "#374151", fontWeight: 600 }}>{nc.clientes?.nombre} {nc.clientes?.apellido}</p>
                      <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>Presupuesto N° {nc.ventas?.nro_factura ?? nc.venta_id} · {fechaLocal(nc.fecha)}</p>
                      {nc.motivo && <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>Motivo: {nc.motivo}</p>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {items.map((it: any, i: number) => (
                          <span key={i} style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#374151" }}>{it.nombre} ×{it.cantidad}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 16, color: "#059669" }}>{fmt(Number(nc.total))}</p>
                      {nc.estado !== "anulada" && (
                        <button onClick={() => { if (confirm("¿Anular esta nota de crédito? Se revertirá el stock y se restaurará el total de la venta original.")) anularNC(nc) }}
                          style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL CREAR NOTA DE CRÉDITO ── */}
      {modalNC && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 55, padding: 16 }} onClick={() => !guardandoNC && setModalNC(null)}>
          <div style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 520, maxHeight: "85vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Nueva Nota de Crédito</h2>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Venta N° {modalNC.venta.nro_factura} · {modalNC.venta.clientes?.nombre} {modalNC.venta.clientes?.apellido}</p>
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 4px" }}>Productos a devolver</p>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>Todos los productos están seleccionados. Usá − para reducir la cantidad o poner en 0 para excluir un producto.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {modalNC.items.length === 0 ? (
                <div style={{ padding: "20px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>⚠️ Esta venta no tiene productos registrados en detalle</p>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6b7280" }}>No se puede generar nota de crédito sin detalle de productos</p>
                </div>
              ) : modalNC.items.map((it: any) => {
                const maxCant = it.cantidad
                const cantSelec = ncCantidades[it.producto_id] ?? maxCant
                return (
                  <div key={it.producto_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: cantSelec > 0 ? "#f0fdf4" : "#f9fafb", borderRadius: 10, border: cantSelec > 0 ? "1px solid #86efac" : "1px solid #e5e7eb" }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: cantSelec > 0 ? "#111827" : "#9ca3af" }}>{it.productos?.nombre || "Producto sin nombre"}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                        Facturado: {maxCant} u. × {fmt(it.precio)}
                        {cantSelec > 0 && cantSelec < maxCant && <span style={{ color: "#d97706", fontWeight: 600 }}> · devolviendo {cantSelec}</span>}
                        {cantSelec === 0 && <span style={{ color: "#9ca3af" }}> · no se devuelve</span>}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Cant.:</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => setNcCantidades(prev => ({ ...prev, [it.producto_id]: Math.max(0, (prev[it.producto_id] ?? maxCant) - 1) }))}
                          style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <span style={{ minWidth: 28, textAlign: "center", fontWeight: 800, fontSize: 15, color: cantSelec > 0 ? "#059669" : "#9ca3af" }}>{cantSelec}</span>
                        <button onClick={() => setNcCantidades(prev => ({ ...prev, [it.producto_id]: Math.min(maxCant, (prev[it.producto_id] ?? maxCant) + 1) }))}
                          style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Motivo (opcional)</label>
              <input type="text" value={ncMotivo} onChange={e => setNcMotivo(e.target.value)} placeholder="Ej: producto dañado, error en pedido..."
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
            </div>

            {(() => {
              const itemsSelec = modalNC.items.filter((it: any) => (ncCantidades[it.producto_id] ?? it.cantidad) > 0)
              const totalNC = itemsSelec.reduce((acc: number, it: any) => acc + it.precio * (ncCantidades[it.producto_id] ?? it.cantidad), 0)
              const cantExcluidos = modalNC.items.length - itemsSelec.length
              return (
                <div style={{ background: totalNC > 0 ? "#f0fdf4" : "#fef9c3", border: `1px solid ${totalNC > 0 ? "#86efac" : "#fde047"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: totalNC > 0 ? "#15803d" : "#92400e", fontWeight: 600 }}>
                        {totalNC > 0 ? "Total a acreditar" : "⚠️ Ningún producto seleccionado"}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>
                        {totalNC > 0
                          ? `${itemsSelec.length} producto${itemsSelec.length !== 1 ? "s" : ""} · Se descuenta del total original${cantExcluidos > 0 ? ` · ${cantExcluidos} excluido${cantExcluidos !== 1 ? "s" : ""}` : ""}`
                          : "Usá los botones + para seleccionar qué productos devuelve el cliente"}
                      </p>
                    </div>
                    {totalNC > 0 && <span style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{fmt(totalNC)}</span>}
                  </div>
                </div>
              )
            })()}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalNC(null)} disabled={guardandoNC}
                style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarNC} disabled={guardandoNC}
                style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #059669, #10b981)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardandoNC ? 0.6 : 1 }}>
                {guardandoNC ? "Generando..." : "✅ Confirmar Nota de Crédito"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DETALLE VENTA ── */}
      {ventaDetalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={() => setVentaDetalle(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, margin: 0 }}>{ventaDetalle.clientes?.nombre} {ventaDetalle.clientes?.apellido}</h2>
                {(() => { const est = ESTADO_VENTA[ventaDetalle.estado] ?? ESTADO_VENTA.cobrada; return <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6 }}>{est.label}</span> })()}
              </div>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "6px 0 0" }}>N° {ventaDetalle.nro_factura} · {fechaLocal(ventaDetalle.fecha)}</p>
            </div>
            {loadingDetalle ? <p style={{ color: "#6b7280", fontSize: 13 }}>Cargando...</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {detalleItems.map((d: any) => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div>
                      <div style={{ color: "white", fontSize: 13, fontWeight: 500 }}>{d.productos?.nombre}</div>
                      <div style={{ color: "#6b7280", fontSize: 11 }}>{d.cantidad} u. × {fmt(d.precio)}</div>
                    </div>
                    <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 13 }}>{fmt(d.cantidad * d.precio)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ color: "#9ca3af", fontSize: 13 }}>Total</span>
              <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>{fmt(Number(ventaDetalle.total))}</span>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => reimprimir(ventaDetalle, detalleItems.length ? detalleItems : undefined)}
                disabled={reimprimiendo || loadingDetalle}
                style={{ flex: 1, minWidth: 110, padding: "10px", background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: reimprimiendo || loadingDetalle ? 0.6 : 1 }}>
                {reimprimiendo ? "Generando..." : "🖨️ Presupuesto"}
              </button>
              <button
                onClick={() => reimprimir(ventaDetalle, detalleItems.length ? detalleItems : undefined, "remito")}
                disabled={reimprimiendo || loadingDetalle}
                style={{ flex: 1, minWidth: 110, padding: "10px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#e2e8f0", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: reimprimiendo || loadingDetalle ? 0.6 : 1 }}>
                📦 Remito
              </button>
              {ventaDetalle.estado !== "anulada" && (
                <button onClick={() => abrirModalNC(ventaDetalle)} disabled={loadingDetalle || cargandoItemsNC} style={{ flex: 1, minWidth: 120, padding: "10px", background: "linear-gradient(135deg, #059669, #10b981)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: (loadingDetalle || cargandoItemsNC) ? 0.6 : 1 }}>
                  {cargandoItemsNC ? "Cargando..." : "↩️ Nota de Crédito"}
                </button>
              )}
              {ventaDetalle.estado !== "anulada" && (
                <button onClick={() => { setConfirmAnular(ventaDetalle); setVentaDetalle(null) }} style={{ flex: 1, minWidth: 120, padding: "10px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Anular venta</button>
              )}
              {ventaDetalle.estado === "anulada" && (
                <button onClick={() => { setConfirmEliminarVenta(ventaDetalle); setVentaDetalle(null) }} style={{ flex: 1, minWidth: 120, padding: "10px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>🗑️ Borrar venta</button>
              )}
              <button onClick={() => setVentaDetalle(null)} style={{ flex: 1, minWidth: 120, padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINAR VENTA ANULADA ── */}
      {confirmEliminarVenta && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setConfirmEliminarVenta(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑️</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>¿Eliminar venta anulada?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>Cliente: <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminarVenta.clientes?.nombre} {confirmEliminarVenta.clientes?.apellido}</span></p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>N° {confirmEliminarVenta.nro_factura} · {fechaLocal(confirmEliminarVenta.fecha)}</p>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 24 }}>
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>Se elimina el registro definitivamente. El stock ya fue restaurado al anularla.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminarVenta(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminarVenta} disabled={eliminandoVenta} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: eliminandoVenta ? 0.5 : 1 }}>
                {eliminandoVenta ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ANULACIÓN ── */}
      {confirmAnular && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={() => setConfirmAnular(null)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>¿Anular venta?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>Cliente: <span style={{ color: "white", fontWeight: 600 }}>{confirmAnular.clientes?.nombre} {confirmAnular.clientes?.apellido}</span></p>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>Total: <span style={{ color: "white", fontWeight: 600 }}>{fmt(Number(confirmAnular.total))}</span> · N° {confirmAnular.nro_factura}</p>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 24 }}>
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ El stock se va a restaurar automáticamente. Esta acción no se puede deshacer.</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmAnular(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={anularVenta} disabled={anulando} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: anulando ? 0.5 : 1 }}>
                {anulando ? "Anulando..." : "Anular venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}