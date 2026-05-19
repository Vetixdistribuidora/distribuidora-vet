"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FacturaLegacy() {
  const router = useRouter()
  useEffect(() => { router.replace("/ventas") }, [])
  return null
}
