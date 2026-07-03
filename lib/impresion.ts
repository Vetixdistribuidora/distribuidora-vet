// lib/impresion.ts
// Generación de HTML para impresión.
// Compartido entre ventas, clientes, cuentas y deudores.

export interface DatosImpresion {
  nroFactura: string
  clienteSeleccionado: any
  carrito: any[]
  subtotal: number
  ivaNum: number
  total: number
  esCuentaCorriente: boolean
  metodoCobro?: string
  fecha?: string  // fecha original de la venta; si no se pasa usa la fecha de hoy
  saldoCliente?: number  // saldo total pendiente del cliente en cuenta corriente (solo se muestra si > 0)
}

export function generarHTMLEImprimir(datos: DatosImpresion, tipo: "presupuesto" | "remito" = "presupuesto") {
  const { nroFactura, clienteSeleccionado, carrito, subtotal, ivaNum, total, esCuentaCorriente, metodoCobro } = datos
  const logoUrl = window.location.origin + "/logo.png"
  const fecha = datos.fecha || new Date().toLocaleDateString("es-AR")
  const f = (num: number) => "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const esRemito = tipo === "remito"
  const saldoCliente = Number(datos.saldoCliente || 0)
  // Dato sutil dentro de la casilla del cliente (no un recuadro destacado). Solo en factura, no en remito.
  const saldoInline = (!esRemito && saldoCliente > 0)
    ? " &nbsp;|&nbsp; <b>Saldo c/c:</b> <span style='color:#b45309;'>" + f(saldoCliente) + "</span>"
    : ""
  const titulo = esRemito ? "REMITO DE ENTREGA" : "PRESUPUESTO"
  const filas = carrito.map((item: any) => {
    const bonif = item.bonificacion || 0
    const unidadesPagas = item.cantidad - bonif > 0 ? item.cantidad - bonif : 0
    if (esRemito) {
      return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + bonif + "</td><td>&nbsp;</td></tr>"
    }
    return "<tr><td>" + item.cantidad + "</td><td style='text-align:left;'>" + item.nombre + "</td><td>" + f(item.precio) + "</td><td>" + bonif + "</td><td>" + f(unidadesPagas * item.precio) + "</td></tr>"
  }).join("")
  const theadCols = esRemito
    ? "<tr><th style='width:7%'>Cant.</th><th style='width:65%'>Descripcion</th><th style='width:10%'>Bonif.</th><th style='width:18%'>Recibido</th></tr>"
    : "<tr><th style='width:6%'>Cant.</th><th style='width:54%'>Descripcion</th><th style='width:16%'>Precio U.</th><th style='width:8%'>Bonif.</th><th style='width:16%'>Total</th></tr>"
  const badgeCC = esCuentaCorriente && !esRemito ? "<div style='background:#e67700;color:white;padding:6px 14px;border-radius:6px;font-weight:bold;display:inline-block;margin-top:8px;'>CUENTA CORRIENTE - PENDIENTE DE PAGO</div>" : ""
  const metodoStr = metodoCobro && metodoCobro !== "sin_especificar" && !esRemito && !esCuentaCorriente ? "<p style='margin:6px 0'><b>Método de cobro:</b> " + metodoCobro.replace("_", " ").toUpperCase() + "</p>" : ""
  const totalesHTML = esRemito
    ? "<div class='totales'><div class='box'><p>Firma y aclaración: ___________________________</p></div></div>"
    : "<div class='totales'><div class='box'>" + metodoStr + "<p><b>Subtotal:</b> " + f(subtotal) + "</p><p><b>IVA (" + ivaNum + "%):</b> " + f(subtotal * ivaNum / 100) + "</p><h2><b>Total:</b> " + f(total) + "</h2></div></div>"
  const html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;background:#e5e7eb}.acciones{display:flex;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}.page{width:180mm;min-height:267mm;margin:16px auto;background:white;padding:16px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.12)}.logo{height:130px;display:block}.empresa-info{font-size:11px;color:#555;margin-top:1px;line-height:1.5}.header{display:flex;justify-content:space-between;align-items:flex-start}.header-right{text-align:center;padding-top:4px}.header-right h2{margin:0;font-size:18px}.nro-factura{font-size:13px;color:#555;margin-top:4px}.cliente-row{margin-top:12px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;line-height:1.9}.contenido{flex:1}table{width:100%;margin-top:14px;border-collapse:collapse;table-layout:fixed}th{border:1px solid #ccc;padding:4px 4px;background:#eee;font-size:10px;white-space:nowrap;overflow:hidden}td{padding:5px 6px;text-align:center;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-word}.totales{margin-top:16px;display:flex;justify-content:flex-end;page-break-inside:avoid;break-inside:avoid}.box{width:250px;border-top:2px solid #333;padding-top:8px}.box p{margin:4px 0;font-size:12px}.box h2{margin:10px 0 4px;font-size:20px}@media(max-width:640px){.page{width:100%;margin:0;padding:12px;min-height:auto;box-shadow:none;border-radius:0}.logo{height:70px}.acciones{gap:8px;padding:10px 12px}.acciones button{flex:1;font-size:15px!important;padding:14px 10px!important}th{font-size:9px;padding:3px 2px}td{font-size:10px;padding:4px 3px}.totales .box{width:100%}}@media print{body{background:white}.acciones{display:none}.page{width:100%;min-height:calc(297mm - 30mm);margin:0;padding:0;box-shadow:none}tr{page-break-inside:avoid;break-inside:avoid}.totales{break-inside:avoid;page-break-inside:avoid}}</style></head><body><div class='acciones'><button onclick='window.close();window.history.back();' style='background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:10px 18px;font-size:14px;font-family:Arial;cursor:pointer;color:#374151;font-weight:600'>&#8592; Volver</button><button onclick='window.print()' style='background:#0f172a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-family:Arial;cursor:pointer;color:white;font-weight:700'>&#128438; Imprimir</button></div><div class='page'><div class='contenido'><div class='header'><div><img src='" + logoUrl + "' class='logo'/><div class='empresa-info'>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div></div><div class='header-right'><h2>" + titulo + "</h2><div class='nro-factura'><b style='font-size:15px;color:#111'>N° 001-" + nroFactura + "</b><br/><span style='font-size:12px;color:#555'>Fecha: " + fecha + "</span></div>" + badgeCC + "</div></div><div class='cliente-row'><b>Cliente:</b> " + clienteSeleccionado.nombre + " " + clienteSeleccionado.apellido + " &nbsp;|&nbsp; <b>CUIT:</b> " + (clienteSeleccionado.cuit || "-") + " &nbsp;|&nbsp; <b>Dir:</b> " + (clienteSeleccionado.localidad || "-") + " &nbsp;|&nbsp; <b>Tel:</b> " + (clienteSeleccionado.telefono || "-") + saldoInline + "</div><table><thead>" + theadCols + "</thead><tbody>" + filas + "</tbody></table></div>" + totalesHTML + "</div></body></html>"
  const ventana = window.open("", "_blank")
  if (!ventana) { alert("Habilita ventanas emergentes"); return }
  ventana.document.write(html); ventana.document.close()
}

