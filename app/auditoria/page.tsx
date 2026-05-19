"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function fechaHora(f: string) {
  return new Date(f).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}

const ACCION_STYLE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  insert: { label: "Alta",      bg: "rgba(74,222,128,0.12)",  color: "#4ade80",  icon: "+" },
  update: { label: "Edición",   bg: "rgba(59,130,246,0.12)",  color: "#60a5fa",  icon: "✎" },
  delete: { label: "Baja",      bg: "rgba(239,68,68,0.12)",   color: "#f87171",  icon: "−" },
  login:  { label: "Login",     bg: "rgba(167,139,250,0.12)", color: "#a78bfa",  icon: "→" },
}

const TABLA_ICON: Record<string, string> = {
  ventas: "🛒", productos: "📦", clientes: "👤",
  compras: "🚚", proveedores: "🏭", lotes: "🗓️",
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .aud-kpis { grid-template-columns: repeat(2, 1fr) !important; }
    .aud-filtros { flex-direction: column !important; }
    .aud-row { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }
    .aud-row-meta { flex-wrap: wrap !important; }
  }
`

export default function Auditoria() {
  const [datos, setDatos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [filtroAccion, setFiltroAccion] = useState("todos")
  const [filtroTabla, setFiltroTabla] = useState("todas")

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from("auditoria")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(500)
      setDatos(data || [])
    } catch (e) {
      console.error("Error cargando auditoria:", e)
    } finally {
      setLoading(false)
    }
  }

  const tablas = [...new Set(datos.map(d => d.tabla).filter(Boolean))]
  const hoy = new Date().toLocaleDateString("sv-SE")

  const filtrados = datos.filter(d => {
    const textoOk = !busqueda || [d.usuario, d.tabla, d.accion, String(d.registro_id || "")].join(" ").toLowerCase().includes(busqueda.toLowerCase())
    const accionOk = filtroAccion === "todos" || d.accion === filtroAccion
    const tablaOk = filtroTabla === "todas" || d.tabla === filtroTabla
    return textoOk && accionOk && tablaOk
  })

  const hoy_count = datos.filter(d => d.fecha && new Date(d.fecha).toLocaleDateString("sv-SE") === hoy).length
  const inserts = datos.filter(d => d.accion === "insert").length
  const updates = datos.filter(d => d.accion === "update").length
  const deletes = datos.filter(d => d.accion === "delete").length

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* KPIs */}
      <div className="aud-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total eventos",  valor: datos.length,  color: "#60a5fa", icon: "📊" },
          { label: "Hoy",            valor: hoy_count,     color: "#a78bfa", icon: "📅" },
          { label: "Altas",          valor: inserts,        color: "#4ade80", icon: "+"  },
          { label: "Bajas",          valor: deletes,        color: "#f87171", icon: "−"  },
        ].map((k, i) => (
          <div key={i} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: k.color, borderRadius: "14px 0 0 14px" }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.valor}</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="aud-filtros" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="🔍 Buscar usuario, tabla, ID..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none" }}
        />
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", background: "white", color: "#111827", cursor: "pointer" }}>
          <option value="todos">Todas las acciones</option>
          <option value="insert">Alta</option>
          <option value="update">Edición</option>
          <option value="delete">Baja</option>
          <option value="login">Login</option>
        </select>
        <select value={filtroTabla} onChange={e => setFiltroTabla(e.target.value)}
          style={{ padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 14, outline: "none", background: "white", color: "#111827", cursor: "pointer" }}>
          <option value="todas">Todas las tablas</option>
          {tablas.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={cargar} style={{ padding: "10px 16px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" }}>
          🔄 Actualizar
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>⏳ Cargando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 600 }}>Sin registros de auditoría</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtrados.map(a => {
            const est = ACCION_STYLE[a.accion] ?? { label: a.accion, bg: "rgba(148,163,184,0.12)", color: "#94a3b8", icon: "·" }
            const tablaIcon = TABLA_ICON[a.tabla] ?? "🗂️"
            return (
              <div key={a.id} className="aud-row" style={{ background: "white", borderRadius: 12, padding: "12px 16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  {/* Badge acción */}
                  <div style={{ background: est.bg, color: est.color, width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
                    {est.icon}
                  </div>
                  <div className="aud-row-meta" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ background: est.bg, color: est.color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>{est.label}</span>
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 600, flexShrink: 0 }}>{tablaIcon} {a.tabla || "—"}</span>
                    {a.registro_id && <span style={{ fontSize: 12, color: "#9ca3af" }}>ID #{a.registro_id}</span>}
                    {a.usuario && (
                      <span style={{ fontSize: 12, color: "#6b7280", background: "#f8fafc", padding: "2px 8px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                        👤 {a.usuario}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, textAlign: "right" }}>
                  {a.fecha ? fechaHora(a.fecha) : "—"}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
