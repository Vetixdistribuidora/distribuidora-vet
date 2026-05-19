"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // getSession() lee de localStorage — sin llamada a red, instantáneo
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login")
        return
      }
      // Mostrar contenido inmediatamente
      setListo(true)

      // Verificar org en segundo plano (sin bloquear la UI)
      supabase
        .from("org_usuarios")
        .select("organizacion_id")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) router.replace("/onboarding")
        })
    })

    // Escuchar cierre de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setListo(false)
        router.replace("/login")
      }
    })

    return () => subscription.unsubscribe()
  }, []) // Solo una vez al montar — no re-verificar en cada navegación

  if (!listo) {
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
        Cargando...
      </div>
    )
  }

  return <>{children}</>
}
