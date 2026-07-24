// lib/formasPago.ts
// Lógica compartida para cobrar con VARIAS formas de pago en un mismo recibo
// (efectivo + cheque + transferencia, etc.). Usado por Deudores, Cuentas y Clientes.
//
// El modelo: un cobro = una lista ordenada de "formas de pago" (renglones método+monto),
// más opcionalmente el saldo a favor / nota de crédito del cliente. Ese total se reparte
// sobre las facturas afectadas. Cada porción (factura × método) se guarda como su propia
// fila en pagos_cuenta_corriente con su metodo_pago, para que la Caja y el saldo del
// cliente queden exactos (misma convención que ya usa el sistema al separar crédito/efectivo).

import { ChequeLite } from "@/components/SelectorCheque"

export type MetodoPago = "efectivo" | "transferencia" | "cheque" | "echeq" | "tarjeta" | "otro"

export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "echeq", label: "E-Cheq" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
]

export const METODO_LABEL: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", cheque: "Cheque",
  echeq: "E-Cheq", tarjeta: "Tarjeta", otro: "Otro", credito: "Nota de crédito / saldo a favor",
}

export interface FormaPago {
  uid: string
  metodo: MetodoPago
  monto: number            // para efectivo/transferencia/tarjeta/otro: monto manual
  cheques?: ChequeLite[]   // para cheque/echeq: el monto sale de la suma de estos cheques
}

let _seq = 0
export function nuevaFormaPago(metodo: MetodoPago = "efectivo"): FormaPago {
  _seq += 1
  return { uid: `fp_${Date.now()}_${_seq}`, metodo, monto: 0, cheques: [] }
}

export function esCheque(m: string): boolean {
  return m === "cheque" || m === "echeq"
}

const r2 = (n: number) => Math.round(n * 100) / 100

// Monto de una forma de pago (los cheques mandan sobre el campo monto)
export function montoForma(f: FormaPago): number {
  if (esCheque(f.metodo)) return r2((f.cheques || []).reduce((s, c) => s + Number(c.monto_ingresado || 0), 0))
  return r2(Number(f.monto) || 0)
}

export function totalFormas(formas: FormaPago[]): number {
  return r2(formas.reduce((s, f) => s + montoForma(f), 0))
}

// Todos los cheques elegidos en el cobro (para enlazarlos al recibo en pago_cheques)
export function chequesDeFormas(formas: FormaPago[]): ChequeLite[] {
  return formas.filter(f => esCheque(f.metodo)).flatMap(f => f.cheques || [])
}

// ── Reparto ────────────────────────────────────────────────────────────────
// Fuente de pago ordenada. El crédito (saldo a favor) va primero si se usa.
export interface Fuente { metodo: MetodoPago | "credito"; disponible: number }

// Fila resultante: cuánto de cada método se imputa a cada factura.
export interface FilaPago { venta_id: number; metodo: MetodoPago | "credito"; monto: number }

/**
 * Reparte las `fuentes` (en orden) sobre las `afectadas` (en orden). Cada factura
 * consume de las fuentes disponibles hasta cubrir su `pago`. Devuelve una fila por
 * (factura × método) efectivamente usado.
 */
export function repartirPago(
  afectadas: { id: number; pago: number }[],
  fuentes: Fuente[],
): FilaPago[] {
  const rows: FilaPago[] = []
  const disp = fuentes.map(f => ({ metodo: f.metodo, disponible: r2(f.disponible) }))
  let idx = 0
  for (const fa of afectadas) {
    let restante = r2(fa.pago)
    while (restante > 0.001 && idx < disp.length) {
      if (disp[idx].disponible <= 0.001) { idx++; continue }
      const usar = r2(Math.min(restante, disp[idx].disponible))
      rows.push({ venta_id: fa.id, metodo: disp[idx].metodo, monto: usar })
      disp[idx].disponible = r2(disp[idx].disponible - usar)
      restante = r2(restante - usar)
    }
  }
  return rows
}

// Resumen por método (para el recibo): agrupa las filas por método → total.
export function resumenPorMetodo(rows: FilaPago[]): { metodo: string; monto: number }[] {
  const acc: Record<string, number> = {}
  for (const r of rows) acc[r.metodo] = r2((acc[r.metodo] || 0) + r.monto)
  return Object.entries(acc).map(([metodo, monto]) => ({ metodo, monto }))
}
