"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    // Verificar sesión al montar (lee localStorage, sin red)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace("/login")
    })

    // Redirigir solo si el usuario cierra sesión explícitamente
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login")
    })

    return () => subscription.unsubscribe()
  }, [])

  // Sin estado de carga — mostrar contenido siempre.
  // Si no hay sesión, la redirección ocurre en < 100ms.
  // El RLS de Supabase protege todos los datos de usuarios no autenticados.
  return <>{children}</>
}