// ─── Recibo de pago individual (cuenta corriente) ───────────────────────────
export interface ClienteRecibo {
  nombre: string; apellido?: string; cuit?: string; telefono?: string; localidad?: string
}

// Datos de un cheque con el que se pagó (opcional, para detallar en el recibo)
export interface ChequeRecibo {
  numero?: string; tipo?: string; banco?: string; fecha?: string; monto?: number
}

function tipoChequeLabel(tipo?: string) {
  if (tipo === "ECHEQ") return "E-Cheq"
  if (tipo === "F_CHEQ") return "Cheque diferido"
  return "Cheque"
}

// Bloque HTML con el detalle del/los cheque(s) usado(s) en el pago
function bloqueChequeHTML(cheques?: ChequeRecibo[]): string {
  const lista = (cheques || []).filter(c => c && c.numero)
  if (!lista.length) return ""
  const f = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const item = (l: string, v: string) =>
    `<span style="white-space:nowrap;"><b style="color:#1971c2;">${l}:</b> <span style="color:#333;">${v}</span></span>`
  const filas = lista.map(c => {
    const fechaCh = c.fecha
      ? new Date(c.fecha.includes("T") ? c.fecha : c.fecha + "T00:00:00").toLocaleDateString("es-AR")
      : "—"
    return `<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;padding:4px 0;">
      <span style="font-weight:700;color:#1971c2;">${tipoChequeLabel(c.tipo)}</span>
      ${item("N°", c.numero || "—")}
      ${c.banco ? item("Banco", c.banco) : ""}
      ${item("Fecha", fechaCh)}
      ${c.monto ? item("Monto", f(Number(c.monto))) : ""}
    </div>`
  }).join("")
  const total = lista.reduce((s, c) => s + Number(c.monto || 0), 0)
  const totalLinea = lista.length > 1
    ? `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #74c0fc;font-weight:800;color:#1971c2;text-align:right;">Total ${lista.length} cheques: ${f(total)}</div>`
    : ""
  const titulo = lista.length > 1 ? "🧾 Pagado con cheques" : "🧾 Pagado con cheque"
  return `<div style="margin-top:14px;background:#e7f5ff;border:1px solid #1971c2;border-radius:8px;padding:10px 14px;font-size:12px;">
    <div style="font-weight:800;color:#1971c2;margin-bottom:4px;">${titulo}</div>
    ${filas}
    ${totalLinea}
  </div>`
}

