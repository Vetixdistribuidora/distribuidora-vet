"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function Auditoria() {

  const [datos, setDatos] = useState<any[]>([])

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from("auditoria")
      .select("*")
      .order("fecha", { ascending: false })

    setDatos(data || [])
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>📊 Auditoría</h1>

      {datos.map(a => (
        <div key={a.id}>
          <p>
            👤 {a.usuario} — {a.accion} — {a.tabla} — ID {a.registro_id}
          </p>
        </div>
      ))}
    </div>
  )
}