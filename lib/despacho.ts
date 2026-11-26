import type { SupabaseClient } from "@supabase/supabase-js";
import { diasDesde, diasRestantes, hoy } from "@/lib/fechas";

/** Quién puede ver el tablero y el reporte: Zaida (admin) y Ricardo (desarrollo). */
/** Quién puede dejar un plazo "sin efecto": Zaida, Rafael y Ricardo. */
export const puedeAnularPlazo = (rol: string) => rol === "admin" || rol === "administrativo" || rol === "desarrollo";

/** Quién puede eliminar expedientes: Zaida, Rafael y Ricardo. */
export const puedeEliminarExpediente = (rol: string) => rol === "admin" || rol === "administrativo" || rol === "desarrollo";

export const puedeVerTablero = (rol: string) => rol === "admin" || rol === "desarrollo";

export type Persona = { id: string; nombre: string; rol: string };
export type Exp = { id: string; numero: string; cliente: string; juzgado: string; responsable_id: string; responsable: string; ultimo_movimiento: string; estado: string; created_at: string };
export type Plazo = { id: string; expediente_id: string; vencimiento: string; actuacion: string; estado: string; cumplido_fecha: string | null; created_by: string; numero: string; responsable_id: string };
export type Registro = { id: string; tipo: string; fecha: string; created_by: string; created_at: string; expediente_id: string; descripcion: string; cumplido: boolean; responsable_id: string | null; fecha_compromiso: string | null };
export type Tarea = { id: string; responsable_id: string; titulo: string; estado: string; fecha_limite: string | null; terminada_at: string | null };

export function sumarDias(iso: string, n: number) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Lunes de la semana de una fecha. */
export function lunesDe(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return sumarDias(iso, -((d.getUTCDay() + 6) % 7));
}
/** Fecha local (Ciudad de México) de un momento timestamptz. */
export const diaLocal = (ts: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date(ts));

/** Carga todo lo necesario para el tablero y el reporte. desde = primer día de actividad a traer. */
export async function cargarDespacho(sb: SupabaseClient, desde: string) {
  const [p, e, pl, b, t] = await Promise.all([
    sb.from("perfiles").select("id, nombre, rol").eq("activo", true).order("nombre"),
    sb.from("v_expedientes").select("id, numero, cliente, juzgado, responsable_id, responsable, ultimo_movimiento, estado, created_at"),
    sb.from("plazos").select("id, expediente_id, vencimiento, actuacion, estado, cumplido_fecha, created_by, expedientes(numero, responsable_id)").neq("estado", "sin_efecto"),
    sb.from("bitacora").select("id, tipo, fecha, created_by, created_at, expediente_id, descripcion, cumplido, responsable_id, fecha_compromiso")
      .or(`created_at.gte.${desde},and(tipo.eq.pendiente,cumplido.eq.false)`),
    sb.from("tareas").select("id, responsable_id, titulo, estado, fecha_limite, terminada_at"),
  ]);
  const plazos: Plazo[] = ((pl.data ?? []) as unknown as (Omit<Plazo, "numero" | "responsable_id"> & { expedientes: { numero: string; responsable_id: string } | null })[])
    .map((x) => ({ ...x, numero: x.expedientes?.numero ?? "", responsable_id: x.expedientes?.responsable_id ?? "" }));
  return {
    personas: (p.data ?? []) as Persona[],
    expedientes: (e.data ?? []) as Exp[],
    plazos,
    registros: (b.data ?? []) as Registro[],
    tareas: (t.error ? [] : t.data ?? []) as Tarea[],
  };
}

/** Indicadores por abogado (o cualquier persona con expedientes). */
export function resumenPorPersona(d: Awaited<ReturnType<typeof cargarDespacho>>, desde: string, hasta: string) {
  const h = hoy();
  return d.personas.map((u) => {
    const exps = d.expedientes.filter((x) => x.responsable_id === u.id && x.estado === "activo");
    const abiertos = d.plazos.filter((x) => x.responsable_id === u.id && x.estado === "abierto");
    const regs = d.registros.filter((r) => r.created_by === u.id);
    const regsPeriodo = regs.filter((r) => { const f = diaLocal(r.created_at); return f >= desde && f <= hasta; });
    const ultimo = regs.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);
    return {
      ...u,
      expedientes: exps.length,
      sinMovimiento: exps.filter((x) => diasDesde(x.ultimo_movimiento) >= 3).length,
      plazosAbiertos: abiertos.length,
      vencidos: abiertos.filter((x) => x.vencimiento < h).length,
      proximos: abiertos.filter((x) => x.vencimiento >= h && diasRestantes(x.vencimiento, h) <= 5).length,
      registros: regsPeriodo.length,
      ultimoRegistro: ultimo,
      pendientesAtrasados: d.registros.filter((r) => r.tipo === "pendiente" && !r.cumplido && r.responsable_id === u.id && r.fecha_compromiso && r.fecha_compromiso < h).length,
    };
  });
}
