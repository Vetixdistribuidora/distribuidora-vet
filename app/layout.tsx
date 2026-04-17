import "./globals.css"

const linkStyle = {
  color: "white",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  textDecoration: "none"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

          {/* Inicio */}
          <a href="/" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 10l9-7 9 7" />
              <path d="M9 21V12h6v9" />
            </svg>
            Inicio
          </a>

          {/* Productos */}
          <a href="/productos" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4 8 4 8-4z" />
              <path d="M4 7v10l8 4 8-4V7" />
            </svg>
            Productos
          </a>

          {/* Clientes */}
          <a href="/clientes" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M7 21v-2a4 4 0 0 1 3-3.87" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Clientes
          </a>

          {/* Ventas */}
          <a href="/ventas" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="17" cy="19" r="1" />
            </svg>
            Ventas
          </a>

          {/* Proveedores */}
          <a href="/proveedores" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 7h13v10H3z" />
              <path d="M16 10h4l1 2v5h-5z" />
              <circle cx="7.5" cy="17.5" r="1.5" />
              <circle cx="17.5" cy="17.5" r="1.5" />
            </svg>
            Proveedores
          </a>

          {/* Compras */}
          <a href="/compras" style={linkStyle}>
            <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 6h15l-1.5 9h-13z" />
              <path d="M6 6L5 3H2" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            Compras
          </a>

          {/* Cuenta Corriente */}
          <a href="/cuentas" style={linkStyle}>
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