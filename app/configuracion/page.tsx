"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR")
}

function fechaLocal(f: string | null | undefined) {
  if (!f) return ""
  return new Date(f + "T00:00:00").toLocaleDateString("es-AR")
}

export default function ConfiguracionPage() {
  const [suscripcion, setSuscripcion] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [creandoLink, setCreandoLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [guardandoNombre, setGuardandoNombre] = useState(false)
  const [nombreEdit, setNombreEdit] = useState("")
  const [editandoNombre, setEditandoNombre] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setUsuario(user)
    if (!user?.email) { setLoading(false); return }

    const { data } = await supabase
      .from("suscripciones")
      .select("*, planes(nombre, precio)")
      .eq("email", user.email)
      .maybeSingle()

    // Si no tiene fila todavía → crear trial automáticamente (15 días)
    if (!data) {
      const venc = new Date(); venc.setDate(venc.getDate() + 15)
      const { data: nuevo } = await supabase
        .from("suscripciones")
        .insert({
          email: user.email,
          nombre_negocio: "",
          estado: "trial",
          plan_id: 1,
          fecha_inicio: new Date().toISOString().split("T")[0],
          fecha_vencimiento: venc.toISOString().split("T")[0],
        })
        .select("*, planes(nombre, precio)")
        .single()
      setSuscripcion(nuevo)
      setNombreEdit(nuevo?.nombre_negocio || "")
    } else {
      setSuscripcion(data)
      setNombreEdit(data?.nombre_negocio || "")
    }
    setLoading(false)
  }

  async function iniciarSuscripcion() {
    if (!usuario) return
    setCreandoLink(true)
    setError(null)
    try {
      const res = await fetch("/api/mp/crear-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: usuario.email,
          nombre_negocio: suscripcion?.nombre_negocio || "",
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      window.location.href = data.init_point
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreandoLink(false)
    }
  }

  async function guardarNombre() {
    if (!usuario) return
    setGuardandoNombre(true)
    await supabase
      .from("suscripciones")
      .update({ nombre_negocio: nombreEdit })
      .eq("email", usuario.email)
    setSuscripcion((prev: any) => ({ ...prev, nombre_negocio: nombreEdit }))
    setGuardandoNombre(false)
    setEditandoNombre(false)
  }

  const estadoConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    owner:   { label: "Owner — Acceso ilimitado", color: "#4ade80", bg: "rgba(74,222,128,0.12)",   icon: "👑" },
    activo:  { label: "Activo",                   color: "#4ade80", bg: "rgba(74,222,128,0.12)",   icon: "✅" },
    trial:   { label: "Período de prueba",         color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  icon: "⏳" },
    vencido: { label: "Suscripción vencida",       color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: "❌" },
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <p style={{ color: "#9ca3af" }}>Cargando...</p>
    </div>
  )

  const est = estadoConfig[suscripcion?.estado || "trial"]
  const esOwner = suscripcion?.estado === "owner"

  // VETIX es de uso interno de la distribuidora: no se muestran carteles de
  // suscripción / activación / plan. La lógica queda intacta; sólo se oculta la UI.
  // Para reactivar el cobro por plan, poner esto en true.
  const MOSTRAR_SUSCRIPCION = false

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

      {/* ── Suscripción (oculta para uso interno) ────────────────────────────── */}
      {MOSTRAR_SUSCRIPCION && (
      <div style={{
        background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: "28px 28px", marginBottom: 20,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ margin: 0, color: "white", fontSize: 17, fontWeight: 700 }}>💳 Suscripción</h2>
          <span style={{
            background: est.bg, color: est.color,
            fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
          }}>
            {est.icon} {est.label}
          </span>
        </div>

        {/* Nombre del negocio */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
            Nombre del negocio
          </div>
          {editandoNombre ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={nombreEdit}
                onChange={e => setNombreEdit(e.target.value)}
                style={{
                  flex: 1, padding: "9px 12px", background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
                  color: "white", fontSize: 14, outline: "none",
                }}
                onKeyDown={e => e.key === "Enter" && guardarNombre()}
                autoFocus
              />
              <button
                onClick={guardarNombre}
                disabled={guardandoNombre}
                style={{ padding: "9px 16px", background: "#3b82f6", border: "none", borderRadius: 8, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {guardandoNombre ? "..." : "Guardar"}
              </button>
              <button
                onClick={() => { setEditandoNombre(false); setNombreEdit(suscripcion?.nombre_negocio || "") }}
                style={{ padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "white", fontSize: 15, fontWeight: 600 }}>
                {suscripcion?.nombre_negocio || <span style={{ color: "#4b5563", fontStyle: "italic" }}>Sin nombre</span>}
              </span>
              <button
                onClick={() => setEditandoNombre(true)}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#9ca3af", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}>
                Editar
              </button>
            </div>
          )}
        </div>

        {/* Info plan */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Plan</div>
            <div style={{ color: "white", fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              {esOwner ? "Owner" : (suscripcion?.planes?.nombre || "Mensual")}
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Precio</div>
            <div style={{ color: "white", fontSize: 14, fontWeight: 700, marginTop: 4 }}>
              {esOwner ? "Gratis" : fmt(suscripcion?.planes?.precio || 60000) + "/mes"}
            </div>
          </div>
          {suscripcion?.fecha_vencimiento && !esOwner && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {suscripcion.estado === "activo" ? "Próximo pago" : "Vence"}
              </div>
              <div style={{ color: "white", fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                {fechaLocal(suscripcion.fecha_vencimiento)}
              </div>
            </div>
          )}
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Email</div>
            <div style={{ color: "white", fontSize: 13, fontWeight: 600, marginTop: 4, wordBreak: "break-all" }}>
              {usuario?.email}
            </div>
          </div>
        </div>

        {/* Acciones según estado */}
        {!esOwner && suscripcion?.estado !== "activo" && (
          <div>
            {suscripcion?.estado === "vencido" && (
              <div style={{
                background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 14,
                color: "#fca5a5", fontSize: 13,
              }}>
                ⚠️ Tu suscripción venció. Reactivala para seguir usando el sistema.
              </div>
            )}
            {suscripcion?.estado === "trial" && (
              <div style={{
                background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
                borderRadius: 10, padding: "12px 14px", marginBottom: 14,
                color: "#fde68a", fontSize: 13,
              }}>
                ⏳ Estás en período de prueba
                {suscripcion?.fecha_vencimiento ? ` — vence el ${fechaLocal(suscripcion.fecha_vencimiento)}` : ""}.
                Activá tu suscripción para no perder el acceso.
              </div>
            )}

            {error && (
              <div style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                color: "#fca5a5", fontSize: 13,
              }}>
                {error}
              </div>
            )}

            <button
              onClick={iniciarSuscripcion}
              disabled={creandoLink}
              style={{
                width: "100%", padding: "13px",
                background: creandoLink ? "rgba(59,130,246,0.5)" : "linear-gradient(135deg, #2563eb, #3b82f6)",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 14, fontWeight: 700, cursor: creandoLink ? "not-allowed" : "pointer",
                boxShadow: creandoLink ? "none" : "0 4px 16px rgba(59,130,246,0.35)",
                transition: "all 0.2s",
              }}>
              {creandoLink ? "Generando link de pago..." : "💳 Activar suscripción con MercadoPago"}
            </button>
          </div>
        )}

        {suscripcion?.estado === "activo" && (
          <div style={{ color: "#4ade80", fontSize: 13 }}>
            ✅ Suscripción activa. Los pagos se renuevan automáticamente cada mes.
          </div>
        )}

        {esOwner && (
          <div style={{ color: "#4ade80", fontSize: 13 }}>
            👑 Cuenta owner — acceso ilimitado sin costo.
          </div>
        )}
      </div>
      )}

      {/* ── Cuenta ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: "white", border: "1px solid #e2e8f0",
        borderRadius: 20, padding: "24px 28px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        <h2 style={{ margin: "0 0 16px", color: "#0f172a", fontSize: 17, fontWeight: 700 }}>⚙️ Cuenta</h2>
        <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Email:</span> {usuario?.email}
        </div>
        <div style={{ fontSize: 13, color: "#374151" }}>
          <span style={{ fontWeight: 600 }}>ID:</span>{" "}
          <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11 }}>{usuario?.id}</span>
        </div>
      </div>

    </div>
  )
}
