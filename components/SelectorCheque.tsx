"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export interface ChequeLite {
  id: number
  numero: string
  tipo: string
  banco?: string
  fecha?: string
  monto_ingresado: number
  dueno?: string
}

// Etiqueta legible del tipo de cheque
export function tipoChequeLabel(tipo?: string) {
  if (tipo === "ECHEQ") return "E-Cheq"
  if (tipo === "F_CHEQ") return "Ch. diferido"
  return "Cheque"
}

function fmtMonto(n: number) {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtFecha(f?: string) {
  if (!f) return "—"
  const d = f.includes("T") ? new Date(f) : new Date(f + "T00:00:00")
  return d.toLocaleDateString("es-AR")
}

/**
 * Selector con buscador de cheques RECIBIDOS para pagar. Permite elegir VARIOS
 * cheques (se van sumando). Excluye los rechazados, los marcados como pagados y
 * los que ya fueron usados en otro pago. Se usa en Cuentas y Deudores.
 */
export function SelectorCheque({ value, onChange, contexto = "cliente" }: {
  value: ChequeLite[]
  onChange: (cheques: ChequeLite[]) => void
  // "cliente" (cobros): excluye cheques ya cobrados a un cliente o endosados a proveedor.
  // "proveedor" (endoso): solo excluye los ya endosados a un proveedor — un cheque cobrado
  // a un cliente sigue en tus manos y se puede endosar a un proveedor.
  contexto?: "cliente" | "proveedor"
}) {
  const [cheques, setCheques] = useState<ChequeLite[]>([])
  const [busq, setBusq] = useState("")
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setCargando(true)
      const [chRes, pcRes, pgRes, ccRes] = await Promise.all([
        supabase.from("cheques")
          .select("id, numero, tipo, banco, fecha, monto_ingresado, dueno")
          .gt("monto_ingresado", 0).eq("rechazado", false).eq("pagado", false)
          .order("fecha", { ascending: false }),
        supabase.from("pago_cheques").select("cheque_id"),
        supabase.from("pagos_cuenta_corriente").select("cheque_id").not("cheque_id", "is", null),
        supabase.from("compra_cheques").select("cheque_id"),
      ])
      // Un cheque endosado a un proveedor (compra_cheques) SIEMPRE se excluye: ya no lo tenés.
      const usados = new Set<number>()
      if (!ccRes.error && ccRes.data) ccRes.data.forEach((r: any) => usados.add(r.cheque_id))
      // Los cobrados a un cliente (pago_cheques + cheque_id viejo) solo se excluyen en
      // cobros a clientes; para endosar a un proveedor siguen disponibles.
      if (contexto === "cliente") {
        if (!pcRes.error && pcRes.data) pcRes.data.forEach((r: any) => usados.add(r.cheque_id))
        if (!pgRes.error && pgRes.data) pgRes.data.forEach((r: any) => usados.add(r.cheque_id))
      }
      if (cancel) return
      setCheques((chRes.data || []).filter((c: any) => !usados.has(c.id)))
      setCargando(false)
    })()
    return () => { cancel = true }
  }, [])

  const selIds = new Set(value.map(c => c.id))
  const t = busq.trim().toLowerCase()
  const disponibles = cheques.filter(c =>
    !selIds.has(c.id) && (!t ||
      (c.numero || "").toLowerCase().includes(t) ||
      (c.banco || "").toLowerCase().includes(t) ||
      (c.dueno || "").toLowerCase().includes(t))
  )
  const totalSel = value.reduce((s, c) => s + Number(c.monto_ingresado), 0)

  function agregar(c: ChequeLite) { onChange([...value, c]); setBusq(""); setAbierto(false) }
  function quitar(id: number) { onChange(value.filter(c => c.id !== id)) }

  return (
    <div>
      {/* Cheques ya elegidos */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {value.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(96,165,250,0.5)", borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                  {tipoChequeLabel(c.tipo)} N° {c.numero} <span style={{ color: "#4ade80" }}>· {fmtMonto(c.monto_ingresado)}</span>
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                  {c.banco || "Banco —"} · {fmtFecha(c.fecha)}{c.dueno ? ` · ${c.dueno}` : ""}
                </div>
              </div>
              <button type="button" onClick={() => quitar(c.id)}
                style={{ flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "none", color: "#9ca3af", borderRadius: 7, padding: "5px 9px", fontSize: 13, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          ))}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#4ade80", textAlign: "right", paddingRight: 2 }}>
            Total {value.length} cheque{value.length !== 1 ? "s" : ""}: {fmtMonto(totalSel)}
          </div>
        </div>
      )}

      {/* Buscador para agregar más */}
      <div style={{ position: "relative" }}>
        <input
          value={busq}
          onChange={e => { setBusq(e.target.value); setAbierto(true) }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          placeholder={cargando ? "Cargando cheques..." : value.length > 0 ? "Agregar otro cheque..." : "Buscar cheque por N°, banco o dueño..."}
          style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
        {abierto && (
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, maxHeight: 240, overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
            {disponibles.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 12, color: "#94a3b8" }}>
                {cargando ? "Cargando..." : "No hay cheques recibidos disponibles. Cargalos en la pestaña Cheques."}
              </div>
            ) : disponibles.map(c => (
              <button key={c.id} type="button"
                onMouseDown={() => agregar(c)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>
                    {tipoChequeLabel(c.tipo)} N° {c.numero}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {c.banco || "Banco —"} · {fmtFecha(c.fecha)}{c.dueno ? ` · ${c.dueno}` : ""}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#4ade80" }}>{fmtMonto(c.monto_ingresado)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
