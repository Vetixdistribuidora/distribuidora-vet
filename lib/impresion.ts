// lib/impresion.ts
// Generación de HTML para impresión de presupuesto y remito.
// Compartido entre ventas y clientes para garantizar formato idéntico.

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
}

export function generarHTMLEImprimir(datos: DatosImpresion, tipo: "presupuesto" | "remito" = "presupuesto") {
  const { nroFactura, clienteSeleccionado, carrito, subtotal, ivaNum, total, esCuentaCorriente, metodoCobro } = datos
  const logoUrl = window.location.origin + "/logo.png"
  const fecha = datos.fecha || new Date().toLocaleDateString("es-AR")
  const f = (num: number) => "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const esRemito = tipo === "remito"
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
  const html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'/><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial;background:#e5e7eb}.acciones{display:flex;gap:10px;padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;position:sticky;top:0;z-index:10}.page{width:180mm;min-height:267mm;margin:16px auto;background:white;padding:16px;display:flex;flex-direction:column;box-shadow:0 2px 8px rgba(0,0,0,.12)}.logo{height:130px;display:block}.empresa-info{font-size:11px;color:#555;margin-top:1px;line-height:1.5}.header{display:flex;justify-content:space-between;align-items:flex-start}.header-right{text-align:center;padding-top:4px}.header-right h2{margin:0;font-size:18px}.nro-factura{font-size:13px;color:#555;margin-top:4px}.cliente-row{margin-top:12px;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:5px;font-size:12px;line-height:1.9}.contenido{flex:1}table{width:100%;margin-top:14px;border-collapse:collapse;table-layout:fixed}th{border:1px solid #ccc;padding:4px 4px;background:#eee;font-size:10px;white-space:nowrap;overflow:hidden}td{padding:5px 6px;text-align:center;font-size:11px;border-bottom:1px solid #f0f0f0;word-break:break-word}.totales{margin-top:16px;display:flex;justify-content:flex-end;page-break-inside:avoid;break-inside:avoid}.box{width:250px;border-top:2px solid #333;padding-top:8px}.box p{margin:4px 0;font-size:12px}.box h2{margin:10px 0 4px;font-size:20px}@media(max-width:640px){.page{width:100%;margin:0;padding:12px;min-height:auto;box-shadow:none;border-radius:0}.logo{height:70px}.acciones{gap:8px;padding:10px 12px}.acciones button{flex:1;font-size:15px!important;padding:14px 10px!important}th{font-size:9px;padding:3px 2px}td{font-size:10px;padding:4px 3px}.totales .box{width:100%}}@media print{body{background:white}.acciones{display:none}.page{width:100%;min-height:calc(297mm - 30mm);margin:0;padding:0;box-shadow:none}tr{page-break-inside:avoid;break-inside:avoid}.totales{break-inside:avoid;page-break-inside:avoid}}</style></head><body><div class='acciones'><button onclick='window.close();window.history.back();' style='background:#f1f5f9;border:1px solid #d1d5db;border-radius:8px;padding:10px 18px;font-size:14px;font-family:Arial;cursor:pointer;color:#374151;font-weight:600'>&#8592; Volver</button><button onclick='window.print()' style='background:#0f172a;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-family:Arial;cursor:pointer;color:white;font-weight:700'>&#128438; Imprimir</button></div><div class='page'><div class='contenido'><div class='header'><div><img src='" + logoUrl + "' class='logo'/><div class='empresa-info'>Almirante Brown 620<br/>Tel: 2604518157<br/>Email: vetix.cf@gmail.com</div></div><div class='header-right'><h2>" + titulo + "</h2><div class='nro-factura'><b style='font-size:15px;color:#111'>N° 001-" + nroFactura + "</b><br/><span style='font-size:12px;color:#555'>Fecha: " + fecha + "</span></div>" + badgeCC + "</div></div><div class='cliente-row'><b>Cliente:</b> " + clienteSeleccionado.nombre + " " + clienteSeleccionado.apellido + " &nbsp;|&nbsp; <b>CUIT:</b> " + (clienteSeleccionado.cuit || "-") + " &nbsp;|&nbsp; <b>Dir:</b> " + (clienteSeleccionado.localidad || "-") + " &nbsp;|&nbsp; <b>Tel:</b> " + (clienteSeleccionado.telefono || "-") + "</div><table><thead>" + theadCols + "</thead><tbody>" + filas + "</tbody></table></div>" + totalesHTML + "</div></body></html>"
  const ventana = window.open("", "_blank")
  if (!ventana) { alert("Habilita ventanas emergentes"); return }
  ventana.document.write(html); ventana.document.close()
}
