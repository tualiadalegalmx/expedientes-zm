import type { SupabaseClient } from "@supabase/supabase-js";

export type Opcion = { id: number | string; nombre: string };

export async function catalogos(sb: SupabaseClient) {
  const [m, e, p] = await Promise.all([
    sb.from("materias").select("id, nombre").order("orden").order("nombre"),
    sb.from("etapas").select("id, nombre").order("orden").order("nombre"),
    sb.from("perfiles").select("id, nombre, rol").eq("activo", true).order("nombre"),
  ]);
  return {
    materias: (m.data ?? []) as Opcion[],
    etapas: (e.data ?? []) as Opcion[],
    usuarios: (p.data ?? []) as (Opcion & { rol: string })[],
  };
}

export const TIPOS = {
  promocion: "Promoción presentada",
  acuerdo: "Acuerdo o notificación",
  audiencia: "Audiencia",
  visita: "Visita al juzgado",
  cliente: "Llamada o reunión con cliente",
  estudio: "Atención o estudio",
  pendiente: "Pendiente / acción inmediata",
} as const;
export type Tipo = keyof typeof TIPOS;

export const ESTADOS = { activo: "Activo", suspendido: "Suspendido", concluido: "Concluido", archivado: "Archivado" } as const;
