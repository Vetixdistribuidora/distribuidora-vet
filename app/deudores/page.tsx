"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

function fmt(num: number) {
  return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const responsiveStyles = `
  @media (max-width: 768px) {
    .deudores-header { flex-direction: column !important; gap: 8px !important; }
    .deudores-kpis { grid-template-columns: 1fr 1fr !important; }
    .deudor-card-top { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
    .deudor-monto-badge { align-self: flex-start !important; }
  }
`

export default function Deudores() {
  const [deudores, setDeudores] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState("")
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set())

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
          .from("pagos_cuenta_corriente").select("monto").eq("venta_id", v.id)
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
    const lista = Object.values(mapaClientes).sort((a: any, b: any) => b.totalDeuda - a.totalDeuda)
    setDeudores(lista)
    setCargando(false)
  }

  const filtrados = deudores.filter(d =>
    (d.nombre + " " + d.apellido).toLowerCase().includes(busqueda.toLowerCase())
  )
  const totalGeneral = deudores.reduce((acc, d) => acc + d.totalDeuda, 0)
  const totalFacturas = deudores.reduce((acc, d) => acc + d.facturas.length, 0)

  function toggleExpandir(id: number) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (cargando) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#9ca3af", fontSize: 14 }}>
      Cargando...
    </div>
  )

  return (
    <div>
      <style>{responsiveStyles}</style>

      {/* KPIs */}
      <div className="deudores-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: deudores.length === 0 ? "white" : "#0f172a", borderRadius: 14, padding: "18px 20px", border: deudores.length === 0 ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.08)", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Clientes con deuda</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: deudores.length === 0 ? "#22c55e" : "#f87171" }}>{deudores.length}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{deudores.length === 0 ? "Sin deudores" : "activos"}</div>
        </div>
        <div style={{ background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Facturas pendientes</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#f59e0b" }}>{totalFacturas}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>sin cobrar</div>
        </div>
        <div style={{ background: totalGeneral > 0 ? "#0f172a" : "white", borderRadius: 14, padding: "18px 20px", border: totalGeneral > 0 ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Total adeudado</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: totalGeneral > 0 ? "#f87171" : "#22c55e", lineHeight: 1.1 }}>{fmt(totalGeneral)}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>acumulado</div>
        </div>
      </div>

      {/* Buscador */}
      {deudores.length > 0 && (
        <input
          placeholder="🔍 Buscar por nombre..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ width: "100%", padding: "10px 14px", marginBottom: 16, borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      )}

      {deudores.length === 0 ? (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#16a34a" }}>Sin deudores activos</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>Todos los clientes están al día</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map(d => {
            const expandido = expandidos.has(d.cliente_id)
            return (
              <div key={d.cliente_id} style={{
                background: "white", borderRadius: 14, border: "1px solid #fecaca",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden"
              }}>
                <div className="deudor-card-top" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg, #dc2626, #ef4444)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 800, color: "white"
                    }}>
                      {(d.nombre.charAt(0) + d.apellido.charAt(0)).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{d.nombre} {d.apellido}</div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {d.telefono && <span>📞 {d.telefono}</span>}
                        {d.localidad && <span>📍 {d.localidad}</span>}
                        <span>{d.facturas.length} factura{d.facturas.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  </div>
                  <div className="deudor-monto-badge" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ background: "#fef2f2", color: "#dc2626", fontSize: 14, fontWeight: 800, padding: "6px 14px", borderRadius: 20, border: "1px solid #fecaca", whiteSpace: "nowrap" }}>
                        {fmt(d.totalDeuda)}
                      </div>
                    </div>
                    <button onClick={() => toggleExpandir(d.cliente_id)} style={{
                      background: "#f1f5f9", border: "none", borderRadius: 8,
                      padding: "6px 10px", cursor: "pointer", fontSize: 12, color: "#6b7280", flexShrink: 0
                    }}>
                      {expandido ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {expandido && (
                  <div style={{ borderTop: "1px solid #fef2f2", padding: "12px 20px 16px", background: "#fffbfb" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>
                      Facturas pendientes
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {d.facturas.map((f: any) => (
                        <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", border: "1px solid #fee2e2", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#374151" }}>N° {f.nro_factura || f.id}</span>
                            {f.fecha && <span style={{ color: "#9ca3af", marginLeft: 10, fontSize: 11 }}>{new Date(f.fecha).toLocaleDateString("es-AR")}</span>}
                          </div>
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>{fmt(f.saldo)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
