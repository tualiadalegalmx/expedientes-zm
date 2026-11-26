import type { Borders, CellValue, Worksheet } from "exceljs";
import { conLetra, type Cotizacion, type Empresa } from "./cotizacion";

export type Logo = { buffer: ArrayBuffer; extension: "png" | "jpeg"; ancho: number; alto: number };

const corta = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };
const venceEl = (c: Cotizacion) => { const d = new Date(c.fecha + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + c.vigencia_dias); return d.toISOString().slice(0, 10); };
const MONEDA = (m: string) => m === "USD" ? '_-"US$"* #,##0.00_-;\\-"US$"* #,##0.00_-;_-"US$"* "-"??_-;_-@_-' : '_-"$"* #,##0.00_-;\\-"$"* #,##0.00_-;_-"$"* "-"??_-;_-@_-';
const argb = (hex: string) => "FF" + (hex || "#2f3a30").replace("#", "").toUpperCase();
const fino = { style: "thin" as const, color: { argb: "FF222222" } };
const caja: Partial<Borders> = { top: fino, left: fino, bottom: fino, right: fino };
/** Alto aproximado de un renglón para que el texto largo no se corte. */
const alto = (texto: string, caracteresPorLinea: number, base = 15) =>
  Math.max(base, texto.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / caracteresPorLinea)), 0) * 12.5 + 4);

/** Arma el .xlsx con el formato de la empresa (sencillo = Poiesis, clásico = TXX), con fórmulas. */
export async function libroCotizacion(c: Cotizacion, e: Empresa, logo?: Logo) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = e.razon_social || e.nombre;
  const ws = wb.addWorksheet(c.folio.slice(0, 31), {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    views: [{ showGridLines: false }],
  });
  const img = logo ? wb.addImage({ buffer: logo.buffer as never, extension: logo.extension }) : null;
  if (e.plantilla === "clasica") clasica(ws, c, e, img, logo);
  else sencilla(ws, c, e, img, logo);
  return wb;
}

function poner(ws: Worksheet, ref: string, valor: CellValue, estilo: Record<string, unknown> = {}) {
  const cell = ws.getCell(ref);
  cell.value = valor;
  Object.assign(cell, estilo);
  return cell;
}

