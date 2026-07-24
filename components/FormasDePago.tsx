"use client"

import { SelectorCheque, ChequeLite } from "@/components/SelectorCheque"
import {
  FormaPago, MetodoPago, METODOS_PAGO, nuevaFormaPago,
  esCheque, montoForma, totalFormas,
} from "@/lib/formasPago"

function fmt(n: number) {
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  color: "#9ca3af", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase",
}
const inputDark: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "white", fontSize: 14, outline: "none", boxSizing: "border-box",
}

/**
 * Editor de formas de pago (pago dividido). Cada renglón es método + monto; para
 * cheque/e-cheq se eligen los cheques y el monto se calcula solo. Compartido por
 * Deudores, Cuentas y Clientes.
 */
export function FormasDePago({ value, onChange, montoObjetivo, disabled }: {
  value: FormaPago[]
  onChange: (formas: FormaPago[]) => void
  // Monto que se espera cubrir (para mostrar cuánto falta / sobra). Opcional.
  montoObjetivo?: number
  disabled?: boolean
}) {
  const total = totalFormas(value)
  const objetivo = Number(montoObjetivo || 0)
  const dif = Math.round((objetivo - total) * 100) / 100

  function actualizar(uid: string, cambios: Partial<FormaPago>) {
    onChange(value.map(f => f.uid === uid ? { ...f, ...cambios } : f))
  }
  function agregar() { onChange([...value, nuevaFormaPago("efectivo")]) }
  function quitar(uid: string) { onChange(value.filter(f => f.uid !== uid)) }

  // Cheques ya elegidos en otros renglones (para no repetir el mismo cheque)
  function chequesEnOtros(uid: string): number[] {
    return value.filter(f => f.uid !== uid && esCheque(f.metodo))
      .flatMap(f => (f.cheques || []).map(c => c.id))
  }

  return (
    <div>
      <label style={labelStyle}>Formas de pago</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {value.map((f, i) => (
          <div key={f.uid} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: esCheque(f.metodo) ? 10 : 0 }}>
              <select
                value={f.metodo}
                disabled={disabled}
                onChange={e => {
                  const metodo = e.target.value as MetodoPago
                  // al cambiar a/desde cheque, reseteamos cheques y monto
                  actualizar(f.uid, { metodo, cheques: esCheque(metodo) ? [] : undefined, monto: 0 })
                }}
                style={{ ...inputDark, cursor: "pointer", background: "#1e293b", flex: "0 0 42%" }}>
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value} style={{ color: "#000" }}>{m.label}</option>)}
              </select>

              {!esCheque(f.metodo) && (
                <input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={f.monto || ""}
                  disabled={disabled}
                  onChange={e => actualizar(f.uid, { monto: parseFloat(e.target.value.replace(",", ".")) || 0 })}
                  placeholder="Monto"
                  style={{ ...inputDark, flex: 1 }}
                />
              )}
              {esCheque(f.metodo) && (
                <div style={{ flex: 1, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#4ade80" }}>
                  {fmt(montoForma(f))}
                </div>
              )}

              {value.length > 1 && (
                <button type="button" onClick={() => quitar(f.uid)} disabled={disabled}
                  title="Quitar forma de pago"
                  style={{ flexShrink: 0, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 8, padding: "8px 11px", fontSize: 13, cursor: "pointer" }}>
                  ✕
                </button>
              )}
            </div>

            {esCheque(f.metodo) && (
              <SelectorCheque
                value={f.cheques || []}
                onChange={chs => actualizar(f.uid, { cheques: chs })}
                excluirIds={chequesEnOtros(f.uid)}
              />
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={agregar} disabled={disabled}
        style={{ marginTop: 10, width: "100%", padding: "9px", background: "rgba(59,130,246,0.12)", border: "1px dashed rgba(96,165,250,0.5)", borderRadius: 10, color: "#93c5fd", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        ➕ Agregar forma de pago
      </button>

      {/* Total de las formas + comparación con el objetivo */}
      <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#9ca3af", fontWeight: 600 }}>Total formas de pago</span>
          <span style={{ color: "white", fontWeight: 800 }}>{fmt(total)}</span>
        </div>
        {objetivo > 0 && Math.abs(dif) >= 0.01 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4 }}>
            <span style={{ color: dif > 0 ? "#fbbf24" : "#4ade80" }}>
              {dif > 0 ? `Falta para cubrir ${fmt(objetivo)}` : "Excedente → quedará a favor"}
            </span>
            <span style={{ color: dif > 0 ? "#fbbf24" : "#4ade80", fontWeight: 700 }}>{fmt(Math.abs(dif))}</span>
          </div>
        )}
      </div>
    </div>
  )
}
