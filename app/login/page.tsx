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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("Email o contraseña incorrectos")
      setLoading(false)
    } else {
      router.push("/")
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0c0f1a;
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
          background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
          top: -100px;
          left: -100px;
          pointer-events: none;
        }
        .login-wrapper::after {
          content: '';
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%);
          bottom: -80px;
          right: -80px;
          pointer-events: none;
        }

        .login-card {
          position: relative;
          z-index: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 48px 44px;
          width: 100%;
          max-width: 400px;
          backdrop-filter: blur(12px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.5);
          animation: fadeUp 0.5s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .logo-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 36px;
          gap: 14px;
        }

        .logo-icon {
          width: 58px;
          height: 58px;
          border-radius: 16px;
          background: linear-gradient(145deg, #1e40af, #3b82f6);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(59,130,246,0.45);
        }

        .logo-text {
          text-align: center;
        }

        .logo-text .brand {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 26px;
          letter-spacing: 4px;
          color: white;
          line-height: 1;
        }

        .logo-text .sub {
          font-size: 10px;
          letter-spacing: 3px;
          color: #3b82f6;
          font-weight: 600;
          margin-top: 4px;
          text-transform: uppercase;
        }

        .login-title {
          font-size: 14px;
          color: #6b7280;
          text-align: center;
          margin-bottom: 28px;
          font-weight: 500;
        }

        .field {
          margin-bottom: 16px;
        }

        .field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          letter-spacing: 0.5px;
          margin-bottom: 7px;
          text-transform: uppercase;
        }

        .field input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          color: white;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .field input:focus {
          border-color: #3b82f6;
          background: rgba(59,130,246,0.06);
        }

        .field input::placeholder {
          color: #4b5563;
        }

        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: center;
        }

        .btn-login {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #2563eb, #3b82f6);
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
          box-shadow: 0 4px 16px rgba(59,130,246,0.35);
        }

        .btn-login:hover:not(:disabled) {
          opacity: 0.9;
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
            <div className="logo-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <polyline
                  points="3,5 9,19 12,13 15,19 21,5"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="4" r="1.3" fill="#93c5fd" />
              </svg>
            </div>
            <div className="logo-text">
              <div className="brand">VETIX</div>
              <div className="sub">Distribuidora</div>
            </div>
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