"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

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
  if (dias < 0) return { label: "Vencido", color: "#e03131", bg: "#fff5f5" }
  if (dias <= 30) return { label: "Crítico", color: "#e03131", bg: "#fff5f5" }
  if (dias <= 60) return { label: "Próximo", color: "#f08c00", bg: "#fff9db" }
  return { label: "OK", color: "#2f9e44", bg: "#ebfbee" }
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
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState<number | null>(null)
  const inputFotoRef = useState<HTMLInputElement | null>(null)
  const [fotoRef, setFotoRef] = useState<HTMLInputElement | null>(null)
  const [productoFotoId, setProductoFotoId] = useState<number | null>(null)

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
    if (data) await cargarLotes(data.map((p: any) => p.id))
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
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
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
      mostrarToast("⚠️ Completá todos los campos", "error")
      return
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

  async function confirmarEliminar() {
    if (!confirmEliminar) return
    const { error } = await supabase.from("productos").delete().eq("id", confirmEliminar.id)
    if (error) {
      mostrarToast("❌ " + error.message, "error")
      setConfirmEliminar(null)
      return
    }
    await supabase.rpc("registrar_auditoria", { accion: "eliminar", tabla: "productos", registro_id: confirmEliminar.id })
    mostrarToast("🗑️ Producto eliminado", "ok")
    setConfirmEliminar(null)
    cargar()
  }

  async function importarCSV() {
    if (!archivo) { mostrarToast("⚠️ Seleccioná un archivo", "error"); return }
    if (!margenImportacion) { mostrarToast("⚠️ Ingresá un margen antes de importar", "error"); return }
    const texto = await archivo.text()
    const lineas = texto.split("\n").slice(1)
    let nuevos = 0, actualizados = 0
    const margenDefault = Number(margenImportacion)
    for (let linea of lineas) {
      if (!linea.trim()) continue
      const separador = linea.includes(";") ? ";" : ","
      const [producto, precio] = linea.split(separador)
      const nombre = producto?.trim()
      const costo = Number(precio)
      if (!nombre || !costo) continue
      const { data: existente } = await supabase.from("productos").select("*").eq("nombre", nombre).maybeSingle()
      if (existente) {
        const precioVenta = costo + (costo * existente.margen / 100)
        await supabase.from("productos").update({ costo, precio_venta: precioVenta }).eq("id", existente.id)
        await supabase.rpc("registrar_auditoria", { accion: "editar", tabla: "productos", registro_id: existente.id })
        actualizados++
      } else {
        const precioVenta = costo + (costo * margenDefault / 100)
        const { data } = await supabase.from("productos").insert([{
          nombre, costo, margen: margenDefault, precio_venta: precioVenta, stock: 0
        }]).select()
        await supabase.rpc("registrar_auditoria", { accion: "crear", tabla: "productos", registro_id: data?.[0]?.id || 0 })
        nuevos++
      }
    }
    mostrarToast(`✅ ${nuevos} nuevos · ${actualizados} actualizados`, "ok")
    setArchivo(null)
    cargar()
  }

  function abrirSelectorFoto(productoId: number) {
    setProductoFotoId(productoId)
    fotoRef?.click()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !productoFotoId) return
    const productoId = productoFotoId
    e.target.value = ""
    const ext = file.name.split(".").pop()
    const path = `${productoId}.${ext}`
    setSubiendoFoto(productoId)
    const { error: uploadError } = await supabase.storage
      .from("productos")
      .upload(path, file, { upsert: true })
    if (uploadError) {
      mostrarToast("❌ Error subiendo imagen", "error")
      setSubiendoFoto(null)
      return
    }
    const { data: urlData } = supabase.storage.from("productos").getPublicUrl(path)
    const url = urlData.publicUrl + "?t=" + Date.now()
    const { error: updateError } = await supabase.from("productos")
      .update({ imagen_url: url })
      .eq("id", productoId)
    if (updateError) {
      mostrarToast("❌ Error guardando URL", "error")
    } else {
      mostrarToast("✅ Foto actualizada", "ok")
      cargar()
    }
    setSubiendoFoto(null)
  }

  async function guardarLote() {
    if (!modalLote) return
    if (!formLote.cantidad || !formLote.fecha_vencimiento) {
      mostrarToast("⚠️ Completá cantidad y fecha", "error")
      return
    }
    setGuardandoLote(true)
    const { error } = await supabase.from("lotes").insert({
      producto_id: modalLote.productoId,
      cantidad: Number(formLote.cantidad),
      fecha_vencimiento: formLote.fecha_vencimiento
    })
    setGuardandoLote(false)
    if (error) return mostrarToast("❌ " + error.message, "error")
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

  if (cargando) return <p style={{ padding: 30 }}>⏳ Cargando productos...</p>

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <input
        ref={el => setFotoRef(el)}
        type="file"
        accept=".jpg,.jpeg,.webp,.png"
        style={{ display: "none" }}
        onChange={subirFoto}
      />

      <h1>📦 Productos</h1>

      <div style={{ marginBottom: 20 }}>
        <input type="number" placeholder="% Margen (ej: 40)" value={margenImportacion}
          onChange={(e) => setMargenImportacion(e.target.value)}
          style={{ width: 180, marginRight: 10 }} />
        <input type="file" accept=".csv" onChange={(e) => setArchivo(e.target.files?.[0] || null)} />
        <button onClick={importarCSV}>📥 Importar CSV</button>
      </div>

      <input placeholder="Buscar producto..." value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={{ width: "100%", marginBottom: 20, padding: 10 }} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 30 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" type="number" value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="% Margen" type="number" value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" type="number" value={stock} onChange={e => setStock(e.target.value)} />
        <button onClick={agregar}>➕ Agregar</button>
      </div>

      {productosFiltrados.map(p => {
        const costoNum = Number(editando?.costo || 0)
        const margenNum = Number(editando?.margen || 0)
        const precioEstimado = costoNum + (costoNum * margenNum / 100)
        const lotes = lotesMap[p.id] || []
        const lotesVisible = lotesAbiertos.has(p.id)

        return (
          <div key={p.id} style={{ background: "white", padding: 15, marginBottom: 10, borderRadius: 10 }}>
            <div style={{ display: "flex", gap: 15, alignItems: "stretch" }}>

              {/* Contenido principal */}
              <div style={{ flex: 1 }}>
                {editando?.id === p.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label><b>🏷️ Nombre</b></label>
                    <input value={editando.nombre || ""} onChange={e => setEditando({ ...editando, nombre: e.target.value })} />
                    <label><b>💰 Costo</b></label>
                    <input type="number" value={editando.costo || ""} onChange={e => setEditando({ ...editando, costo: e.target.value })} />
                    <label><b>📊 % Margen</b></label>
                    <input type="number" value={editando.margen || ""} onChange={e => setEditando({ ...editando, margen: e.target.value })} />
                    <label><b>📦 Stock</b></label>
                    <input type="number" value={editando.stock || ""} onChange={e => setEditando({ ...editando, stock: e.target.value })} />
                    <div style={{ background: "#f1f3f5", padding: 10, borderRadius: 8, marginTop: 10 }}>
                      💵 <b>Precio estimado:</b> {formatearPrecio(precioEstimado)}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={guardarEdicion}>💾 Guardar</button>
                      <button onClick={() => setEditando(null)}>✖️ Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <b style={{ color: "#111827", fontSize: "15px" }}>{p.nombre}</b>
                    {p.stock <= 5 && (
                      <span style={{
                        marginLeft: 10, background: "#fff3cd", color: "#92400e",
                        fontSize: "12px", fontWeight: "600", padding: "2px 8px",
                        borderRadius: "6px", border: "1px solid #fbbf24"
                      }}>
                        ⚠️ Stock bajo
                      </span>
                    )}
                    {lotes.length > 0 && (() => {
                      const diasMin = Math.min(...lotes.map((l: any) => {
                        const diff = Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                        return diff
                      }))
                      const est = estadoLote(diasMin)
                      if (diasMin <= 60) return (
                        <span style={{
                          marginLeft: 8, background: est.bg, color: est.color,
                          fontSize: "12px", fontWeight: "600", padding: "2px 8px",
                          borderRadius: "6px", border: `1px solid ${est.color}`
                        }}>
                          📅 {est.label}: {diasMin < 0 ? "vencido" : `${diasMin}d`}
                        </span>
                      )
                    })()}
                    <p style={{ color: "#374151", margin: "6px 0 4px" }}>
                      💰 Costo: {formatearPrecio(p.costo)} · 📊 Margen: {p.margen}% · 💵 Venta: {formatearPrecio(p.precio_venta)}
                    </p>
                    <p style={{ color: "#374151", margin: "0 0 10px" }}>📦 Stock: {p.stock}</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => setEditando({ ...p })}>✏️ Editar</button>
                      <button onClick={() => setConfirmEliminar(p)} style={{ background: "red", color: "white" }}>🗑️</button>
                      <button
                        onClick={() => toggleLotes(p.id)}
                        style={{
                          background: lotes.length > 0 ? "#e7f5ff" : "#f1f3f5",
                          color: lotes.length > 0 ? "#1971c2" : "#666",
                          border: "none", borderRadius: 6, padding: "4px 10px",
                          fontSize: 12, cursor: "pointer", fontWeight: 600
                        }}>
                        📅 Lotes ({lotes.length}) {lotesVisible ? "▲" : "▼"}
                      </button>
                      <button
                        onClick={() => {
                          setModalLote({ productoId: p.id, productoNombre: p.nombre })
                          setFormLote({ cantidad: "", fecha_vencimiento: "" })
                        }}
                        style={{
                          background: "#ebfbee", color: "#2f9e44",
                          border: "none", borderRadius: 6, padding: "4px 10px",
                          fontSize: 12, cursor: "pointer", fontWeight: 600
                        }}>
                        ➕ Lote
                      </button>
                    </div>

                    {/* Panel de lotes expandible */}
                    {lotesVisible && (
                      <div style={{ marginTop: 12, borderTop: "1px solid #e9ecef", paddingTop: 10 }}>
                        {lotes.length === 0 ? (
                          <p style={{ fontSize: 12, color: "#aaa" }}>Sin lotes registrados.</p>
                        ) : (
                          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ color: "#666", textAlign: "left" }}>
                                <th style={{ paddingBottom: 6 }}>Vencimiento</th>
                                <th style={{ paddingBottom: 6 }}>Días</th>
                                <th style={{ paddingBottom: 6 }}>Estado</th>
                                <th style={{ paddingBottom: 6 }}>Cantidad</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {lotes.map((l: any) => {
                                const dias = Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                                const est = estadoLote(dias)
                                return (
                                  <tr key={l.id} style={{ borderTop: "1px solid #f1f3f5" }}>
                                    <td style={{ padding: "5px 0" }}>{l.fecha_vencimiento}</td>
                                    <td style={{ padding: "5px 8px", color: est.color, fontWeight: 600 }}>
                                      {dias < 0 ? "Vencido" : `${dias}d`}
                                    </td>
                                    <td style={{ padding: "5px 8px" }}>
                                      <span style={{
                                        background: est.bg, color: est.color,
                                        padding: "2px 7px", borderRadius: 5, fontWeight: 600
                                      }}>
                                        {est.label}
                                      </span>
                                    </td>
                                    <td style={{ padding: "5px 8px" }}>{l.cantidad} u.</td>
                                    <td style={{ padding: "5px 0", textAlign: "right" }}>
                                      <button
                                        onClick={() => setConfirmEliminarLote(l)}
                                        style={{ background: "none", border: "none", color: "#e03131", cursor: "pointer", fontSize: 13 }}>
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
              <div
                onClick={() => abrirSelectorFoto(p.id)}
                title="Clic para cambiar foto"
                style={{
                  width: 90, minHeight: 90, flexShrink: 0, borderRadius: 10,
                  overflow: "hidden", border: "2px dashed #d1d5db", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", background: "#f9fafb", position: "relative"
                }}>
                {subiendoFoto === p.id ? (
                  <span style={{ fontSize: 12, color: "#6b7280", textAlign: "center", padding: 4 }}>⏳ Subiendo...</span>
                ) : p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: 6 }}>
                    <div style={{ fontSize: 22 }}>📷</div>
                    <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4, lineHeight: 1.3 }}>
                      JPG / WebP<br />800×800px
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* Modal agregar lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Agregar lote</h2>
            <p className="text-sm text-gray-500 mb-4">{modalLote.productoNombre}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                <input type="number" min="1" value={formLote.cantidad}
                  onChange={e => setFormLote({ ...formLote, cantidad: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
                <input type="date" value={formLote.fecha_vencimiento}
                  onChange={e => setFormLote({ ...formLote, fecha_vencimiento: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModalLote(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
              <button onClick={guardarLote} disabled={guardandoLote}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium">
                {guardandoLote ? "Guardando..." : "Guardar lote"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar lote */}
      {confirmEliminarLote && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">¿Eliminar lote?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Lote con vencimiento <strong>{confirmEliminarLote.fecha_vencimiento}</strong> ({confirmEliminarLote.cantidad} u.). Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmEliminarLote(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
              <button onClick={eliminarLote} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar producto */}
      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">¿Eliminar producto?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Vas a eliminar <strong>{confirmEliminar.nombre}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmEliminar(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
              <button onClick={confirmarEliminar} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}