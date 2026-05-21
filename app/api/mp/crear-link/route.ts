import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

// En producción usar las credenciales reales, en dev las de prueba
function getAccessToken() {
  return process.env.NODE_ENV === "production"
    ? process.env.MP_ACCESS_TOKEN_PROD
    : process.env.MP_ACCESS_TOKEN_TEST
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://distribuidora-vet.vercel.app"

export async function POST(req: NextRequest) {
  try {
    const { email, nombre_negocio } = await req.json()
    if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 })

    const ACCESS_TOKEN = getAccessToken()
    if (!ACCESS_TOKEN) return NextResponse.json({ error: "Credenciales MP no configuradas" }, { status: 500 })

    // Crear suscripción recurrente en MercadoPago (preapproval)
    const body = {
      reason: `Floppa — ${nombre_negocio || email}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 60000,
        currency_id: "ARS",
      },
      payer_email: email,
      back_url: `${APP_URL}/configuracion`,
      status: "pending",
    }

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(body),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error("Error MP crear preapproval:", mpData)
      return NextResponse.json(
        { error: mpData.message || "Error al crear la suscripción en MercadoPago" },
        { status: 500 }
      )
    }

    // Guardar el preapproval_id en la tabla suscripciones
    await supabaseAdmin
      .from("suscripciones")
      .upsert(
        { email, nombre_negocio, mp_preapproval_id: mpData.id, estado: "trial" },
        { onConflict: "email" }
      )

    return NextResponse.json({ init_point: mpData.init_point, id: mpData.id })
  } catch (e: any) {
    console.error("Error en /api/mp/crear-link:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
