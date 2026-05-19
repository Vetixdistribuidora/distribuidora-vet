"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function OnboardingPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) { setError("Ingresá el nombre de tu negocio."); return }

    setLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc("crear_organizacion", {
      p_nombre: nombre.trim()
    })

    if (rpcError) {
      setError("Error al crear la organización: " + rpcError.message)
      setLoading(false)
      return
    }

    router.replace("/")
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0c0f1a 0%, #111827 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "DM Sans, Segoe UI, sans-serif"
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: "44px 40px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "linear-gradient(145deg, #1e40af, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 6px 20px rgba(59,130,246,0.4)"
          }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <polyline points="3,5 9,19 12,13 15,19 21,5" stroke="white" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="12" cy="4" r="1.3" fill="#93c5fd" />
            </svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 24, color: "white", letterSpacing: 2 }}>¡Bienvenido!</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
            Configurá el nombre de tu negocio<br />para comenzar a usar VETIX
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700,
              color: "#9ca3af", letterSpacing: 0.5, marginBottom: 8,
              textTransform: "uppercase"
            }}>
              Nombre del negocio
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Distribuidora San Martín"
              autoFocus
              style={{
                width: "100%", padding: "13px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "white", fontSize: 15, outline: "none",
                boxSizing: "border-box", fontFamily: "inherit"
              }}
            />
            <div style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>
              Podés cambiarlo después desde Configuración.
            </div>
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
              width: "100%", padding: "14px",
              background: loading ? "#1e3a8a" : "linear-gradient(135deg, #1e40af, #3b82f6)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(59,130,246,0.3)"
            }}
          >
            {loading ? "Configurando..." : "Comenzar →"}
          </button>
        </form>
      </div>
    </div>
  )
}
