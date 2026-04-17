"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verificado, setVerificado] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser()
      const user = data?.user

      if (!user) {
        router.replace("/login")
        return
      }

      const permitidos = ["clauforte@gmail.com", "santiagozabalegui@gmail.com"]
      if (!permitidos.includes(user.email ?? "")) {
        await supabase.auth.signOut()
        router.replace("/login")
        return
      }

      setVerificado(true)
    }

    check()
  }, [pathname]) // se re-ejecuta en cada cambio de ruta

  if (!verificado) {
    return (
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize: "13px",
        fontFamily: "Segoe UI"
      }}>
        Verificando sesión...
      </div>
    )
  }

  return <>{children}</>
}