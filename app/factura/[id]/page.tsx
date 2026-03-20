"use client"

import { useParams } from "next/navigation"

export default function Factura() {

  const { id } = useParams()

  return (
    <div style={{
      background: "white",
      padding: 40,
      maxWidth: 600,
      margin: "auto",
      borderRadius: 10
    }}>

      <h2>🧾 Factura</h2>
      <p>N°: {id}</p>

      <hr />

      <p><b>Cliente:</b> ---</p>
      <p><b>Producto:</b> ---</p>
      <p><b>Total:</b> ---</p>

      <hr />

      <button onClick={() => window.print()}>
        🖨 Imprimir
      </button>

      <button onClick={() => window.print()} style={{ marginLeft: 10 }}>
        📄 Guardar PDF
      </button>

      <br /><br />

      <button onClick={() => window.history.back()}>
        🔙 Volver
      </button>

    </div>
  )
}