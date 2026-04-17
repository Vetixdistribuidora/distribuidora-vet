"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function LayoutClient({ children }: { children: React.ReactNode }) {

  const pathname = usePathname()
  const router = useRouter()

  const [usuario, setUsuario] = useState<any>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()

        if (error) {
          console.error("Error obteniendo usuario:", error.message)
          router.push("/login")
          return
        }

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

      } catch (err) {
        console.error("Error inesperado:", err)
        router.push("/login")
      } finally {
        setLoadingAuth(false)
      }
    }

    init()
  }, [])

  // 🔒 LOADING SEGURO (ya no se queda colgado)
  if (loadingAuth) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#555",
        fontSize: "14px"
      }}>
        Cargando...
      </div>
    )
  }

  const getItemStyle = (path: string) => {
    const active = pathname.startsWith(path)

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

  const nombre =
    usuario?.user_metadata?.nombre ||
    usuario?.email ||
    "Usuario"

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: "#f1f3f5"
    }}>

      {/* SIDEBAR */}
      <aside style={{
        width: "230px",
        background: "#111",
        color: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}>

        <div style={{ padding: "20px" }}>
          <h2 style={{ marginBottom: "20px" }}>🐾 DVS</h2>

          <nav>
            <Link href="/" style={getItemStyle("/")}>Inicio</Link>
            <Link href="/productos" style={getItemStyle("/productos")}>Productos</Link>
            <Link href="/clientes" style={getItemStyle("/clientes")}>Clientes</Link>
            <Link href="/ventas" style={getItemStyle("/ventas")}>Ventas</Link>
            <Link href="/proveedores" style={getItemStyle("/proveedores")}>Proveedores</Link>
            <Link href="/compras" style={getItemStyle("/compras")}>Compras</Link>
            <Link href="/cuentas" style={getItemStyle("/cuentas")}>Cuenta Corriente</Link>
          </nav>
        </div>

        {/* USER */}
        <div style={{
          padding: "15px",
          borderTop: "1px solid #1f2937"
        }}>

          <div style={{
            fontWeight: "600",
            fontSize: "13px"
          }}>
            {nombre}
          </div>

          <div style={{
            fontSize: "11px",
            color: "#9ca3af"
          }}>
            {usuario?.email}
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push("/login")
            }}
            style={{
              marginTop: "10px",
              width: "100%",
              background: "#1f2937",
              border: "none",
              color: "#e5e7eb",
              padding: "8px",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      {/* CONTENIDO */}
      <main style={{
        flex: 1,
        padding: "30px",
        overflowY: "auto"
      }}>
        {children}
      </main>

    </div>
  )
}