"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"

export default function RegistroPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "", confirmar: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.email.trim() || !form.password || !form.confirmar) {
      setError("Completá todos los campos.")
      return
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setLoading(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Iniciar sesión automáticamente después del registro
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (signInError) {
      // Si requiere confirmación de email
      setError("Cuenta creada. Revisá tu email para confirmar antes de ingresar.")
      setLoading(false)
      return
    }

    router.replace("/onboarding")
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0f1a 0%, #111827 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "DM Sans, Segoe UI, sans-serif"
    }}>
      <div style={{
        width: "100%", maxWidth: 420,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: "40px 36px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(145deg, #1e40af, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 6px 20px rgba(59,130,246,0.4)"
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <polyline points="3,5 9,19 12,13 15,19 21,5" stroke="white" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="12" cy="4" r="1.3" fill="#93c5fd" />
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, color: "white", letterSpacing: 2 }}>VETIX</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Crear cuenta nueva</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: 14, outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => set("password", e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: 14, outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" }}>
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={form.confirmar}
              onChange={e => set("confirmar", e.target.value)}
              placeholder="Repetí la contraseña"
              autoComplete="new-password"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: 14, outline: "none", boxSizing: "border-box"
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              color: "#f87171", fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px",
              background: loading ? "#1e3a8a" : "linear-gradient(135deg, #1e40af, #3b82f6)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.2s"
            }}
          >
            {loading ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#6b7280" }}>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
