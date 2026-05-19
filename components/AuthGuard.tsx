"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Solo reaccionar a SIGNED_OUT explícito.
    // NO llamar getSession() aquí — puede devolver null durante el token refresh
    // y causar un redirect incorrecto que desmonta todo el árbol de componentes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/login")
      }
      // INITIAL_SESSION sin sesión = usuario no autenticado
      if (event === "INITIAL_SESSION" && !session) {
        router.replace("/login")
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Sin loading state — nunca bloquea la UI.
  // RLS de Supabase protege todos los datos.
  return <>{children}</>
}
