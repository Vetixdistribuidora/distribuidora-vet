// lib/saldo.ts
// Calcula el saldo total pendiente de un cliente en cuenta corriente.
// Método autoritativo: suma de (total de cada venta en cuenta corriente − pagos de esa venta).
// Es el mismo criterio que usa la página de Deudores.

import { supabase } from "./supabase"

export async function getSaldoCliente(clienteId: number | string): Promise<number> {
  if (!clienteId) return 0
  try {
    const { data: ventas } = await supabase
      .from("ventas")
      .select("id, total")
      .eq("cliente_id", clienteId)
      .eq("estado", "cuenta_corriente")
    if (!ventas || ventas.length === 0) return 0

    const ids = ventas.map((v: any) => v.id)
    const { data: pagos } = await supabase
      .from("pagos_cuenta_corriente")
      .select("venta_id, monto")
      .in("venta_id", ids)

    const pagosPorVenta: Record<number, number> = {}
    ;(pagos || []).forEach((p: any) => {
      pagosPorVenta[p.venta_id] = (pagosPorVenta[p.venta_id] || 0) + Number(p.monto)
    })

    const total = ventas.reduce((s: number, v: any) => {
      const saldo = Number(v.total) - (pagosPorVenta[v.id] || 0)
      return s + (saldo > 0 ? saldo : 0)
    }, 0)
    return Math.round(total * 100) / 100
  } catch (e) {
    console.error("Error calculando saldo del cliente:", e)
    return 0
  }
}
