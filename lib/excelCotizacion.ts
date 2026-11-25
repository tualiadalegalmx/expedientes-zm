import type { CellValue } from "exceljs";
import { conLetra, type Cotizacion, type Empresa } from "./cotizacion";

const fechaTxt = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

/** Arma el .xlsx con fórmulas para que se pueda seguir editando. */
export async function libroCotizacion(c: Cotizacion, e: Empresa) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Expedientes · Zaida Marmen";
  const ws = wb.addWorksheet(c.folio, { pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } } });
  const color = (e.color || "#2f3a30").replace("#", "FF");
  const moneda = c.moneda === "USD" ? '"US$"#,##0.00' : '"$"#,##0.00';
  const fuente = { name: "Arial", size: 10 };
  ws.columns = [{ width: 6 }, { width: 52 }, { width: 12 }, { width: 11 }, { width: 16 }, { width: 17 }];
  ws.properties.defaultRowHeight = 16;

  // Encabezado de la empresa
  ws.mergeCells("A1:F1");
  Object.assign(ws.getCell("A1"), { value: e.razon_social || e.nombre });
  ws.getCell("A1").font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  ws.getRow(1).height = 30;
  ws.getCell("A1").alignment = { vertical: "middle", indent: 1 };
  const datosEmp = [e.rfc && `RFC: ${e.rfc}`, e.direccion, [e.telefono, e.correo].filter(Boolean).join("  ·  ")].filter(Boolean) as string[];
  datosEmp.forEach((t, i) => {
    ws.mergeCells(`A${2 + i}:F${2 + i}`);
    ws.getCell(`A${2 + i}`).value = t;
    ws.getCell(`A${2 + i}`).font = { ...fuente, color: { argb: "FF555555" } };
  });
  let r = 3 + datosEmp.length;

  // Título y datos de la cotización
  ws.getCell(`A${r}`).value = "COTIZACIÓN";
  ws.getCell(`A${r}`).font = { name: "Arial", size: 14, bold: true, color: { argb: color } };
  const dato = (etq: string, valor: string, negrita = false) => {
    ws.getCell(`D${r}`).value = etq;
    ws.getCell(`D${r}`).font = { ...fuente, color: { argb: "FF666666" } };
    ws.getCell(`D${r}`).alignment = { horizontal: "right" };
    ws.mergeCells(`E${r}:F${r}`);
    ws.getCell(`E${r}`).value = valor;
    ws.getCell(`E${r}`).font = { ...fuente, bold: negrita };
    ws.getCell(`E${r}`).alignment = { horizontal: "right" };
  };
  dato("Folio", c.folio, true);
  r++;
  const vence = new Date(c.fecha + "T00:00:00Z"); vence.setUTCDate(vence.getUTCDate() + c.vigencia_dias);
  dato("Fecha", fechaTxt(c.fecha)); r++;
  dato("Vigente hasta", fechaTxt(vence.toISOString().slice(0, 10))); r++;
  r++;
  ([["Cliente", c.cliente], ["Atención", c.atencion], ["Correo", c.cliente_correo], ["Teléfono", c.cliente_tel]] as const).forEach(([k, v]) => {
    if (!v) return;
    ws.mergeCells(`A${r}:F${r}`);
    ws.getCell(`A${r}`).value = { richText: [{ text: `${k}: `, font: { ...fuente, bold: true } }, { text: v, font: { ...fuente, bold: k === "Cliente", size: k === "Cliente" ? 11 : 10 } }] };
    r++;
  });
  r++;

  // Tabla de conceptos
  const enc = ["#", "Descripción", "Unidad", "Cantidad", "Precio unitario", "Importe"];
  const filaEnc = ws.getRow(r);
  enc.forEach((t, i) => {
    const cell = filaEnc.getCell(i + 1);
    cell.value = t;
    cell.font = { ...fuente, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cell.alignment = { vertical: "middle", horizontal: i >= 3 ? "right" : "left" };
  });
  filaEnc.height = 20;
  const primera = r + 1;
  c.conceptos.forEach((k, i) => {
    r++;
    const row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = k.descripcion;
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    row.getCell(3).value = k.unidad || "";
    row.getCell(4).value = Number(k.cantidad);
    row.getCell(5).value = Number(k.precio);
    row.getCell(5).numFmt = moneda;
    row.getCell(6).value = { formula: `D${r}*E${r}`, result: Number(k.cantidad) * Number(k.precio) };
    row.getCell(6).numFmt = moneda;
    for (let j = 1; j <= 6; j++) {
      row.getCell(j).border = { bottom: { style: "thin", color: { argb: "FFD8D1C4" } } };
      if (j !== 2) row.getCell(j).alignment = { vertical: "top", horizontal: j >= 4 ? "right" : "left" };
      if (!row.getCell(j).font) row.getCell(j).font = fuente;
    }
    row.height = Math.max(16, Math.ceil(k.descripcion.length / 60) * 15);
  });
  const ultima = r;
  r += 2;

  // Totales con fórmulas
  const total = (etq: string, valor: CellValue, negrita = false) => {
    ws.getCell(`E${r}`).value = etq;
    ws.getCell(`E${r}`).alignment = { horizontal: "right" };
    ws.getCell(`F${r}`).value = valor;
    ws.getCell(`F${r}`).numFmt = moneda;
    ws.getCell(`E${r}`).font = ws.getCell(`F${r}`).font = { ...fuente, bold: negrita, size: negrita ? 12 : 10 };
    return r++;
  };
  const rSub = total("Subtotal", { formula: `SUM(F${primera}:F${ultima})`, result: Number(c.subtotal) });
  const rDesc = total("Descuento", Number(c.descuento));
  ws.getCell(`D${r}`).value = Number(c.iva_pct) / 100;
  ws.getCell(`D${r}`).numFmt = "0%";
  ws.getCell(`D${r}`).note = "Cambia el porcentaje de IVA aquí";
  const rIva = total("IVA", { formula: `ROUND((F${rSub}-F${rDesc})*D${r},2)`, result: Number(c.iva) });
  const rTot = total("Total", { formula: `F${rSub}-F${rDesc}+F${rIva}`, result: Number(c.total) }, true);
  ws.getCell(`F${rTot}`).fill = ws.getCell(`E${rTot}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3EEE5" } };
  ws.getCell(`F${rTot}`).border = { top: { style: "medium", color: { argb: color } } };
  r++;
  ws.mergeCells(`A${r}:F${r}`);
  ws.getCell(`A${r}`).value = `Importe con letra: ${conLetra(Number(c.total), c.moneda)}`;
  ws.getCell(`A${r}`).font = { ...fuente, italic: true };
  r += 2;

  for (const [titulo, texto] of [["Notas", c.notas], ["Condiciones", c.condiciones]] as const) {
    if (!texto) continue;
    ws.getCell(`A${r}`).value = titulo;
    ws.getCell(`A${r}`).font = { ...fuente, bold: true, color: { argb: color } };
    r++;
    ws.mergeCells(`A${r}:F${r}`);
    ws.getCell(`A${r}`).value = texto;
    ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = Math.max(18, (texto.split("\n").length + Math.ceil(texto.length / 110)) * 14);
    r += 2;
  }

  ws.eachRow((row) => row.eachCell((cell) => { if (!cell.font?.name) cell.font = { ...fuente, ...(cell.font ?? {}) }; }));
  return wb;
}

