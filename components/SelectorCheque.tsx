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
 * Selector con buscador de cheques RECIBIDOS (monto_ingresado > 0) que todavía
 * no fueron usados en ningún pago ni están rechazados. Se usa en el modal de
 * cobro de Cuentas y de Deudores cuando el método es Cheque / E-Cheq.
 */
export function SelectorCheque({ value, onSelect }: {
  value: ChequeLite | null
  onSelect: (c: ChequeLite | null) => void
}) {
  const [cheques, setCheques] = useState<ChequeLite[]>([])
  const [busq, setBusq] = useState("")
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setCargando(true)
      const [{ data: chs }, { data: pgs, error: ePg }] = await Promise.all([
        supabase.from("cheques")
          .select("id, numero, tipo, banco, fecha, monto_ingresado, dueno")
          .gt("monto_ingresado", 0).eq("rechazado", false)
          .order("fecha", { ascending: false }),
        supabase.from("pagos_cuenta_corriente").select("cheque_id").not("cheque_id", "is", null),
      ])
      // Si la columna cheque_id todavía no existe (migración sin correr), ePg trae error → tratamos como "ninguno usado".
      const usados = new Set<number>((!ePg && pgs ? pgs : []).map((p: any) => p.cheque_id))
      if (cancel) return
      setCheques((chs || []).filter((c: any) => !usados.has(c.id)))
      setCargando(false)
    })()
    return () => { cancel = true }
  }, [])

  const t = busq.trim().toLowerCase()
  const lista = !t ? cheques : cheques.filter(c =>
    (c.numero || "").toLowerCase().includes(t) ||
    (c.banco || "").toLowerCase().includes(t) ||
    (c.dueno || "").toLowerCase().includes(t)
  )

  const chipBase: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "10px 12px", color: "white",
  }

  // Cheque ya elegido
  if (value) {
    return (
      <div style={{ ...chipBase, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderColor: "rgba(96,165,250,0.5)", background: "rgba(59,130,246,0.1)" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
            {tipoChequeLabel(value.tipo)} N° {value.numero}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {value.banco || "Banco —"} · {fmtFecha(value.fecha)} · {fmtMonto(value.monto_ingresado)}
            {value.dueno ? ` · ${value.dueno}` : ""}
          </div>
        </div>
        <button type="button" onClick={() => { onSelect(null); setBusq(""); setAbierto(false) }}
          style={{ flexShrink: 0, background: "rgba(255,255,255,0.08)", border: "none", color: "#9ca3af", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={busq}
        onChange={e => { setBusq(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder={cargando ? "Cargando cheques..." : "Buscar cheque por N°, banco o dueño..."}
        style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box" }}
      />
      {abierto && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 40, background: "#1e293b", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, maxHeight: 240, overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
          {lista.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 12, color: "#94a3b8" }}>
              {cargando ? "Cargando..." : "No hay cheques recibidos disponibles. Cargalos en la pestaña Cheques."}
            </div>
          ) : lista.map(c => (
            <button key={c.id} type="button"
              onMouseDown={() => { onSelect(c); setAbierto(false) }}
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
  )
}
