"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"

// ── Tipos ─────────────────────────────────────────────────────────────────────
type PedidoItem = {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

type ModalItem = {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  bonificacion: number
}

type Pedido = {
  id: number
  created_at: string
  estado: string
  total: number
  notas: string | null
  usuario_id: string | null
  pedido_items: PedidoItem[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type ClienteDB = {
  id: number
  nombre: string
  apellido: string
  email?: string | null
}

type MatchEstado = "buscando" | "encontrado" | "no_encontrado" | "sin_email"

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR")
const fechaCorta = (s: string) =>
  new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })

const pNombre   = (p: Pedido) => p.cliente_nombre   ?? p.nombre   ?? "Sin nombre"
const pEmail    = (p: Pedido) => p.cliente_email    ?? p.email    ?? null
const pTelefono = (p: Pedido) => p.cliente_telefono ?? p.telefono ?? null
const pDireccion = (p: Pedido) => p.cliente_direccion ?? p.direccion ?? null

const ESTADOS = ["pendiente", "confirmado", "en preparación", "enviado", "entregado", "procesado", "cancelado"]
const ESTADO_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  pendiente:        { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  confirmado:       { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "en preparación": { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe" },
  enviado:          { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  entregado:        { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  procesado:        { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
  cancelado:        { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
}

function calcTotal(items: ModalItem[]) {
  return items.reduce((s, i) => s + i.precio_unitario * Math.max(0, i.cantidad - i.bonificacion), 0)
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function TiendaOnline() {
  const [pedidos, setPedidos]             = useState<Pedido[]>([])
  const [loading, setLoading]             = useState(true)
  const [filtroEstado, setFiltroEstado]   = useState("todos")
  const [expandedId, setExpandedId]       = useState<number | null>(null)
  const [guardandoEstado, setGuardandoEstado] = useState<number | null>(null)

  // Eliminar pedido
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [eliminandoPedido, setEliminandoPedido] = useState(false)

  // Clientes internos
  const [clientes, setClientes] = useState<ClienteDB[]>([])

  // Modal pasar a venta
  const [modalVenta, setModalVenta]     = useState<Pedido | null>(null)
  const [modalItems, setModalItems]     = useState<ModalItem[]>([])
  const [matchEstado, setMatchEstado]   = useState<MatchEstado | null>(null)
  const [busqCliente, setBusqCliente]   = useState("")
  const [clienteSelId, setClienteSelId] = useState<number | null>(null)
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
  const [metodoCobro, setMetodoCobro]   = useState("efectivo")
  const [creandoVenta, setCreandoVenta] = useState(false)
  const [creandoCliente, setCreandoCliente] = useState(false)
  const [ventaCreada, setVentaCreada]   = useState<{ nro: string; id: number } | null>(null)
  const [errorVenta, setErrorVenta]     = useState("")

  // ── Lookup email → id para badges en la lista ─────────────────────────────
  const emailMap = useMemo(() => {
    const m = new Map<string, number>()
    clientes.forEach(c => { if (c.email) m.set(c.email.toLowerCase(), c.id) })
    return m
  }, [clientes])

  // ── Cargar pedidos ────────────────────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(producto_id, nombre_producto, cantidad, precio_unitario)")
      .is("nombre_proveedor", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300)
    setPedidos((data as Pedido[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { cargarPedidos() }, [cargarPedidos])

  // ── Cargar clientes ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from("clientes").select("id, nombre, apellido, email").order("nombre").then(({ data }) => {
      setClientes((data as ClienteDB[]) ?? [])
    })
  }, [])

  // ── Cambiar estado ────────────────────────────────────────────────────────
  async function cambiarEstado(id: number, estado: string) {
    setGuardandoEstado(id)
    setPedidos(ps => ps.map(p => p.id === id ? { ...p, estado } : p))
    await supabase.from("pedidos").update({ estado }).eq("id", id)
    setGuardandoEstado(null)
  }

  // ── Eliminar pedido ───────────────────────────────────────────────────────
  async function eliminarPedido() {
    if (!confirmDeleteId) return
    setEliminandoPedido(true)
    await supabase.from("pedidos").update({ deleted_at: new Date().toISOString() }).eq("id", confirmDeleteId)
    setPedidos(ps => ps.filter(p => p.id !== confirmDeleteId))
    setConfirmDeleteId(null)
    setExpandedId(null)
    setEliminandoPedido(false)
  }

  // ── Abrir modal con autodetección ─────────────────────────────────────────
  function abrirModal(p: Pedido) {
    setModalVenta(p)
    setModalItems((p.pedido_items ?? []).map(i => ({
      producto_id: i.producto_id,
      nombre_producto: i.nombre_producto,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
      bonificacion: 0,
    })))
    setVentaCreada(null)
    setErrorVenta("")
    setEsCuentaCorriente(false)
    setMetodoCobro("efectivo")

    const email = pEmail(p)
    if (!email) {
      setMatchEstado("sin_email")
      setClienteSelId(null)
      setBusqCliente("")
      return
    }

    setMatchEstado("buscando")
    const match = clientes.find(c => c.email?.toLowerCase() === email.toLowerCase())
    if (match) {
      setClienteSelId(match.id)
      setBusqCliente(`${match.nombre} ${match.apellido}`)
      setMatchEstado("encontrado")
    } else {
      setClienteSelId(null)
      setBusqCliente("")
      setMatchEstado("no_encontrado")
    }
  }

  function cerrarModal() {
    setModalVenta(null)
    setModalItems([])
    setClienteSelId(null)
    setBusqCliente("")
    setMatchEstado(null)
    setEsCuentaCorriente(false)
    setMetodoCobro("efectivo")
    setVentaCreada(null)
    setErrorVenta("")
  }

  // ── Crear cliente desde datos del pedido ─────────────────────────────────
  async function crearClienteDesde(p: Pedido) {
    setCreandoCliente(true)
    setErrorVenta("")
    const nombreCompleto = pNombre(p)
    const partes = nombreCompleto.trim().split(" ")
    const nombre   = partes[0] ?? nombreCompleto
    const apellido = partes.slice(1).join(" ")

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre,
        apellido: apellido || null,
        email: pEmail(p) ?? null,
        telefono: pTelefono(p) ?? null,
        localidad: pDireccion(p) ?? null,
      })
      .select("id, nombre, apellido, email")
      .single()

    if (error || !data) {
      setErrorVenta("Error al crear el cliente: " + (error?.message ?? "intentá de nuevo"))
      setCreandoCliente(false)
      return
    }

    // Agregar a la lista local y seleccionar
    const nuevo = data as ClienteDB
    setClientes(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setClienteSelId(nuevo.id)
    setBusqCliente(`${nuevo.nombre} ${nuevo.apellido ?? ""}`.trim())
    setMatchEstado("encontrado")
    setCreandoCliente(false)
  }

  // ── Editar items en modal ─────────────────────────────────────────────────
  function actualizarItem(idx: number, campo: keyof ModalItem, valor: number | string) {
    setModalItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }
  function quitarItem(idx: number) {
    setModalItems(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Pasar a venta ─────────────────────────────────────────────────────────
  async function pasarAVenta() {
    if (!modalVenta || !clienteSelId) { setErrorVenta("Seleccioná un cliente para continuar"); return }
    if (modalItems.length === 0) { setErrorVenta("El pedido no tiene items"); return }
    setCreandoVenta(true)
    setErrorVenta("")

    // 1. Número de factura
    let nroFactura = ""
    const { data: nroData } = await supabase.rpc("get_next_nro_factura")
    if (nroData) {
      nroFactura = String(nroData)
    } else {
      const { data: ultima } = await supabase.from("ventas").select("nro_factura").order("id", { ascending: false }).limit(1).maybeSingle()
      const n = parseInt(ultima?.nro_factura ?? "0", 10)
      nroFactura = String(isNaN(n) ? 1 : n + 1)
    }

    // 2. Costos de productos
    const prodIds = modalItems.filter(i => i.producto_id).map(i => i.producto_id!)
    const costosMap: Record<number, number> = {}
    if (prodIds.length > 0) {
      const { data: prods } = await supabase.from("productos").select("id, costo").in("id", prodIds)
      ;(prods as { id: number; costo: number | null }[] ?? []).forEach(p => { if (p.costo != null) costosMap[p.id] = p.costo })
    }

    // 3. Total con bonificación
    const total = calcTotal(modalItems)

    // 4. Crear venta
    const { data: venta, error: errVenta } = await supabase
      .from("ventas")
      .insert({
        cliente_id: clienteSelId,
        total,
        fecha: new Date(),
        estado: esCuentaCorriente ? "cuenta_corriente" : "cobrada",
        nro_factura: nroFactura,
        metodo_cobro: esCuentaCorriente ? null : metodoCobro,
      })
      .select()
      .single()

    if (errVenta || !venta) {
      setErrorVenta("Error al crear la venta. Intentá de nuevo.")
      setCreandoVenta(false)
      return
    }

    // 5. Detalle de venta
    const detalle = modalItems.map(item => ({
      venta_id: venta.id,
      producto_id: item.producto_id ?? null,
      cantidad: item.cantidad,
      precio: item.precio_unitario,
      bonificacion: item.bonificacion,
      costo_unitario: item.producto_id ? (costosMap[item.producto_id] ?? 0) : 0,
    }))
    const { error: errDetalle } = await supabase.from("detalle_ventas").insert(detalle)
    if (errDetalle) {
      setErrorVenta("Venta creada pero error en los items. Revisá en Ventas.")
      setCreandoVenta(false)
      return
    }

    // 6. Descontar stock
    for (const item of modalItems) {
      if (!item.producto_id) continue
      const { data: prod } = await supabase.from("productos").select("stock").eq("id", item.producto_id).single()
      if (prod) {
        await supabase.from("productos").update({
          stock: Math.max(0, prod.stock - item.cantidad)
        }).eq("id", item.producto_id)
      }
    }

    // 7. Cuenta corriente si aplica
    if (esCuentaCorriente) {
      const { data: ultimo } = await supabase.from("cuentas_corrientes")
        .select("saldo").eq("cliente_id", clienteSelId)
        .order("id", { ascending: false }).limit(1).maybeSingle()
      const nuevoSaldo = (ultimo?.saldo || 0) + total
      await supabase.from("cuentas_corrientes").insert({
        cliente_id: clienteSelId, tipo: "venta", monto: total,
        saldo: nuevoSaldo, venta_id: venta.id, fecha: new Date()
      })
    }

    // 8. Marcar pedido como procesado
    await supabase.from("pedidos").update({ estado: "procesado" }).eq("id", modalVenta.id)
    setPedidos(ps => ps.map(p => p.id === modalVenta.id ? { ...p, estado: "procesado" } : p))

    setVentaCreada({ nro: nroFactura, id: venta.id })
    setCreandoVenta(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p =>
    filtroEstado === "todos" || p.estado === filtroEstado
  )

  const clientesFiltrados = clientes.filter(c => {
    if (!busqCliente.trim()) return true
    const q = busqCliente.toLowerCase()
    return `${c.nombre} ${c.apellido} ${c.email ?? ""}`.toLowerCase().includes(q)
  }).slice(0, 40)

  const contadores = ESTADOS.reduce((acc, e) => {
    acc[e] = pedidos.filter(p => p.estado === e).length
    return acc
  }, {} as Record<string, number>)
  const pendientes = contadores["pendiente"] ?? 0

  const modalTotal = calcTotal(modalItems)

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Título */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
            Tienda Online
            {pendientes > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 800, background: "#e8197d", color: "white", borderRadius: 20, padding: "2px 10px" }}>
                {pendientes} nuevos
              </span>
            )}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            Pedidos recibidos desde la tienda web · {pedidos.length} total
          </p>
        </div>
        <button onClick={cargarPedidos} style={{ padding: "8px 16px", background: "#1e293b", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          ↺ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {["todos", ...ESTADOS].map(e => (
          <button key={e} onClick={() => setFiltroEstado(e)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: filtroEstado === e ? 800 : 600,
              border: `1.5px solid ${filtroEstado === e ? "#1d4ed8" : "#e2e8f0"}`,
              background: filtroEstado === e ? "#eff6ff" : "white",
              color: filtroEstado === e ? "#1d4ed8" : "#64748b",
              cursor: "pointer",
            }}>
            {e === "todos" ? "Todos" : e}
            {e !== "todos" && (contadores[e] ?? 0) > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 800, background: e === "pendiente" ? "#e8197d" : "#e2e8f0", color: e === "pendiente" ? "white" : "#64748b", borderRadius: 10, padding: "0 5px" }}>
                {contadores[e]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #1d4ed8", borderTopColor: "transparent", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
          Cargando pedidos...
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>
          {filtroEstado === "todos" ? "No hay pedidos todavía" : `No hay pedidos con estado "${filtroEstado}"`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pedidosFiltrados.map(p => {
            const est     = ESTADO_COLOR[p.estado] ?? ESTADO_COLOR.pendiente
            const expanded = expandedId === p.id
            const email    = pEmail(p)
            const vinculado = email ? emailMap.has(email.toLowerCase()) : null

            return (
              <div key={p.id} style={{ background: "white", borderRadius: 12, border: "1.5px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                {/* Header row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  style={{ padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flexWrap: "wrap" }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", minWidth: 46 }}>#{p.id}</span>
                  <span style={{ fontSize: 11.5, color: "#64748b", minWidth: 105, whiteSpace: "nowrap" }}>{fechaCorta(p.created_at)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 120 }}>{pNombre(p)}</span>

                  {/* Badge vinculación */}
                  {vinculado === true && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                      ● En base
                    </span>
                  )}
                  {vinculado === false && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                      ● Nuevo
                    </span>
                  )}
                  {vinculado === null && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                      Sin email
                    </span>
                  )}

                  <span style={{ fontSize: 12, color: "#64748b", minWidth: 150 }}>{email ?? "—"}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", minWidth: 90, textAlign: "right" }}>{fmt(p.total ?? 0)}</span>

                  {/* Estado select */}
                  <div onClick={e => e.stopPropagation()}>
                    <select
                      value={p.estado}
                      onChange={e => cambiarEstado(p.id, e.target.value)}
                      disabled={guardandoEstado === p.id}
                      style={{ padding: "4px 8px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none", border: `1.5px solid ${est.border}`, background: est.bg, color: est.color }}
                    >
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>

                  {/* Pasar a venta */}
                  {p.estado !== "procesado" && p.estado !== "cancelado" && (
                    <div onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => abrirModal(p)}
                        style={{ padding: "5px 12px", background: "#1d4ed8", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Pasar a venta →
                      </button>
                    </div>
                  )}
                  {p.estado === "procesado" && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                      ✓ Procesado
                    </span>
                  )}

                  <span style={{ fontSize: 12, color: "#94a3b8", userSelect: "none" }}>{expanded ? "▲" : "▼"}</span>
                </div>

                {/* Detalle expandido */}
                {expanded && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, marginBottom: 12 }}>
                      {pTelefono(p) && <span style={{ fontSize: 12, color: "#475569" }}>📞 {pTelefono(p)}</span>}
                      {pDireccion(p) && <span style={{ fontSize: 12, color: "#475569" }}>📍 {pDireccion(p)}</span>}
                    </div>
                    {p.notas && (
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#475569", whiteSpace: "pre-wrap" }}>
                        📝 <strong>Notas:</strong> {p.notas}
                      </div>
                    )}
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Producto", "Cantidad", "Precio unit.", "Subtotal"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {p.pedido_items?.map((item, i) => (
                          <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "7px 10px", fontSize: 12, color: "#0f172a" }}>{item.nombre_producto}</td>
                            <td style={{ padding: "7px 10px", fontSize: 12, color: "#475569" }}>{item.cantidad}</td>
                            <td style={{ padding: "7px 10px", fontSize: 12, color: "#475569" }}>{fmt(item.precio_unitario)}</td>
                            <td style={{ padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{fmt(item.precio_unitario * item.cantidad)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(p.id) }}
                        style={{ padding: "6px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        🗑 Eliminar pedido
                      </button>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Total: {fmt(p.total ?? 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Confirmación eliminar pedido ─────────────────────────────────── */}
      {confirmDeleteId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteId(null) }}
        >
          <div style={{ background: "white", borderRadius: 14, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>¿Eliminar pedido?</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
              Esta acción es permanente. El pedido #{confirmDeleteId} será eliminado junto con sus items.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: 10, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={eliminarPedido}
                disabled={eliminandoPedido}
                style={{ flex: 1, padding: 10, background: "#dc2626", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                {eliminandoPedido ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal pasar a venta ──────────────────────────────────────────── */}
      {modalVenta && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}
        >
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "92vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>Pasar a venta</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Pedido #{modalVenta.id} · {pNombre(modalVenta)}</p>
              </div>
              <button onClick={cerrarModal} style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#64748b" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {ventaCreada ? (
                // ── Éxito ──────────────────────────────────────────────
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>¡Venta registrada!</p>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>
                    Venta N° {String(ventaCreada.nro).padStart(5, "0")} creada · stock descontado · pedido procesado.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={cerrarModal} style={{ flex: 1, padding: "10px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
                    <a href="/ventas" style={{ flex: 1, padding: "10px", background: "#1d4ed8", color: "white", borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      Ver en Ventas →
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Items editables ─────────────────────────────── */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Productos del pedido
                    </p>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 70px 32px", gap: 6, padding: "6px 10px", background: "#f8fafc", fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>
                        <span>Producto</span>
                        <span style={{ textAlign: "center" }}>Cant.</span>
                        <span style={{ textAlign: "right" }}>Precio</span>
                        <span style={{ textAlign: "center" }}>Bonif.</span>
                        <span />
                      </div>
                      {modalItems.length === 0 && (
                        <div style={{ padding: "12px 10px", fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Sin items</div>
                      )}
                      {modalItems.map((item, idx) => (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 80px 90px 70px 32px", gap: 6, padding: "7px 10px", borderTop: "1px solid #f1f5f9", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.nombre_producto}>
                            {item.nombre_producto}
                          </span>
                          <input type="number" min={1} value={item.cantidad}
                            onChange={e => actualizarItem(idx, "cantidad", Math.max(1, parseInt(e.target.value) || 1))}
                            style={{ width: "100%", padding: "4px 6px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                          />
                          <input type="number" min={0} value={item.precio_unitario}
                            onChange={e => actualizarItem(idx, "precio_unitario", parseFloat(e.target.value) || 0)}
                            style={{ width: "100%", padding: "4px 6px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, textAlign: "right", outline: "none", boxSizing: "border-box" }}
                          />
                          <input type="number" min={0} max={item.cantidad} value={item.bonificacion}
                            onChange={e => actualizarItem(idx, "bonificacion", Math.min(item.cantidad, Math.max(0, parseInt(e.target.value) || 0)))}
                            style={{ width: "100%", padding: "4px 6px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 12, textAlign: "center", outline: "none", boxSizing: "border-box" }}
                          />
                          <button onClick={() => quitarItem(idx)}
                            style={{ width: 28, height: 28, border: "1px solid #fecaca", borderRadius: 6, background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                          >×</button>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderTop: "2px solid #e2e8f0", fontSize: 14, fontWeight: 900, background: "#f8fafc" }}>
                        <span style={{ color: "#475569", fontSize: 12 }}>Total (con bonif.)</span>
                        <span style={{ color: "#0f172a" }}>{fmt(modalTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Sección cliente con autodetección ───────────── */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Cliente *
                    </label>

                    {/* Banner de estado según match */}
                    {matchEstado === "encontrado" && clienteSelId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                        <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#15803d" }}>{busqCliente}</p>
                          <p style={{ margin: 0, fontSize: 11, color: "#16a34a" }}>Cliente encontrado en tu base de datos</p>
                        </div>
                        <button
                          onClick={() => { setClienteSelId(null); setBusqCliente(""); setMatchEstado("no_encontrado") }}
                          style={{ background: "none", border: "1px solid #86efac", borderRadius: 6, color: "#15803d", cursor: "pointer", fontSize: 11, padding: "3px 8px", fontWeight: 700 }}
                        >
                          Cambiar
                        </button>
                      </div>
                    )}

                    {matchEstado === "no_encontrado" && !clienteSelId && (
                      <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <svg width="15" height="15" fill="none" stroke="#b45309" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                            {pNombre(modalVenta)} no está en tu base de clientes
                          </p>
                        </div>
                        <p style={{ margin: "0 0 10px", fontSize: 11, color: "#b45309" }}>
                          Email: {pEmail(modalVenta)} · Tel: {pTelefono(modalVenta) ?? "—"} · Dir: {pDireccion(modalVenta) ?? "—"}
                        </p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => crearClienteDesde(modalVenta)}
                            disabled={creandoCliente}
                            style={{ flex: 1, padding: "8px 12px", background: "#1d4ed8", color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            {creandoCliente ? "Creando..." : "✦ Crear cliente con estos datos"}
                          </button>
                          <button
                            onClick={() => setMatchEstado("sin_email")}
                            style={{ padding: "8px 12px", background: "white", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                          >
                            Buscar manualmente
                          </button>
                        </div>
                      </div>
                    )}

                    {matchEstado === "sin_email" && !clienteSelId && (
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#64748b" }}>
                        Sin email en el pedido — buscá el cliente manualmente.
                      </div>
                    )}

                    {/* Buscador manual — visible cuando no hay cliente seleccionado */}
                    {!clienteSelId && (
                      <>
                        <input
                          placeholder="Buscar cliente por nombre o email..."
                          value={busqCliente}
                          onChange={e => { setBusqCliente(e.target.value); setClienteSelId(null) }}
                          style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
                          onFocus={e => (e.target.style.borderColor = "#1d4ed8")}
                          onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                        />
                        {busqCliente && (
                          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxHeight: 180, overflowY: "auto" }}>
                            {clientesFiltrados.length === 0 ? (
                              <div style={{ padding: "10px 12px", fontSize: 13, color: "#94a3b8" }}>Sin resultados</div>
                            ) : clientesFiltrados.map(c => (
                              <button key={c.id}
                                onClick={() => { setClienteSelId(c.id); setBusqCliente(`${c.nombre} ${c.apellido}`); setMatchEstado("encontrado") }}
                                style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left", background: "white", border: "none", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: 13 }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
                                onMouseLeave={e => (e.currentTarget.style.background = "white")}
                              >
                                <span style={{ fontWeight: 600, color: "#0f172a" }}>{c.nombre} {c.apellido}</span>
                                {c.email && <span style={{ color: "#64748b", marginLeft: 8, fontSize: 12 }}>{c.email}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* ── Cobro ───────────────────────────────────────── */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Cobro
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setEsCuentaCorriente(false)}
                        style={{ flex: 1, padding: "9px", borderRadius: 8, border: `2px solid ${!esCuentaCorriente ? "#1d4ed8" : "#e2e8f0"}`, background: !esCuentaCorriente ? "#eff6ff" : "white", color: !esCuentaCorriente ? "#1d4ed8" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >Cobrado</button>
                      <button onClick={() => setEsCuentaCorriente(true)}
                        style={{ flex: 1, padding: "9px", borderRadius: 8, border: `2px solid ${esCuentaCorriente ? "#1d4ed8" : "#e2e8f0"}`, background: esCuentaCorriente ? "#eff6ff" : "white", color: esCuentaCorriente ? "#1d4ed8" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >Cuenta corriente</button>
                    </div>
                    {!esCuentaCorriente && (
                      <select value={metodoCobro} onChange={e => setMetodoCobro(e.target.value)}
                        style={{ width: "100%", marginTop: 8, padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none" }}
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    )}
                  </div>

                  {errorVenta && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                      ⚠ {errorVenta}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={cerrarModal} style={{ flex: 1, padding: "11px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      Cancelar
                    </button>
                    <button
                      onClick={pasarAVenta}
                      disabled={creandoVenta || !clienteSelId || modalItems.length === 0}
                      style={{
                        flex: 2, padding: "11px",
                        background: creandoVenta || !clienteSelId || modalItems.length === 0 ? "#93c5fd" : "#1d4ed8",
                        color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 900,
                        cursor: creandoVenta || !clienteSelId || modalItems.length === 0 ? "not-allowed" : "pointer"
                      }}
                    >
                      {creandoVenta ? "Registrando venta..." : `✓ Pasar a venta · ${fmt(modalTotal)}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
