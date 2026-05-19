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

      // Verificar que el usuario tenga una organización vinculada
      const { data: orgData } = await supabase
        .from("org_usuarios")
        .select("organizacion_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!orgData) {
        // Usuario autenticado pero sin org → onboarding
        router.replace("/onboarding")
        return
      }

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
