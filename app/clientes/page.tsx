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
  const [porcentaje, setPorcentaje] = useState("")

  async function cargar() {
    const { data } = await supabase.from("clientes").select("*")
    setClientes(data || [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar() {

    const { error } = await supabase.from("clientes").insert([{
      nombre,
      apellido,
      cuit,
      telefono,
      localidad,
      porcentaje: Number(porcentaje)
    }])

    if (error) {
      alert(error.message)
      return
    }

    setNombre("")
    setApellido("")
    setCuit("")
    setTelefono("")
    setLocalidad("")
    setPorcentaje("")

    cargar()
  }

  return (
    <div>

      <h1>👥 Clientes</h1>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
        <input placeholder="Apellido" value={apellido} onChange={e => setApellido(e.target.value)} />
        <input placeholder="CUIT" value={cuit} onChange={e => setCuit(e.target.value)} />
        <input placeholder="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} />
        <input placeholder="Localidad" value={localidad} onChange={e => setLocalidad(e.target.value)} />
        <input placeholder="% Margen" value={porcentaje} onChange={e => setPorcentaje(e.target.value)} />

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
            <p>📊 Margen: {c.porcentaje}%</p>
          </div>
        ))}
      </div>

    </div>
  )
}