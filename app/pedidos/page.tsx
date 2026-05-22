"use client"

import { useEffect, useState } from "react"
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
    stock <= 0 ? ["#dc2626", "#fef2f2", "#fecaca"] :
    stock <= 5 ? ["#d97706", "#fffbeb", "#fde68a"] :
                 ["#16a34a", "#f0fdf4", "#bbf7d0"]
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, color, background: bg,
      border: `1px solid ${border}`, padding: "2px 8px", borderRadius: 8, whiteSpace: "nowrap"
    }}>
      Stock: {stock}
    </span>
  )
}

// ─── Componente: fila de item ────────────────────────────────────────────────
function ItemPedido({ item, onCantidadChange, onNotasChange, onEliminar }: {
  item: any
  onCantidadChange: (item: any, cant: number) => void
  onNotasChange: (item: any, notas: string) => void
  onEliminar: (id: number) => void
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad))
  const [verNotas, setVerNotas] = useState(!!item.notas)
  const [notas, setNotas] = useState(item.notas || "")

  useEffect(() => { setCantidad(String(item.cantidad)) }, [item.cantidad])

  function handleBlur() {
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
    <div style={{
      background: "white", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "12px 16px", marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Info producto */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {prod.nombre || "—"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            {prod.laboratorio && (
              <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "1px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                {prod.laboratorio}
              </span>
            )}
            <StockChip stock={prod.stock ?? 0} />
          </div>
        </div>

        {/* Cantidad */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <button onClick={() => sumar(-1)}
            style={{ width: 32, height: 32, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, color: "#374151", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>
            −
          </button>
          <input
            type="number" min={1} value={cantidad}
            onChange={e => setCantidad(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e => { if (e.key === "Enter") { handleBlur(); (e.target as HTMLElement).blur() } }}
            style={{ width: 58, textAlign: "center", padding: "6px 4px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, color: "#0f172a", fontSize: 14, fontWeight: 800, outline: "none" }}
          />
          <button onClick={() => sumar(1)}
            style={{ width: 32, height: 32, border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 8, color: "#374151", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>
            +
          </button>
        </div>

        {/* Atajos rápidos */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {[5, 10, 20].map(n => (
            <button key={n} onClick={() => { setCantidad(String(n)); onCantidadChange(item, n) }}
              style={{
                padding: "4px 9px", border: "1px solid #e2e8f0", borderRadius: 7,
                background: cantidad === String(n) ? "#1e40af" : "#f8fafc",
                color: cantidad === String(n) ? "white" : "#64748b",
                fontSize: 12, cursor: "pointer", fontWeight: 700
              }}>
              {n}
            </button>
          ))}
        </div>

        {/* Nota + eliminar */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => setVerNotas(!verNotas)} title="Nota"
            style={{
              width: 32, height: 32, border: `1px solid ${verNotas ? "#fde68a" : "#e2e8f0"}`,
              background: verNotas ? "#fffbeb" : "#f8fafc",
              borderRadius: 8, color: verNotas ? "#d97706" : "#94a3b8", fontSize: 14, cursor: "pointer"
            }}>
            📝
          </button>
          <button onClick={() => onEliminar(item.id)}
            style={{ width: 32, height: 32, border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 8, color: "#dc2626", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>
            ×
          </button>
        </div>
      </div>

      {verNotas && (
        <input
          value={notas} onChange={e => setNotas(e.target.value)}
          onBlur={() => onNotasChange(item, notas)}
          placeholder="Nota para este producto…"
          style={{
            marginTop: 10, width: "100%", padding: "7px 12px",
            background: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, color: "#374151", fontSize: 13, outline: "none", boxSizing: "border-box"
          }}
        />
      )}
    </div>
  )
}

// ─── PAGE ────────────────────────────────────────────────────────────────────
export default function Pedidos() {
  const [pedidos,   setPedidos]   = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [cargando,  setCargando]  = useState(true)
  const [filtro,    setFiltro]    = useState<"todos" | "borrador" | "enviado">("todos")
  const [toast,     setToast]     = useState<any>(null)

  // editor (null = lista, "nuevo" = creando, pedido = editando)
  const [vista,          setVista]          = useState<"lista" | "editor">("lista")
  const [pedidoActivo,   setPedidoActivo]   = useState<any | null>(null)
  const [itemsPedido,    setItemsPedido]    = useState<any[]>([])
  const [guardandoEstado, setGuardandoEstado] = useState(false)

  // campos del editor
  const [nombreProveedor, setNombreProveedor] = useState("")
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [notasPedido,     setNotasPedido]     = useState("")

  // búsqueda de productos
  const [busqueda,  setBusqueda]  = useState("")
  const [filtroLab, setFiltroLab] = useState("")

  // confirm eliminar
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [eliminando,       setEliminando]      = useState(false)

  // creación
  const [creando, setCreando] = useState(false)

  function mostrarToast(m: string, t: "ok" | "error") {
    setToast({ mensaje: m, tipo: t }); setTimeout(() => setToast(null), 3200)
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

  const laboratorios = [...new Set(productos.map(p => p.laboratorio).filter(Boolean))].sort() as string[]

  // Proveedores ya usados en pedidos anteriores (para autocomplete)
  const proveedoresExistentes = [...new Set(pedidos.map(p => p.nombre_proveedor).filter(Boolean))].sort() as string[]

  // ── Crear pedido ───────────────────────────────────────────────────────────
  async function crearPedido() {
    const nombre = nombreProveedor.trim()
    if (!nombre) { mostrarToast("Ingresá el nombre del proveedor", "error"); return }
    setCreando(true)
    try {
      const { data, error } = await supabase.from("pedidos")
        .insert({ nombre_proveedor: nombre, estado: "borrador" })
        .select().single()
      if (error || !data) { mostrarToast("Error al crear pedido", "error"); return }
      await cargar()
      abrirEditor({ ...data, pedidos_items: [], totalItems: 0, totalUnidades: 0 })
    } finally {
      setCreando(false)
    }
  }

  // ── Editor ─────────────────────────────────────────────────────────────────
  function abrirNuevo() {
    setPedidoActivo(null)
    setNombreProveedor("")
    setNotasPedido("")
    setItemsPedido([])
    setBusqueda("")
    setFiltroLab("")
    setVista("editor")
  }

  async function abrirEditor(p: any) {
    setPedidoActivo(p)
    setNombreProveedor(p.nombre_proveedor)
    setNotasPedido(p.notas || "")
    setBusqueda("")
    setFiltroLab("")
    setVista("editor")
    await cargarItems(p.id)
  }

  function volverALista() {
    setVista("lista")
    setPedidoActivo(null)
    setItemsPedido([])
    cargar()
  }

  async function cargarItems(pedidoId: number) {
    const { data } = await supabase
      .from("pedidos_items")
      .select("*, productos(id, nombre, laboratorio, stock)")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: true })
    setItemsPedido(data || [])
  }

  // ── Guardar nombre proveedor ───────────────────────────────────────────────
  async function guardarNombreProveedor() {
    if (!pedidoActivo || !nombreProveedor.trim()) return
    if (nombreProveedor.trim() === pedidoActivo.nombre_proveedor) return
    setGuardandoNombre(true)
    const { error } = await supabase.from("pedidos")
      .update({ nombre_proveedor: nombreProveedor.trim() }).eq("id", pedidoActivo.id)
    if (!error) {
      setPedidoActivo((p: any) => ({ ...p, nombre_proveedor: nombreProveedor.trim() }))
      mostrarToast("Proveedor actualizado", "ok")
    }
    setGuardandoNombre(false)
  }

  // ── Items ──────────────────────────────────────────────────────────────────
  async function agregarProducto(prod: any) {
    if (!pedidoActivo) return
    if (itemsPedido.find(i => i.producto_id === prod.id)) {
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
    await supabase.from("pedidos_items").update({ cantidad: nuevaCantidad }).eq("id", item.id)
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

  async function guardarNotas() {
    if (!pedidoActivo) return
    await supabase.from("pedidos").update({ notas: notasPedido || null }).eq("id", pedidoActivo.id)
  }

  // ── Toggle estado ──────────────────────────────────────────────────────────
  async function toggleEstado() {
    if (!pedidoActivo) return
    setGuardandoEstado(true)
    const nuevoEstado = pedidoActivo.estado === "borrador" ? "enviado" : "borrador"
    const patch: any = { estado: nuevoEstado }
    if (nuevoEstado === "enviado") patch.fecha_envio = new Date().toISOString()
    else patch.fecha_envio = null
    const { error } = await supabase.from("pedidos").update(patch).eq("id", pedidoActivo.id)
    if (!error) {
      setPedidoActivo((p: any) => ({ ...p, ...patch }))
      mostrarToast(nuevoEstado === "enviado" ? "✅ Marcado como enviado" : "📝 Vuelto a borrador", "ok")
    }
    setGuardandoEstado(false)
  }

  // ── Eliminar pedido ────────────────────────────────────────────────────────
  async function eliminarPedido() {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      const { error } = await supabase.from("pedidos").delete().eq("id", confirmEliminar.id)
      if (error) { mostrarToast("Error al eliminar", "error"); return }
      mostrarToast("Pedido eliminado", "ok")
      setConfirmEliminar(null)
      if (pedidoActivo?.id === confirmEliminar.id) volverALista()
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
      "Producto": it.productos?.nombre || "",
      "Laboratorio": it.productos?.laboratorio || "",
      "Stock actual": it.productos?.stock ?? 0,
      "Cantidad pedida": it.cantidad,
      "Notas": it.notas || "",
    }))

    const ws = XLSX.utils.json_to_sheet([])
    XLSX.utils.sheet_add_aoa(ws, [
      [`Pedido a: ${pedido.nombre_proveedor}`],
      [`Fecha: ${fechaCorta(pedido.created_at)}${pedido.estado === "enviado" && pedido.fecha_envio ? `  |  Enviado: ${fechaCorta(pedido.fecha_envio)}` : ""}`],
      pedido.notas ? [`Notas: ${pedido.notas}`] : [],
      [],
    ], { origin: "A1" })

    const filaEnc = pedido.notas ? 5 : 4
    XLSX.utils.sheet_add_json(ws, datos, { origin: `A${filaEnc}` })

    const totalUnidades = listaItems.reduce((s: number, i: any) => s + i.cantidad, 0)
    XLSX.utils.sheet_add_aoa(ws, [
      [],
      [`Total productos: ${listaItems.length}`, "", "", "", `Total unidades: ${totalUnidades}`],
    ], { origin: `A${filaEnc + listaItems.length + 1}` })

    ws["!cols"] = [{ wch: 5 }, { wch: 38 }, { wch: 18 }, { wch: 13 }, { wch: 16 }, { wch: 25 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Pedido")
    XLSX.writeFile(wb, `pedido_${pedido.nombre_proveedor.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    mostrarToast("📊 Excel exportado", "ok")
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  const pedidosFiltrados = pedidos.filter(p => filtro === "todos" || p.estado === filtro)

  const terminoBusq = busqueda.trim().toLowerCase()
  const productosFiltrados = productos.filter(p => {
    const match = !terminoBusq ||
      p.nombre.toLowerCase().includes(terminoBusq) ||
      (p.laboratorio || "").toLowerCase().includes(terminoBusq)
    const matchLab = !filtroLab || p.laboratorio === filtroLab
    const yaEsta = itemsPedido.some(i => i.producto_id === p.id)
    return match && matchLab && !yaEsta
  }).slice(0, 50)

  const totalUnidadesPedido = itemsPedido.reduce((s, i) => s + i.cantidad, 0)

  // ── Autocompletar proveedor desde pedidos anteriores ──────────────────────
  const proveedoresSugeridos = proveedoresExistentes.filter(p =>
    nombreProveedor.length > 0 &&
    p.toLowerCase().includes(nombreProveedor.toLowerCase()) &&
    p.toLowerCase() !== nombreProveedor.toLowerCase()
  ).slice(0, 6)

  // ════════════════════════════════════════════════════════════════════════════
  // VISTA EDITOR
  // ════════════════════════════════════════════════════════════════════════════
  if (vista === "editor") {
    const esNuevo = !pedidoActivo

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 100px)", minHeight: 600 }}>
        {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

        {/* ── BARRA SUPERIOR ── */}
        <div style={{
          background: "white", border: "1px solid #e2e8f0", borderRadius: "14px 14px 0 0",
          padding: "18px 24px", display: "flex", alignItems: "center", gap: 16,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)", flexShrink: 0, flexWrap: "wrap"
        }}>
          {/* Volver */}
          <button onClick={volverALista}
            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 9, padding: "8px 16px", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            ← Volver
          </button>

          {/* Input proveedor */}
          <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              Proveedor
            </div>
            <input
              autoFocus={esNuevo}
              value={nombreProveedor}
              onChange={e => setNombreProveedor(e.target.value)}
              onBlur={() => { if (!esNuevo) guardarNombreProveedor() }}
              onKeyDown={e => {
                if (e.key === "Enter" && esNuevo) crearPedido()
                if (e.key === "Enter" && !esNuevo) { guardarNombreProveedor(); (e.target as HTMLElement).blur() }
              }}
              placeholder="Nombre del proveedor o laboratorio…"
              style={{
                width: "100%", padding: "10px 14px", fontSize: 15, fontWeight: 700,
                border: "2px solid #3b82f6", borderRadius: 10, outline: "none",
                color: "#0f172a", background: "#f8fafc", boxSizing: "border-box"
              }}
            />
            {/* Autocomplete desde pedidos anteriores */}
            {proveedoresSugeridos.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
                background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)", overflow: "hidden"
              }}>
                {proveedoresSugeridos.map(prov => (
                  <button key={prov} onClick={() => setNombreProveedor(prov)}
                    style={{ display: "block", width: "100%", padding: "10px 14px", background: "none", border: "none", color: "#374151", fontSize: 14, cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    📦 {prov}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Estado + info (solo si ya existe el pedido) */}
          {pedidoActivo && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 20,
                background: pedidoActivo.estado === "enviado" ? "#f0fdf4" : "#fffbeb",
                color:      pedidoActivo.estado === "enviado" ? "#16a34a" : "#d97706",
                border:     pedidoActivo.estado === "enviado" ? "1px solid #bbf7d0" : "1px solid #fde68a",
              }}>
                {pedidoActivo.estado === "enviado" ? "✓ Enviado" : "📝 Borrador"}
              </span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                  {itemsPedido.length} prod · {totalUnidadesPedido} uds
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Creado {fechaCorta(pedidoActivo.created_at)}</div>
              </div>
            </div>
          )}

          {/* Botón crear (solo si es nuevo) */}
          {esNuevo && (
            <button onClick={crearPedido} disabled={creando || !nombreProveedor.trim()}
              style={{
                padding: "10px 22px", background: "linear-gradient(135deg,#1e40af,#3b82f6)", border: "none",
                borderRadius: 10, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                opacity: creando || !nombreProveedor.trim() ? 0.5 : 1, flexShrink: 0
              }}>
              {creando ? "Creando…" : "Crear pedido →"}
            </button>
          )}

          {/* Acciones (solo si existe) */}
          {pedidoActivo && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => exportarExcel(pedidoActivo)}
                style={{ padding: "9px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, color: "#16a34a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                📊 Excel
              </button>
              <button onClick={toggleEstado} disabled={guardandoEstado}
                style={{
                  padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  background: pedidoActivo.estado === "borrador" ? "linear-gradient(135deg,#1e40af,#3b82f6)" : "#fffbeb",
                  color: pedidoActivo.estado === "borrador" ? "white" : "#d97706",
                  border: pedidoActivo.estado === "enviado" ? "1px solid #fde68a" : "none",
                }}>
                {pedidoActivo.estado === "borrador" ? "✅ Marcar enviado" : "📝 Borrador"}
              </button>
              <button onClick={() => setConfirmEliminar(pedidoActivo)}
                style={{ padding: "9px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, color: "#dc2626", fontSize: 14, cursor: "pointer" }}>
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* ── CUERPO: 2 columnas ── */}
        {pedidoActivo ? (
          <div style={{ flex: 1, display: "flex", gap: 0, minHeight: 0, background: "#f8fafc", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>

            {/* COLUMNA IZQUIERDA: buscar productos */}
            <div style={{ width: 380, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", background: "white", flexShrink: 0 }}>
              {/* Buscador */}
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                  Agregar productos
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16 }}>🔍</span>
                  <input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por producto o laboratorio…"
                    style={{
                      width: "100%", padding: "11px 14px 11px 38px",
                      border: "1.5px solid #e2e8f0", borderRadius: 10,
                      fontSize: 14, color: "#0f172a", outline: "none",
                      background: "#f8fafc", boxSizing: "border-box",
                      transition: "border-color 0.15s"
                    }}
                    onFocus={e => (e.target.style.borderColor = "#3b82f6")}
                    onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
                  />
                </div>

                {/* Chips de laboratorio */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  <button onClick={() => setFiltroLab("")}
                    style={{
                      padding: "5px 13px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: filtroLab === "" ? "#1e40af" : "#f1f5f9",
                      color: filtroLab === "" ? "white" : "#64748b"
                    }}>
                    Todos
                  </button>
                  {laboratorios.map(lab => (
                    <button key={lab} onClick={() => setFiltroLab(filtroLab === lab ? "" : lab)}
                      style={{
                        padding: "5px 13px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                        background: filtroLab === lab ? "#1e40af" : "#f1f5f9",
                        color: filtroLab === lab ? "white" : "#64748b",
                        maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                      }}>
                      {lab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de productos */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
                {productosFiltrados.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8", fontSize: 14 }}>
                    {busqueda || filtroLab ? "Sin resultados para ese filtro" : "Todos los productos ya están en el pedido"}
                  </div>
                ) : productosFiltrados.map(prod => (
                  <button key={prod.id} onClick={() => agregarProducto(prod)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "10px 12px", background: "none", border: "none",
                      borderBottom: "1px solid #f1f5f9", cursor: "pointer", textAlign: "left",
                      borderRadius: 8, gap: 10, transition: "background 0.1s"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {prod.nombre}
                      </div>
                      {prod.laboratorio && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{prod.laboratorio}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <StockChip stock={prod.stock} />
                      <span style={{ fontSize: 20, color: "#3b82f6", fontWeight: 700, lineHeight: 1 }}>+</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* COLUMNA DERECHA: lista del pedido */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
              <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #e2e8f0", flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Lista del pedido
                  {itemsPedido.length > 0 && (
                    <span style={{ marginLeft: 8, background: "#1e40af", color: "white", borderRadius: 99, fontSize: 11, padding: "1px 8px", fontWeight: 800 }}>
                      {itemsPedido.length}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 18px" }}>
                {itemsPedido.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Sin productos todavía</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Buscá y agregá desde el panel izquierdo</div>
                  </div>
                ) : (
                  itemsPedido.map(item => (
                    <ItemPedido
                      key={item.id} item={item}
                      onCantidadChange={actualizarCantidad}
                      onNotasChange={actualizarNotasItem}
                      onEliminar={eliminarItem}
                    />
                  ))
                )}
              </div>

              {/* Notas generales */}
              <div style={{ padding: "14px 18px", borderTop: "1px solid #e2e8f0", background: "white", flexShrink: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>
                  Notas del pedido
                </label>
                <textarea
                  value={notasPedido} onChange={e => setNotasPedido(e.target.value)} onBlur={guardarNotas}
                  placeholder="Ej: urgente, confirmar precio antes de enviar…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 9, color: "#374151", fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Estado: pedido aún no creado */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "white", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 14px 14px" }}>
            <div style={{ textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#374151", marginBottom: 4 }}>
                Ingresá el proveedor y presioná "Crear pedido"
              </div>
              <div style={{ fontSize: 13 }}>Después podrás agregar productos</div>
            </div>
          </div>
        )}

        {/* Modal confirmar eliminar */}
        {confirmEliminar && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
            onClick={() => setConfirmEliminar(null)}>
            <div style={{ background: "white", borderRadius: 18, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>¿Eliminar pedido?</h2>
              <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
                Pedido a <b style={{ color: "#0f172a" }}>{confirmEliminar.nombre_proveedor}</b>.
                Esta acción no se puede deshacer.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmEliminar(null)}
                  style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "none", borderRadius: 10, color: "#374151", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={eliminarPedido} disabled={eliminando}
                  style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: eliminando ? 0.6 : 1 }}>
                  {eliminando ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // VISTA LISTA
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Pedidos a proveedores</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}{" "}
            {pedidos.filter(p => p.estado === "borrador").length > 0 && (
              <span style={{ color: "#d97706", fontWeight: 600 }}>· {pedidos.filter(p => p.estado === "borrador").length} en borrador</span>
            )}
            {pedidos.filter(p => p.estado === "enviado").length > 0 && (
              <span style={{ color: "#16a34a", fontWeight: 600 }}> · {pedidos.filter(p => p.estado === "enviado").length} enviados</span>
            )}
          </p>
        </div>
        <button onClick={abrirNuevo}
          style={{ background: "linear-gradient(135deg,#1e40af,#3b82f6)", color: "white", border: "none", borderRadius: 11, padding: "11px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.3)", display: "flex", alignItems: "center", gap: 7 }}>
          + Nuevo pedido
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "white", padding: 4, borderRadius: 11, border: "1px solid #e2e8f0", width: "fit-content", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {([
          { key: "todos",    label: "Todos",         count: pedidos.length },
          { key: "borrador", label: "📝 Borradores",  count: pedidos.filter(p => p.estado === "borrador").length },
          { key: "enviado",  label: "✅ Enviados",    count: pedidos.filter(p => p.estado === "enviado").length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setFiltro(t.key)} style={{
            padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 700, transition: "all 0.15s",
            background: filtro === t.key ? "#0f172a" : "transparent",
            color: filtro === t.key ? "white" : "#64748b",
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: 5, background: filtro === t.key ? "rgba(255,255,255,0.2)" : "#e2e8f0", color: filtro === t.key ? "white" : "#374151", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 800 }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {cargando ? (
        <div style={{ textAlign: "center", padding: 80, color: "#9ca3af", fontSize: 15 }}>⏳ Cargando pedidos…</div>
      ) : pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, background: "white", borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#374151" }}>
            {filtro === "todos" ? "No hay pedidos todavía" : filtro === "borrador" ? "No hay borradores" : "No hay pedidos enviados"}
          </div>
          {filtro === "todos" && <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>Creá tu primer pedido con el botón de arriba</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {pedidosFiltrados.map(p => (
            <div key={p.id} style={{
              background: "white", borderRadius: 16,
              border: p.estado === "enviado" ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden"
            }}>
              <div style={{ height: 5, background: p.estado === "enviado" ? "linear-gradient(90deg,#16a34a,#22c55e)" : "linear-gradient(90deg,#2563eb,#3b82f6)" }} />
              <div style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nombre_proveedor}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{fechaCorta(p.created_at)}</div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0, marginLeft: 8,
                    background: p.estado === "enviado" ? "#f0fdf4" : "#fffbeb",
                    color:      p.estado === "enviado" ? "#16a34a" : "#d97706",
                    border:     p.estado === "enviado" ? "1px solid #bbf7d0" : "1px solid #fde68a",
                  }}>
                    {p.estado === "enviado" ? "✓ Enviado" : "📝 Borrador"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 0", flex: 1, textAlign: "center", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{p.totalItems}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.3 }}>PRODUCTOS</div>
                  </div>
                  <div style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 0", flex: 1, textAlign: "center", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{p.totalUnidades}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.3 }}>UNIDADES</div>
                  </div>
                </div>

                {p.notas && (
                  <div style={{ fontSize: 12, color: "#64748b", background: "#f8fafc", borderRadius: 8, padding: "6px 10px", marginBottom: 12, fontStyle: "italic" }}>
                    📝 {p.notas.length > 70 ? p.notas.slice(0, 70) + "…" : p.notas}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => abrirEditor(p)}
                    style={{ flex: 1, padding: "9px", background: "linear-gradient(135deg,#1e40af,#3b82f6)", border: "none", borderRadius: 9, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    ✏️ Ver / Editar
                  </button>
                  <button onClick={() => exportarExcel(p)} title="Exportar Excel"
                    style={{ padding: "9px 13px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, color: "#16a34a", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    📊
                  </button>
                  <button onClick={() => setConfirmEliminar(p)} title="Eliminar"
                    style={{ padding: "9px 13px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, color: "#dc2626", fontSize: 14, cursor: "pointer" }}>
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
          onClick={() => setConfirmEliminar(null)}>
          <div style={{ background: "white", borderRadius: 18, padding: "32px 28px", maxWidth: 380, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗑️</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "#0f172a" }}>¿Eliminar pedido?</h2>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>
              Pedido a <b style={{ color: "#0f172a" }}>{confirmEliminar.nombre_proveedor}</b> con{" "}
              <b>{confirmEliminar.totalItems} productos</b>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)}
                style={{ flex: 1, padding: "11px", background: "#f1f5f9", border: "none", borderRadius: 10, color: "#374151", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={eliminarPedido} disabled={eliminando}
                style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: eliminando ? 0.6 : 1 }}>
                {eliminando ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
