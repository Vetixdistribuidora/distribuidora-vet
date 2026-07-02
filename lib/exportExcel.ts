// Exportación de Excel con el formato VETIX: logo centrado en la fila 1,
// encabezados en navy negrita sobre rosa claro, y datos en navy negrita.
// Usa exceljs (carga diferida) porque SheetJS no soporta imágenes ni estilos.

export interface ColExcel {
  header: string
  width: number
  align?: "left" | "center" | "right"
  numFmt?: string
}

const NAVY = "FF15264A"   // texto navy (marca)
const PINK = "FFFFE7FF"   // relleno rosa claro de los encabezados

export async function exportarExcelVetix(opts: {
  archivo: string
  hoja: string
  columnas: ColExcel[]
  filas: (string | number)[][]
}) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(opts.hoja, { views: [{ showGridLines: false }] })
  const nCols = opts.columnas.length

  // Estilo por columna (rápido: se aplica a todas las celdas de la columna)
  ws.columns = opts.columnas.map(c => ({
    width: c.width,
    style: {
      font: { bold: true, size: 12, color: { argb: NAVY } },
      alignment: { horizontal: c.align || "center", vertical: "middle" as const },
      ...(c.numFmt ? { numFmt: c.numFmt } : {}),
    },
  }))

  // ── Fila 1: logo VETIX centrado ──
  ws.mergeCells(1, 1, 1, nCols)
  ws.getRow(1).height = 92
  try {
    const res = await fetch("/logo.png")
    if (res.ok) {
      const buf = await res.arrayBuffer()
      const imgId = wb.addImage({ buffer: buf, extension: "png" })
      const imgW = 180, imgH = 120  // logo 3:2 (navy + rosa)
      // Centrar horizontalmente sobre el ancho total de las columnas
      const widthsPx = opts.columnas.map(c => c.width * 7 + 5)
      const totalPx = widthsPx.reduce((s, w) => s + w, 0)
      let offset = Math.max(0, (totalPx - imgW) / 2)
      let tlCol = 0
      for (let i = 0; i < widthsPx.length; i++) {
        if (offset < widthsPx[i]) { tlCol = i + offset / widthsPx[i]; break }
        offset -= widthsPx[i]
        tlCol = i + 1
      }
      ws.addImage(imgId, { tl: { col: tlCol, row: 0.06 }, ext: { width: imgW, height: imgH }, editAs: "oneCellAnchor" })
    }
  } catch { /* si falla el fetch del logo, se exporta sin logo */ }

  // ── Fila 2: encabezados (relleno rosa) ──
  const hr = ws.getRow(2)
  hr.height = 22
  opts.columnas.forEach((c, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = c.header
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } }
  })

  // ── Datos desde fila 3 (heredan el estilo de columna) ──
  ws.addRows(opts.filas)

  // ── Descargar ──
  const outBuf = await wb.xlsx.writeBuffer()
  const blob = new Blob([outBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = opts.archivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
