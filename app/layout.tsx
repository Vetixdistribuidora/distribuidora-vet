import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
     <body style={{
  margin: 0,
  fontFamily: "Segoe UI",
  background: "#f1f3f5",
  color: "#111" // 👈 ESTO ARREGLA TODO EL TEXTO
}}>

        <nav style={{
          background: "#111",
          padding: "15px 30px",
          display: "flex",
          gap: "20px"
        }}>
          <a href="/" style={{ color: "white" }}>🏠 Inicio</a>
          <a href="/productos" style={{ color: "white" }}>📦 Productos</a>
          <a href="/clientes" style={{ color: "white" }}>👥 Clientes</a>
          <a href="/ventas" style={{ color: "white" }}>💰 Ventas</a>
        </nav>

        <div style={{ padding: "30px", maxWidth: "900px", margin: "auto" }}>
          {children}
        </div>

      </body>
    </html>
  )
}