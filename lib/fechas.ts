// Fechas como texto "AAAA-MM-DD" (sin hora) para evitar saltos de zona horaria.

export const ZONA = "America/Mexico_City";

export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

function aFecha(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
function aIso(f: Date) {
  return f.toISOString().slice(0, 10);
}
const esFinDeSemana = (f: Date) => f.getUTCDay() === 0 || f.getUTCDay() === 6;

/**
 * Vencimiento de un plazo. El conteo empieza el día siguiente a la fecha en que
 * surte efectos la notificación. En días hábiles salta sábados, domingos y las
 * fechas de `inhabiles` (calendario por autoridad; se carga en la Fase 2).
 * Las horas se cuentan en bloques de 24 h desde la fecha en que surte efectos.
 */
export function calcularVencimiento(
  surteEfectos: string,
  cantidad: number,
  unidad: "dias" | "horas",
  tipo: "habiles" | "naturales",
  inhabiles: Set<string> = new Set(),
): string {
  const f = aFecha(surteEfectos);
  let restantes = unidad === "horas" ? Math.ceil(cantidad / 24) : cantidad;
  while (restantes > 0) {
    f.setUTCDate(f.getUTCDate() + 1);
    if (tipo === "naturales" || (!esFinDeSemana(f) && !inhabiles.has(aIso(f)))) restantes--;
  }
  return aIso(f);
}

/** Días que faltan para el vencimiento (negativo si ya pasó). Cuenta hábiles. */
export function diasRestantes(vencimiento: string, desde = hoy()): number {
  const a = aFecha(desde), b = aFecha(vencimiento);
  if (+b === +a) return 0;
  const signo = b > a ? 1 : -1;
  let n = 0;
  const f = new Date(a);
  while (+f !== +b) {
    f.setUTCDate(f.getUTCDate() + signo);
    if (!esFinDeSemana(f)) n += signo;
  }
  return n;
}

export type Semaforo = "verde" | "amarillo" | "rojo" | "vencido";

/** Verde: más de 5 días · amarillo: 3 a 5 · rojo: 2 o menos · vencido. */
export function semaforo(restantes: number): Semaforo {
  if (restantes < 0) return "vencido";
  if (restantes <= 2) return "rojo";
  if (restantes <= 5) return "amarillo";
  return "verde";
}

/** Días naturales transcurridos desde un momento (para "sin movimiento"). */
export function diasDesde(momento: string): number {
  return Math.floor((aFecha(hoy()).getTime() - aFecha(momento.slice(0, 10)).getTime()) / 86_400_000);
}

const fmtCorta = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtLarga = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const fecha = (iso?: string | null) => (iso ? fmtCorta.format(aFecha(iso)) : "—");
export const fechaLarga = (iso: string) => fmtLarga.format(aFecha(iso));

export function textoRestantes(n: number): string {
  if (n < 0) return n === -1 ? "Venció hace 1 día hábil" : `Venció hace ${-n} días hábiles`;
  if (n === 0) return "Vence hoy";
  if (n === 1) return "Vence mañana";
  return `Faltan ${n} días hábiles`;
}
