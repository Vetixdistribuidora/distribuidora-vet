"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [verificado, setVerificado] = useState(false)
  const yaVerificado = useRef(false)   // persiste entre renders sin causar re-render
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Si ya verificamos en esta sesión de layout, no volver a bloquear
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

      // Usar el RPC SECURITY DEFINER — evita depender del RLS de org_usuarios
      const { data: orgId } = await supabase.rpc("get_my_org_id")

      if (!orgId) {
        // Usuario autenticado pero sin organización → onboarding
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
