"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [nuevoNombre, setNuevoNombre] = useState("")

  useEffect(() => {
    fetchClientes()
  }, [])

  async function fetchClientes() {
    const { data } = await supabase
      .from("clientes")
      .select("*")

    setClientes(data || [])
  }

  async function agregarCliente() {
    if (!nuevoNombre) return

    await supabase
      .from("clientes")
      .insert([
        { nombre: nuevoNombre }
      ])

    setNuevoNombre("")
    fetchClientes()
  }

  return (
    <main style={{ padding: "40px" }}>

      <h1>Clientes</h1>

      <input
        placeholder="Nombre del cliente"
        value={nuevoNombre}
        onChange={(e) => setNuevoNombre(e.target.value)}
      />

      <button onClick={agregarCliente}>
        Agregar cliente
      </button>

      <hr />

      {clientes.map((cliente) => (
        <div key={cliente.id}>
          {cliente.nombre}
        </div>
      ))}

    </main>
  )
}