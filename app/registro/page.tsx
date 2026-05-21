"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function RegistroPage() {
  const [nombreNegocio, setNombreNegocio] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [exito, setExito] = useState(false)
  const router = useRouter()

  async function handleRegistro() {
    setError("")
    if (!nombreNegocio.trim()) { setError("Ingresá el nombre de tu negocio"); return }
    if (!email.trim()) { setError("Ingresá tu email"); return }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return }
    if (password !== password2) { setError("Las contraseñas no coinciden"); return }

    setLoading(true)
    try {
      // 1. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { nombre_negocio: nombreNegocio.trim() },
        },
      })

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("Este email ya está registrado. Intentá iniciar sesión.")
        } else {
          setError(authError.message)
        }
        return
      }

      // 2. Crear fila en suscripciones (trial 15 días)
      const venc = new Date(); venc.setDate(venc.getDate() + 15)
      await supabase.from("suscripciones").insert({
        email: email.trim().toLowerCase(),
        nombre_negocio: nombreNegocio.trim(),
        estado: "trial",
        plan_id: 1,
        fecha_inicio: new Date().toISOString().split("T")[0],
        fecha_vencimiento: venc.toISOString().split("T")[0],
      })

      setExito(true)
    } catch (e: any) {
      setError(e.message || "Error al registrarse")
    } finally {
      setLoading(false)
    }
  }

  if (exito) return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c0f1a; }
      `}</style>
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0c0f1a", padding: 24,
      }}>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "48px 40px", maxWidth: 420, width: "100%",
          textAlign: "center", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🎉</div>
          <h2 style={{ color: "white", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            ¡Cuenta creada!
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Te enviamos un email de confirmación a <strong style={{ color: "white" }}>{email}</strong>.
            <br /><br />
            Confirmá tu email y después iniciá sesión. Tenés <strong style={{ color: "#fbbf24" }}>15 días de prueba gratuita</strong>.
          </p>
          <button
            onClick={() => router.push("/login")}
            style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg, #2563eb, #3b82f6)",
              border: "none", borderRadius: 10, color: "white",
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(59,130,246,0.35)",
            }}>
            Ir al login
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0c0f1a; }
        .reg-wrapper {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #0c0f1a; font-family: 'DM Sans', sans-serif; padding: 24px;
        }
        .reg-card {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 44px 40px; width: 100%; max-width: 420px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
        }
        .field { margin-bottom: 14px; }
        .field label {
          display: block; font-size: 11px; font-weight: 700; color: #9ca3af;
          letter-spacing: 0.5px; margin-bottom: 6px; text-transform: uppercase;
        }
        .field input {
          width: 100%; padding: 11px 14px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 9px; color: white; font-size: 14px;
          font-family: 'DM Sans', sans-serif; outline: none; transition: border-color 0.2s;
        }
        .field input:focus { border-color: #3b82f6; background: rgba(59,130,246,0.06); }
        .field input::placeholder { color: #4b5563; }
        .btn-reg {
          width: 100%; padding: 13px; background: linear-gradient(135deg, #2563eb, #3b82f6);
          border: none; border-radius: 10px; color: white; font-size: 14px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer; margin-top: 6px;
          box-shadow: 0 4px 16px rgba(59,130,246,0.35); transition: opacity 0.2s;
        }
        .btn-reg:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      <div className="reg-wrapper">
        <div className="reg-card">

          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(145deg, #1e40af, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 12px", boxShadow: "0 8px 24px rgba(59,130,246,0.4)",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <polyline points="3,5 9,19 12,13 15,19 21,5" stroke="white" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: 3, color: "white" }}>
              FLOPPA
            </div>
            <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: 2, fontWeight: 600, marginTop: 3, textTransform: "uppercase" }}>
              Crear cuenta
            </div>
          </div>

          <div className="field">
            <label>Nombre del negocio</label>
            <input
              type="text"
              placeholder="Ej: Distribuidora Pérez"
              value={nombreNegocio}
              onChange={e => setNombreNegocio(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Repetir contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRegistro()}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              color: "#fca5a5", fontSize: 13, padding: "10px 14px",
              borderRadius: 8, marginBottom: 14, textAlign: "center",
            }}>
              {error}
            </div>
          )}

          <button className="btn-reg" onClick={handleRegistro} disabled={loading}>
            {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#6b7280" }}>
            ¿Ya tenés cuenta?{" "}
            <a href="/login" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
              Iniciá sesión
            </a>
          </div>

          <div style={{ textAlign: "center", marginTop: 14, fontSize: 11, color: "#4b5563", lineHeight: 1.5 }}>
            15 días de prueba gratuita · Sin tarjeta requerida
          </div>

        </div>
      </div>
    </>
  )
}
