"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"

// ── Tipos ─────────────────────────────────────────────────────────────────────
type PedidoItem = {
  producto_id: number | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

type Pedido = {
  id: number
  created_at: string
  estado: string
  total: number
  notas: string | null
  usuario_id: string | null
  pedido_items: PedidoItem[]
  // columnas de cliente (nombre puede variar)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type ClienteDB = {
  id: number
  nombre: string
  apellido: string
  email?: string | null
}

type ProductoDB = {
  id: number
  costo: number | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-AR")
const fechaCorta = (s: string) =>
  new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })

const pNombre   = (p: Pedido) => p.cliente_nombre   ?? p.nombre   ?? "Sin nombre"
const pEmail    = (p: Pedido) => p.cliente_email    ?? p.email    ?? null
const pTelefono = (p: Pedido) => p.cliente_telefono ?? p.telefono ?? null

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

// ── Componente ────────────────────────────────────────────────────────────────
export default function TiendaOnline() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [guardandoEstado, setGuardandoEstado] = useState<number | null>(null)

  // Modal crear venta
  const [modalVenta, setModalVenta] = useState<Pedido | null>(null)
  const [clientes, setClientes] = useState<ClienteDB[]>([])
  const [busqCliente, setBusqCliente] = useState("")
  const [clienteSelId, setClienteSelId] = useState<number | null>(null)
  const [esCuentaCorriente, setEsCuentaCorriente] = useState(false)
  const [metodoCobro, setMetodoCobro] = useState("efectivo")
  const [creandoVenta, setCreandoVenta] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<{ nro: string; id: number } | null>(null)
  const [errorVenta, setErrorVenta] = useState("")

  // ── Cargar pedidos ────────────────────────────────────────────────────────
  const cargarPedidos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("pedidos")
      .select("*, pedido_items(producto_id, nombre_producto, cantidad, precio_unitario)")
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

  // ── Crear venta ────────────────────────────────────────────────────────────
  async function crearVenta() {
    if (!modalVenta || !clienteSelId) { setErrorVenta("Seleccioná un cliente para continuar"); return }
    setCreandoVenta(true)
    setErrorVenta("")

    // 1. Obtener nro_factura
    let nroFactura = ""
    const { data: nroData } = await supabase.rpc("get_next_nro_factura")
    if (nroData) {
      nroFactura = String(nroData)
    } else {
      const { data: ultima } = await supabase.from("ventas").select("nro_factura").order("id", { ascending: false }).limit(1).maybeSingle()
      const n = parseInt(ultima?.nro_factura ?? "0", 10)
      nroFactura = String(isNaN(n) ? 1 : n + 1)
    }

    // 2. Obtener costos de productos
    const prodIds = modalVenta.pedido_items.filter(i => i.producto_id).map(i => i.producto_id!)
    let costosMap: Record<number, number> = {}
    if (prodIds.length > 0) {
      const { data: prods } = await supabase.from("productos").select("id, costo").in("id", prodIds)
      ;(prods as ProductoDB[] ?? []).forEach(p => { if (p.costo != null) costosMap[p.id] = p.costo })
    }

    // 3. Crear venta
    const total = modalVenta.pedido_items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0)
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

    // 4. Insertar detalle_ventas
    const detalle = modalVenta.pedido_items.map(item => ({
      venta_id: venta.id,
      producto_id: item.producto_id ?? null,
      cantidad: item.cantidad,
      precio: item.precio_unitario,
      bonificacion: 0,
      costo_unitario: item.producto_id ? (costosMap[item.producto_id] ?? 0) : 0,
    }))
    const { error: errDetalle } = await supabase.from("detalle_ventas").insert(detalle)
    if (errDetalle) {
      setErrorVenta("Venta creada pero error en los items. Revisá en Ventas.")
      setCreandoVenta(false)
      return
    }

    // 5. Cuenta corriente si aplica
    if (esCuentaCorriente) {
      const { data: ultimo } = await supabase.from("cuentas_corrientes").select("saldo").eq("cliente_id", clienteSelId).order("id", { ascending: false }).limit(1).maybeSingle()
      const nuevoSaldo = (ultimo?.saldo || 0) + total
      await supabase.from("cuentas_corrientes").insert({ cliente_id: clienteSelId, tipo: "venta", monto: total, saldo: nuevoSaldo, venta_id: venta.id, fecha: new Date() })
    }

    // 6. Marcar pedido como procesado
    await supabase.from("pedidos").update({ estado: "procesado" }).eq("id", modalVenta.id)
    setPedidos(ps => ps.map(p => p.id === modalVenta.id ? { ...p, estado: "procesado" } : p))

    setVentaCreada({ nro: nroFactura, id: venta.id })
    setCreandoVenta(false)
  }

  function cerrarModal() {
    setModalVenta(null)
    setClienteSelId(null)
    setBusqCliente("")
    setEsCuentaCorriente(false)
    setMetodoCobro("efectivo")
    setVentaCreada(null)
    setErrorVenta("")
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

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>

      {/* Título + acciones */}
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
            const est = ESTADO_COLOR[p.estado] ?? ESTADO_COLOR.pendiente
            const expanded = expandedId === p.id
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
                  <span style={{ fontSize: 12, color: "#64748b", minWidth: 150 }}>{pEmail(p) ?? "—"}</span>
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

                  {/* Crear venta */}
                  {p.estado !== "procesado" && p.estado !== "cancelado" && (
                    <div onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setModalVenta(p); setVentaCreada(null) }}
                        style={{ padding: "5px 12px", background: "#1d4ed8", color: "white", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        + Crear venta
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

                {/* Expanded detail */}
                {expanded && (
                  <div style={{ padding: "0 16px 16px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, marginBottom: 12 }}>
                      {pTelefono(p) && <span style={{ fontSize: 12, color: "#475569" }}>📞 {pTelefono(p)}</span>}
                      {p.cliente_direccion ?? p.direccion ? <span style={{ fontSize: 12, color: "#475569" }}>📍 {p.cliente_direccion ?? p.direccion}</span> : null}
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
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>Total: {fmt(p.total ?? 0)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal crear venta ───────────────────────────────────────────── */}
      {modalVenta && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}
        >
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "white", zIndex: 10 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>Crear venta</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Pedido #{modalVenta.id} · {pNombre(modalVenta)} · {fmt(modalVenta.total ?? 0)}</p>
              </div>
              <button onClick={cerrarModal} style={{ width: 32, height: 32, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#64748b" }}>✕</button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {ventaCreada ? (
                // Éxito
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", border: "2px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                    <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>¡Venta creada!</p>
                  <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Venta N° {String(ventaCreada.nro).padStart(5, "0")} registrada correctamente.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={cerrarModal} style={{ flex: 1, padding: "10px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cerrar</button>
                    <a href="/ventas" style={{ flex: 1, padding: "10px", background: "#1d4ed8", color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      Ver en Ventas →
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {/* Items del pedido */}
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6 }}>Items del pedido</p>
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      {modalVenta.pedido_items?.map((item, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: i < (modalVenta.pedido_items?.length ?? 0) - 1 ? "1px solid #e2e8f0" : "none", fontSize: 13 }}>
                          <span style={{ color: "#0f172a" }}>{item.cantidad}× {item.nombre_producto}</span>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmt(item.precio_unitario * item.cantidad)}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderTop: "2px solid #e2e8f0", fontSize: 14, fontWeight: 900 }}>
                        <span>Total</span>
                        <span>{fmt(modalVenta.total ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Buscar cliente */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Cliente *
                    </label>
                    <input
                      placeholder="Buscar cliente..."
                      value={busqCliente}
                      onChange={e => { setBusqCliente(e.target.value); setClienteSelId(null) }}
                      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 6 }}
                      onFocus={e => (e.target.style.borderColor = "#1d4ed8")}
                      onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                    />
                    {busqCliente && !clienteSelId && (
                      <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden", maxHeight: 180, overflowY: "auto" }}>
                        {clientesFiltrados.length === 0 ? (
                          <div style={{ padding: "10px 12px", fontSize: 13, color: "#94a3b8" }}>Sin resultados</div>
                        ) : clientesFiltrados.map(c => (
                          <button key={c.id}
                            onClick={() => { setClienteSelId(c.id); setBusqCliente(`${c.nombre} ${c.apellido}`) }}
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
                    {clienteSelId && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "7px 12px" }}>
                        <svg width="14" height="14" fill="none" stroke="#1d4ed8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>{busqCliente}</span>
                        <button onClick={() => { setClienteSelId(null); setBusqCliente("") }} style={{ marginLeft: "auto", background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", fontSize: 14 }}>✕</button>
                      </div>
                    )}
                  </div>

                  {/* Cobro */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Cobro
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setEsCuentaCorriente(false)}
                        style={{ flex: 1, padding: "9px", borderRadius: 8, border: `2px solid ${!esCuentaCorriente ? "#1d4ed8" : "#e2e8f0"}`, background: !esCuentaCorriente ? "#eff6ff" : "white", color: !esCuentaCorriente ? "#1d4ed8" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Cobrado
                      </button>
                      <button
                        onClick={() => setEsCuentaCorriente(true)}
                        style={{ flex: 1, padding: "9px", borderRadius: 8, border: `2px solid ${esCuentaCorriente ? "#1d4ed8" : "#e2e8f0"}`, background: esCuentaCorriente ? "#eff6ff" : "white", color: esCuentaCorriente ? "#1d4ed8" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Cuenta corriente
                      </button>
                    </div>
                    {!esCuentaCorriente && (
                      <select
                        value={metodoCobro}
                        onChange={e => setMetodoCobro(e.target.value)}
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
                      onClick={crearVenta}
                      disabled={creandoVenta || !clienteSelId}
                      style={{ flex: 2, padding: "11px", background: creandoVenta || !clienteSelId ? "#93c5fd" : "#1d4ed8", color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: creandoVenta || !clienteSelId ? "not-allowed" : "pointer" }}
                    >
                      {creandoVenta ? "Creando venta..." : "✓ Crear venta"}
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
