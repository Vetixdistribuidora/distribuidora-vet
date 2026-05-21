"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL || ""

function fechaLocal(f: string | null | undefined) {
  if (!f) return "—"
  return new Date(f + "T00:00:00").toLocaleDateString("es-AR")
}

const estadoBadge: Record<string, { color: string; bg: string; label: string }> = {
  owner:   { color: "#4ade80", bg: "rgba(74,222,128,0.12)",   label: "👑 Owner" },
  activo:  { color: "#4ade80", bg: "rgba(74,222,128,0.12)",   label: "✅ Activo" },
  trial:   { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",   label: "⏳ Trial" },
  vencido: { color: "#f87171", bg: "rgba(248,113,113,0.12)",  label: "❌ Vencido" },
}

export default function AdminPage() {
  const [suscripciones, setSuscripciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [esAdmin, setEsAdmin] = useState(false)
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Verificar que sea el owner (tiene policy "owner_ve_todo" en Supabase)
    const { data, error } = await supabase
      .from("suscripciones")
      .select("*, planes(nombre, precio)")
      .order("creado_en", { ascending: false })

    // Si solo devuelve 1 fila (la propia), no es admin
    if (!error && data && data.length > 1) {
      setEsAdmin(true)
      setSuscripciones(data)
    } else if (!error && data?.length === 1 && data[0].estado === "owner") {
      setEsAdmin(true)
      setSuscripciones(data)
    } else {
      setEsAdmin(false)
    }
    setLoading(false)
  }

  async function cambiarEstado(id: number, nuevoEstado: string) {
    await supabase.from("suscripciones").update({ estado: nuevoEstado }).eq("id", id)
    setSuscripciones(prev => prev.map(s => s.id === id ? { ...s, estado: nuevoEstado } : s))
  }

  const filtradas = suscripciones.filter(s =>
    s.email?.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.nombre_negocio?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const totales = {
    activos: suscripciones.filter(s => s.estado === "activo").length,
    trial:   suscripciones.filter(s => s.estado === "trial").length,
    vencidos: suscripciones.filter(s => s.estado === "vencido").length,
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <p style={{ color: "#9ca3af" }}>Cargando...</p>
    </div>
  )

  if (!esAdmin) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#f87171", fontWeight: 700, fontSize: 16, marginBottom: 8 }}>🚫 Acceso restringido</p>
        <p style={{ color: "#6b7280", fontSize: 13 }}>Esta sección es solo para administradores.</p>
      </div>
    </div>
  )

  return (
    <div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total clientes", valor: suscripciones.length, color: "#3b82f6", icon: "👥" },
          { label: "Activos",         valor: totales.activos,       color: "#4ade80", icon: "✅" },
          { label: "En trial",        valor: totales.trial,         color: "#fbbf24", icon: "⏳" },
          { label: "Vencidos",        valor: totales.vencidos,      color: "#f87171", icon: "❌" },
        ].map(k => (
          <div key={k.label} style={{
            background: "white", borderRadius: 14, padding: "18px 20px",
            border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: k.color, borderRadius: "14px 0 0 14px" }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{k.label}</span>
                <span style={{ fontSize: 16 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a" }}>{k.valor}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: 16 }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por email o nombre..."
          style={{
            width: "100%", padding: "10px 16px", borderRadius: 10,
            border: "1px solid #e2e8f0", fontSize: 14, outline: "none",
            background: "white", color: "#0f172a",
          }}
        />
      </div>

      {/* Tabla */}
      <div style={{ background: "#0f172a", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto",
          gap: 12, padding: "12px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10, fontWeight: 700, color: "#4b5563", textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          <span>Negocio / Email</span>
          <span>Plan</span>
          <span>Vence</span>
          <span>Estado</span>
          <span>Acción</span>
        </div>

        {filtradas.length === 0 && (
          <div style={{ padding: "24px 20px", color: "#4b5563", fontSize: 13, textAlign: "center" }}>
            Sin resultados
          </div>
        )}

        {filtradas.map((s, idx) => {
          const badge = estadoBadge[s.estado] || estadoBadge.trial
          return (
            <div key={s.id} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto",
              gap: 12, padding: "14px 20px", alignItems: "center",
              borderBottom: idx < filtradas.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              {/* Negocio / email */}
              <div>
                <div style={{ color: "white", fontSize: 13, fontWeight: 600 }}>
                  {s.nombre_negocio || <span style={{ color: "#4b5563", fontStyle: "italic" }}>Sin nombre</span>}
                </div>
                <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>{s.email}</div>
              </div>

              {/* Plan */}
              <div style={{ color: "#9ca3af", fontSize: 12 }}>
                {s.estado === "owner" ? "Owner" : (s.planes?.nombre || "Mensual")}
              </div>

              {/* Fecha vencimiento */}
              <div style={{ color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
                {s.estado === "owner" ? "—" : fechaLocal(s.fecha_vencimiento)}
              </div>

              {/* Badge estado */}
              <span style={{
                background: badge.bg, color: badge.color,
                fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12,
                whiteSpace: "nowrap",
              }}>
                {badge.label}
              </span>

              {/* Acción rápida */}
              <div>
                {s.estado !== "owner" && (
                  <select
                    value={s.estado}
                    onChange={e => cambiarEstado(s.id, e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6, color: "#9ca3af", fontSize: 11, padding: "4px 8px", cursor: "pointer",
                    }}>
                    <option value="trial">Trial</option>
                    <option value="activo">Activo</option>
                    <option value="vencido">Vencido</option>
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
