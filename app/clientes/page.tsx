"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"

type Cliente = {
  id: number
  nombre: string
  apellido: string
  cuit: string
  razon_social: string
  telefono: string
  localidad: string
}

export default function Clientes() {

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [form, setForm] = useState<Partial<Cliente>>({})

  useEffect(() => {
    fetchClientes()
  }, [])

  async function fetchClientes() {
    const { data, error } = await supabase.from("clientes").select("*")
    if (error) {
      console.log(error)
      alert("Error al cargar clientes")
      return
    }
    setClientes(data || [])
  }

  async function guardarCliente() {

    if (!form.nombre) {
      alert("Nombre obligatorio")
      return
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert([{
        nombre: form.nombre || "",
        apellido: form.apellido || "",
        cuit: form.cuit || "",
        razon_social: form.razon_social || "",
        telefono: form.telefono || "",
        localidad: form.localidad || ""
      }])
      .select() // <- asegura que traiga el registro insertado

    if (error) {
      console.log("ERROR REAL:", error)
      alert("Error al guardar: " + error.message)
      return
    }

    alert("Cliente guardado ✅")
    setForm({})
    fetchClientes()
  }

  async function eliminar(id: number) {
    const { error } = await supabase.from("clientes").delete().eq("id", id)
    if (error) {
      alert("Error al eliminar: " + error.message)
      return
    }
    fetchClientes()
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>

      <h1 style={{ color: "#000" }}>👤 Clientes</h1>

      <button onClick={() => window.history.back()} style={{ marginBottom: 20 }}>
        🔙 Volver
      </button>

      <h2>Nuevo cliente</h2>

      <input
        placeholder="Nombre"
        value={form.nombre || ""}
        onChange={e => setForm({ ...form, nombre: e.target.value })}
      />

      <input
        placeholder="Apellido"
        value={form.apellido || ""}
        onChange={e => setForm({ ...form, apellido: e.target.value })}
      />

      <input
        placeholder="CUIT"
        value={form.cuit || ""}
        onChange={e => setForm({ ...form, cuit: e.target.value })}
      />

      <input
        placeholder="Razón social"
        value={form.razon_social || ""}
        onChange={e => setForm({ ...form, razon_social: e.target.value })}
      />

      <input
        placeholder="Teléfono"
        value={form.telefono || ""}
        onChange={e => setForm({ ...form, telefono: e.target.value })}
      />

      <input
        placeholder="Localidad"
        value={form.localidad || ""}
        onChange={e => setForm({ ...form, localidad: e.target.value })}
      />

      <br /><br />
      <button onClick={guardarCliente} style={{ marginRight: 10 }}>
        💾 Guardar cliente
      </button>

      <hr style={{ margin: "20px 0" }} />

      <h2>Lista de clientes</h2>

      {clientes.map(c => (
        <div
          key={c.id}
          style={{
            border: "1px solid gray",
            marginBottom: 10,
            padding: 10,
            borderRadius: 8,
            backgroundColor: "#f9f9f9",
            color: "#000"
          }}
        >
          <b>{c.nombre} {c.apellido}</b>
          <p>CUIT: {c.cuit}</p>
          <p>Razón social: {c.razon_social}</p>
          <p>Teléfono: {c.telefono}</p>
          <p>Localidad: {c.localidad}</p>

          <button onClick={() => eliminar(c.id)} style={{ marginTop: 5 }}>
            ❌ Eliminar
          </button>
        </div>
      ))}

    </main>
  )
}