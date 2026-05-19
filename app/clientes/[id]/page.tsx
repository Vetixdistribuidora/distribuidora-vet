"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function ClienteHistorialLegacy() {
  const router = useRouter()
  useEffect(() => { router.replace("/clientes") }, [])
  return null
}
