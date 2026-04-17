"use client"

import "./globals.css"
import { usePathname } from "next/navigation"
import Link from "next/link"

export default function RootLayout({ children }: { children: React.ReactNode }) {

  const pathname = usePathname()

  const getLinkStyle = (path: string) => {
    const active = pathname.startsWith(path)

    return {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 12px",
      borderRadius: "10px",
      textDecoration: "none",
      fontSize: "14px",
      fontWeight: 500,
      transition: "all 0.2s ease",
      background: active ? "#1f2937" : "transparent",
      color: active ? "white" : "#d1d5db",
    }
  }

  const iconStyle = (color: string, active: boolean) => ({
    width: "18px",
    height: "18px",
    stroke: active ? color : "#9ca3af",
  })

  return (
    <html lang="es">
      <body style={{
        margin: 0,
        fontFamily: "Segoe UI",
        background: "#f1f3f5",
        color: "#111"
      }}>

        <nav style={{
          background: "#111",
          padding: "15px 30px",
          display: "flex",
          gap: "15px"
        }}>

          {/* Inicio */}
          <Link href="/" style={getLinkStyle("/")}>
            <svg style={iconStyle("#60a5fa", pathname === "/")} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10l9-7 9 7" />
              <path d="M9 21V12h6v9" />
            </svg>
            Inicio
          </Link>

          {/* Productos */}
          <Link href="/productos" style={getLinkStyle("/productos")}>
            <svg style={iconStyle("#34d399", pathname.startsWith("/productos"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4 8 4 8-4z" />
              <path d="M4 7v10l8 4 8-4V7" />
            </svg>
            Productos
          </Link>

          {/* Clientes */}
          <Link href="/clientes" style={getLinkStyle("/clientes")}>
            <svg style={iconStyle("#a78bfa", pathname.startsWith("/clientes"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
            </svg>
            Clientes
          </Link>

          {/* Ventas */}
          <Link href="/ventas" style={getLinkStyle("/ventas")}>
            <svg style={iconStyle("#fbbf24", pathname.startsWith("/ventas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="17" cy="19" r="1" />
            </svg>
            Ventas
          </Link>

          {/* Proveedores */}
          <Link href="/proveedores" style={getLinkStyle("/proveedores")}>
            <svg style={iconStyle("#f87171", pathname.startsWith("/proveedores"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7h13v10H3z" />
              <path d="M16 10h4l1 2v5h-5z" />
              <circle cx="7.5" cy="17.5" r="1.5" />
              <circle cx="17.5" cy="17.5" r="1.5" />
            </svg>
            Proveedores
          </Link>

          {/* Compras */}
          <Link href="/compras" style={getLinkStyle("/compras")}>
            <svg style={iconStyle("#fb923c", pathname.startsWith("/compras"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6h15l-1.5 9h-13z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            Compras
          </Link>

          {/* Cuenta Corriente */}
          <Link href="/cuentas" style={getLinkStyle("/cuentas")}>
            <svg style={iconStyle("#22c55e", pathname.startsWith("/cuentas"))} fill="none" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <path d="M14 2v6h6" />
            </svg>
            Cuenta Corriente
          </Link>

        </nav>

        <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
          {children}
        </div>

      </body>
    </html>
  )
}