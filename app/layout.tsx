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
    }

    init()
  }, [])

  if (loadingAuth) {
    return (
      <div style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        color: "#555"
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

        {/* TOP */}
        <div style={{ padding: "20px" }}>

          <h2 style={{
            marginBottom: "25px",
            fontSize: "18px"
          }}>
            🐾 DVS
          </h2>

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

        {/* BOTTOM USER */}
        <div style={{
          padding: "15px",
          borderTop: "1px solid #1f2937"
        }}>

          <div style={{
            fontSize: "13px",
            fontWeight: "600"
          }}>
            {nombre}
          </div>

          <div style={{
            fontSize: "11px",
            color: "#9ca3af",
            marginBottom: "10px"
          }}>
            {usuario?.email}
          </div>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push("/login")
            }}
            style={{
              width: "100%",
              background: "#1f2937",
              border: "none",
              color: "#e5e7eb",
              padding: "8px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "12px"
            }}
          >
            Cerrar sesión
          </button>

        </div>

      </aside>

      {/* CONTENT */}
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