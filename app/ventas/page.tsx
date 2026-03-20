"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase"
import { useRouter } from "next/navigation"

export default function Ventas() {

  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productoId, setProductoId] = useState("")
  const [clienteId, setClienteId] = useState("")

  const router = useRouter()

  useEffect(() => {
    cargar()
  }, [])

  async function cargar() {
    const { data: prod } = await supabase.from("productos").select("*")
    const { data: cli } = await supabase.from("clientes").select("*")

    setProductos(prod || [])
    setClientes(cli || [])
  }

  async function vender() {

    const { data, error } = await supabase
      .from("ventas")
      .insert([{ producto_id: productoId, cliente_id: clienteId }])
      .select()
      .single()

    if (data) {
      router.push(`/factura/${data.id}`)
    }
  }

  return (
    <div>
      <h1>💰 Venta</h1>

      <select onChange={e => setProductoId(e.target.value)}>
        <option>Producto</option>
        {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
      </select>

      <select onChange={e => setClienteId(e.target.value)}>
        <option>Cliente</option>
        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <button onClick={vender}>Generar venta</button>
    </div>
  )
}