import { cache } from "react";
import { usuarioActual } from "@/lib/supabase/server";
import { diasRestantes, fecha, hoy } from "@/lib/fechas";

export type Nivel = "vencido" | "hoy" | "pronto" | "recordatorio";
export type Recordatorio = { nivel: Nivel; texto: string; cuando: string; href: string; orden: string; quien?: string };

const NIVEL_ORDEN: Record<Nivel, number> = { vencido: 0, hoy: 1, pronto: 2, recordatorio: 3 };

function sumarDias(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diasNaturales = (de: string, a: string) =>
  Math.round((new Date(a + "T00:00:00Z").getTime() - new Date(de + "T00:00:00Z").getTime()) / 86_400_000);

/**
 * Lo que requiere atención de la persona que entró. Zaida (admin) ve los
 * plazos y pendientes de todo el despacho; los demás, solo lo suyo.
 * Si alguna migración no se ha corrido, esa parte simplemente no aparece.
 */
export const recordatorios = cache(async (): Promise<Recordatorio[]> => {
  const { sb, perfil, esAdmin } = await usuarioActual();
  const h = hoy();
  const limite = sumarDias(h, 45);
  const out: Recordatorio[] = [];

  type Exp = { expedientes: { numero: string; responsable_id: string } | null };

  let pl = await sb.from("plazos")
    .select("id, vencimiento, actuacion, recordar_dias, created_by, expediente_id, expedientes(numero, responsable_id)")
    .eq("estado", "abierto").lte("vencimiento", limite);
  if (pl.error) pl = await sb.from("plazos")
    .select("id, vencimiento, actuacion, created_by, expediente_id, expedientes(numero, responsable_id)")
    .eq("estado", "abierto").lte("vencimiento", limite) as typeof pl;

  const [pe, ag, ta, us] = await Promise.all([
    sb.from("bitacora").select("id, descripcion, fecha_compromiso, responsable_id, expediente_id, expedientes(numero)")
      .eq("tipo", "pendiente").eq("cumplido", false).lte("fecha_compromiso", sumarDias(h, 1)),
    sb.from("agenda").select("*").eq("hecho", false).eq("responsable_id", perfil.id).lte("fecha", limite),
    sb.from("tareas").select("id, titulo, fecha_limite, estado").eq("responsable_id", perfil.id).neq("estado", "terminada").lte("fecha_limite", sumarDias(h, 1)),
    sb.from("perfiles").select("id, nombre"),
  ]);
  const nombre = new Map((us.data ?? []).map((u) => [u.id, u.nombre as string]));

  for (const p of (pl.data ?? []) as unknown as ({ vencimiento: string; actuacion: string; recordar_dias?: number | null; created_by: string; expediente_id: string } & Exp)[]) {
    const mio = p.expedientes?.responsable_id === perfil.id || p.created_by === perfil.id;
    if (!esAdmin && !mio) continue;
    const n = diasRestantes(p.vencimiento, h);
    const rec = p.recordar_dias ?? null;
    let nivel: Nivel | null = null;
    if (n < 0) nivel = "vencido";
    else if (n === 0) nivel = "hoy";
    else if (n <= 2) nivel = "pronto";
    else if (rec !== null && n <= rec) nivel = "recordatorio";
    if (!nivel) continue;
    out.push({
      nivel, href: `/expedientes/${p.expediente_id}`, orden: p.vencimiento,
      texto: `${p.expedientes?.numero ?? ""} · ${p.actuacion}`,
      cuando: n < 0 ? `Plazo vencido el ${fecha(p.vencimiento)}` : n === 0 ? "Plazo vence hoy" : n === 1 ? "Plazo vence mañana" : `Plazo vence el ${fecha(p.vencimiento)}`,
      quien: esAdmin && !mio ? nombre.get(p.expedientes?.responsable_id ?? "") : undefined,
    });
  }

  for (const r of (pe.data ?? []) as unknown as { descripcion: string; fecha_compromiso: string | null; responsable_id: string | null; expediente_id: string; expedientes: { numero: string } | null }[]) {
    if (!r.fecha_compromiso) continue;
    const mio = r.responsable_id === perfil.id;
    const vencido = r.fecha_compromiso < h;
    if (!mio && !(esAdmin && vencido)) continue;
    out.push({
      nivel: vencido ? "vencido" : r.fecha_compromiso === h ? "hoy" : "pronto",
      href: `/expedientes/${r.expediente_id}`, orden: r.fecha_compromiso,
      texto: `${r.expedientes?.numero ?? ""} · ${r.descripcion}`,
      cuando: vencido ? `Pendiente atrasado (${fecha(r.fecha_compromiso)})` : r.fecha_compromiso === h ? "Pendiente para hoy" : "Pendiente para mañana",
      quien: mio ? undefined : nombre.get(r.responsable_id ?? ""),
    });
  }

  for (const g of ag.data ?? []) {
    const faltan = diasNaturales(h, g.fecha);
    const rec = g.recordar_dias ?? null;
    let nivel: Nivel | null = null;
    if (faltan < 0) nivel = "vencido";
    else if (faltan === 0) nivel = "hoy";
    else if (rec !== null && faltan <= rec) nivel = "recordatorio";
    if (!nivel) continue;
    const hora = g.hora ? ` a las ${String(g.hora).slice(0, 5)}` : "";
    out.push({
      nivel, href: `/calendario?mes=${g.fecha.slice(0, 7)}&dia=${g.fecha}`, orden: g.fecha + (g.hora ?? ""),
      texto: g.titulo,
      cuando: faltan < 0 ? `Agenda atrasada (${fecha(g.fecha)})` : faltan === 0 ? `Agenda de hoy${hora}` : faltan === 1 ? `Agenda de mañana${hora}` : `Agenda del ${fecha(g.fecha)}${hora}`,
    });
  }

  for (const t of ta.data ?? []) {
    if (!t.fecha_limite) continue;
    const vencida = t.fecha_limite < h;
    out.push({
      nivel: vencida ? "vencido" : t.fecha_limite === h ? "hoy" : "pronto",
      href: "/tareas", orden: t.fecha_limite, texto: t.titulo,
      cuando: vencida ? `Tarea vencida (${fecha(t.fecha_limite)})` : t.fecha_limite === h ? "Tarea vence hoy" : "Tarea vence mañana",
    });
  }

  return out.sort((a, b) => NIVEL_ORDEN[a.nivel] - NIVEL_ORDEN[b.nivel] || a.orden.localeCompare(b.orden));
});