export function imprimirReciboCC(
  pago: { monto: number | string; nota?: string | null; nro_recibo?: string; fecha?: any },
  venta: { id: number; nro_factura?: string; total: number | string },
  cliente: ClienteRecibo,
  saldoAnterior: number,
  saldoTotalCliente?: number,
  cheques?: ChequeRecibo[],
  creditoGenerado?: number
) {
  const logoUrl = window.location.origin + "/logo.png"
  const fecha = pago.fecha
    ? (typeof pago.fecha === "string" ? new Date(pago.fecha).toLocaleDateString("es-AR") : new Date(pago.fecha).toLocaleDateString("es-AR"))
    : new Date().toLocaleDateString("es-AR")
  const nroRecibo = pago.nro_recibo || "001-??????"
  const saldoRestante = Math.max(0, saldoAnterior - Number(pago.monto))
  const saldoTotal = Number(saldoTotalCliente || 0)
  const f = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const filaConcepto = (label: string, valor: string) =>
    `<tr><td style="padding:7px 10px;font-size:12px;color:#555;border-bottom:1px solid #f0f0f0;">${label}</td><td style="padding:7px 10px;font-size:12px;font-weight:600;color:#111;border-bottom:1px solid #f0f0f0;text-align:right;">${valor}</td></tr>`
  const css = `@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;background:#e5e7eb}.acciones{display:flex;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}.page{width:180mm;min-height:267mm;margin:16px auto;background:white;padding:24px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.12)}.logo{height:130px;display:block}.empresa-info{font-size:11px;color:#555;margin-top:4px;line-height:1.6}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1971c2;padding-bottom:14px;margin-bottom:16px}.header-right{text-align:center;padding-top:4px}.titulo{font-size:20px;font-weight:800;color:#1971c2;margin:0 0 6px}.nro-doc{font-size:15px;font-weight:700;color:#111;margin:0 0 4px}.fecha-doc{font-size:12px;color:#555;margin:0}.cliente-row{padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;line-height:1.9;margin-bottom:16px}.tabla-concepto{width:100%;border-collapse:collapse}.tabla-concepto thead th{background:#f1f5f9;padding:8px 10px;font-size:11px;font-weight:700;color:#374151;text-align:left;text-transform:uppercase;letter-spacing:.4px}.tabla-concepto thead th:last-child{text-align:right}.total-box{margin-top:20px;display:flex;justify-content:flex-end}.total-inner{width:260px}.total-pagado{background:#d3f9d8;border:1px solid #2f9e44;border-radius:8px;padding:12px 16px;text-align:center}.total-pagado-label{font-size:11px;color:#2f9e44;font-weight:600;text-transform:uppercase;margin:0 0 4px}.total-pagado-monto{font-size:24px;font-weight:800;color:#2f9e44;margin:0}.saldo-box{margin-top:8px;border-radius:8px;padding:10px 16px;text-align:center}.saldo-saldado{background:#d3f9d8;border:1px solid #2f9e44;color:#2f9e44}.saldo-pendiente{background:#fff3cd;border:1px solid #e67700;color:#e67700}.saldo-label{font-size:12px;font-weight:700;margin:0}.firma-box{margin-top:40px;display:flex;justify-content:space-between;font-size:11px;color:#555}.firma-linea{border-top:1px solid #555;width:200px;text-align:center;padding-top:6px}.footer{margin-top:auto;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center}@media(max-width:640px){.page{width:100%;margin:0;padding:12px;min-height:auto;box-shadow:none}.logo{height:70px}.firma-box{flex-direction:column;gap:20px}.firma-linea{width:100%}.total-inner{width:100%}}@media print{body{background:white}.acciones{display:none}.page{width:100%;min-height:calc(297mm - 30mm);margin:0;padding:16px;box-shadow:none}}`
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body>
<div class="acciones"><button onclick="window.close();window.history.back();" style="background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:10px 18px;font-size:14px;font-family:Arial;cursor:pointer;color:#374151;font-weight:600">&#8592; Volver</button><button onclick="window.print()" style="background:#0f172a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-family:Arial;cursor:pointer;color:white;font-weight:700">&#128438; Imprimir</button></div>
<div class="page">
  <div class="header">
    <div><img src="${logoUrl}" class="logo"/><div class="empresa-info">Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div></div>
    <div class="header-right"><div class="titulo">RECIBO DE COBRO</div><div class="nro-doc">N° ${nroRecibo}</div><div class="fecha-doc">Fecha: ${fecha}</div></div>
  </div>
  <div class="cliente-row"><b>Cliente:</b> ${cliente.nombre} ${cliente.apellido || ""} &nbsp;|&nbsp; <b>CUIT:</b> ${cliente.cuit || "-"} &nbsp;|&nbsp; <b>Tel:</b> ${cliente.telefono || "-"} &nbsp;|&nbsp; <b>Dir:</b> ${cliente.localidad || "-"}${saldoTotal > 0 ? ` &nbsp;|&nbsp; <b>Saldo c/c:</b> <span style="color:#b45309;">${f(saldoTotal)}</span>` : ""}</div>
  <table class="tabla-concepto">
    <thead><tr><th>Concepto</th><th style="text-align:right;">Importe</th></tr></thead>
    <tbody>
      ${filaConcepto("Factura / Comprobante N°", venta.nro_factura || String(venta.id))}
      ${filaConcepto("Total de la factura", f(Number(venta.total)))}
      ${filaConcepto("Saldo anterior al pago", f(saldoAnterior))}
      ${pago.nota ? filaConcepto("Nota / Detalle", String(pago.nota)) : ""}
    </tbody>
  </table>
  ${bloqueChequeHTML(cheques)}
  <div class="total-box"><div class="total-inner">
    <div class="total-pagado"><p class="total-pagado-label">Monto recibido</p><p class="total-pagado-monto">${f(Number(pago.monto))}</p></div>
    <div class="saldo-box ${saldoRestante > 0 ? "saldo-pendiente" : "saldo-saldado"}"><p class="saldo-label">${saldoRestante > 0 ? "Saldo restante de esta factura: " + f(saldoRestante) : "✓ Factura saldada completamente"}</p></div>
    ${creditoGenerado && creditoGenerado > 0 ? `<div class="saldo-box" style="background:#e7f5ff;border:1px solid #1971c2;color:#1971c2;"><p class="saldo-label">💚 Saldo a favor generado: ${f(Number(creditoGenerado))}</p></div>` : ""}
  </div></div>
  <div class="firma-box">
    <div class="firma-linea">Firma y aclaración<br/><span style="font-size:10px;color:#aaa;">Cliente</span></div>
    <div class="firma-linea">Firma y sello<br/><span style="font-size:10px;color:#aaa;">VETIX Distribuidora</span></div>
  </div>
  <div class="footer">VETIX Distribuidora — Almirante Brown 620 — Tel: 2604518157 — vetix.cf@gmail.com</div>
</div></body></html>`
  const w = window.open("", "_blank")
  if (!w) { alert("Habilitá ventanas emergentes"); return }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600)
}

// ─── Recibo de cobro masivo (deudores — múltiples facturas) ──────────────────
// saldo en cada item = saldo ANTES de este pago (viene de calcularPreview en deudores)
export function imprimirReciboCobroMasivo(
  totalCobrado: number,
  nroReciboBase: string,
  afectadas: Array<{ id: number; nro_factura?: string; total: number; pago: number; resultado: string; saldo: number }>,
  cliente: ClienteRecibo,
  nota?: string,
  saldoTotalCliente?: number,
  creditoAplicado?: number,
  cheques?: ChequeRecibo[],
  creditoGenerado?: number
) {
  const logoUrl = window.location.origin + "/logo.png"
  const fecha = new Date().toLocaleDateString("es-AR")
  const f = (n: number) => "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const cantSaldadas = afectadas.filter(fa => fa.resultado === "pagado").length
  const cantParciales = afectadas.filter(fa => fa.resultado === "parcial").length

  const filasFacturas = afectadas.map(fa => {
    const saldoAntes = fa.saldo          // saldo antes de este pago
    const saldoDespues = Math.max(0, saldoAntes - fa.pago)
    const esSaldada = fa.resultado === "pagado"
    const rowBg = esSaldada ? "background:#f0fdf4;" : "background:#fffbeb;"
    const estadoHtml = esSaldada
      ? `<span style="background:#d3f9d8;color:#2f9e44;font-weight:700;font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #2f9e44;">✓ Saldada</span>`
      : `<span style="background:#fff3cd;color:#e67700;font-weight:600;font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #e67700;">Parcial</span>`
    return `<tr style="${rowBg}">
      <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#111;border-bottom:1px solid #e2e8f0;">N° ${fa.nro_factura || fa.id}</td>
      <td style="padding:8px 10px;font-size:12px;color:#555;border-bottom:1px solid #e2e8f0;text-align:right;">${f(saldoAntes)}</td>
      <td style="padding:8px 10px;font-size:12px;font-weight:700;color:#2f9e44;border-bottom:1px solid #e2e8f0;text-align:right;">${f(fa.pago)}</td>
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;text-align:right;${esSaldada ? "color:#2f9e44;font-weight:600;" : "color:#e67700;font-weight:600;"}">${esSaldada ? "—" : f(saldoDespues)}</td>
      <td style="padding:8px 10px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:center;">${estadoHtml}</td>
    </tr>`
  }).join("")

  const resumenHtml = `
    <div style="margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:12px;display:flex;gap:24px;flex-wrap:wrap;">
      <span><b style="color:#111;">Facturas aplicadas:</b> <span style="color:#374151;">${afectadas.length}</span></span>
      ${cantSaldadas > 0 ? `<span><b style="color:#2f9e44;">✓ Saldadas:</b> <span style="color:#2f9e44;font-weight:700;">${cantSaldadas}</span></span>` : ""}
      ${cantParciales > 0 ? `<span><b style="color:#e67700;">~ Abonos parciales:</b> <span style="color:#e67700;font-weight:700;">${cantParciales}</span></span>` : ""}
      ${nota ? `<span><b style="color:#555;">Nota:</b> ${nota}</span>` : ""}
    </div>`

  const css = `@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;background:#e5e7eb}.acciones{display:flex;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}.page{width:180mm;min-height:267mm;margin:16px auto;background:white;padding:24px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.12)}.logo{height:130px;display:block}.empresa-info{font-size:11px;color:#555;margin-top:4px;line-height:1.6}.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1971c2;padding-bottom:14px;margin-bottom:16px}.header-right{text-align:center;padding-top:4px}.titulo{font-size:20px;font-weight:800;color:#1971c2;margin:0 0 6px}.nro-doc{font-size:15px;font-weight:700;color:#111;margin:0 0 4px}.fecha-doc{font-size:12px;color:#555;margin:0}.cliente-row{padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;line-height:1.9;margin-bottom:16px}table{width:100%;border-collapse:collapse}thead th{background:#1971c2;color:white;padding:9px 10px;font-size:11px;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:.4px}.total-box{margin-top:20px;display:flex;justify-content:flex-end}.total-inner{width:280px}.total-pagado{background:#d3f9d8;border:2px solid #2f9e44;border-radius:10px;padding:14px 18px;text-align:center}.total-pagado-label{font-size:11px;color:#2f9e44;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px}.total-pagado-monto{font-size:28px;font-weight:800;color:#2f9e44;margin:0}.footer{margin-top:auto;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center}.firma-box{margin-top:36px;display:flex;justify-content:space-between;font-size:11px;color:#555}.firma-linea{border-top:1px solid #555;width:200px;text-align:center;padding-top:6px}@media print{body{background:white}.acciones{display:none}.page{width:100%;min-height:calc(297mm - 30mm);margin:0;padding:16px;box-shadow:none}tr{page-break-inside:avoid}}`

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>${css}</style></head><body>
<div class="acciones"><button onclick="window.close();window.history.back();" style="background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:10px 18px;font-size:14px;font-family:Arial;cursor:pointer;color:#374151;font-weight:600">&#8592; Volver</button><button onclick="window.print()" style="background:#0f172a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-family:Arial;cursor:pointer;color:white;font-weight:700">&#128438; Imprimir</button></div>
<div class="page">
  <div class="header">
    <div><img src="${logoUrl}" class="logo"/><div class="empresa-info">Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div></div>
    <div class="header-right">
      <div class="titulo">RECIBO DE COBRO</div>
      <div class="nro-doc">N° ${nroReciboBase}</div>
      <div class="fecha-doc">Fecha: ${fecha}</div>
      ${afectadas.length > 1 ? `<div style="margin-top:6px;background:#e7f5ff;border:1px solid #1971c2;border-radius:6px;padding:3px 10px;font-size:11px;color:#1971c2;font-weight:700;">${afectadas.length} facturas incluidas</div>` : ""}
    </div>
  </div>
  <div class="cliente-row">
    <b>Cliente:</b> ${cliente.nombre} ${cliente.apellido || ""} &nbsp;|&nbsp;
    <b>CUIT:</b> ${cliente.cuit || "-"} &nbsp;|&nbsp;
    <b>Tel:</b> ${cliente.telefono || "-"}
    ${cliente.localidad ? ` &nbsp;|&nbsp; <b>Dir:</b> ${cliente.localidad}` : ""}
    ${Number(saldoTotalCliente || 0) > 0 ? ` &nbsp;|&nbsp; <b>Saldo c/c:</b> <span style="color:#b45309;">${f(Number(saldoTotalCliente))}</span>` : ""}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:18%;">N° Factura</th>
        <th style="width:18%;text-align:right;">Saldo anterior</th>
        <th style="width:18%;text-align:right;">Abonado</th>
        <th style="width:18%;text-align:right;">Saldo restante</th>
        <th style="width:28%;text-align:center;">Estado</th>
      </tr>
    </thead>
    <tbody>${filasFacturas}</tbody>
  </table>
  ${resumenHtml}
  ${bloqueChequeHTML(cheques)}
  <div class="total-box"><div class="total-inner">
    <div class="total-pagado">
      <p class="total-pagado-label">${Number(creditoAplicado || 0) > 0 ? "Total aplicado" : "Total recibido"}</p>
      <p class="total-pagado-monto">${f(totalCobrado)}</p>
    </div>
    ${Number(creditoAplicado || 0) > 0 ? `<div style="margin-top:8px;background:#e7f5ff;border:1px solid #1971c2;border-radius:8px;padding:10px 16px;text-align:left;font-size:12px;"><p style="margin:0 0 3px;color:#555;display:flex;justify-content:space-between;"><span>Nota de crédito aplicada:</span><span style="font-weight:700;color:#1971c2;">${f(Number(creditoAplicado))}</span></p><p style="margin:0;color:#555;display:flex;justify-content:space-between;"><span>Efectivo recibido:</span><span style="font-weight:700;color:#2f9e44;">${f(Math.max(0, totalCobrado - Number(creditoAplicado)))}</span></p></div>` : ""}
    ${creditoGenerado && creditoGenerado > 0 ? `<div class="saldo-box" style="margin-top:8px;background:#e7f5ff;border:1px solid #1971c2;color:#1971c2;"><p class="saldo-label">💚 Saldo a favor generado: ${f(Number(creditoGenerado))}</p></div>` : ""}
  </div></div>
  <div class="firma-box">
    <div class="firma-linea">Firma y aclaración<br/><span style="font-size:10px;color:#aaa;">Cliente</span></div>
    <div class="firma-linea">Firma y sello<br/><span style="font-size:10px;color:#aaa;">VETIX Distribuidora</span></div>
  </div>
  <div class="footer">VETIX Distribuidora — Almirante Brown 620 — Tel: 2604518157 — vetix.cf@gmail.com</div>
</div></body></html>`
  const w = window.open("", "_blank")
  if (!w) { alert("Habilitá ventanas emergentes"); return }
  w.document.write(html); w.document.close(); setTimeout(() => w.print(), 600)
}
