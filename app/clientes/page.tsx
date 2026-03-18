"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Clientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [nuevoNombre, setNuevoNombre] = useState<string>("")

  useEffect(() => {
    fetchClientes()
  }, [])

  const fetchClientes = async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")

    if (error) {
      console.error(error)
      return
    }

    setClientes(data || [])
  }

  const agregarCliente = async () => {
    if (!nuevoNombre) return

    const { error } = await supabase
      .from("clientes")
      .insert([{ nombre: nuevoNombre }])

    if (error) {
      console.error(error)
      return
    }

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

      {clientes.map((cliente: any) => (
        <div key={cliente.id}>
          {cliente.nombre}
        </div>
      ))}
    </main>
  )
}