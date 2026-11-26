export type Concepto = { descripcion: string; unidad?: string; cantidad: number; precio: number };
export type Empresa = {
  id: number; nombre: string; razon_social: string | null; rfc: string | null; direccion: string | null;
  telefono: string | null; correo: string | null; prefijo: string; color: string; condiciones: string | null; activa: boolean;
  plantilla?: "sencilla" | "clasica"; logo?: string | null; firmante_nombre?: string | null; firmante_cargo?: string | null;
  pie?: string | null; numero_proveedor?: string | null; folio_con_anio?: boolean;
};
export type Cotizacion = {
  id: string; empresa_id: number; folio: string; fecha: string; vigencia_dias: number; cliente: string;
  atencion: string | null; cliente_correo: string | null; cliente_tel: string | null; moneda: string;
  conceptos: Concepto[]; iva_pct: number; descuento: number; subtotal: number; iva: number; total: number;
  notas: string | null; condiciones: string | null; estado: string; created_by: string; created_at: string;
  cliente_direccion?: string | null; numero_proveedor?: string | null;
};

/** Zaida, Rafael y Ricardo. */
export const puedeCotizar = (rol: string) => rol === "admin" || rol === "administrativo" || rol === "desarrollo";

export const ESTADOS_COT = { borrador: "Borrador", enviada: "Enviada", aceptada: "Aceptada", rechazada: "Rechazada" } as const;

export function totales(conceptos: Concepto[], ivaPct: number, descuento = 0) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const subtotal = r(conceptos.reduce((s, c) => s + (Number(c.cantidad) || 0) * (Number(c.precio) || 0), 0));
  const desc = Math.min(Math.max(Number(descuento) || 0, 0), subtotal);
  const iva = r((subtotal - desc) * (Number(ivaPct) || 0) / 100);
  return { subtotal, descuento: desc, iva, total: r(subtotal - desc + iva) };
}

export const dinero = (n: number, moneda = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda, minimumFractionDigits: 2 }).format(Number(n) || 0);

// ---------------------------------------------------------------- Importe con letra
const U = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE",
  "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIÚN", "VEINTIDÓS", "VEINTITRÉS",
  "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

function cientos(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  let t = C[c];
  if (r) t += (t ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : ""));
  return t;
}
function entero(n: number): string {
  if (n === 0) return "CERO";
  const millones = Math.floor(n / 1_000_000), miles = Math.floor((n % 1_000_000) / 1000), resto = n % 1000;
  const partes: string[] = [];
  if (millones) partes.push(millones === 1 ? "UN MILLÓN" : `${entero(millones)} MILLONES`);
  if (miles) partes.push(miles === 1 ? "MIL" : `${cientos(miles)} MIL`);
  if (resto) partes.push(cientos(resto));
  return partes.join(" ");
}
/** 4524.5 → "CUATRO MIL QUINIENTOS VEINTICUATRO PESOS 50/100 M.N." */
export function conLetra(n: number, moneda = "MXN") {
  const v = Math.round((Number(n) || 0) * 100);
  const e = Math.floor(v / 100), cts = String(v % 100).padStart(2, "0");
  const millonExacto = e >= 1_000_000 && e % 1_000_000 === 0;
  const nombre = moneda === "USD" ? (e === 1 ? "DÓLAR" : "DÓLARES") : e === 1 ? "PESO" : "PESOS";
  return `${entero(e)}${millonExacto ? " DE" : ""} ${nombre} ${cts}/100 ${moneda === "USD" ? "USD" : "M.N."}`;
}
