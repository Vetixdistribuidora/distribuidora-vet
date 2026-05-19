"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verificado, setVerificado] = useState(false)
  const yaVerificado = useRef(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Si ya verificamos, no volver a bloquear en cada navegación
    if (yaVerificado.current) {
      setVerificado(true)
      return
    }

    async function check() {
      const { data } = await supabase.auth.getUser()
      const user = data?.user

      if (!user) {
        router.replace("/login")
        return
      }

      // Verificar org con query directa (más simple que RPC)
      const { data: orgData, error } = await supabase
        .from("org_usuarios")
        .select("organizacion_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (error || !orgData) {
        // Sin org → onboarding
        router.replace("/onboarding")
        return
      }

      yaVerificado.current = true
      setVerificado(true)
    }

    check()
  }, [pathname])

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
