"use client"

import "./globals.css"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import AuthGuard from "@/components/AuthGuard"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [usuario, setUsuario] = useState<any>(null)
  const [sidebarAbierto, setSidebarAbierto] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setUsuario(null); router.replace("/login") }
      else setUsuario(session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Cerrar sidebar al navegar
  useEffect(() => { setSidebarAbierto(false) }, [pathname])

  const isLoginPage = pathname === "/login"

  const getItemStyle = (path: string) => {
    const active = path === "/" ? pathname === "/" : pathname.startsWith(path)
    return {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "10px 14px",
      borderRadius: "10px",
      textDecoration: "none",
      fontSize: "14px",
      marginBottom: "6px",
      transition: "all 0.2s ease",
      background: active ? "#1f2937" : "transparent",
      color: active ? "white" : "#9ca3af",
      borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
    }
  }

  const iconStyle = (color: string, active: boolean) => ({
    width: "18px",
    height: "18px",
    stroke: active ? color : "#6b7280",
  })

  const getTitle = () => {
    if (pathname === "/") return "Inicio"
    if (pathname.startsWith("/productos")) return "Productos"
    if (pathname.startsWith("/clientes")) return "Clientes"
    if (pathname.startsWith("/ventas")) return "Ventas"
    if (pathname.startsWith("/proveedores")) return "Proveedores"
    if (pathname.startsWith("/compras")) return "Compras"
    if (pathname.startsWith("/cuentas")) return "Cuenta Corriente"
    return ""
  }

  const getPageIcon = () => {
    if (pathname === "/") return "🏠"
    if (pathname.startsWith("/productos")) return "📦"
    if (pathname.startsWith("/clientes")) return "👤"
    if (pathname.startsWith("/ventas")) return "🛒"
    if (pathname.startsWith("/proveedores")) return "🚚"
    if (pathname.startsWith("/compras")) return "🧾"
    if (pathname.startsWith("/cuentas")) return "📄"
    return ""
  }

  const inicialAvatar = usuario?.email?.charAt(0).toUpperCase() ?? "?"
  const emailCorto = usuario?.email ?? ""

  if (isLoginPage) {
    return (
      <html lang="es">
        <body style={{ margin: 0, fontFamily: "Segoe UI", background: "#f1f3f5" }}>
          {children}
        </body>
      </html>
    )
  }

  const SidebarContent = () => (
    <div style={{
      width: "230px",
      background: "#111",
      color: "white",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <div style={{ padding: "20px" }}>
        {/* LOGO */}
        <div style={{ marginBottom: "28px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px",
            background: "linear-gradient(145deg, #1e40af, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <polyline points="3,5 9,19 12,13 15,19 21,5" stroke="white" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
              <circle cx="12" cy="4" r="1.3" fill="#93c5fd" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: "800", fontSize: "17px", letterSpacing: "2px", color: "white", lineHeight: 1 }}>VETIX</div>
            <div style={{ fontSize: "9px", color: "#3b82f6", letterSpacing: "2.5px", marginTop: "3px", textTransform: "uppercase", fontWeight: "600" }}>Distribuidora</div>
          </div>
        </div>

        {/* NAV */}
        <nav>
          <Link href="/" style={getItemStyle("/")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#60a5fa", pathname === "/")} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10l9-7 9 7" /><path d="M9 21V12h6v9" />
            </svg>
            Inicio
          </Link>
          <Link href="/productos" style={getItemStyle("/productos")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#34d399", pathname.startsWith("/productos"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4 8 4 8-4z" /><path d="M4 7v10l8 4 8-4V7" />
            </svg>
            Productos
          </Link>
          <Link href="/clientes" style={getItemStyle("/clientes")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#a78bfa", pathname.startsWith("/clientes"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
            </svg>
            Clientes
          </Link>
          <Link href="/ventas" style={getItemStyle("/ventas")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#fbbf24", pathname.startsWith("/ventas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" /><circle cx="9" cy="19" r="1" /><circle cx="17" cy="19" r="1" />
            </svg>
            Ventas
          </Link>
          <Link href="/proveedores" style={getItemStyle("/proveedores")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#f87171", pathname.startsWith("/proveedores"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7h13v10H3z" /><path d="M16 10h4l1 2v5h-5z" />
              <circle cx="7.5" cy="17.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" />
            </svg>
            Proveedores
          </Link>
          <Link href="/compras" style={getItemStyle("/compras")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#fb923c", pathname.startsWith("/compras"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6h15l-1.5 9h-13z" /><path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
            </svg>
            Compras
          </Link>
          <Link href="/cuentas" style={getItemStyle("/cuentas")} onClick={() => setSidebarAbierto(false)}>
            <svg style={iconStyle("#22c55e", pathname.startsWith("/cuentas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <path d="M14 2v6h6" />
            </svg>
            Cuenta Corriente
          </Link>
        </nav>
      </div>

      {/* USER SECTION */}
      <div style={{ borderTop: "1px solid #1f2937", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: "700", color: "white", flexShrink: 0,
        }}>
          {inicialAvatar}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {emailCorto}
          </div>
          <div style={{ fontSize: "10px", color: "#4ade80", marginTop: "1px" }}>● Activo</div>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); setUsuario(null); router.replace("/login") }}
          title="Cerrar sesión"
          style={{ background: "transparent", border: "1px solid #374151", color: "#9ca3af", cursor: "pointer", fontSize: "11px", borderRadius: "6px", padding: "4px 8px", flexShrink: 0 }}>
          Salir
        </button>
      </div>
    </div>
  )

  return (
    <html lang="es">
      <head>
        <style>{`
          @media (max-width: 768px) {
            .desktop-sidebar { display: none !important; }
            .mobile-overlay { display: flex !important; }
            .main-content { padding: 16px !important; }
            .header-date { display: none !important; }
          }
          @media (min-width: 769px) {
            .mobile-hamburger { display: none !important; }
            .mobile-overlay { display: none !important; }
          }
        `}</style>
      </head>
      <body style={{ margin: 0, fontFamily: "Segoe UI", display: "flex", background: "#f1f5f9" }}>

        {/* SIDEBAR desktop — fijo */}
        <aside className="desktop-sidebar" style={{ position: "sticky", top: 0, height: "100vh" }}>
          <SidebarContent />
        </aside>

        {/* OVERLAY mobile */}
        <div className="mobile-overlay" style={{
          display: "none",
          position: "fixed", inset: 0, zIndex: 100,
        }}>
          {/* Backdrop */}
          {sidebarAbierto && (
            <div onClick={() => setSidebarAbierto(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100 }} />
          )}
          {/* Drawer */}
          <div style={{
            position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 101,
            transform: sidebarAbierto ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.25s ease",
          }}>
            <SidebarContent />
          </div>
        </div>

        {/* MAIN */}
        <main style={{ flex: 1, height: "100vh", display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* HEADER */}
          <div style={{
            background: "white", padding: "0 28px",
            borderBottom: "1px solid #e2e8f0", height: "60px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)", flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              {/* Hamburger — solo mobile */}
              <button
                className="mobile-hamburger"
                onClick={() => setSidebarAbierto(!sidebarAbierto)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", flexDirection: "column", gap: "5px" }}>
                <span style={{ display: "block", width: 22, height: 2, background: "#374151", borderRadius: 2 }} />
                <span style={{ display: "block", width: 22, height: 2, background: "#374151", borderRadius: 2 }} />
                <span style={{ display: "block", width: 22, height: 2, background: "#374151", borderRadius: 2 }} />
              </button>

              <div style={{
                width: "36px", height: "36px", borderRadius: "10px",
                background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", boxShadow: "0 2px 8px rgba(59,130,246,0.3)"
              }}>
                {getPageIcon()}
              </div>
              <div>
                <div style={{ fontWeight: "800", fontSize: "16px", color: "#0f172a", lineHeight: 1.2 }}>{getTitle()}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "1px", fontWeight: 500 }}>VETIX Distribuidora</div>
              </div>
            </div>
            <div className="header-date" style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </div>

          {/* CONTENT */}
          <div className="main-content" style={{ padding: "30px", overflowY: "auto", flex: 1, background: "#f1f5f9" }}>
            <AuthGuard>{children}</AuthGuard>
          </div>
        </main>

      </body>
    </html>
  )
}