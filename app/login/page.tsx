"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    setLoading(true)
    setError("")
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError("Email o contraseña incorrectos")
      } else {
        router.push("/")
      }
    } catch (e) {
      setError("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #fbeaf2 0%, #f6d8e6 55%, #eccfe0 100%);
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
        }

        /* Fondo con manchas de luz */
        .login-wrapper::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(29,52,97,0.10) 0%, transparent 70%);
          top: -120px;
          left: -120px;
          pointer-events: none;
        }
        .login-wrapper::after {
          content: '';
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(246,201,221,0.55) 0%, transparent 70%);
          bottom: -90px;
          right: -90px;
          pointer-events: none;
        }

        .login-card {
          position: relative;
          z-index: 1;
          background: #ffffff;
          border: 1px solid #f1d6e3;
          border-radius: 20px;
          padding: 44px 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 24px 64px rgba(21,38,74,0.18);
          animation: fadeUp 0.5s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo-area {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
        }

        .logo-area img {
          width: 220px;
          max-width: 80%;
          height: auto;
          display: block;
        }

        .login-title {
          font-size: 14px;
          color: #64748b;
          text-align: center;
          margin-bottom: 26px;
          font-weight: 500;
        }

        .field {
          margin-bottom: 16px;
        }

        .field label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.5px;
          margin-bottom: 7px;
          text-transform: uppercase;
        }

        .field input {
          width: 100%;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          color: #0f172a;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .field input:focus {
          border-color: #1d3461;
          background: #fffafc;
        }

        .field input::placeholder {
          color: #94a3b8;
        }

        .error-msg {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: center;
        }

        .btn-login {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #1d3461, #15264a);
          border: none;
          border-radius: 10px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 6px;
          box-shadow: 0 6px 18px rgba(21,38,74,0.30);
        }

        .btn-login:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }

        .btn-login:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      <div className="login-wrapper">
        <div className="login-card">

          {/* LOGO */}
          <div className="logo-area">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="VETIX Distribuidora" />
          </div>

          <p className="login-title">Ingresá con tu cuenta</p>

          {/* CAMPOS */}
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button
            className="btn-login"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

        </div>
      </div>
    </>
  )
}
