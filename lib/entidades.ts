export type Entidad = { id: number; nombre: string; tipo: "fisica" | "moral"; color: string; rfc: string | null; orden: number; activa: boolean };
export type Documento = {
  id: string; entidad_id: number; categoria: string; periodo: string; nombre: string; ruta: string;
  tipo_mime: string | null; bytes: number | null; notas: string | null; created_by: string; created_at: string;
};

export const BUCKET_DOCS = "documentos-empresas";

/** Zaida, Rafael y Ricardo suben y eliminan; todos consultan y descargan. */
export const puedeSubirDocs = (rol: string) => rol === "admin" || rol === "administrativo" || rol === "desarrollo";

export const CATEGORIAS = [
  "Constancia de situación fiscal",
  "Opinión de cumplimiento SAT (32-D)",
  "Opinión de cumplimiento IMSS",
  "Opinión de cumplimiento INFONAVIT",
  "Constancia de no adeudo estatal",
  "Comprobante de domicilio",
  "Estado de cuenta bancario",
  "Acta constitutiva",
  "Poder notarial",
  "Identificación oficial",
  "Otro",
];

/** Texto blanco u oscuro según el color de fondo, para que siempre se lea. */
export function textoSobre(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? "#1d1d1b" : "#ffffff";
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-12-01" → "Diciembre 2026" */
export const nombreMes = (iso: string) => { const [a, m] = iso.split("-"); return `${MESES[Number(m) - 1].replace(/^./, (c) => c.toUpperCase())} ${a}`; };

export function tamano(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
