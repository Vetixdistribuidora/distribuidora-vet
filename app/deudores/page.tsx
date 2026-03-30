"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function formatearPrecio(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Deudores() {

  const [deudores, setDeudores] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")

  useEffect(() => { cargarDeudores() }, [])

  async function cargarDeudores() {
    setCargando(true)
    const { data: ventas } = await supabase
      .from("ventas")
      .select("id, total, nro_factura, fecha, cliente_id, clientes(nombre, apellido, telefono, localidad)")
      .eq("estado", "cuenta_corriente")
      .order("id", { ascending: false })
    if (!ventas) { setDeudores([]); setCargando(false); return }
    const conSaldo = await Promise.all(
      ventas.map(async (v) => {
        const { data: pagos } = await supabase
          .from("pagos_cuenta_corriente")
          .select("monto")
          .eq("venta_id", v.id)
        const pagado = (pagos || []).reduce((acc, p) => acc + Number(p.monto), 0)
        const saldo = Number(v.total) - pagado
        return { ...v, saldo: saldo > 0 ? saldo : 0 }
      })
    )
    const conDeuda = conSaldo.filter(v => v.saldo > 0)
    const mapaClientes: Record<number, any> = {}
    for (const v of conDeuda) {
      const cid = v.cliente_id
      if (!mapaClientes[cid]) {
        mapaClientes[cid] = {
          cliente_id: cid,
          nombre: (v.clientes as any)?.nombre || "",
          apellido: (v.clientes as any)?.apellido || "",
          telefono: (v.clientes as any)?.telefono || "",
          localidad: (v.clientes as any)?.localidad || "",
          totalDeuda: 0,
          facturas: []
        }
      }
      mapaClientes[cid].totalDeuda += v.saldo
      mapaClientes[cid].facturas.push(v)
    }
    const lista = Object.values(mapaClientes).sort((a, b) => b.totalDeuda - a.totalDeuda)
    setDeudores(lista)
    setCargando(false)
  }

  const deudoresFiltrados = deudores.filter(d =>
    (d.nombre + " " + d.apellido).toLowerCase().includes(busqueda.toLowerCase())
  )

  const totalGeneral = deudores.reduce((acc, d) => acc + d.totalDeuda, 0)

  if (cargando) return <p style={{ padding: 30 }}>Cargando deudores...</p>

  return (
    <div style={{ padding: 20 }}>
      <h1>Deudores</h1>
      <div style={{
        background: deudores.length === 0 ? "#d3f9d8" : "#fff3cd",
        border: "2px solid " + (deudores.length === 0 ? "#2f9e44" : "#e67700"),
        borderRadius: 10,
        padding: "12px 18px",
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <b style={{ fontSize: 16 }}>
          {deudores.length === 0 ? "Sin deudores activos" : deudores.length + " cliente(s) con deuda"}
        </b>
        {deudores.length > 0 && (
          <b style={{ fontSize: 18, color: "#e67700" }}>Total: {formatearPrecio(totalGeneral)}</b>
        )}
      </div>
      {deudores.length > 0 && (
        <input
          placeholder="Buscar deudor..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: 10, marginBottom: 16, borderRadius: 8, border: "1px solid #ccc" }}
        />
      )}
      {deudoresFiltrados.map(d => (
        <div key={d.cliente_id} style={{
          background: "white",
          border: "2px solid #e03131",
          borderRadius: 10,
          padding: 16,
          marginBottom: 14
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <b style={{ fontSize: 16 }}>{d.nombre} {d.apellido}</b>
              {d.telefono && <p style={{ margin: "4px 0", color: "#555" }}>Tel: {d.telefono}</p>}
              {d.localidad && <p style={{ margin: "4px 0", color: "#555" }}>Localidad: {d.localidad}</p>}
            </div>
            <div style={{
              background: "#e03131", color: "white",
              borderRadius: 10, padding: "6px 14px",
              fontWeight: "bold", fontSize: 16, textAlign: "center"
            }}>
              {formatearPrecio(d.totalDeuda)}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <b style={{ fontSize: 13, color: "#777" }}>Facturas pendientes:</b>
            {d.facturas.map((f: any) => (
              <div key={f.id} style={{
                display: "flex", justifyContent: "space-between",
                background: "#fff9f0", border: "1px solid #e67700",
                borderRadius: 6, padding: "6px 10px", marginTop: 6, fontSize: 14
              }}>
                <span>Factura #{f.nro_factura || f.id}</span>
                <span style={{ color: "#e67700", fontWeight: "bold" }}>{formatearPrecio(f.saldo)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}