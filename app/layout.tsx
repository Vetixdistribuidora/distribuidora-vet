"use client"

import "./globals.css"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
export default function RootLayout({ children }: { children: React.ReactNode }) {

  const pathname = usePathname()
const [usuario, setUsuario] = useState<any>(null)
const [loadingAuth, setLoadingAuth] = useState(true)
const router = useRouter()
  const getItemStyle = (path: string) => {
    const active = pathname.startsWith(path)
useEffect(() => {
  checkUser()
}, [])

async function checkUser() {
  const { data } = await supabase.auth.getUser()

  const user = data?.user

  if (!user) {
    router.push("/login")
    return
  }

  const usuariosPermitidos = [
    "admin@dvs.com",
    "sofia@dvs.com"
  ]

  if (!usuariosPermitidos.includes(user.email ?? "")) {
    await supabase.auth.signOut()
    router.push("/login")
    return
  }

  setUsuario(user)
  setLoadingAuth(false)
  if (loadingAuth) {
  return null
}
}
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

  return (
    <html lang="es">
      <body style={{
        margin: 0,
        fontFamily: "Segoe UI",
        display: "flex",
        background: "#f1f3f5"
      }}>

        {/* SIDEBAR */}
        <aside style={{
          width: "230px",
          background: "#111",
          color: "white",
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>

          {/* TOP */}
          <div style={{ padding: "20px" }}>

            {/* LOGO */}
            <h2 style={{ marginBottom: "25px" }}>🐾 DVS</h2>

            {/* NAV */}
            <nav>

              <Link href="/" style={getItemStyle("/")}>
                <svg style={iconStyle("#60a5fa", pathname === "/")} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 10l9-7 9 7" />
                  <path d="M9 21V12h6v9" />
                </svg>
                Inicio
              </Link>

              <Link href="/productos" style={getItemStyle("/productos")}>
                <svg style={iconStyle("#34d399", pathname.startsWith("/productos"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M20 7l-8-4-8 4 8 4 8-4z" />
                  <path d="M4 7v10l8 4 8-4V7" />
                </svg>
                Productos
              </Link>

              <Link href="/clientes" style={getItemStyle("/clientes")}>
                <svg style={iconStyle("#a78bfa", pathname.startsWith("/clientes"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
                </svg>
                Clientes
              </Link>

              <Link href="/ventas" style={getItemStyle("/ventas")}>
                <svg style={iconStyle("#fbbf24", pathname.startsWith("/ventas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="17" cy="19" r="1" />
                </svg>
                Ventas
              </Link>

              <Link href="/proveedores" style={getItemStyle("/proveedores")}>
                <svg style={iconStyle("#f87171", pathname.startsWith("/proveedores"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 7h13v10H3z" />
                  <path d="M16 10h4l1 2v5h-5z" />
                  <circle cx="7.5" cy="17.5" r="1.5" />
                  <circle cx="17.5" cy="17.5" r="1.5" />
                </svg>
                Proveedores
              </Link>

              <Link href="/compras" style={getItemStyle("/compras")}>
                <svg style={iconStyle("#fb923c", pathname.startsWith("/compras"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 6h15l-1.5 9h-13z" />
                  <path d="M6 6L5 3H2" />
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                </svg>
                Compras
              </Link>

              <Link href="/cuentas" style={getItemStyle("/cuentas")}>
                <svg style={iconStyle("#22c55e", pathname.startsWith("/cuentas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                  <path d="M14 2v6h6" />
                </svg>
                Cuenta Corriente
              </Link>

            </nav>
          </div>

          {/* USER */}
          <div style={{
  borderTop: "1px solid #1f2937",
  padding: "15px 20px",
  display: "flex",
  alignItems: "center",
  gap: "10px"
}}>

  <div style={{
    width: "35px",
    height: "35px",
    borderRadius: "50%",
    background: "#374151",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "bold"
  }}>
    {usuario?.email?.charAt(0).toUpperCase()}
  </div>

  <div style={{ flex: 1 }}>
    <div style={{ fontSize: "13px", fontWeight: "600" }}>
      {usuario?.email}
    </div>
    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
      Usuario activo
    </div>
  </div>

  <button
    onClick={async () => {
      await supabase.auth.signOut()
      router.push("/login")
    }}
    style={{
      background: "transparent",
      border: "none",
      color: "#9ca3af",
      cursor: "pointer",
      fontSize: "12px"
    }}
  >
    Salir
  </button>

</div>
        </aside>

        {/* MAIN */}
        <main style={{
          flex: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column"
        }}>

          {/* HEADER */}
          <div style={{
            background: "white",
            padding: "15px 25px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: "600",
            fontSize: "16px"
          }}>
            {getTitle()}
          </div>

          {/* CONTENT */}
          <div style={{
            padding: "30px",
            overflowY: "auto",
            flex: 1
          }}>
            {children}
          </div>

        </main>

      </body>
    </html>
  )
}