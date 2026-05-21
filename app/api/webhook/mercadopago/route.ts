import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

function getAccessToken() {
  return process.env.NODE_ENV === "production"
    ? process.env.MP_ACCESS_TOKEN_PROD
    : process.env.MP_ACCESS_TOKEN_TEST
}

// MercadoPago verifica el endpoint con GET
export async function GET() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const ACCESS_TOKEN = getAccessToken()
    if (!ACCESS_TOKEN) return NextResponse.json({ ok: true })

    const { type, data } = body

    // ── Notificación de suscripción (preapproval) ──────────────────────────
    if (type === "subscription_preapproval") {
      const preapprovalId = data?.id
      if (!preapprovalId) return NextResponse.json({ ok: true })

      // Consultar estado real del preapproval en MP
      const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      })
      const preapproval = await mpRes.json()

      if (preapproval.status === "authorized") {
        const hoy = new Date()
        const proximo = new Date(hoy)
        proximo.setMonth(proximo.getMonth() + 1)

        await supabaseAdmin
          .from("suscripciones")
          .update({
            estado: "activo",
            fecha_inicio: preapproval.date_created?.split("T")[0] || hoy.toISOString().split("T")[0],
            fecha_vencimiento: proximo.toISOString().split("T")[0],
            mp_payer_email: preapproval.payer_email,
          })
          .eq("mp_preapproval_id", preapprovalId)
      }

      if (preapproval.status === "cancelled" || preapproval.status === "paused") {
        await supabaseAdmin
          .from("suscripciones")
          .update({ estado: "vencido" })
          .eq("mp_preapproval_id", preapprovalId)
      }
    }

    // ── Notificación de pago individual dentro de la suscripción ──────────
    if (type === "payment") {
      const paymentId = data?.id
      if (!paymentId) return NextResponse.json({ ok: true })

      const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      })
      const payment = await payRes.json()

      // Pago aprobado → extender fecha de vencimiento 1 mes más
      if (payment.status === "approved" && payment.preapproval_id) {
        const hoy = new Date()
        const proximo = new Date(hoy)
        proximo.setMonth(proximo.getMonth() + 1)

        await supabaseAdmin
          .from("suscripciones")
          .update({
            estado: "activo",
            fecha_vencimiento: proximo.toISOString().split("T")[0],
          })
          .eq("mp_preapproval_id", payment.preapproval_id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error("Error webhook MP:", e)
    // Siempre devolver 200 para que MP no reintente infinitamente
    return NextResponse.json({ ok: true })
  }
}
