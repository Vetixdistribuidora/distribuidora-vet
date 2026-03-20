"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Cliente = {
  id: number
  nombre: string
  apellido: string
  razon_social: string
  cuit: string
  telefono: string
  localidad: string
}

export default function Clientes() {

  const [clientes, setClientes] = useState<Cliente[]>([])

  const [nombre, setNombre] = useState("")
  const [apellido, setApellido] = useState("")
  const [razon, setRazon] = useState("")
  const [cuit, setCuit] = useState("")
  const [telefono, setTelefono] = useState("")
  const [localidad, setLocalidad] = useState("")

  useEffect(() => {
    fetchClientes()
  }, [])

  async function fetchClientes() {
    const { data } = await supabase.from("clientes").select("*")
    setClientes(data || [])
  }

  async function agregarCliente() {

    const { error } = await supabase.from("clientes").insert([
      {
        nombre,
        apellido,
        razon_social: razon,
        cuit,
        telefono,
        localidad
      }
    ])

    if (error) {
      alert(error.message)
      return
    }

    setNombre("")
    setApellido("")
    setRazon("")
    setCuit("")
    setTelefono("")
    setLocalidad("")

    fetchClientes()
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>Clientes</h1>

      <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
      <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
      <input placeholder="Razón Social" value={razon} onChange={e => setRazon(e.target.value)} />
      <input placeholder="CUIT" value={cuit} onChange={e => setCuit(e.target.value)} />
      <input placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
      <input placeholder="Localidad" value={localidad} onChange={e => setLocalidad(e.target.value)} />

      <button onClick={agregarCliente}>Agregar</button>

      <hr />

      {clientes.map(c => (
        <div key={c.id}>
          <p>{c.nombre} {c.apellido}</p>
          <p>{c.razon_social}</p>
        </div>
      ))}
    </main>
  )
}