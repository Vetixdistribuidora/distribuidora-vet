"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"

/* ================= UI ================= */

function Toast({ mensaje, tipo }: { mensaje: string, tipo: "ok" | "error" }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 30,
      right: 30,
      background: tipo === "ok" ? "#16a34a" : "#dc2626",
      color: "white",
      padding: "12px 20px",
      borderRadius: 10,
      fontWeight: "bold",
      zIndex: 1000
    }}>
      {mensaje}
    </div>
  )
}

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function estadoLote(dias: number) {
  if (dias < 0) return { label: "Vencido", color: "#dc2626", bg: "#fef2f2" }
  if (dias <= 30) return { label: "Crítico", color: "#dc2626", bg: "#fef2f2" }
  if (dias <= 60) return { label: "Próximo", color: "#d97706", bg: "#fffbeb" }
  return { label: "OK", color: "#16a34a", bg: "#ecfdf5" }
}

/* ================= ESTILOS ================= */

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14
}

const btnPrimary = {
  background: "#2563eb",
  color: "#fff",
  border: "none",
  padding: "10px 14px",
  borderRadius: 8,
  cursor: "pointer"
}

const btnDanger = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer"
}

/* ================= COMPONENT ================= */

export default function Productos() {

  const [productos, setProductos] = useState<any[]>([])
  const [lotesMap, setLotesMap] = useState<Record<number, any[]>>({})

  const [cargando, setCargando] = useState(true)
  const [toast, setToast] = useState<any>(null)

  const [busqueda, setBusqueda] = useState("")
  const [nombre, setNombre] = useState("")
  const [costo, setCosto] = useState("")
  const [margen, setMargen] = useState("")
  const [stock, setStock] = useState("")

  const [editando, setEditando] = useState<any | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<any | null>(null)

  /* FOTO */
  const inputFotoRef = useRef<HTMLInputElement>(null)
  const productoFotoRef = useRef<number | null>(null)
  const [subiendoFoto, setSubiendoFoto] = useState<number | null>(null)

  /* LOTES */
  const [lotesAbiertos, setLotesAbiertos] = useState<Set<number>>(new Set())
  const [modalLote, setModalLote] = useState<any>(null)
  const [formLote, setFormLote] = useState({ cantidad: "", fecha: "" })
  const [confirmEliminarLote, setConfirmEliminarLote] = useState<any>(null)

  function mostrarToast(mensaje: string, tipo: "ok" | "error") {
    setToast({ mensaje, tipo })
    setTimeout(() => setToast(null), 3000)
  }

  /* ================= DATA ================= */

  async function cargar() {
    const { data: productosData } = await supabase
      .from("productos")
      .select("*")
      .order("nombre")

    setProductos(productosData || [])

    if (productosData) {
      const { data: lotes } = await supabase
        .from("lotes")
        .select("*")
        .in("producto_id", productosData.map(p => p.id))

      const mapa: Record<number, any[]> = {}
      lotes?.forEach(l => {
        if (!mapa[l.producto_id]) mapa[l.producto_id] = []
        mapa[l.producto_id].push(l)
      })

      setLotesMap(mapa)
    }

    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  /* ================= PRODUCTOS ================= */

  async function agregar() {
    const costoNum = Number(costo)
    const margenNum = Number(margen)
    const precio = costoNum + (costoNum * margenNum / 100)

    await supabase.from("productos").insert({
      nombre,
      costo: costoNum,
      margen: margenNum,
      precio_venta: precio,
      stock: Number(stock)
    })

    mostrarToast("Producto agregado", "ok")
    setNombre(""); setCosto(""); setMargen(""); setStock("")
    cargar()
  }

  async function guardarEdicion() {
    const costoNum = Number(editando.costo)
    const margenNum = Number(editando.margen)
    const precio = costoNum + (costoNum * margenNum / 100)

    await supabase.from("productos")
      .update({
        ...editando,
        precio_venta: precio
      })
      .eq("id", editando.id)

    setEditando(null)
    mostrarToast("Actualizado", "ok")
    cargar()
  }

  /* ================= FOTO ================= */

  function abrirSelectorFoto(id: number) {
    productoFotoRef.current = id
    inputFotoRef.current?.click()
  }

  async function subirFoto(e: any) {
    const file = e.target.files?.[0]
    if (!file || !productoFotoRef.current) return

    const id = productoFotoRef.current
    setSubiendoFoto(id)

    const path = `${id}.${file.name.split(".").pop()}`

    await supabase.storage.from("productos").upload(path, file, { upsert: true })

    const { data } = supabase.storage.from("productos").getPublicUrl(path)

    await supabase.from("productos")
      .update({ imagen_url: data.publicUrl + "?t=" + Date.now() })
      .eq("id", id)

    setSubiendoFoto(null)
    cargar()
  }

  /* ================= LOTES ================= */

  async function guardarLote() {
    await supabase.from("lotes").insert({
      producto_id: modalLote.id,
      cantidad: Number(formLote.cantidad),
      fecha_vencimiento: formLote.fecha
    })

    setModalLote(null)
    setFormLote({ cantidad: "", fecha: "" })
    cargar()
  }

  async function eliminarLote() {
    await supabase.from("lotes").delete().eq("id", confirmEliminarLote.id)
    setConfirmEliminarLote(null)
    cargar()
  }

  function toggleLotes(id: number) {
    setLotesAbiertos(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  /* ================= RENDER ================= */

  if (cargando) return <p style={{ padding: 30 }}>Cargando...</p>

  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", padding: 20 }}>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} />}

      <input ref={inputFotoRef} type="file" style={{ display: "none" }} onChange={subirFoto} />

      <h1>📦 Productos</h1>

      <input
        placeholder="Buscar..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ ...inputStyle, width: "100%", marginBottom: 20 }}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input placeholder="Nombre" style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Costo" style={inputStyle} value={costo} onChange={e => setCosto(e.target.value)} />
        <input placeholder="Margen" style={inputStyle} value={margen} onChange={e => setMargen(e.target.value)} />
        <input placeholder="Stock" style={inputStyle} value={stock} onChange={e => setStock(e.target.value)} />
        <button style={btnPrimary} onClick={agregar}>Agregar</button>
      </div>

      {filtrados.map(p => {
        const lotes = lotesMap[p.id] || []
        const abierto = lotesAbiertos.has(p.id)

        const diasMin = lotes.length
          ? Math.min(...lotes.map(l =>
              Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
            ))
          : null

        const estado = diasMin !== null ? estadoLote(diasMin) : null

        return (
          <div key={p.id} style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 15,
            marginBottom: 10
          }}>

            <b>{p.nombre}</b>

            {estado && diasMin! <= 60 && (
              <span style={{
                marginLeft: 10,
                background: estado.bg,
                color: estado.color,
                padding: "2px 8px",
                borderRadius: 6
              }}>
                {estado.label} ({diasMin}d)
              </span>
            )}

            <p style={{ color: "#4b5563" }}>
              💰 {formatearPrecio(p.precio_venta)} · 📦 {p.stock}
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => toggleLotes(p.id)}>Lotes ({lotes.length})</button>
              <button onClick={() => setModalLote(p)}>+ Lote</button>
            </div>

            {abierto && (
              <div style={{ marginTop: 10 }}>
                {lotes.map(l => {
                  const dias = Math.floor((new Date(l.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                  const est = estadoLote(dias)

                  return (
                    <div key={l.id} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12
                    }}>
                      {l.fecha_vencimiento} - {l.cantidad}u
                      <span style={{ color: est.color }}>{est.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}