// ------------------------------------------------------------------ Clásica (TXX)
function clasica(ws: Worksheet, c: Cotizacion, e: Empresa, img: number | null, logo?: Logo) {
  const F = { name: "Calibri", size: 11 };
  const color = argb(e.color);
  const banda = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: color } };
  const blanco = { ...F, bold: true, color: { argb: "FFFFFFFF" } };
  ws.columns = [{ width: 1.4 }, { width: 14 }, { width: 25 }, { width: 29 }, { width: 7.5 }, { width: 12.5 }, { width: 14 }, { width: 2 }];
  const moneda = MONEDA(c.moneda);

  // Logo a la izquierda; datos de la cotización a la derecha
  if (img !== null && logo) {
    const w = 300, h = Math.round((logo.alto / logo.ancho) * w);
    ws.addImage(img, { tl: { col: 1.2, row: 1.3 }, ext: { width: w, height: h } });
  }
  ws.mergeCells("F2:G2"); poner(ws, "F2", "COTIZACIÓN", { font: { ...F, bold: true }, alignment: { horizontal: "center" } });
  ws.mergeCells("F3:G3"); poner(ws, "F3", c.folio, { font: { ...F, bold: true, color: { argb: "FFB36B2C" } }, alignment: { horizontal: "center" } });
  ws.mergeCells("F4:G4"); poner(ws, "F4", `FECHA:    ${corta(c.fecha)}`, { font: { ...F, bold: true }, alignment: { horizontal: "center" } });
  const datos = [e.rfc && ["RFC: ", e.rfc], e.telefono && ["TEL: ", e.telefono], e.correo && ["CORREO: ", e.correo],
    c.numero_proveedor && ["NO. PROVEEDOR: ", c.numero_proveedor]].filter(Boolean) as string[][];
  let r = 5;
  for (const [k, v] of datos) {
    ws.mergeCells(`E${r}:G${r}`);
    poner(ws, `E${r}`, { richText: [{ text: k, font: { ...F, bold: true } }, { text: v, font: F }] });
    r++;
  }
  if (e.razon_social) {
    const fr = img !== null ? 8 : 2;
    ws.mergeCells(`B${fr}:C${fr}`);
    poner(ws, `B${fr}`, e.razon_social.replace(/^TXX\s*/i, "").toUpperCase(), { font: { ...F, bold: true, size: 10, color: { argb: "FF8A6D45" } }, alignment: { horizontal: "center" } });
  }
  r = Math.max(r + 1, 10);

  // Datos del cliente
  ws.mergeCells(`B${r}:G${r}`);
  poner(ws, `B${r}`, "DATOS DEL CLIENTE", { font: blanco, fill: banda, alignment: { horizontal: "center" }, border: caja });
  r++;
  const filas: [string, string | null | undefined, boolean][] = [
    ["NOMBRE:", c.cliente, true], ["ATENCIÓN:", c.atencion, false], ["DIRECCIÓN:", c.cliente_direccion, false],
    ["CORREO:", c.cliente_correo, false], ["TELÉFONO:", c.cliente_tel, false]];
  for (const [k, v, negrita] of filas) {
    if (!v) continue;
    poner(ws, `B${r}`, k, { font: { ...F, bold: true }, alignment: { horizontal: "center", vertical: "middle" }, border: caja });
    ws.mergeCells(`C${r}:G${r}`);
    poner(ws, `C${r}`, v, { font: { ...F, bold: negrita }, alignment: { wrapText: true, vertical: "middle" }, border: caja });
    ws.getRow(r).height = alto(v, 70);
    r++;
  }
  r++;

  // Conceptos
  const enc: [string, string][] = [["B", "CANTIDAD"], ["C", "DESCRIPCIÓN"], ["E", "UNIDAD"], ["F", "P.U. COMPRA"], ["G", "TOTAL"]];
  ws.mergeCells(`C${r}:D${r}`);
  for (const [col, t] of enc) poner(ws, `${col}${r}`, t, { font: { ...blanco, size: 9 }, fill: banda, alignment: { horizontal: "center", vertical: "middle" }, border: caja });
  ws.getCell(`D${r}`).border = caja;
  ws.getRow(r).height = 18;
  const primera = r + 1;
  for (const k of c.conceptos) {
    r++;
    const f9 = { ...F, size: 9 };
    poner(ws, `B${r}`, Number(k.cantidad), { font: f9, numFmt: "#,##0", alignment: { horizontal: "center", vertical: "middle" }, border: caja });
    ws.mergeCells(`C${r}:D${r}`);
    poner(ws, `C${r}`, k.descripcion, { font: f9, alignment: { wrapText: true, vertical: "middle" }, border: caja });
    poner(ws, `E${r}`, k.unidad || "", { font: f9, alignment: { horizontal: "center", vertical: "middle" }, border: caja });
    poner(ws, `F${r}`, Number(k.precio), { font: { ...f9, bold: true }, numFmt: moneda, alignment: { vertical: "middle" }, border: caja });
    poner(ws, `G${r}`, { formula: `B${r}*F${r}`, result: Number(k.cantidad) * Number(k.precio) }, { font: { ...f9, bold: true }, numFmt: moneda, alignment: { vertical: "middle" }, border: caja });
    ws.getRow(r).height = Math.max(30, alto(k.descripcion, 62, 30) * 0.92);
  }
  const ultima = r;
  r++;

  // Totales con fórmulas
  const total = (etq: string, valor: CellValue) => {
    poner(ws, `F${r}`, etq, { font: { ...F, size: 9, bold: true }, alignment: { horizontal: "right" }, border: caja });
    poner(ws, `G${r}`, valor, { font: { ...F, size: 9, bold: true }, numFmt: moneda, border: caja });
    return r++;
  };
  const rSub = total("SUBTOTAL", { formula: `SUM(G${primera}:G${ultima})`, result: Number(c.subtotal) });
  const rDesc = Number(c.descuento) > 0 ? total("DESCUENTO", Number(c.descuento)) : null;
  const pct = Number(c.iva_pct) / 100;
  const base = rDesc ? `(G${rSub}-G${rDesc})` : `G${rSub}`;
  const rIva = total(pct === 0.16 ? "IVA" : `IVA ${Number(c.iva_pct)}%`, { formula: `ROUND(${base}*${pct},2)`, result: Number(c.iva) });
  total("TOTAL", { formula: `${base}+G${rIva}`, result: Number(c.total) });
  ws.mergeCells(`B${rSub}:E${rIva}`);
  poner(ws, `B${rSub}`, conLetra(Number(c.total), c.moneda), { font: { ...F, size: 9, italic: true, color: { argb: "FF444444" } }, alignment: { vertical: "top", wrapText: true } });
  r++;

  if (c.notas) {
    ws.mergeCells(`B${r}:G${r}`);
    poner(ws, `B${r}`, c.notas, { font: { ...F, size: 10 }, alignment: { wrapText: true, vertical: "top" } });
    ws.getRow(r).height = alto(c.notas, 95);
    r += 2;
  }
  if (c.condiciones) {
    const lineas = c.condiciones.split("\n").length;
    const fin = r + Math.max(2, lineas) - 1;
    ws.mergeCells(`B${r}:B${fin}`);
    poner(ws, `B${r}`, "CONDICIONES COMERCIALES:", { font: blanco, fill: banda, alignment: { horizontal: "center", vertical: "middle", wrapText: true }, border: caja });
    ws.mergeCells(`C${r}:G${fin}`);
    poner(ws, `C${r}`, c.condiciones, { font: { ...F, size: 8, bold: true }, alignment: { wrapText: true, vertical: "top" }, border: caja });
    for (let i = r; i <= fin; i++) ws.getRow(i).height = Math.max(15, (lineas * 11.5 + 6) / (fin - r + 1));
    r = fin + 2;
  }
  firma(ws, r, e, "B", "G", F);
}

