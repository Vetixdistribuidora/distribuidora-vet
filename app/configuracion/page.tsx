"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

interface OrgForm {
  nombre: string
  telefono: string
  email: string
  direccion: string
}

const EMPTY: OrgForm = { nombre: "", telefono: "", email: "", direccion: "" }

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#64748b", letterSpacing: 0.5, marginBottom: 6,
  textTransform: "uppercase"
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1px solid #e2e8f0", fontSize: 14, color: "#111827",
  outline: "none", boxSizing: "border-box", background: "white",
  fontFamily: "inherit"
}

export default function ConfiguracionPage() {
  const [form, setForm] = useState<OrgForm>(EMPTY)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email ?? "")

      const { data: org } = await supabase
        .from("organizaciones")
        .select("*")
        .single()

      if (org) {
        setOrgId(org.id)
        setForm({
          nombre:    org.nombre    ?? "",
          telefono:  org.telefono  ?? "",
          email:     org.email     ?? "",
          direccion: org.direccion ?? "",
        })
      }
    } catch (e) {
      console.error("Error cargando configuracion:", e)
    } finally {
      setLoading(false)
    }
  }

  function set(field: keyof OrgForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setExito(false)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError("El nombre del negocio es obligatorio."); return }
    setGuardando(true)
    setError(null)

    const { error: err } = await supabase
      .from("organizaciones")
      .update({
        nombre:    form.nombre.trim(),
        telefono:  form.telefono.trim()  || null,
        email:     form.email.trim()     || null,
        direccion: form.direccion.trim() || null,
      })
      .eq("id", orgId)

    setGuardando(false)
    if (err) { setError("Error al guardar: " + err.message); return }
    setExito(true)
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 14 }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0 }}>Configuración</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>Datos de tu negocio</p>
      </div>

      {/* Card cuenta */}
      <div style={{
        background: "white", borderRadius: 14, padding: "20px 24px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0",
        marginBottom: 20
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
          Cuenta
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "white", flexShrink: 0
          }}>
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{userEmail}</div>
            <div style={{ fontSize: 12, color: "#4ade80", marginTop: 2 }}>● Administrador</div>
          </div>
        </div>
      </div>

      {/* Card formulario */}
      <div style={{
        background: "white", borderRadius: 14, padding: "28px 24px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0"
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 20 }}>
          Datos del negocio
        </div>

        <form onSubmit={guardar}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>

            <div>
              <label style={labelStyle}>Nombre del negocio *</label>
              <input
                style={inputStyle}
                value={form.nombre}
                onChange={e => set("nombre", e.target.value)}
                placeholder="Ej: Distribuidora San Martín"
              />
            </div>

            <div>
              <label style={labelStyle}>Teléfono</label>
              <input
                style={inputStyle}
                value={form.telefono}
                onChange={e => set("telefono", e.target.value)}
                placeholder="Ej: +54 11 1234-5678"
              />
            </div>

            <div>
              <label style={labelStyle}>Email de contacto</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="Ej: contacto@minegocio.com"
              />
            </div>

            <div>
              <label style={labelStyle}>Dirección</label>
              <input
                style={inputStyle}
                value={form.direccion}
                onChange={e => set("direccion", e.target.value)}
                placeholder="Ej: Av. San Martín 1234, CABA"
              />
            </div>

          </div>

          {error && (
            <div style={{
              marginTop: 16, background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px", color: "#ef4444", fontSize: 13
            }}>
              {error}
            </div>
          )}

          {exito && (
            <div style={{
              marginTop: 16, background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 10, padding: "10px 14px", color: "#16a34a", fontSize: 13, fontWeight: 600
            }}>
              ✅ Cambios guardados correctamente
            </div>
          )}

          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                padding: "11px 28px",
                background: guardando ? "#93c5fd" : "#3b82f6",
                border: "none", borderRadius: 10, color: "white",
                fontSize: 14, fontWeight: 700,
                cursor: guardando ? "not-allowed" : "pointer"
              }}
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
