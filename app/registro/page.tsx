"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// El registro de nuevos usuarios está DESHABILITADO.
// El sistema interno de la distribuidora es de uso privado: el acceso se maneja
// con la lista de emails autorizados en lib/acceso.ts. Esta página ya no crea
// cuentas; simplemente redirige al login.
export default function RegistroPage() {
  const router = useRouter()
  useEffect(() => { router.replace("/login") }, [router])
  return null
}
