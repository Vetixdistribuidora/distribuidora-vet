"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function CuentasCorrientes() {

  const [clientes, setClientes] = useState<any[]>([])
  const [clienteId, setClienteId] = useState("")
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [saldo, setSaldo] = useState(0)
  const [montoPago, setMontoPago] = useState("")

  useEffect(() => {
    cargarClientes()
  }, [])

  async function cargarClientes() {
    const { data } = await supabase.from("clientes").select("*")
    setClientes(data || [])
  }

  async function cargarMovimientos(id: string) {
    setClienteId(id)

    const { data } = await supabase
      .from("cuentas_corrientes")
      .select("*")
      .eq("cliente_id", Number(id))
      .order("fecha", { ascending: false })

    setMovimientos(data || [])

    if (data && data.length > 0) {
      setSaldo(data[0].saldo)
    } else {
      setSaldo(0)
    }
  }

  // 🔥 ESTA ES LA FUNCIÓN PAGAR
  async function pagar() {
  console.log("---- INICIANDO PAGO ----")
  console.log("clienteId:", clienteId)
  console.log("montoPago:", montoPago)

  if (!clienteId || !montoPago) return

  const monto = Number(montoPago)

  const { data, error } = await supabase
    .from("cuentas_corrientes")
    .insert({
      cliente_id: Number(clienteId),
      tipo: "pago",
      monto: -monto,
      fecha: new Date()
    })
    .select()

  console.log("RESULTADO INSERT:", data, error)

  if (error) {
    alert("Error al registrar pago")
    return
  }

  console.log("RECARGANDO MOVIMIENTOS...")

  await cargarMovimientos(clienteId)

  setMontoPago("")
}

  function fmt(n: number) {
    return "$" + n.toLocaleString("es-AR")
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>💰 Cuenta Corriente</h1>

      <select onChange={e => cargarMovimientos(e.target.value)}>
        <option value="">Seleccionar cliente</option>
        {clientes.map(c => (
          <option key={c.id} value={c.id}>
            {c.nombre} {c.apellido}
          </option>
        ))}
      </select>

      <h2>Saldo: {fmt(saldo)}</h2>

      <div style={{ marginTop: 20 }}>
        <input
          type="number"
          placeholder="Monto pago"
          value={montoPago}
          onChange={e => setMontoPago(e.target.value)}
        />
        <button onClick={pagar}>Registrar pago</button>
      </div>

      <h3 style={{ marginTop: 30 }}>Movimientos</h3>

      {movimientos.map(m => (
        <div key={m.id} style={{ background: "#eee", padding: 10, marginBottom: 10 }}>
          <b>{m.tipo.toUpperCase()}</b> — {fmt(m.monto)}
          <br />
          Fecha: {new Date(m.fecha).toLocaleDateString()}
          <br />
          Saldo: {fmt(m.saldo)}
        </div>
      ))}
    </div>
  )
}