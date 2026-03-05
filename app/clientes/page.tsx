"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

export default function Clientes() {

  const [clientes, setClientes] = useState([])
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")

  async function fetchClientes() {

    const { data } = await supabase
      .from("clientes")
      .select("*")

    setClientes(data || [])
  }

  useEffect(() => {
    fetchClientes()
  }, [])

  async function agregarCliente() {

    await supabase
      .from("clientes")
      .insert([
        {
          nombre: nombre,
          telefono: telefono
        }
      ])

    setNombre("")
    setTelefono("")

    fetchClientes()
  }

  return (

    <main style={{ padding: "40px" }}>

      <h1>Clientes</h1>

      <h2>Agregar cliente</h2>

      <input
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <input
        placeholder="Teléfono"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
      />

      <button onClick={agregarCliente}>
        Agregar cliente
      </button>

      <hr />

      {clientes.map((cliente) => (

        <div
          key={cliente.id}
          style={{
            border: "1px solid gray",
            padding: "15px",
            marginBottom: "15px",
            borderRadius: "10px"
          }}
        >

          <h3>{cliente.nombre}</h3>

          <p>Tel: {cliente.telefono}</p>

        </div>

      ))}

    </main>

  )

}