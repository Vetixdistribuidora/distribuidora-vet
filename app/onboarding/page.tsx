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
      background: "linear-gradient(135deg, #fbeaf2 0%, #f6d8e6 55%, #eccfe0 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "DM Sans, Segoe UI, sans-serif"
    }}>
      <div style={{
        width: "100%", maxWidth: 460,
        background: "#ffffff",
        border: "1px solid #f1d6e3",
        borderRadius: 20, padding: "44px 40px",
        boxShadow: "0 20px 60px rgba(21,38,74,0.18)"
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="VETIX Distribuidora" style={{ width: 210, maxWidth: "75%", height: "auto", display: "block", margin: "0 auto 20px" }} />
          <div style={{ fontWeight: 800, fontSize: 24, color: "#0f172a", letterSpacing: 1 }}>¡Bienvenido!</div>
          <div style={{ fontSize: 14, color: "#64748b", marginTop: 8, lineHeight: 1.5 }}>
            Configurá el nombre de tu negocio<br />para comenzar a usar VETIX
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 11, fontWeight: 700,
              color: "#64748b", letterSpacing: 0.5, marginBottom: 8,
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
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                color: "#0f172a", fontSize: 15, outline: "none",
                boxSizing: "border-box", fontFamily: "inherit"
              }}
            />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>
              Podés cambiarlo después desde Configuración.
            </div>
          </div>

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              color: "#dc2626", fontSize: 13
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading ? "#475569" : "linear-gradient(135deg, #1d3461, #15264a)",
              border: "none", borderRadius: 12, color: "white",
              fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 6px 18px rgba(21,38,74,0.30)"
            }}
          >
            {loading ? "Configurando..." : "Comenzar →"}
          </button>
        </form>
      </div>
    </div>
  )
}
