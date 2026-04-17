"use client"

import "./globals.css"
import { usePathname } from "next/navigation"

export default function RootLayout({ children }: { children: React.ReactNode }) {

  const pathname = usePathname()

  const getLinkStyle = (path: string) => ({
    color: "white",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    textDecoration: "none",
    padding: "6px 10px",
    borderRadius: "8px",
    background: pathname === path ? "#2b2b2b" : "transparent",
    opacity: pathname === path ? 1 : 0.7,
    transition: "all 0.2s ease"
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
          gap: "20px"
        }}>

          <a href="/" style={getLinkStyle("/")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10l9-7 9 7" />
              <path d="M9 21V12h6v9" />
            </svg>
            Inicio
          </a>

          <a href="/productos" style={getLinkStyle("/productos")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4 8 4 8-4z" />
              <path d="M4 7v10l8 4 8-4V7" />
            </svg>
            Productos
          </a>

          <a href="/clientes" style={getLinkStyle("/clientes")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="7" r="4" />
              <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
            </svg>
            Clientes
          </a>

          <a href="/ventas" style={getLinkStyle("/ventas")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="17" cy="19" r="1" />
            </svg>
            Ventas
          </a>

          <a href="/proveedores" style={getLinkStyle("/proveedores")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7h13v10H3z" />
              <path d="M16 10h4l1 2v5h-5z" />
              <circle cx="7.5" cy="17.5" r="1.5" />
              <circle cx="17.5" cy="17.5" r="1.5" />
            </svg>
            Proveedores
          </a>

          <a href="/compras" style={getLinkStyle("/compras")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6h15l-1.5 9h-13z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            Compras
          </a>

          <a href="/cuentas" style={getLinkStyle("/cuentas")}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <path d="M14 2v6h6" />
            </svg>
            Cuenta Corriente
          </a>

        </nav>

        <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
          {children}
        </div>

      </body>
    </html>
  )
}