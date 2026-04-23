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
      borderRadius: 10, fontWeight: "bold",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function estadoLote(dias: number) {
  if (dias < 0) return { label: "Vencido", color: "#f87171", bg: "rgba(239,68,68,0.15)" }
  if (dias <= 30) return { label: "Crítico", color: "#f87171", bg: "rgba(239,68,68,0.15)" }
  if (dias <= 60) return { label: "Próximo", color: "#fbbf24", bg: "rgba(251,191,36,0.15)" }
  return { label: "OK", color: "#4ade80", bg: "rgba(74,222,128,0.15)" }
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "white",
  fontSize: "14px",
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: "600",
  color: "#9ca3af",
  letterSpacing: "0.5px",
  marginBottom: "6px",
  textTransform: "uppercase",
}

export default function Productos() {
  const [productos, setProductos] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)
  const [busqueda, setBusqueda] = useState("")
  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")
  const [editando, setEditando] = useState<any | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [margenImportacion, setMargenImportacion] = useState("")
  const [preview, setPreview] = useState<any[]>([])
  const [importando, setImportando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState<number | null>(null)
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const productoFotoRef = useRef<number | null>(null)

  // Lotes
  const [lotesMap, setLotesMap] = useState<Record<number, any[]>>({})
  const [lotesAbiertos, setLotesAbiertos] = useState<Set<number>>(new Set())
  const [modalLote, setModalLote] = useState<{ productoId: number, productoNombre: string } | null>(null)
  const [formLote, setFormLote] = useState({ cantidad: "", fecha_vencimiento: "" })
  const [guardandoLote, setGuardandoLote] = useState(false)
  const [confirmEliminarLote, setConfirmEliminarLote] = useState<any | null>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  async function cargar() {
    const { data } = await supabase.from("productos").select("*").order("nombre")
    setProductos(data || [])
    setCargando(false)
    if (data && data.length > 0) await cargarLotes(data.map((p: any) => p.id))
  }

  async function cargarLotes(ids: number[]) {
    const { data } = await supabase
      .from("lotes")
      .select("*")
      .in("producto_id", ids)
      .gt("cantidad", 0)
      .order("fecha_vencimiento", { ascending: true })
    if (!data) return
    const mapa: Record<number, any[]> = {}
    data.forEach((l: any) => {
      if (!mapa[l.producto_id]) mapa[l.producto_id] = []
      mapa[l.producto_id].push(l)
    })
    setLotesMap(mapa)
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {
    if (!nombre || !costo || !margen || !stock) {
      mostrarToast("⚠️ Completá todos los campos", "error"); return
    }
    const costoNum = Number(costo)
    const margenNum = Number(margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)
    const { data, error } = await supabase.from("productos").insert([{
      nombre, costo: costoNum, margen: margenNum, precio_venta: precioVenta, stock: Number(stock)
    }]).select()
    if (error) return mostrarToast("❌ " + error.message, "error")
    await supabase.rpc("registrar_auditoria", { accion: "crear", tabla: "productos", registro_id: data?.[0]?.id || 0 })
    mostrarToast("✅ Producto agregado", "ok")
    setNombre(""); setCosto(""); setMargen(""); setStock("")
    cargar()
  }

  async function guardarEdicion() {
    if (!editando.nombre || !editando.costo || !editando.margen) {
      mostrarToast("⚠️ Completá todos los campos", "error"); return
    }
    const costoNum = Number(editando.costo)
    const margenNum = Number(editando.margen)
    const precioVenta = costoNum + (costoNum * margenNum / 100)
    const { error } = await supabase.from("productos").update({
      nombre: editando.nombre, costo: costoNum, margen: margenNum,
      precio_venta: precioVenta, stock: Number(editando.stock)
    }).eq("id", editando.id)
    if (error) return mostrarToast("❌ " + error.message, "error")
    await supabase.rpc("registrar_auditoria", { accion: "editar", tabla: "productos", registro_id: editando.id })
    mostrarToast("✅ Producto actualizado", "ok")
    setEditando(null)
    cargar()
  }

  async function confirmarEliminarFn() {
    if (!confirmEliminar) return
    const { error } = await supabase.from("productos").delete().eq("id", confirmEliminar.id)
    if (error) { mostrarToast("❌ " + error.message, "error"); setConfirmEliminar(null); return }
    await supabase.rpc("registrar_auditoria", { accion: "eliminar", tabla: "productos", registro_id: confirmEliminar.id })
    mostrarToast("🗑️ Producto eliminado", "ok")
    setConfirmEliminar(null)
    cargar()
  }

  function parsePrecio(valor: any) {
    if (!valor) return NaN
    let str = String(valor).replace(/\$/g, "").trim()
    if (str.includes(",") && str.includes(".")) str = str.replace(/\./g, "").replace(",", ".")
    else if (str.includes(",") && !str.includes(".")) str = str.replace(",", ".")
    return Number(str)
  }

  async function procesarArchivoUniversal() {
    if (!archivo) { mostrarToast("⚠️ Seleccioná un archivo", "error"); return }
    let productos: any[] = []
    if (archivo.name.endsWith(".xlsx")) {
      const data = await archivo.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json: any[] = XLSX.utils.sheet_to_json(sheet)
      for (let fila of json) {
        const laboratorio = fila.Laboratorio || fila.laboratorio || fila.Marca || fila.marca || ""
        const nombreProd = fila.Producto || fila.producto || fila.Nombre || fila.nombre || ""
        const costoRaw = fila.Costo || fila.costo || fila.Precio || fila.precio || fila["Precio Costo"] || fila["precio_costo_con_iva"] || ""
        const nombreFinal = `${String(laboratorio).trim()} ${String(nombreProd).trim()}`.trim()
        const costo = parsePrecio(costoRaw)
        if (!nombreFinal || isNaN(costo)) continue
        productos.push({ nombre: nombreFinal, costo })
      }
    } else {
      const buffer = await archivo.arrayBuffer()
      let texto = ""
      try { texto = new TextDecoder("utf-8").decode(buffer) } catch { texto = new TextDecoder("latin1").decode(buffer) }
      const lineas = texto.split("\n").slice(1)
      for (let linea of lineas) {
        if (!linea.trim()) continue
        const sep = linea.includes(";") ? ";" : ","
        const partes = linea.split(sep)
        const laboratorio = partes[0]; const producto = partes[1]; const precioRaw = partes[2] || partes[1]
        const nombreFinal = `${String(laboratorio || "").trim()} ${String(producto || "").trim()}`.trim()
        const costo = parsePrecio(precioRaw)
        if (!nombreFinal || isNaN(costo)) continue
        productos.push({ nombre: nombreFinal, costo })
      }
    }
    setPreview(productos.slice(0, 20))
    mostrarToast(`📊 ${productos.length} productos detectados`, "ok")
    return productos
  }

  async function importarCSV() {
    if (!archivo) return
    if (!margenImportacion) { mostrarToast("⚠️ Ingresá margen", "error"); return }
    const productosBase = await procesarArchivoUniversal()
    if (!productosBase) return
    setImportando(true); setProgreso(0)
    const margenDefault = Number(margenImportacion)
    const productosFinal = productosBase.map(p => ({
      nombre: p.nombre, costo: p.costo, margen: margenDefault,
      precio_venta: p.costo + (p.costo * margenDefault / 100), stock: 0
    }))
    const chunkSize = 200; let procesados = 0
    for (let i = 0; i < productosFinal.length; i += chunkSize) {
      const chunk = productosFinal.slice(i, i + chunkSize)
      const { error } = await supabase.from("productos").upsert(chunk, { onConflict: "nombre" })
      if (error) { mostrarToast("❌ Error en importación", "error"); break }
      procesados += chunk.length
      setProgreso(Math.round((procesados / productosFinal.length) * 100))
    }
    setImportando(false); setPreview([]); setArchivo(null)
    mostrarToast(`✅ ${procesados} productos importados`, "ok")
    cargar()
  }

  function abrirSelectorFoto(productoId: number) {
    productoFotoRef.current = productoId
    inputFotoRef.current?.click()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !productoFotoRef.current) return
    const productoId = productoFotoRef.current
    e.target.value = ""
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
  if (!formLote.cantidad || !formLote.fecha_vencimiento) {
    mostrarToast("⚠️ Completá cantidad y fecha", "error"); return
  }
  setGuardandoLote(true)
  const { error } = await supabase.from("lotes").insert({
    producto_id: modalLote.productoId,
    cantidad: Number(formLote.cantidad),
    fecha_vencimiento: formLote.fecha_vencimiento
  })
  if (error) { setGuardandoLote(false); return mostrarToast("❌ " + error.message, "error") }

  // Actualizar stock del producto
  await supabase.rpc("registrar_auditoria", { accion: "crear", tabla: "lotes", registro_id: modalLote.productoId })
  const { error: errorStock } = await supabase
    .from("productos")
    .update({ stock: productos.find(p => p.id === modalLote.productoId)?.stock + Number(formLote.cantidad) })
    .eq("id", modalLote.productoId)

  setGuardandoLote(false)
  if (errorStock) return mostrarToast("❌ Error actualizando stock", "error")
  mostrarToast("✅ Lote agregado", "ok")
  setModalLote(null)
  setFormLote({ cantidad: "", fecha_vencimiento: "" })
  cargar()
}

  async function eliminarLote() {
    if (!confirmEliminarLote) return
    const { error } = await supabase.from("lotes").delete().eq("id", confirmEliminarLote.id)
    if (error) return mostrarToast("❌ " + error.message, "error")
    mostrarToast("🗑️ Lote eliminado", "ok")
    setConfirmEliminarLote(null)
    cargar()
  }

  function toggleLotes(id: number) {
    setLotesAbiertos(prev => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  if (cargando) return <p style={{ padding: 30, color: "#9ca3af" }}>⏳ Cargando productos...</p>

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <input ref={inputFotoRef} type="file" accept=".jpg,.jpeg,.webp,.png"
        style={{ display: "none" }} onChange={subirFoto} />

      {/* Importación */}
      <div style={{
        background: "white", borderRadius: 12, padding: "16px 20px",
        marginBottom: 16, border: "1px solid #e5e7eb", display: "flex",
        alignItems: "center", gap: 10, flexWrap: "wrap"
      }}>
        <input type="number" placeholder="% Margen" value={margenImportacion}
          onChange={e => setMargenImportacion(e.target.value)}
          style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }} />
        <input type="file" accept=".csv,.xlsx" onChange={e => setArchivo(e.target.files?.[0] || null)}
          style={{ fontSize: 13 }} />
        <button onClick={procesarArchivoUniversal} style={btnSecundario}>👁️ Preview</button>
        <button onClick={importarCSV} style={btnPrimario}>📥 Importar</button>
      </div>

      {preview.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: 14, marginBottom: 16, border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Preview (primeros 20)</p>
          {preview.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: "#6b7280", padding: "2px 0" }}>{p.nombre} — ${p.costo}</div>
          ))}
        </div>
      )}

      {importando && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ width: `${progreso}%`, background: "#22c55e", height: "100%", transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{progreso}% completado</p>
        </div>
      )}

      {/* Buscador */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
  <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
    <span style={{ fontWeight: 700, color: "#374151" }}>{productos.length}</span> productos cargados
    {busqueda && (
      <span style={{ marginLeft: 8, color: "#9ca3af" }}>
        · <span style={{ fontWeight: 600, color: "#374151" }}>{productosFiltrados.length}</span> resultado{productosFiltrados.length !== 1 ? "s" : ""}
      </span>
    )}
  </p>
</div>
      <input placeholder="🔍 Buscar producto..." value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{
          width: "100%", marginBottom: 16, padding: "10px 14px",
          borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14,
          boxSizing: "border-box"
        }} />

      {/* Formulario agregar */}
      <div style={{
        background: "white", borderRadius: 12, padding: "16px 20px",
        marginBottom: 20, border: "1px solid #e5e7eb",
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end"
      }}>
        {[
          { placeholder: "Nombre", value: nombre, onChange: setNombre, type: "text" },
          { placeholder: "Costo", value: costo, onChange: setCosto, type: "number" },
          { placeholder: "% Margen", value: margen, onChange: setMargen, type: "number" },
          { placeholder: "Stock", value: stock, onChange: setStock, type: "number" },
        ].map(f => (
          <input key={f.placeholder} type={f.type} placeholder={f.placeholder} value={f.value}
            onChange={e => f.onChange(e.target.value)}
            style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, width: 130 }} />
        ))}
        <button onClick={agregar} style={btnPrimario}>➕ Agregar</button>
      </div>

      {/* Lista de productos */}
      {productosFiltrados.map(p => {
        const costoNum = Number(editando?.costo || 0)
        const margenNum = Number(editando?.margen || 0)
        const precioEstimado = costoNum + (costoNum * margenNum / 100)
        const lotes = lotesMap[p.id] || []
        const lotesVisible = lotesAbiertos.has(p.id)

        // Badge del lote más próximo a vencer
        let badgeLote = null
        if (lotes.length > 0) {
          const diasMin = Math.min(...lotes.map((l: any) =>
            Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
          ))
          if (diasMin <= 60) {
            const est = estadoLote(diasMin)
            badgeLote = (
              <span style={{
                marginLeft: 8, background: est.bg, color: est.color,
                fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                borderRadius: "6px", border: `1px solid ${est.color}`
              }}>
                📅 {est.label}: {diasMin < 0 ? "vencido" : `${diasMin}d`}
              </span>
            )
          }
        }

        return (
          <div key={p.id} style={{
            background: "white", padding: 16, marginBottom: 10, borderRadius: 12,
            border: "1px solid #e5e7eb", display: "flex", gap: 15, alignItems: "stretch",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
          }}>
            <div style={{ flex: 1 }}>

              {/* MODO EDICIÓN */}
              {editando?.id === p.id ? (
                <div style={{
                  background: "#0f172a", borderRadius: 12, padding: 20,
                  border: "1px solid rgba(255,255,255,0.08)"
                }}>
                  <p style={{ color: "#9ca3af", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
                    Editando: <span style={{ color: "white" }}>{p.nombre}</span>
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[
                      { label: "Nombre", key: "nombre", type: "text" },
                      { label: "Stock", key: "stock", type: "number" },
                      { label: "Costo", key: "costo", type: "number" },
                      { label: "% Margen", key: "margen", type: "number" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={labelStyle}>{f.label}</label>
                        <input type={f.type} value={editando[f.key] || ""}
                          onChange={e => setEditando({ ...editando, [f.key]: e.target.value })}
                          style={inputStyle} />
                      </div>
                    ))}
                  </div>
                  <div style={{
                    background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 8, padding: "10px 14px", marginTop: 14
                  }}>
                    <span style={{ color: "#93c5fd", fontSize: 13 }}>
                      💵 Precio estimado: <b style={{ color: "white" }}>{formatearPrecio(precioEstimado)}</b>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button onClick={guardarEdicion} style={{
                      background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                      color: "white", border: "none", borderRadius: 8,
                      padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer"
                    }}>💾 Guardar</button>
                    <button onClick={() => setEditando(null)} style={{
                      background: "rgba(255,255,255,0.07)", color: "#9ca3af",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                      padding: "9px 18px", fontSize: 13, cursor: "pointer"
                    }}>✖️ Cancelar</button>
                  </div>
                </div>

              ) : (
                /* MODO VISTA */
                <div>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    <b style={{ color: "#111827", fontSize: "15px" }}>{p.nombre}</b>
                    {p.stock <= 5 && (
                      <span style={{
                        marginLeft: 6, background: "#fff3cd", color: "#92400e",
                        fontSize: "11px", fontWeight: "600", padding: "2px 8px",
                        borderRadius: "6px", border: "1px solid #fbbf24"
                      }}>⚠️ Stock bajo</span>
                    )}
                    {badgeLote}
                  </div>
                  <p style={{ color: "#374151", margin: "0 0 4px", fontSize: 13 }}>
                    💰 Costo: {formatearPrecio(p.costo)} · 📊 Margen: {p.margen}% · 💵 Venta: {formatearPrecio(p.precio_venta)}
                  </p>
                  <p style={{ color: "#374151", margin: "0 0 12px", fontSize: 13 }}>📦 Stock: {p.stock}</p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => setEditando({ ...p })} style={btnSecundario}>✏️ Editar</button>
                    <button onClick={() => setConfirmEliminar(p)} style={btnDanger}>🗑️</button>
                    <button onClick={() => toggleLotes(p.id)} style={{
                      background: lotes.length > 0 ? "#eff6ff" : "#f9fafb",
                      color: lotes.length > 0 ? "#2563eb" : "#6b7280",
                      border: `1px solid ${lotes.length > 0 ? "#bfdbfe" : "#e5e7eb"}`,
                      borderRadius: 8, padding: "6px 12px", fontSize: 12,
                      cursor: "pointer", fontWeight: 600
                    }}>
                      📅 Lotes ({lotes.length}) {lotesVisible ? "▲" : "▼"}
                    </button>
                    <button onClick={() => {
                      setModalLote({ productoId: p.id, productoNombre: p.nombre })
                      setFormLote({ cantidad: "", fecha_vencimiento: "" })
                    }} style={{
                      background: "#f0fdf4", color: "#16a34a",
                      border: "1px solid #bbf7d0", borderRadius: 8,
                      padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600
                    }}>
                      ➕ Lote
                    </button>
                  </div>

                  {/* Panel lotes expandible */}
                  {lotesVisible && (
                    <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                      {lotes.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#9ca3af" }}>Sin lotes registrados.</p>
                      ) : (
                        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: "#6b7280" }}>
                              <th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 600 }}>Vencimiento</th>
                              <th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 600 }}>Días</th>
                              <th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 600 }}>Estado</th>
                              <th style={{ textAlign: "left", paddingBottom: 6, fontWeight: 600 }}>Cantidad</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {lotes.map((l: any) => {
                              const dias = Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                              const est = estadoLote(dias)
                              return (
                                <tr key={l.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "6px 0", color: "#374151" }}>{l.fecha_vencimiento}</td>
                                  <td style={{ padding: "6px 8px", color: est.color, fontWeight: 700 }}>
                                    {dias < 0 ? "Vencido" : `${dias}d`}
                                  </td>
                                  <td style={{ padding: "6px 8px" }}>
                                    <span style={{
                                      background: est.bg, color: est.color,
                                      padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11
                                    }}>{est.label}</span>
                                  </td>
                                  <td style={{ padding: "6px 8px", color: "#374151" }}>{l.cantidad} u.</td>
                                  <td style={{ textAlign: "right" }}>
                                    <button onClick={() => setConfirmEliminarLote(l)}
                                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14 }}>
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Foto */}
            <div onClick={() => abrirSelectorFoto(p.id)} title="Clic para cambiar foto"
              style={{
                width: 90, minHeight: 90, flexShrink: 0, borderRadius: 10,
                overflow: "hidden", border: "2px dashed #d1d5db", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", background: "#f9fafb"
              }}>
              {subiendoFoto === p.id ? (
                <span style={{ fontSize: 11, color: "#6b7280", textAlign: "center", padding: 4 }}>⏳ Subiendo...</span>
              ) : p.imagen_url ? (
                <img src={p.imagen_url} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ textAlign: "center", padding: 6 }}>
                  <div style={{ fontSize: 22 }}>📷</div>
                  <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4, lineHeight: 1.3 }}>JPG / WebP<br />800×800px</div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* ── MODAL AGREGAR LOTE ── */}
      {modalLote && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 380,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ color: "white", fontSize: 18, fontWeight: 700, margin: 0 }}>Agregar lote</h2>
              <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>{modalLote.productoNombre}</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Cantidad</label>
              <input type="number" min="1" placeholder="Ej: 50" value={formLote.cantidad}
                onChange={e => setFormLote({ ...formLote, cantidad: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Fecha de vencimiento</label>
              <input type="date" value={formLote.fecha_vencimiento}
                onChange={e => setFormLote({ ...formLote, fecha_vencimiento: e.target.value })}
                style={{ ...inputStyle, colorScheme: "dark" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setModalLote(null)} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600
              }}>Cancelar</button>
              <button onClick={guardarLote} disabled={guardandoLote} style={{
                flex: 1, padding: "11px",
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                opacity: guardandoLote ? 0.5 : 1
              }}>
                {guardandoLote ? "Guardando..." : "✅ Guardar lote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR LOTE ── */}
      {confirmEliminarLote && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>¿Eliminar lote?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Lote con vencimiento <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminarLote.fecha_vencimiento}</span> ({confirmEliminarLote.cantidad} u.). Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminarLote(null)} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer"
              }}>Cancelar</button>
              <button onClick={eliminarLote} style={{
                flex: 1, padding: "11px", background: "#dc2626",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ELIMINAR PRODUCTO ── */}
      {confirmEliminar && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16
        }}>
          <div style={{
            background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 360,
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)"
          }}>
            <h2 style={{ color: "white", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>¿Eliminar producto?</h2>
            <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 24 }}>
              Vas a eliminar <span style={{ color: "white", fontWeight: 600 }}>{confirmEliminar.nombre}</span>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmEliminar(null)} style={{
                flex: 1, padding: "11px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
                color: "#9ca3af", fontSize: 13, cursor: "pointer"
              }}>Cancelar</button>
              <button onClick={confirmarEliminarFn} style={{
                flex: 1, padding: "11px", background: "#dc2626",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer"
              }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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

const btnDanger: React.CSSProperties = {
  background: "#fef2f2", color: "#dc2626",
  border: "1px solid #fecaca", borderRadius: 8,
  padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer"
}