// ------------------------------------------------------------------ Sencilla (Poiesis)
function sencilla(ws: Worksheet, c: Cotizacion, e: Empresa, img: number | null, logo?: Logo) {
  const F = { name: "Arial", size: 11 };
  ws.columns = [{ width: 16.3 }, { width: 11 }, { width: 7.1 }, { width: 10.1 }, { width: 10 }, { width: 13.9 }, { width: 10.3 }, { width: 12.7 }, { width: 13 }];
  const moneda = MONEDA(c.moneda);
  const gris = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD9D9D9" } };
  const linea = { bottom: { style: "thin" as const, color: { argb: "FF555555" } } };

  if (img !== null && logo) {
    const w = 98, h = Math.round((logo.alto / logo.ancho) * w);
    ws.addImage(img, { tl: { col: 0.15, row: 0.1 }, ext: { width: w, height: h } });
  } else if (!logo) {
    poner(ws, "A1", e.razon_social || e.nombre, { font: { ...F, bold: true } });
  }
  ws.mergeCells("A1:I1");
  poner(ws, "A1", "COTIZACIÓN", { font: { ...F, size: 20, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });
  ws.getRow(1).height = 75;
  ws.mergeCells("G2:H2");
  poner(ws, "G2", "No. Cotización:", { font: { ...F, bold: true }, alignment: { horizontal: "right" } });
  poner(ws, "I2", c.folio, { font: { ...F, bold: true, color: { argb: "FF1F4F99" } }, alignment: { horizontal: "center" } });

  let r = 3;
  const filas: [string, string | null | undefined][] = [
    ["Cliente:", c.cliente], ["Atención:", c.atencion], ["Teléfono:", c.cliente_tel || "N/A"], ["Correo:", c.cliente_correo],
    ["Fecha:", corta(c.fecha)], ["Vigencia:", corta(venceEl(c))], ["Dirección:", c.cliente_direccion], ["No. Proveedor:", c.numero_proveedor]];
  for (const [k, v] of filas) {
    if (!v) continue;
    poner(ws, `A${r}`, k, { font: { ...F, bold: true }, border: linea, alignment: { vertical: "top" } });
    ws.mergeCells(`B${r}:I${r}`);
    poner(ws, `B${r}`, v, { font: F, border: linea, alignment: { wrapText: true, vertical: "top" } });
    ws.getRow(r).height = alto(v, 66);
    r++;
  }

  // Conceptos
  const enc: [string, string][] = [["A", "No."], ["B", "Descripción"], ["F", "Unidad"], ["G", "Cantidad"], ["H", "P. Unitario"], ["I", "Importe"]];
  ws.mergeCells(`B${r}:E${r}`);
  for (const [col, t] of enc) poner(ws, `${col}${r}`, t, { font: { ...F, bold: true }, fill: gris, alignment: { horizontal: "center" }, border: caja });
  const primera = r + 1;
  c.conceptos.forEach((k, i) => {
    r++;
    poner(ws, `A${r}`, i + 1, { font: F, alignment: { horizontal: "center", vertical: "top" }, border: caja });
    ws.mergeCells(`B${r}:E${r}`);
    poner(ws, `B${r}`, k.descripcion, { font: F, alignment: { wrapText: true, vertical: "top" }, border: caja });
    poner(ws, `F${r}`, k.unidad || "", { font: F, alignment: { horizontal: "center", vertical: "top" }, border: caja });
    poner(ws, `G${r}`, Number(k.cantidad), { font: F, alignment: { horizontal: "center", vertical: "top" }, border: caja });
    poner(ws, `H${r}`, Number(k.precio), { font: F, numFmt: moneda, alignment: { vertical: "top" }, border: caja });
    poner(ws, `I${r}`, { formula: `G${r}*H${r}`, result: Number(k.cantidad) * Number(k.precio) }, { font: F, numFmt: moneda, alignment: { vertical: "top" }, border: caja });
    ws.getRow(r).height = alto(k.descripcion, 40);
  });
  const ultima = r;
  r += 2;

  // Totales (abarcan TODOS los conceptos)
  const total = (etq: string, valor: CellValue, negrita = false) => {
    poner(ws, `E${r}`, etq, { font: { ...F, bold: negrita }, border: negrita ? caja : undefined });
    poner(ws, `F${r}`, valor, { font: { ...F, bold: negrita }, numFmt: moneda, border: negrita ? caja : undefined });
    return r++;
  };
  const rSub = total("Subtotal", { formula: `SUM(I${primera}:I${ultima})`, result: Number(c.subtotal) });
  const rDesc = Number(c.descuento) > 0 ? total("Descuento", Number(c.descuento)) : null;
  const pct = Number(c.iva_pct) / 100;
  const base = rDesc ? `(F${rSub}-F${rDesc})` : `F${rSub}`;
  const rIva = total(pct === 0.16 ? "IVA" : `IVA ${Number(c.iva_pct)}%`, { formula: `ROUND(${base}*${pct},2)`, result: Number(c.iva) });
  total("Total", { formula: `${base}+F${rIva}`, result: Number(c.total) }, true);
  ws.mergeCells(`B${r}:I${r}`);
  poner(ws, `B${r}`, conLetra(Number(c.total), c.moneda), { font: { ...F, size: 9, italic: true, color: { argb: "FF444444" } }, alignment: { horizontal: "center" } });
  r += 3;

  if (c.notas) {
    ws.mergeCells(`A${r}:I${r}`);
    poner(ws, `A${r}`, c.notas, { font: F, alignment: { wrapText: true, vertical: "top" } });
    ws.getRow(r).height = alto(c.notas, 95);
    r += 2;
  }
  if (c.condiciones) {
    poner(ws, `A${r}`, "Condiciones:", { font: { ...F, bold: true }, alignment: { horizontal: "right", vertical: "top" } });
    ws.mergeCells(`B${r}:I${r}`);
    poner(ws, `B${r}`, c.condiciones, { font: F, alignment: { wrapText: true, vertical: "top" } });
    ws.getRow(r).height = alto(c.condiciones, 80);
    r += 3;
  }
  r = firma(ws, r, e, "D", "G", F) + 4;
  if (e.pie) {
    ws.mergeCells(`A${r}:I${r}`);
    poner(ws, `A${r}`, e.pie, { font: F, alignment: { horizontal: "center" } });
  }
}

function firma(ws: Worksheet, r: number, e: Empresa, de: string, a: string, F: { name: string; size: number }) {
  if (!e.firmante_nombre) return r;
  ws.mergeCells(`${de}${r}:${a}${r}`);
  poner(ws, `${de}${r}`, "ATENTAMENTE", { font: { ...F, bold: true }, alignment: { horizontal: "center" } });
  r += 3;
  ws.mergeCells(`${de}${r}:${a}${r}`);
  poner(ws, `${de}${r}`, e.firmante_nombre, { font: F, alignment: { horizontal: "center" } });
  if (e.firmante_cargo) {
    r++;
    ws.mergeCells(`${de}${r}:${a}${r}`);
    poner(ws, `${de}${r}`, e.firmante_cargo, { font: F, alignment: { horizontal: "center" } });
  }
  return r;
}
