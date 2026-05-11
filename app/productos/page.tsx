"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
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

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function estadoLote(dias: number) {
  if (dias < 0)   return { label: "Vencido", color: "#f87171", bg: "rgba(239,68,68,0.15)" }
  if (dias <= 30) return { label: "Crítico", color: "#f87171", bg: "rgba(239,68,68,0.15)" }
  if (dias <= 60) return { label: "Próximo", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" }
  return { label: "OK", color: "#4ade80", bg: "rgba(74,222,128,0.15)" }
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px", color: "white", fontSize: "14px", outline: "none",
}
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: "600",
  color: "#9ca3af", letterSpacing: "0.5px", marginBottom: "6px", textTransform: "uppercase",
}
const btnPrimario: React.CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white", border: "none", borderRadius: 8,
  padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
}
const btnSecundario: React.CSSProperties = {
  background: "#f1f5f9", color: "#374151",
  border: "1px solid #e2e8f0", borderRadius: 8,
  padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer"
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .productos-topbar { flex-wrap: wrap !important; }
    .productos-topbar input { min-width: 0 !important; width: 100% !important; }
    .productos-topbar span { order: 3 !important; width: 100% !important; }

    .productos-add-panel { padding: 16px !important; }
    .productos-add-grid {
      grid-template-columns: 1fr 1fr !important;
    }
    .productos-add-grid > *:first-child {
      grid-column: 1 / -1 !important;
    }
    .productos-add-grid > *:last-child {
      grid-column: 1 / -1 !important;
    }

    .producto-item-main { flex-wrap: wrap !important; }
    .producto-item-foto { display: none !important; }
    .producto-item-acciones { flex-wrap: wrap !important; margin-top: 8px !important; width: 100% !important; }
    .producto-item-acciones button { flex: 1 !important; min-width: 60px !important; }

    .producto-edit-grid { grid-template-columns: 1fr 1fr !important; }
    .producto-edit-grid > *:first-child { grid-column: 1 / -1 !important; }

    .import-panel-row { flex-wrap: wrap !important; }
    .import-panel-row > * { width: 100% !important; box-sizing: border-box !important; }
  }
