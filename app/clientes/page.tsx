"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [cuit, setCuit] = useState("")
  const [telefono, setTelefono] = useState("")
  const [localidad, setLocalidad] = useState("")

  async function cargar() {
    const { data } = await supabase.from("clientes").select("*")
    setClientes(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {
    await supabase.from("clientes").insert([{
      nombre,
      apellido,
      cuit,
      telefono,
      localidad
    }])
    cargar()
  }

  return (
    <div>

      <h1>👥 Clientes</h1>

      <button onClick={() => window.history.back()}>🔙 Volver</button>

      <div style={{ marginTop: 20 }}>
        <input placeholder="Nombre" onChange={e => setNombre(e.target.value)} />
        <input placeholder="Apellido" onChange={e => setApellido(e.target.value)} />
        <input placeholder="CUIT" onChange={e => setCuit(e.target.value)} />
        <input placeholder="Teléfono" onChange={e => setTelefono(e.target.value)} />
        <input placeholder="Localidad" onChange={e => setLocalidad(e.target.value)} />

        <button onClick={agregar}>➕ Agregar</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {clientes.map(c => (
          <div key={c.id} style={{
            background: "white",
            padding: 15,
            marginBottom: 15,
            borderRadius: 10
          }}>
            <b>{c.nombre} {c.apellido}</b>
            <p>CUIT: {c.cuit}</p>
            <p>📞 {c.telefono}</p>
            <p>📍 {c.localidad}</p>
          </div>
        ))}
      </div>

    </div>
  )
}