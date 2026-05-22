"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

// ─── helpers ────────────────────────────────────────────────────────────────
function fechaCorta(f: string) {
  if (!f) return "-"
  return new Date(f).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function Toast({ mensaje, tipo }: { mensaje: string; tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed", bottom: 30, right: 30, zIndex: 9999,
      background: tipo === "ok" ? "#2f9e44" : "#e03131",
      color: "white", padding: "12px 22px", borderRadius: 10,
      fontWeight: "bold", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", fontSize: 15
    }}>
      {tipo === "ok" ? "✓ " : "✕ "}{mensaje}
    </div>
  )
}

function StockChip({ stock }: { stock: number }) {
  const [color, bg, border] =
    stock <= 0  ? ["#dc2626", "#fef2f2", "#fecaca"] :
    stock <= 5  ? ["#d97706", "#fffbeb", "#fde68a"] :
                  ["#16a34a", "#f0fdf4", "#bbf7d0"]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg,
      border: `1px solid ${border}`, padding: "1px 7px", borderRadius: 8, whiteSpace: "nowrap" }}>
      Stock: {stock}
    </span>
  )
}

// ─── page ───────────────────────────────────────────────────────────────────
export default function Pedidos() {
  const [pedidos,   setPedidos]   = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [cargando,  setCargando]  = useState(false)
  const [filtro,    setFiltro]    = useState<"todos" | "borrador" | "enviado">("todos")
  const [toast,     setToast]     = useState<any>(null)

  // modal nuevo
  const [modalNuevo,     setModalNuevo]     = useState(false)
  const [nuevoProveedor, setNuevoProveedor] = useState("")
  const [creando,        setCreando]        = useState(false)
  const [showLabSuggest, setShowLabSuggest] = useState(false)

  // modal editar
  const [pedidoActivo,   setPedidoActivo]   = useState<any | null>(null)
  const [itemsPedido,    setItemsPedido]     = useState<any[]>([])
  const [busqueda,       setBusqueda]        = useState("")
  const [filtroLab,      setFiltroLab]       = useState("")
  const [notasPedido,    setNotasPedido]     = useState("")
  const [editandoNombre, setEditandoNombre]  = useState(false)
  const [nuevoNombre,    setNuevoNombre]     = useState("")
  const [guardandoNombre,setGuardandoNombre] = useState(false)

  // confirm eliminar
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [eliminando,       setEliminando]      = useState(false)

  function mostrarToast(m: string, t: "ok" | "error") {
    setToast({ mensaje: m, tipo: t }); setTimeout(() => setToast(null), 3000)
  }

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [{ data: peds }, { data: prods }] = await Promise.all([
        supabase.from("pedidos")
          .select("*, pedidos_items(id, cantidad)")
          .order("created_at", { ascending: false }),
        supabase.from("productos")
          .select("id, nombre, laboratorio, categoria, stock")
          .order("nombre")
      ])
      setPedidos((peds || []).map(p => ({
        ...p,
        totalItems:    (p.pedidos_items || []).length,
        totalUnidades: (p.pedidos_items || []).reduce((s: number, i: any) => s + i.cantidad, 0)
      })))
      setProductos(prods || [])
    } finally {
      setCargando(false)
    }
  }

  // ── Laboratorios únicos ────────────────────────────────────────────────────
  const laboratorios = [...new Set(
    productos.map(p => p.laboratorio).filter(Boolean)
  )].sort() as string[]

  // ── Crear pedido ───────────────────────────────────────────────────────────
  async function crearPedido() {
    const nombre = nuevoProveedor.trim()
    if (!nombre) { mostrarToast("Ingresá el nombre del proveedor", "error"); return }
    setCreando(true)
    try {
      const { data, error } = await supabase.from("pedidos")
        .insert({ nombre_proveedor: nombre, estado: "borrador" })
        .select().single()
      if (error || !data) { mostrarToast("Error al crear pedido", "error"); return }
      setModalNuevo(false)
      setNuevoProveedor("")
      await cargar()
      abrirPedido({ ...data, pedidos_items: [] })
    } finally {
      setCreando(false)
    }
  }

  // ── Abrir / cerrar pedido ──────────────────────────────────────────────────
  async function abrirPedido(p: any) {
    setPedidoActivo(p)
    setNotasPedido(p.notas || "")
    setEditandoNombre(false)
    setBusqueda("")
    setFiltroLab("")
    await cargarItems(p.id)
  }

  function cerrarPedido() {
    setPedidoActivo(null)
    setItemsPedido([])
    cargar()   // refresca los contadores de la lista
  }

  async function cargarItems(pedidoId: number) {
    const { data } = await supabase
      .from("pedidos_items")
      .select("*, productos(id, nombre, laboratorio, stock)")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true })
    setItemsPedido(data || [])
  }

  // ── Items: agregar, cambiar cantidad, eliminar ─────────────────────────────
  async function agregarProducto(prod: any) {
    if (!pedidoActivo) return
    const existe = itemsPedido.find(i => i.producto_id === prod.id)
    if (existe) {
      mostrarToast("Ya está en el pedido — modificá la cantidad", "error"); return
    }
    const { data, error } = await supabase.from("pedidos_items")
      .insert({ pedido_id: pedidoActivo.id, producto_id: prod.id, cantidad: 1 })
      .select("*, productos(id, nombre, laboratorio, stock)").single()
    if (error || !data) { mostrarToast("Error al agregar", "error"); return }
    setItemsPedido(prev => [...prev, data])
  }

  async function actualizarCantidad(item: any, nuevaCantidad: number) {
    if (isNaN(nuevaCantidad) || nuevaCantidad < 1) nuevaCantidad = 1
    const { error } = await supabase.from("pedidos_items")
      .update({ cantidad: nuevaCantidad }).eq("id", item.id)
    if (error) { mostrarToast("Error al guardar cantidad", "error"); return }
    setItemsPedido(prev => prev.map(i => i.id === item.id ? { ...i, cantidad: nuevaCantidad } : i))
  }

  async function actualizarNotasItem(item: any, notas: string) {
    await supabase.from("pedidos_items").update({ notas: notas || null }).eq("id", item.id)
    setItemsPedido(prev => prev.map(i => i.id === item.id ? { ...i, notas } : i))
  }

  async function eliminarItem(itemId: number) {
    await supabase.from("pedidos_items").delete().eq("id", itemId)
    setItemsPedido(prev => prev.filter(i => i.id !== itemId))
  }

  // ── Guardar notas del pedido ───────────────────────────────────────────────
  async function guardarNotas() {
    if (!pedidoActivo) return
    await supabase.from("pedidos").update({ notas: notasPedido || null }).eq("id", pedidoActivo.id)
  }

  // ── Renombrar proveedor ────────────────────────────────────────────────────
  async function guardarNombreProveedor() {
    if (!nuevoNombre.trim() || !pedidoActivo) return
    setGuardandoNombre(true)
    const { error } = await supabase.from("pedidos")
      .update({ nombre_proveedor: nuevoNombre.trim() }).eq("id", pedidoActivo.id)
    if (!error) {
      setPedidoActivo((p: any) => ({ ...p, nombre_proveedor: nuevoNombre.trim() }))
      setEditandoNombre(false)
    }
    setGuardandoNombre(false)
  }

  // ── Cambiar estado ─────────────────────────────────────────────────────────
  async function toggleEstado() {
    if (!pedidoActivo) return
    const nuevoEstado = pedidoActivo.estado === "borrador" ? "enviado" : "borrador"
    const patch: any = { estado: nuevoEstado }
    if (nuevoEstado === "enviado") patch.fecha_envio = new Date().toISOString()
    else patch.fecha_envio = null
    const { error } = await supabase.from("pedidos").update(patch).eq("id", pedidoActivo.id)
    if (error) { mostrarToast("Error al cambiar estado", "error"); return }
    setPedidoActivo((p: any) => ({ ...p, ...patch }))
    mostrarToast(nuevoEstado === "enviado" ? "✅ Marcado como enviado" : "📝 Vuelto a borrador", "ok")
  }

  // ── Eliminar pedido ────────────────────────────────────────────────────────
  async function eliminarPedido() {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      const { error } = await supabase.from("pedidos").delete().eq("id", confirmEliminar.id)
      if (error) { mostrarToast("Error al eliminar", "error"); return }
      mostrarToast("🗑️ Pedido eliminado", "ok")
      setConfirmEliminar(null)
      if (pedidoActivo?.id === confirmEliminar.id) cerrarPedido()
      else cargar()
    } finally {
      setEliminando(false)
    }
  }

  // ── Exportar Excel ─────────────────────────────────────────────────────────
  async function exportarExcel(pedido: any, items?: any[]) {
    const XLSX = await import("xlsx")
    const listaItems = items || itemsPedido

    if (!listaItems.length) { mostrarToast("El pedido no tiene productos", "error"); return }

    const datos = listaItems.map((it: any, idx: number) => ({
      "N°": idx + 1,
      "Producto":       it.productos?.nombre || "",
      "Laboratorio":    it.productos?.laboratorio || "",
      "Stock actual":   it.productos?.stock ?? 0,
      "Cantidad pedida": it.cantidad,
      "Notas":          it.notas || "",
    }))

    const ws = XLSX.utils.json_to_sheet([])

    // Título
    XLSX.utils.sheet_add_aoa(ws, [
      [`Pedido a: ${pedido.nombre_proveedor}`],
      [`Fecha: ${fechaCorta(pedido.created_at)}${pedido.estado === "enviado" && pedido.fecha_envio ? `  |  Enviado: ${fechaCorta(pedido.fecha_envio)}` : ""}`],
      pedido.notas ? [`Notas: ${pedido.notas}`] : [],
      [],
    ], { origin: "A1" })

    const filaEncabezado = pedido.notas ? 5 : 4
    XLSX.utils.sheet_add_json(ws, datos, { origin: `A${filaEncabezado}` })

    // Totales
    const totalUnidades = listaItems.reduce((s: number, i: any) => s + i.cantidad, 0)
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`Total productos: ${listaItems.length}`, "", "", "", `Total unidades: ${totalUnidades}`],
    ], { origin: `A${filaEncabezado + listaItems.length + 1}` })

    ws["!cols"] = [{ wch: 5 }, { wch: 38 }, { wch: 18 }, { wch: 13 }, { wch: 16 }, { wch: 25 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pedido")
    const nombre = `pedido_${pedido.nombre_proveedor.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, nombre)
    mostrarToast("📊 Excel exportado", "ok")
  }

  // ── Filtros y búsqueda ─────────────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p =>
    (filtro === "todos" || p.estado === filtro)
  )

  const terminoBusq = busqueda.trim().toLowerCase()
  const productosFiltrados = productos.filter(p => {
    const match = !terminoBusq ||
      p.nombre.toLowerCase().includes(terminoBusq) ||
      (p.laboratorio || "").toLowerCase().includes(terminoBusq)
    const matchLab = !filtroLab || p.laboratorio === filtroLab
    const yaEsta = itemsPedido.some(i => i.producto_id === p.id)
    return match && matchLab && !yaEsta
  }).slice(0, 40)

  const totalUnidadesPedido = itemsPedido.reduce((s, i) => s + i.cantidad, 0)

  // ── labsSugeridos para autocomplete del nuevo pedido ──────────────────────
  const labsSugeridos = laboratorios.filter(l =>
    nuevoProveedor.length > 0 &&
    l.toLowerCase().includes(nuevoProveedor.toLowerCase()) &&
    l.toLowerCase() !== nuevoProveedor.toLowerCase()
  ).slice(0, 6)

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Pedidos a proveedores</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6b7280" }}>
            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} ·{" "}
            <span style={{ color: "#d97706", fontWeight: 600 }}>{pedidos.filter(p => p.estado === "borrador").length} en borrador</span>
            {pedidos.filter(p => p.estado === "enviado").length > 0 && (
              <span style={{ color: "#16a34a", fontWeight: 600 }}> · {pedidos.filter(p => p.estado === "enviado").length} enviados</span>
            )}
          </p>
        </div>
        <button onClick={() => { setModalNuevo(true); setNuevoProveedor("") }}
          style={{ background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.3)", display: "flex", alignItems: "center", gap: 6 }}>
          + Nuevo pedido
        </button>
      </div>

      {/* ── TABS FILTRO ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "white", padding: 4, borderRadius: 10, border: "1px solid #e2e8f0", width: "fit-content", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {([
          { key: "todos",    label: "Todos",       count: pedidos.length },
          { key: "borrador", label: "📝 Borradores", count: pedidos.filter(p => p.estado === "borrador").length },
          { key: "enviado",  label: "✅ Enviados",   count: pedidos.filter(p => p.estado === "enviado").length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s",
            background: filtro === t.key ? "#0f172a" : "transparent",
            color: filtro === t.key ? "white" : "#6b7280",
          }}>
            {t.label} {t.count > 0 && <span style={{ marginLeft: 4, background: filtro === t.key ? "rgba(255,255,255,0.2)" : "#e2e8f0", color: filtro === t.key ? "white" : "#374151", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 800 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── LISTA DE PEDIDOS ── */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>⏳ Cargando pedidos...</div>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "white", borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#374151" }}>
            {filtro === "todos" ? "No hay pedidos todavía" : filtro === "borrador" ? "No hay borradores" : "No hay pedidos enviados"}
          </div>
          <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
            {filtro === "todos" && "Creá tu primer pedido con el botón de arriba"}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {pedidosFiltrados.map(p => (
            <div key={p.id} style={{
              background: "white", borderRadius: 14,
              border: p.estado === "enviado" ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)", overflow: "hidden",
              transition: "box-shadow 0.15s",
            }}>
              {/* Color stripe */}
              <div style={{ height: 4, background: p.estado === "enviado" ? "linear-gradient(90deg,#16a34a,#22c55e)" : "linear-gradient(90deg,#2563eb,#3b82f6)" }} />
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nombre_proveedor}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{fechaCorta(p.created_at)}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0, marginLeft: 8,
                    background: p.estado === "enviado" ? "#f0fdf4" : "#fffbeb",
                    color:      p.estado === "enviado" ? "#16a34a"  : "#d97706",
                    border:     p.estado === "enviado" ? "1px solid #bbf7d0" : "1px solid #fde68a",
                  }}>
                    {p.estado === "enviado" ? "✓ Enviado" : "📝 Borrador"}
                  </span>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "6px 12px", flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{p.totalItems}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>PRODUCTOS</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 8, padding: "6px 12px", flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{p.totalUnidades}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>UNIDADES</div>
                  </div>
                </div>
                {p.notas && (
                  <div style={{ fontSize: 11, color: "#6b7280", background: "#f8fafc", borderRadius: 6, padding: "5px 10px", marginBottom: 10, fontStyle: "italic" }}>
                    📝 {p.notas.length > 60 ? p.notas.slice(0, 60) + "…" : p.notas}
                  </div>
                )}

                {/* Acciones */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => abrirPedido(p)} style={{ flex: 1, padding: "8px", background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    ✏️ Ver / Editar
                  </button>
                  <button onClick={async () => { await abrirPedido(p); setTimeout(() => exportarExcel(p), 400) }}
                    title="Exportar Excel"
                    style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, color: "#16a34a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    📊
                  </button>
                  <button onClick={() => setConfirmEliminar(p)}
                    title="Eliminar"
                    style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 12, cursor: "pointer" }}>
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — NUEVO PEDIDO
      ══════════════════════════════════════════════════════════════════════ */}
      {modalNuevo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => setModalNuevo(false)}>
          <div style={{ background: "#0f172a", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: "white", margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>Nuevo pedido</h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 24px" }}>Ingresá el nombre del proveedor</p>

            <div style={{ position: "relative" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
                Proveedor / Laboratorio
              </label>
              <input
                autoFocus
                value={nuevoProveedor}
                onChange={e => { setNuevoProveedor(e.target.value); setShowLabSuggest(true) }}
                onKeyDown={e => { if (e.key === "Enter") crearPedido(); if (e.key === "Escape") setModalNuevo(false) }}
                onFocus={() => setShowLabSuggest(true)}
                placeholder="Ej: Vetoquinol, Bayer, Purina…"
                style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
              {/* Autocomplete de laboratorios */}
              {showLabSuggest && labsSugeridos.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden", zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  {labsSugeridos.map(lab => (
                    <button key={lab} onClick={() => { setNuevoProveedor(lab); setShowLabSuggest(false) }}
                      style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", color: "#e2e8f0", fontSize: 13, cursor: "pointer", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      🏭 {lab}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chips de labs más usados */}
            {laboratorios.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>O elegí uno rápido:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {laboratorios.slice(0, 8).map(lab => (
                    <button key={lab} onClick={() => { setNuevoProveedor(lab); setShowLabSuggest(false) }}
                      style={{ padding: "4px 10px", background: nuevoProveedor === lab ? "#3b82f6" : "rgba(255,255,255,0.06)", border: nuevoProveedor === lab ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", borderRadius: 20, color: nuevoProveedor === lab ? "white" : "#9ca3af", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      {lab}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
              <button onClick={() => setModalNuevo(false)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={crearPedido} disabled={creando || !nuevoProveedor.trim()} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: creando || !nuevoProveedor.trim() ? 0.5 : 1 }}>
                {creando ? "Creando…" : "Crear pedido →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — EDITAR PEDIDO
      ══════════════════════════════════════════════════════════════════════ */}
      {pedidoActivo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "stretch", justifyContent: "flex-end", zIndex: 50 }}
          onClick={cerrarPedido}>
          <div style={{ background: "#0f172a", width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(0,0,0,0.5)", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>

            {/* ── Header del modal ── */}
            <div style={{ padding: "24px 28px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editandoNombre ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input autoFocus value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") guardarNombreProveedor(); if (e.key === "Escape") setEditandoNombre(false) }}
                        style={{ flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid #3b82f6", borderRadius: 8, color: "white", fontSize: 18, fontWeight: 700, padding: "6px 12px", outline: "none" }} />
                      <button onClick={guardarNombreProveedor} disabled={guardandoNombre} style={{ padding: "6px 14px", background: "#3b82f6", border: "none", borderRadius: 8, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓</button>
                      <button onClick={() => setEditandoNombre(false)} style={{ padding: "6px 10px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "#9ca3af", fontSize: 12, cursor: "pointer" }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h2 style={{ margin: 0, color: "white", fontSize: 20, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pedidoActivo.nombre_proveedor}
                      </h2>
                      <button onClick={() => { setNuevoNombre(pedidoActivo.nombre_proveedor); setEditandoNombre(true) }}
                        title="Renombrar" style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: 2 }}>✏️</button>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>Creado: {fechaCorta(pedidoActivo.created_at)}</span>
                    {pedidoActivo.estado === "enviado" && pedidoActivo.fecha_envio && (
                      <span style={{ fontSize: 12, color: "#4ade80" }}>· Enviado: {fechaCorta(pedidoActivo.fecha_envio)}</span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                      background: pedidoActivo.estado === "enviado" ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
                      color:      pedidoActivo.estado === "enviado" ? "#4ade80"  : "#fbbf24",
                      border:     pedidoActivo.estado === "enviado" ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(251,191,36,0.3)",
                    }}>
                      {pedidoActivo.estado === "enviado" ? "✓ Enviado" : "📝 Borrador"}
                    </span>
                  </div>
                </div>
                <button onClick={cerrarPedido} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "white", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>✕</button>
              </div>

              {/* Stats rápidos */}
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{itemsPedido.length}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>productos</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 16px", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "white" }}>{totalUnidadesPedido}</span>
                  <span style={{ fontSize: 11, color: "#6b7280", marginLeft: 6 }}>unidades</span>
                </div>
              </div>
            </div>

            {/* ── Contenido dividido ── */}
            <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0, overflow: "hidden" }}>

              {/* Panel izquierdo: agregar productos */}
              <div style={{ width: 340, borderRight: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Agregar productos</div>
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="🔍 Buscar por nombre o laboratorio…"
                    style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, color: "white", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
                  {/* Chips de labs */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    <button onClick={() => setFiltroLab("")}
                      style={{ padding: "3px 10px", borderRadius: 20, border: filtroLab === "" ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", background: filtroLab === "" ? "#3b82f6" : "transparent", color: filtroLab === "" ? "white" : "#9ca3af", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                      Todos
                    </button>
                    {laboratorios.slice(0, 6).map(lab => (
                      <button key={lab} onClick={() => setFiltroLab(filtroLab === lab ? "" : lab)}
                        style={{ padding: "3px 10px", borderRadius: 20, border: filtroLab === lab ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", background: filtroLab === lab ? "#3b82f6" : "transparent", color: filtroLab === lab ? "white" : "#9ca3af", fontSize: 11, cursor: "pointer", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lista de productos */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                  {productosFiltrados.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 16px", color: "#6b7280", fontSize: 13 }}>
                      {busqueda ? "Sin resultados" : "Todos los productos ya están en el pedido"}
                    </div>
                  ) : productosFiltrados.map(prod => (
                    <button key={prod.id} onClick={() => agregarProducto(prod)}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "9px 10px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", textAlign: "left", borderRadius: 6, transition: "background 0.1s", gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.nombre}</div>
                        {prod.laboratorio && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>{prod.laboratorio}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <StockChip stock={prod.stock} />
                        <span style={{ fontSize: 16, color: "#3b82f6" }}>+</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel derecho: items del pedido */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Lista del pedido
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
                  {itemsPedido.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "50px 20px", color: "#4b5563" }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                      <div style={{ fontWeight: 600, color: "#6b7280" }}>Sin productos aún</div>
                      <div style={{ fontSize: 12, color: "#4b5563", marginTop: 4 }}>Buscá y agregá desde el panel izquierdo</div>
                    </div>
                  ) : itemsPedido.map(item => (
                    <ItemPedido key={item.id} item={item}
                      onCantidadChange={actualizarCantidad}
                      onNotasChange={actualizarNotasItem}
                      onEliminar={eliminarItem} />
                  ))}
                </div>

                {/* Notas generales */}
                <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 5 }}>Notas del pedido (opcional)</label>
                  <textarea value={notasPedido} onChange={e => setNotasPedido(e.target.value)} onBlur={guardarNotas}
                    placeholder="Ej: urgente, confirmar precio antes de enviar…"
                    rows={2}
                    style={{ width: "100%", padding: "8px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "white", fontSize: 12, resize: "none", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
            </div>

            {/* ── Footer con acciones ── */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
              <button onClick={() => exportarExcel(pedidoActivo)}
                style={{ flex: 1, minWidth: 140, padding: "11px 16px", background: "linear-gradient(135deg, #15803d, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📊 Exportar Excel
              </button>
              <button onClick={toggleEstado}
                style={{ flex: 1, minWidth: 160, padding: "11px 16px", background: pedidoActivo.estado === "borrador" ? "linear-gradient(135deg,#1e40af,#3b82f6)" : "rgba(251,191,36,0.15)", border: pedidoActivo.estado === "enviado" ? "1px solid rgba(251,191,36,0.3)" : "none", borderRadius: 10, color: pedidoActivo.estado === "borrador" ? "white" : "#fbbf24", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {pedidoActivo.estado === "borrador" ? "✅ Marcar como enviado" : "📝 Volver a borrador"}
              </button>
              <button onClick={cerrarPedido}
                style={{ padding: "11px 20px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#9ca3af", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINAR
      ══════════════════════════════════════════════════════════════════════ */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
          onClick={() => setConfirmEliminar(null)}>
          <div style={{ background: "#0f172a", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <h2 style={{ color: "white", margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>¿Eliminar pedido?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 24px" }}>
              Pedido a <b style={{ color: "white" }}>{confirmEliminar.nombre_proveedor}</b> con{" "}
              <b style={{ color: "white" }}>{confirmEliminar.totalItems} productos</b>.{" "}
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={eliminarPedido} disabled={eliminando} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: eliminando ? 0.6 : 1 }}>
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente: fila de item en el pedido ──────────────────────────────────
function ItemPedido({ item, onCantidadChange, onNotasChange, onEliminar }: {
  item: any
  onCantidadChange: (item: any, cant: number) => void
  onNotasChange: (item: any, notas: string) => void
  onEliminar: (id: number) => void
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  const [verNotas, setVerNotas] = useState(!!item.notas)
  const [notas,    setNotas]    = useState(item.notas || "")

  // Sincronizar si cambia desde afuera
  useEffect(() => { setCantidad(String(item.cantidad)) }, [item.cantidad])

  function handleBlurCantidad() {
    const n = parseInt(cantidad, 10)
    if (isNaN(n) || n < 1) { setCantidad(String(item.cantidad)); return }
    if (n !== item.cantidad) onCantidadChange(item, n)
  }

  function sumar(delta: number) {
    const n = Math.max(1, (parseInt(cantidad, 10) || 1) + delta)
    setCantidad(String(n))
    onCantidadChange(item, n)
  }

  const prod = item.productos || {}

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Info producto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.nombre || "—"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
            {prod.laboratorio && <span style={{ fontSize: 10, color: "#6b7280" }}>{prod.laboratorio}</span>}
            <StockChip stock={prod.stock ?? 0} />
          </div>
        </div>

        {/* Controles cantidad */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button onClick={() => sumar(-1)}
            style={{ width: 28, height: 28, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", borderRadius: 6, color: "white", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <input type="number" min={1} value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            onBlur={handleBlurCantidad}
            onKeyDown={e => { if (e.key === "Enter") { handleBlurCantidad(); (e.target as HTMLElement).blur() } }}
            style={{ width: 52, textAlign: "center", padding: "5px 4px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "white", fontSize: 13, fontWeight: 700, outline: "none" }} />
          <button onClick={() => sumar(1)}
            style={{ width: 28, height: 28, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", borderRadius: 6, color: "white", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>

        {/* Atajos rápidos */}
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {[5, 10, 20].map(n => (
            <button key={n} onClick={() => { setCantidad(String(n)); onCantidadChange(item, n) }}
              style={{ padding: "3px 7px", border: "1px solid rgba(255,255,255,0.08)", background: cantidad === String(n) ? "#3b82f6" : "transparent", borderRadius: 6, color: cantidad === String(n) ? "white" : "#6b7280", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {n}
            </button>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => setVerNotas(!verNotas)}
            title="Notas" style={{ width: 28, height: 28, border: `1px solid ${verNotas ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"}`, background: verNotas ? "rgba(251,191,36,0.1)" : "transparent", borderRadius: 6, color: verNotas ? "#fbbf24" : "#6b7280", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            📝
          </button>
          <button onClick={() => onEliminar(item.id)}
            style={{ width: 28, height: 28, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", borderRadius: 6, color: "#ef4444", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ×
          </button>
        </div>
      </div>

      {/* Notas del item */}
      {verNotas && (
        <input value={notas} onChange={e => setNotas(e.target.value)}
          onBlur={() => onNotasChange(item, notas)}
          placeholder="Nota para este producto…"
          style={{ marginTop: 8, width: "100%", padding: "6px 10px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 6, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      )}
    </div>
  )
}