`

export default function Productos() {
  const [productos, setProductos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [busqueda, setBusqueda] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")
  const [categoria, setCategoria] = useState("")
  const [editando, setEditando] = useState<any | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [margenImportacion, setMargenImportacion] = useState("")
  const [fleteImportacion, setFleteImportacion] = useState("")
  const [preview, setPreview] = useState<any[]>([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [columnas, setColumnas] = useState<string[]>([])
  const [colNombre, setColNombre] = useState("")
  const [colCosto, setColCosto] = useState("")
  const [colLaboratorio, setColLaboratorio] = useState("")
  const [rawRows, setRawRows] = useState<any[]>([])
  const [laboratorio, setLaboratorio] = useState("")
  const [fleteProducto, setFleteProducto] = useState("")
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState<number | null>(null)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const productoFotoRef = useRef<number | null>(null)
  const [pagina, setPagina] = useState(1)
  const [mostrarImport, setMostrarImport] = useState(false)
  const [mostrarAgregar, setMostrarAgregar] = useState(false)

  const [lotesMap, setLotesMap] = useState<Record<number, any[]>>({})
  const [lotesAbiertos, setLotesAbiertos] = useState<Set<number>>(new Set())
  const [modalLote, setModalLote] = useState<{ productoId: number, productoNombre: string } | null>(null)
  const [formLote, setFormLote] = useState({ cantidad: "", fecha_vencimiento: "" })
  const [guardandoLote, setGuardandoLote] = useState(false)
  const [confirmEliminarLote, setConfirmEliminarLote] = useState<any | null>(null)
  const [modalPrecios, setModalPrecios] = useState(false)
  const [ajusteTipo, setAjusteTipo] = useState<"porcentaje" | "pesos">("porcentaje")
  const [ajusteValor, setAjusteValor] = useState("")
  const [ajusteAplica, setAjusteAplica] = useState<"costos" | "precios">("costos")
  const [aplicandoPrecios, setAplicandoPrecios] = useState(false)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo }); setTimeout(() => setToast(null), 3000)
  }

  async function actualizarPrecios() {
    const valor = parseFloat(ajusteValor)
    if (!valor || valor <= 0) { mostrarToast("Ingresá un valor válido", "error"); return }
    setAplicandoPrecios(true)
    const updates = productos.map(p => {
      let nuevoCosto = p.costo
      let nuevoMargen = p.margen
      if (ajusteAplica === "costos") {
        nuevoCosto = ajusteTipo === "porcentaje" ? p.costo * (1 + valor / 100) : p.costo + valor
        // Mantener el ratio precio_venta/costo para preservar el flete incluido
        // Si costo era 100 y precio_venta 127 (incluye IVA+flete), el ratio 1.27 se mantiene
        const ratio = p.costo > 0 ? p.precio_venta / p.costo : (1 + nuevoMargen / 100)
        const nuevoPrecio = nuevoCosto * ratio
        return { id: p.id, costo: Math.round(nuevoCosto * 100) / 100, margen: nuevoMargen, precio_venta: Math.round(nuevoPrecio * 100) / 100 }
      } else {
        // precios: update precio_venta, recalculate margen
        const nuevoPrecio = ajusteTipo === "porcentaje" ? p.precio_venta * (1 + valor / 100) : p.precio_venta + valor
        nuevoMargen = nuevoCosto > 0 ? ((nuevoPrecio / nuevoCosto) - 1) * 100 : p.margen
        return { id: p.id, costo: nuevoCosto, margen: Math.round(nuevoMargen * 100) / 100, precio_venta: Math.round(nuevoPrecio * 100) / 100 }
      }
    })
    const CHUNK = 50
    for (let i = 0; i < updates.length; i += CHUNK) {
      await Promise.all(updates.slice(i, i + CHUNK).map(u =>
        supabase.from("productos").update({ costo: u.costo, margen: u.margen, precio_venta: u.precio_venta }).eq("id", u.id)
      ))
    }
    setAplicandoPrecios(false)
    setModalPrecios(false)
    setAjusteValor("")
    mostrarToast(`✅ ${productos.length} precios actualizados`, "ok")
    cargar()
  }

  function exportarStock() {
    const data = productos.map(p => ({
      "Nombre": p.nombre,
      "Laboratorio": p.laboratorio || "",
      "Costo ($)": p.costo,
      "Margen (%)": p.margen,
      "Precio Venta ($)": p.precio_venta,
      "Stock (u.)": p.stock,
      "Capital ($)": Math.round(p.costo * p.stock * 100) / 100,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [{ wch: 40 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Stock")
    XLSX.writeFile(wb, `stock_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function exportarListaPrecios() {
    const data = productos.filter(p => p.stock > 0).map(p => ({
      "Producto": p.nombre,
      "Precio ($)": p.precio_venta,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = [{ wch: 45 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Lista de Precios")
    XLSX.writeFile(wb, `lista_precios_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function cargar() {
    let todos: any[] = []
    let desde = 0
    const tamano = 1000
    while (true) {
      const { data, error } = await supabase.from("productos").select("*").order("nombre").range(desde, desde + tamano - 1)
      if (error || !data || data.length === 0) break
      todos = [...todos, ...data]
      if (data.length < tamano) break
      desde += tamano
    }
    setProductos(todos); setCargando(false)
    if (todos.length > 0) await cargarLotes(todos.map((p: any) => p.id))
  }

  async function cargarLotes(ids: number[]) {
    const mapa: Record<number, any[]> = {}
    const chunkSize = 200
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const { data } = await supabase.from("lotes").select("*").in("producto_id", chunk).gt("cantidad", 0).order("fecha_vencimiento", { ascending: true })
      data?.forEach((l: any) => {
        if (!mapa[l.producto_id]) mapa[l.producto_id] = []
        mapa[l.producto_id].push(l)
      })
    }
    setLotesMap(mapa)
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {
    if (!nombre || !costo || !margen || !stock) { mostrarToast("⚠️ Completá todos los campos", "error"); return }
    const costoNum = Number(costo)
    const ivaNum = Number(margen)
    const fleteNum = Number(fleteProducto) || 0
    const precioVenta = Math.round(costoNum * (1 + ivaNum / 100) * (1 + fleteNum / 100) * 100) / 100
    const { data, error } = await supabase.from("productos").insert([{ nombre, costo: costoNum, margen: ivaNum, flete: fleteNum, precio_venta: precioVenta, stock: Number(stock), categoria: categoria.trim(), laboratorio: laboratorio.trim() }]).select()
    if (error) return mostrarToast("❌ " + error.message, "error")
    await supabase.rpc("registrar_auditoria", { accion: "crear", tabla: "productos", registro_id: data?.[0]?.id || 0 })
    mostrarToast("✅ Producto agregado", "ok")
    setNombre(""); setCosto(""); setMargen(""); setFleteProducto(""); setStock(""); setCategoria(""); setLaboratorio("")
    setMostrarAgregar(false); cargar()
  }

  async function guardarEdicion() {
    if (!editando.nombre || !editando.costo || !editando.margen) { mostrarToast("⚠️ Completá todos los campos", "error"); return }
    const costoNum = Number(editando.costo)
    const ivaNum = Number(editando.margen)
    const fleteNum = Number(editando.flete) || 0
    const precioVenta = Math.round(costoNum * (1 + ivaNum / 100) * (1 + fleteNum / 100) * 100) / 100
    const { error } = await supabase.from("productos").update({ nombre: editando.nombre, costo: costoNum, margen: ivaNum, flete: fleteNum, precio_venta: precioVenta, stock: Number(editando.stock), categoria: editando.categoria || "", laboratorio: editando.laboratorio || "" }).eq("id", editando.id)
    if (error) return mostrarToast("❌ " + error.message, "error")
    await supabase.rpc("registrar_auditoria", { accion: "editar", tabla: "productos", registro_id: editando.id })
    mostrarToast("✅ Producto actualizado", "ok")
    setEditando(null); cargar()
  }

  async function confirmarEliminarFn() {
    if (!confirmEliminar) return
    const { error } = await supabase.from("productos").delete().eq("id", confirmEliminar.id)
    if (error) { mostrarToast("❌ " + error.message, "error"); setConfirmEliminar(null); return }
    await supabase.rpc("registrar_auditoria", { accion: "eliminar", tabla: "productos", registro_id: confirmEliminar.id })
    mostrarToast("🗑️ Producto eliminado", "ok")
    setConfirmEliminar(null); cargar()
  }

  function parsePrecio(valor: any) {
    if (!valor && valor !== 0) return NaN
    let str = String(valor).replace(/\$/g, "").replace(/\s/g, "").trim()
    if (str.includes(",") && str.includes(".")) str = str.replace(/\./g, "").replace(",", ".")
    else if (str.includes(",") && !str.includes(".")) str = str.replace(",", ".")
    const num = Number(str)
    return isNaN(num) || num < 0 ? NaN : num
  }

  function descargarPlantilla() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nombre del producto", "Laboratorio", "Costo"],
      ["Ivermectina 1% x 50ml", "Laboratorio Richmond", "1500"],
      ["Amoxicilina 250mg x 10", "Laboratorio Bagó", "850"],
      ["Enrofloxacina 50mg x 20", "Laboratorio Holliday", "2300"],
    ])
    ws["!cols"] = [{ wch: 40 }, { wch: 22 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Productos")
    XLSX.writeFile(wb, "plantilla_productos.xlsx")
  }

  async function leerArchivo(file: File) {
    setArchivo(file)
    setColumnas([]); setColNombre(""); setColCosto(""); setColLaboratorio(""); setRawRows([]); setPreview([])
    try {
      const data = await file.arrayBuffer()
      let rows: any[] = []
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const wb2 = XLSX.read(data)
        const sheet = wb2.Sheets[wb2.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json(sheet, { defval: "" })
      } else {
        let texto = ""
        try { texto = new TextDecoder("utf-8").decode(data) } catch { texto = new TextDecoder("latin1").decode(data) }
        const lineas = texto.split("\n").filter((l: string) => l.trim())
        const sep = lineas[0].includes(";") ? ";" : ","
        const headers = lineas[0].split(sep).map((c: string) => c.trim().replace(/^"|"$/g, ""))
        rows = lineas.slice(1).map((l: string) => {
          const vals = l.split(sep).map((v: string) => v.trim().replace(/^"|"$/g, ""))
          const obj: any = {}
          headers.forEach((h: string, i: number) => { obj[h] = vals[i] ?? "" })
          return obj
        })
      }
      if (rows.length === 0) { mostrarToast("❌ Archivo vacío", "error"); return }
      const cols = Object.keys(rows[0])
      setColumnas(cols)
      setRawRows(rows)
      const probNombre = cols.find(c => /nombre|descrip|product|articul/i.test(c)) || cols[0]
      const probCosto = cols.find(c => /precio|costo|price|valor|importe/i.test(c)) || (cols.length > 1 ? cols[cols.length - 1] : cols[0])
      const probLab = cols.find(c => /laborator|lab\b|fabricante|marca|proveedor|drogueria|drog/i.test(c)) || ""
      setColNombre(probNombre)
      setColCosto(probCosto)
      setColLaboratorio(probLab)
      mostrarToast(`✅ ${rows.length} filas · ${cols.length} columnas detectadas`, "ok")
    } catch {
      mostrarToast("❌ Error leyendo el archivo", "error")
    }
  }

  function previsualizarMapeo() {
    if (!colNombre || !colCosto) return []
    return rawRows
      .map(r => ({
        nombre: String(r[colNombre] || "").trim(),
        costo: parsePrecio(r[colCosto]),
        laboratorio: colLaboratorio ? String(r[colLaboratorio] || "").trim() : "",
      }))
      .filter(r => r.nombre && !isNaN(r.costo))
  }

  function contarDescartados() {
    if (!colNombre || !colCosto) return { sinNombre: 0, sinCosto: 0 }
    let sinNombre = 0, sinCosto = 0
    for (const r of rawRows) {
      const nombre = String(r[colNombre] || "").trim()
      const costo = parsePrecio(r[colCosto])
      if (!nombre) sinNombre++
      else if (isNaN(costo)) sinCosto++
    }
    return { sinNombre, sinCosto }
  }

  async function importarConMapeo() {
    if (!colNombre || !colCosto) { mostrarToast("⚠️ Seleccioná las columnas", "error"); return }
    if (!margenImportacion) { mostrarToast("⚠️ Ingresá margen para nuevos productos", "error"); return }
    const mapeo = previsualizarMapeo()
    if (mapeo.length === 0) { mostrarToast("❌ Sin productos válidos con ese mapeo", "error"); return }
    setImportando(true); setProgreso(0)
    const margenDefault = Number(margenImportacion)
    const fleteDefault = Number(fleteImportacion) || 0
    const nombresExistentes = new Map(productos.map((p: any) => [p.nombre.toLowerCase().trim(), p]))

    // Separar nuevos (sin stock aún) de existentes (conservan su stock actual)
    const nuevos: any[] = []
    const existentes: any[] = []
    for (const { nombre, costo, laboratorio } of mapeo) {
      const existente = nombresExistentes.get(nombre.toLowerCase().trim())
      const margen = existente ? existente.margen : margenDefault
      // Fórmula: Precio Neto × (1 + IVA%) × (1 + Flete%)
      const precio_venta = Math.round(costo * (1 + margen / 100) * (1 + fleteDefault / 100) * 100) / 100
      const rec: any = { nombre, costo: Math.round(costo * 100) / 100, margen, precio_venta }
      if (laboratorio) rec.laboratorio = laboratorio
      if (existente) existentes.push(rec)
      else nuevos.push({ ...rec, stock: 0 })
    }

    const CHUNK = 100; let procesados = 0
    const todosLotes = [...nuevos, ...existentes]
    for (let i = 0; i < todosLotes.length; i += CHUNK) {
      const { error } = await supabase.from("productos").upsert(todosLotes.slice(i, i + CHUNK), { onConflict: "nombre" })
      if (error) { mostrarToast("❌ " + error.message, "error"); setImportando(false); return }
      procesados += Math.min(CHUNK, todosLotes.length - i)
      setProgreso(Math.round((procesados / todosLotes.length) * 100))
    }
    setImportando(false); setPreview([]); setRawRows([]); setColumnas([]); setColNombre(""); setColCosto(""); setColLaboratorio(""); setArchivo(null); setFleteImportacion("")
    mostrarToast(`✅ ${nuevos.length} nuevos · ${existentes.length} actualizados`, "ok"); cargar()
  }

  function abrirSelectorFoto(productoId: number) {
    productoFotoRef.current = productoId; inputFotoRef.current?.click()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !productoFotoRef.current) return
    const productoId = productoFotoRef.current; e.target.value = ""
    const ext = file.name.split(".").pop()
    const path = `${productoId}.${ext}`
    setSubiendoFoto(productoId)
    const { error: uploadError } = await supabase.storage.from("productos").upload(path, file, { upsert: true })
    if (uploadError) { mostrarToast("❌ Error subiendo imagen", "error"); setSubiendoFoto(null); return }
    const { data: urlData } = supabase.storage.from("productos").getPublicUrl(path)
    const url = urlData.publicUrl + "?t=" + Date.now()
    const { error: updateError } = await supabase.from("productos").update({ imagen_url: url }).eq("id", productoId)
    if (updateError) mostrarToast("❌ Error guardando URL", "error")
    else { mostrarToast("✅ Foto actualizada", "ok"); cargar() }
    setSubiendoFoto(null)
  }

  async function guardarLote() {
    if (!modalLote) return
    if (!formLote.cantidad || !formLote.fecha_vencimiento) { mostrarToast("⚠️ Completá cantidad y fecha", "error"); return }
    setGuardandoLote(true)
    const { error } = await supabase.from("lotes").insert({ producto_id: modalLote.productoId, cantidad: Number(formLote.cantidad), fecha_vencimiento: formLote.fecha_vencimiento })
    if (error) { setGuardandoLote(false); return mostrarToast("❌ " + error.message, "error") }
    await supabase.rpc("registrar_auditoria", { accion: "crear", tabla: "lotes", registro_id: modalLote.productoId })
    const { error: errorStock } = await supabase.from("productos").update({ stock: productos.find(p => p.id === modalLote.productoId)?.stock + Number(formLote.cantidad) }).eq("id", modalLote.productoId)
    setGuardandoLote(false)
    if (errorStock) return mostrarToast("❌ Error actualizando stock", "error")
    mostrarToast("✅ Lote agregado", "ok")
    setModalLote(null); setFormLote({ cantidad: "", fecha_vencimiento: "" }); cargar()
  }

  async function eliminarLote() {
    if (!confirmEliminarLote) return
    const producto = productos.find(p => p.id === confirmEliminarLote.producto_id)
    if (producto) {
      await supabase.from("productos").update({ stock: Math.max(0, producto.stock - confirmEliminarLote.cantidad) }).eq("id", confirmEliminarLote.producto_id)
    }
    const { error } = await supabase.from("lotes").delete().eq("id", confirmEliminarLote.id)
    if (error) return mostrarToast("❌ " + error.message, "error")
    mostrarToast("🗑️ Lote eliminado", "ok")
    setConfirmEliminarLote(null); cargar()
  }

  function toggleLotes(id: number) {
    setLotesAbiertos(prev => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  if (cargando) return <p style={{ padding: 30, color: "#9ca3af" }}>⏳ Cargando productos...</p>

  const terminoBusqProdPage = busqueda.trim().replace(/\s+/g, " ").toLowerCase()
  const palabrasBusqProdPage = terminoBusqProdPage.split(" ").filter(Boolean)
  const productosFiltrados = productos.filter(p => {
    if (palabrasBusqProdPage.length > 0) {
      const campo = p.nombre.toLowerCase() + " " + (p.laboratorio || "").toLowerCase()
      if (!campo.includes(terminoBusqProdPage) && !palabrasBusqProdPage.every(w => campo.includes(w))) return false
    }
    return !filtroCategoria || p.categoria === filtroCategoria
  })
  const productosVisibles = productosFiltrados.slice(0, pagina * 50)

  return (
    <div>
      <style>{responsiveStyles}</style>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}
      <input ref={inputFotoRef} type="file" accept=".jpg,.jpeg,.webp,.png" style={{ display: "none" }} onChange={subirFoto} />

      {/* Barra de acciones superior */}
      <div className="productos-topbar" style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="🔍 Buscar producto..." value={busqueda}
          onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        {(() => {
          const cats = [...new Set(productos.map((p: any) => p.categoria).filter(Boolean))].sort()
          if (cats.length === 0) return null
          return (
            <select value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setPagina(1) }}
              style={{ padding: "10px 14px", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, outline: "none", background: "white", color: "#111827", cursor: "pointer" }}>
              <option value="">Todas las categorías</option>
              {cats.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
          )
        })()}
        <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>
          <b style={{ color: "#374151" }}>{productos.length}</b> productos
          {busqueda && <span style={{ color: "#9ca3af" }}> · <b style={{ color: "#374151" }}>{productosFiltrados.length}</b> resultados</span>}
        </span>
        <button onClick={() => setMostrarAgregar(!mostrarAgregar)} style={btnSecundario}>
          {mostrarAgregar ? "✕ Cerrar" : "➕ Agregar"}
        </button>
        <button onClick={() => setMostrarImport(!mostrarImport)} style={btnSecundario}>
          {mostrarImport ? "✕ Cerrar" : "📥 Importar"}
        </button>
        <button onClick={exportarStock} style={btnSecundario} title="Exportar stock completo">
          📊 Stock
        </button>
        <button onClick={exportarListaPrecios} style={btnSecundario} title="Lista de precios para clientes">
          📋 Precios
        </button>
        <button onClick={() => setModalPrecios(true)} style={{ ...btnPrimario, background: "linear-gradient(135deg, #7c3aed, #8b5cf6)" }}>
          💲 Actualizar precios
        </button>
      </div>

      {/* Panel agregar */}
      {mostrarAgregar && (
        <div className="productos-add-panel" style={{ background: "#0f172a", borderRadius: 14, padding: "20px 24px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <p style={{ color: "#6b7280", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Nuevo producto</p>
          <div className="productos-add-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
            <input placeholder="Nombre del producto" value={nombre} onChange={e => setNombre(e.target.value)} type="text"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="Laboratorio" value={laboratorio} onChange={e => setLaboratorio(e.target.value)} type="text"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="Precio Neto" value={costo} onChange={e => setCosto(e.target.value)} type="number"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="% IVA" value={margen} onChange={e => setMargen(e.target.value)} type="number"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="% Flete" value={fleteProducto} onChange={e => setFleteProducto(e.target.value)} type="number"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="Stock" value={stock} onChange={e => setStock(e.target.value)} type="number"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <input placeholder="Categoría" value={categoria} onChange={e => setCategoria(e.target.value)} type="text"
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: 13, outline: "none" }} />
            <button onClick={agregar} style={btnPrimario}>Guardar</button>
          </div>
        </div>
      )}

      {/* Panel importar */}
      {mostrarImport && (
        <div style={{ background: "#0f172a", borderRadius: 14, padding: "20px 24px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <p style={{ color: "white", fontSize: 13, fontWeight: 700, margin: 0 }}>📥 Importar lista de precios</p>
              <p style={{ color: "#6b7280", fontSize: 12, margin: "4px 0 0" }}>Subí el Excel del distribuidor, elegí las columnas y el margen de ganancia.</p>
            </div>
            <button onClick={descargarPlantilla} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#9ca3af", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ⬇️ Descargar plantilla
            </button>
          </div>

          {/* File picker */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Archivo (.xlsx, .xls, .csv)</label>
            <input type="file" accept=".csv,.xlsx,.xls"
              onChange={e => { const f = e.target.files?.[0]; if (f) leerArchivo(f) }}
              style={{ display: "block", fontSize: 13, color: "#9ca3af", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", width: "100%", boxSizing: "border-box", cursor: "pointer" }} />
          </div>

          {/* Vista previa de datos crudos */}
          {rawRows.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ ...labelStyle, marginBottom: 8 }}>Vista previa del archivo ({rawRows.length} filas · {columnas.length} columnas detectadas)</p>
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: columnas.length * 120 }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.06)" }}>
                      {columnas.map(c => (
                        <th key={c} style={{ padding: "7px 12px", textAlign: "left", color: "#9ca3af", fontWeight: 700, whiteSpace: "nowrap", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 3).map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        {columnas.map(c => (
                          <td key={c} style={{ padding: "6px 12px", color: "#d1d5db", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rawRows.length > 3 && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>...y {rawRows.length - 3} filas más</p>}
            </div>
          )}

          {/* Column selectors */}
          {columnas.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ ...labelStyle, marginBottom: 8 }}>Mapeo de columnas</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={labelStyle}>Columna de laboratorio</label>
                  <select value={colLaboratorio} onChange={e => { setColLaboratorio(e.target.value); setPreview([]) }}
                    style={{ width: "100%", padding: "9px 12px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="" style={{ background: "#1e293b", color: "white" }}>— ninguna —</option>
                    {columnas.map(c => <option key={c} value={c} style={{ background: "#1e293b", color: "white" }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Columna de nombre *</label>
                  <select value={colNombre} onChange={e => { setColNombre(e.target.value); setPreview([]) }}
                    style={{ width: "100%", padding: "9px 12px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="" style={{ background: "#1e293b", color: "white" }}>— elegir —</option>
                    {columnas.map(c => <option key={c} value={c} style={{ background: "#1e293b", color: "white" }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Columna de precio neto *</label>
                  <select value={colCosto} onChange={e => { setColCosto(e.target.value); setPreview([]) }}
                    style={{ width: "100%", padding: "9px 12px", background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="" style={{ background: "#1e293b", color: "white" }}>— elegir —</option>
                    {columnas.map(c => <option key={c} value={c} style={{ background: "#1e293b", color: "white" }}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>IVA para nuevos (%)</label>
                  <input type="number" placeholder="ej: 21" value={margenImportacion}
                    onChange={e => setMargenImportacion(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>Existentes conservan su IVA</div>
                </div>
                <div>
                  <label style={labelStyle}>Flete (%)</label>
                  <input type="number" placeholder="ej: 5" value={fleteImportacion}
                    onChange={e => setFleteImportacion(e.target.value)}
                    style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                  <div style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>Costo = Precio Neto × (1+IVA) × (1+Flete)</div>
                </div>
              </div>
            </div>
          )}

          {/* Preview and action */}
          {colNombre && colCosto && (() => {
            const mapped = previsualizarMapeo()
            const { sinNombre, sinCosto } = contarDescartados()
            const descartados = sinNombre + sinCosto
            const existentesCount = mapped.filter(r => productos.some((p: any) => p.nombre.toLowerCase().trim() === r.nombre.toLowerCase().trim())).length
            const nuevosCount = mapped.length - existentesCount
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    <b style={{ color: "#4ade80" }}>{mapped.length}</b> válidos ·{" "}
                    <b style={{ color: "#60a5fa" }}>{existentesCount}</b> actualizaciones ·{" "}
                    <b style={{ color: "#fbbf24" }}>{nuevosCount}</b> nuevos
                    {descartados > 0 && (
                      <span title={`${sinNombre} sin nombre · ${sinCosto} sin precio válido`}>
                        {" "}· <b style={{ color: "#f87171" }}>{descartados} ignoradas</b>
                        <span style={{ color: "#6b7280" }}> (sin nombre: {sinNombre}, sin precio: {sinCosto})</span>
                      </span>
                    )}
                  </span>
                  <button onClick={importarConMapeo} disabled={importando || mapped.length === 0 || !margenImportacion}
                    style={{ marginLeft: "auto", background: mapped.length > 0 && margenImportacion ? "linear-gradient(135deg, #16a34a, #22c55e)" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, color: "white", padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: mapped.length > 0 && margenImportacion ? "pointer" : "not-allowed", opacity: importando ? 0.6 : 1 }}>
                    {importando ? `Importando... ${progreso}%` : `📥 Importar ${mapped.length} productos`}
                  </button>
                </div>
                {importando && (
                  <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ width: `${progreso}%`, background: "linear-gradient(90deg, #16a34a, #22c55e)", height: "100%", transition: "width 0.3s" }} />
                  </div>
                )}
                {mapped.length > 0 && (
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                    <div style={{ padding: "7px 12px", background: "rgba(255,255,255,0.04)", display: "flex", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", flex: 2 }}>NOMBRE</span>
                      {colLaboratorio && <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", flex: 1 }}>LABORATORIO</span>}
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 90, textAlign: "right" }}>PRECIO NETO</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", width: 50, textAlign: "center" }}>EST.</span>
                    </div>
                    {mapped.slice(0, 8).map((r, i) => {
                      const esExistente = productos.some((p: any) => p.nombre.toLowerCase().trim() === r.nombre.toLowerCase().trim())
                      return (
                        <div key={i} style={{ display: "flex", gap: 12, padding: "7px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#d1d5db", flex: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</span>
                          {colLaboratorio && <span style={{ fontSize: 11, color: "#9ca3af", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.laboratorio || <span style={{ color: "#374151" }}>—</span>}</span>}
                          <span style={{ fontSize: 12, color: "#4ade80", width: 90, textAlign: "right", fontWeight: 600 }}>${r.costo.toLocaleString("es-AR")}</span>
                          <span style={{ width: 50, textAlign: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: esExistente ? "rgba(59,130,246,0.15)" : "rgba(251,191,36,0.15)", color: esExistente ? "#60a5fa" : "#fbbf24" }}>
                              {esExistente ? "ACT." : "NUEVO"}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                    {mapped.length > 8 && <div style={{ padding: "7px 12px", fontSize: 11, color: "#4b5563", borderTop: "1px solid rgba(255,255,255,0.04)" }}>...y {mapped.length - 8} más</div>}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Lista de productos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {productosVisibles.map(p => {
          const lotes = lotesMap[p.id] || []
          const lotesVisible = lotesAbiertos.has(p.id)
          const costoNum = Number(editando?.costo || 0)
          const margenNum = Number(editando?.margen || 0)
          const fleteEditNum = Number(editando?.flete || 0)
          const precioEstimado = Math.round(costoNum * (1 + margenNum / 100) * (1 + fleteEditNum / 100) * 100) / 100

          let badgeLote = null
          if (lotes.length > 0) {
            const diasMin = Math.min(...lotes.map((l: any) => Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)))
            if (diasMin <= 60) {
              const est = estadoLote(diasMin)
              badgeLote = (
                <span style={{ background: est.bg, color: est.color, fontSize: "10px", fontWeight: "700", padding: "1px 7px", borderRadius: "5px", border: `1px solid ${est.color}` }}>
                  📅 {diasMin < 0 ? "Vencido" : `${diasMin}d`}
                </span>
              )
            }
          }

          return (
            <div key={p.id} style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

              {/* MODO EDICIÓN */}
              {editando?.id === p.id ? (
                <div style={{ background: "#0f172a", borderRadius: 10, padding: 18, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
                    Editando: <span style={{ color: "white" }}>{p.nombre}</span>
                  </p>
                  <div className="producto-edit-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 12 }}>
                    {[
                      { label: "Nombre",      key: "nombre", type: "text" },
                      { label: "Precio Neto", key: "costo",  type: "number" },
                      { label: "% IVA",       key: "margen", type: "number" },
                      { label: "% Flete",     key: "flete",  type: "number" },
                      { label: "Stock",       key: "stock",  type: "number" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={labelStyle}>{f.label}</label>
                        <input type={f.type} value={editando[f.key] ?? ""}
                          onChange={e => setEditando({ ...editando, [f.key]: e.target.value })}
                          placeholder={f.key === "flete" ? "0" : ""}
                          style={inputStyle} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <div>
                      <label style={labelStyle}>Laboratorio</label>
                      <input type="text" placeholder="Ej: Laboratorio Richmond" value={editando?.laboratorio ?? ""}
                        onChange={e => setEditando({ ...editando, laboratorio: e.target.value })}
                        style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Categoría</label>
                      <input type="text" placeholder="Ej: Antiparasitarios" value={editando?.categoria ?? ""}
                        onChange={e => setEditando({ ...editando, categoria: e.target.value })}
                        style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
                    <span style={{ color: "#93c5fd", fontSize: 13 }}>
                      💵 Costo estimado: <b style={{ color: "white" }}>{formatearPrecio(precioEstimado)}</b>
                      <span style={{ color: "#6b7280", fontSize: 11 }}> = Neto × (1+IVA{margenNum > 0 ? " " + margenNum + "%" : ""}) × (1+Flete{fleteEditNum > 0 ? " " + fleteEditNum + "%" : ""})</span>
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={guardarEdicion} style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💾 Guardar</button>
                      <button onClick={() => setEditando(null)} style={{ background: "rgba(255,255,255,0.07)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  </div>
                </div>

              ) : (
                /* MODO VISTA */
                <div style={{ padding: "10px 14px" }}>
                  <div className="producto-item-main" style={{ display: "flex", alignItems: "center", gap: 10 }}>

                    {/* Foto miniatura */}
                    <div className="producto-item-foto" onClick={() => abrirSelectorFoto(p.id)} title="Cambiar foto"
                      style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", cursor: "pointer", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {subiendoFoto === p.id ? (
                        <span style={{ fontSize: 9, color: "#9ca3af" }}>...</span>
                      ) : p.imagen_url ? (
                        <img src={p.imagen_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 16 }}>📷</span>
                      )}
                    </div>

                    {/* Info principal */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{p.nombre}</span>
                        {p.laboratorio && (
                          <span style={{ background: "#f0fdf4", color: "#15803d", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, border: "1px solid #bbf7d0" }}>
                            🧪 {p.laboratorio}
                          </span>
                        )}
                        {p.categoria && (
                          <span style={{ background: "#eff6ff", color: "#3b82f6", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, border: "1px solid #bfdbfe" }}>
                            {p.categoria}
                          </span>
                        )}
                        {(p.stock == null || p.stock === 0) ? (
                          <span style={{ background: "#fef2f2", color: "#dc2626", fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "5px", border: "1px solid #fecaca" }}>🚫 Sin stock</span>
                        ) : p.stock <= 5 ? (
                          <span style={{ background: "#fff3cd", color: "#92400e", fontSize: "10px", fontWeight: "600", padding: "1px 6px", borderRadius: "5px", border: "1px solid #fbbf24" }}>⚠️ Stock bajo</span>
                        ) : null}
                        {badgeLote}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, flexWrap: "wrap", display: "flex", gap: 4 }}>
                        <span>Precio Neto: <b style={{ color: "#374151" }}>{formatearPrecio(p.costo)}</b></span>
                        <span style={{ color: "#d1d5db" }}>·</span>
                        <span>IVA: <b style={{ color: "#374151" }}>{p.margen ?? 0}%</b></span>
                        <span style={{ color: "#d1d5db" }}>·</span>
                        <span>Flete: <b style={{ color: "#374151" }}>{p.flete ?? 0}%</b></span>
                        <span style={{ color: "#d1d5db" }}>·</span>
                        <span>Costo: <b style={{ color: "#374151" }}>{formatearPrecio(p.precio_venta)}</b></span>
                        <span style={{ color: "#d1d5db" }}>·</span>
                        <span>Stock: <b style={{ color: p.stock === 0 ? "#dc2626" : p.stock <= 5 ? "#92400e" : "#374151" }}>{p.stock}</b></span>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="producto-item-acciones" style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => toggleLotes(p.id)} style={{
                        background: lotes.length > 0 ? "#eff6ff" : "#f9fafb",
                        color: lotes.length > 0 ? "#2563eb" : "#9ca3af",
                        border: `1px solid ${lotes.length > 0 ? "#bfdbfe" : "#e5e7eb"}`,
                        borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600
                      }}>📅 {lotes.length}</button>
                      <button onClick={() => { setModalLote({ productoId: p.id, productoNombre: p.nombre }); setFormLote({ cantidad: "", fecha_vencimiento: "" }) }} style={{
                        background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0",
                        borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600
                      }}>+ Lote</button>
                      <button onClick={() => setEditando({ ...p })} style={{ background: "#f1f5f9", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✏️</button>
                      <button onClick={() => setConfirmEliminar(p)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 7, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>🗑️</button>
                    </div>
                  </div>

                  {/* Panel lotes expandible */}
                  {lotesVisible && (
                    <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                      {lotes.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#9ca3af" }}>Sin lotes registrados.</p>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", minWidth: 300 }}>
                            <thead>
                              <tr style={{ color: "#6b7280" }}>
                                <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Vencimiento</th>
                                <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Días</th>
                                <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Estado</th>
                                <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Cantidad</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {lotes.map((l: any) => {
                                const dias = Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                                const est = estadoLote(dias)
                                return (
                                  <tr key={l.id} style={{ borderTop: "1px solid #f8fafc" }}>
                                    <td style={{ padding: "4px 0", color: "#374151" }}>{l.fecha_vencimiento}</td>
                                    <td style={{ padding: "4px 8px", color: est.color, fontWeight: 700 }}>{dias < 0 ? "Vencido" : `${dias}d`}</td>
                                    <td style={{ padding: "4px 8px" }}>
                                      <span style={{ background: est.bg, color: est.color, padding: "1px 7px", borderRadius: 5, fontWeight: 700, fontSize: 11 }}>{est.label}</span>
                                    </td>
                                    <td style={{ padding: "4px 8px", color: "#374151" }}>{l.cantidad} u.</td>
                                    <td style={{ textAlign: "right" }}>
                                      <button onClick={() => setConfirmEliminarLote(l)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13 }}>🗑️</button>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Botón ver más */}
      {productosVisibles.length < productosFiltrados.length && (
        <button onClick={() => setPagina(p => p + 1)} style={{
          width: "100%", padding: "12px", background: "white",
          border: "1px solid #e2e8f0", borderRadius: 10, cursor: "pointer",
          fontSize: 13, fontWeight: 600, color: "#374151", marginTop: 10
        }}>
          Ver más ({productosFiltrados.length - productosVisibles.length} restantes)
        </button>
      )}

      {/* ── MODAL AGREGAR LOTE ── */}
      {modalLote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Agregar lote</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 20 }}>{modalLote.productoNombre}</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Cantidad</label>
              <input type="number" min="1" placeholder="Ej: 50" value={formLote.cantidad} onChange={e => setFormLote({ ...formLote, cantidad: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Fecha de vencimiento</label>
              <input type="date" value={formLote.fecha_vencimiento} onChange={e => setFormLote({ ...formLote, fecha_vencimiento: e.target.value })} style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalLote(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarLote} disabled={guardandoLote} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: guardandoLote ? 0.5 : 1 }}>
                {guardandoLote ? "Guardando..." : "✅ Guardar lote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ACTUALIZAR PRECIOS ── */}
      {modalPrecios && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={() => !aplicandoPrecios && setModalPrecios(false)}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💲</div>
            <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Actualizar precios</h2>
            <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
              Se aplicará a <b style={{ color: "white" }}>{productos.length} productos</b>
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>¿Qué actualizar?</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["costos", "Costos (recalcula precio)"], ["precios", "Precios de venta"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setAjusteAplica(val)}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid " + (ajusteAplica === val ? "#8b5cf6" : "rgba(255,255,255,0.1)"), background: ajusteAplica === val ? "rgba(139,92,246,0.2)" : "transparent", color: ajusteAplica === val ? "#c4b5fd" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Tipo de ajuste</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {([["porcentaje", "% Porcentaje"], ["pesos", "$ Pesos fijos"]] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setAjusteTipo(val)}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1px solid " + (ajusteTipo === val ? "#3b82f6" : "rgba(255,255,255,0.1)"), background: ajusteTipo === val ? "rgba(59,130,246,0.2)" : "transparent", color: ajusteTipo === val ? "#93c5fd" : "#9ca3af", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                  Valor ({ajusteTipo === "porcentaje" ? "%" : "$"})
                </label>
                <input
                  type="number" min="0" step="0.1"
                  placeholder={ajusteTipo === "porcentaje" ? "Ej: 10 para subir 10%" : "Ej: 500 para sumar $500"}
                  value={ajusteValor} onChange={e => setAjusteValor(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, color: "white", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
              </div>

              {ajusteValor && parseFloat(ajusteValor) > 0 && productos.length > 0 && (() => {
                const p = productos[0]
                const valor = parseFloat(ajusteValor)
                let ejCosto = p.costo, ejPrecio = p.precio_venta
                if (ajusteAplica === "costos") {
                  ejCosto = ajusteTipo === "porcentaje" ? p.costo * (1 + valor / 100) : p.costo + valor
                  const ratio = p.costo > 0 ? p.precio_venta / p.costo : 1
                  ejPrecio = ejCosto * ratio
                } else {
                  ejPrecio = ajusteTipo === "porcentaje" ? p.precio_venta * (1 + valor / 100) : p.precio_venta + valor
                }
                return (
                  <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: "12px 14px", fontSize: 12 }}>
                    <div style={{ color: "#9ca3af", marginBottom: 4 }}>Ejemplo con <b style={{ color: "white" }}>{p.nombre.slice(0, 30)}</b>:</div>
                    <div style={{ color: "#c4b5fd" }}>
                      Costo: ${p.costo.toLocaleString("es-AR")} → <b>${ejCosto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</b>
                      &nbsp;·&nbsp;
                      Precio: ${p.precio_venta.toLocaleString("es-AR")} → <b>${ejPrecio.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</b>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => setModalPrecios(false)} disabled={aplicandoPrecios}
                style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={actualizarPrecios} disabled={aplicandoPrecios || !ajusteValor || parseFloat(ajusteValor) <= 0}
                style={{ flex: 1, padding: "11px", background: aplicandoPrecios || !ajusteValor ? "rgba(139,92,246,0.3)" : "linear-gradient(135deg, #7c3aed, #8b5cf6)", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: aplicandoPrecios || !ajusteValor ? "not-allowed" : "pointer" }}>
                {aplicandoPrecios ? `Actualizando...` : `Aplicar a ${productos.length} productos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR LOTE ── */}
      {confirmEliminarLote && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>¿Eliminar lote?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Vencimiento <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminarLote.fecha_vencimiento}</span> · {confirmEliminarLote.cantidad} u.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminarLote(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={eliminarLote} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR PRODUCTO ── */}
      {confirmEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>¿Eliminar producto?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Vas a eliminar <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminar.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={confirmarEliminarFn} style={{ flex: 1, padding: "11px", background: "#dc2626", border: "none", borderRadius: 10, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}