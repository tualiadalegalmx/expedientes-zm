"use server";
import { revalidatePath } from "next/cache";
import { usuarioActual } from "@/lib/supabase/server";

export type Resultado = { error?: string; ok?: boolean };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

function mensaje(m: string) {
  if ((m.includes("agenda") || m.includes("dias_inhabiles")) && (m.includes("does not exist") || m.includes("schema cache")))
    return "El calendario todavía no está habilitado en la base de datos. Pide a Ricardo que corra la migración 005.";
  if (m.includes("row-level security")) return "Solo puedes agregar o cambiar tus propias actividades.";
  if (m.includes("duplicate key")) return "Ese día ya está marcado como inhábil.";
  return m;
}

export async function agregarAgenda(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb, perfil } = await usuarioActual();
  const titulo = txt(form, "titulo");
  if (!titulo) return { error: "Escribe la actividad." };
  const { error } = await sb.from("agenda").insert({
    fecha: txt(form, "fecha"),
    hora: txt(form, "hora"),
    titulo,
    detalle: txt(form, "detalle"),
    tipo: txt(form, "tipo") ?? "diaria",
    responsable_id: txt(form, "responsable_id") ?? perfil.id,
  });
  if (error) return { error: mensaje(error.message) };
  revalidatePath("/calendario");
  return { ok: true };
}

export async function marcarAgenda(form: FormData) {
  const { sb } = await usuarioActual();
  await sb.from("agenda").update({ hecho: form.get("hecho") === "si" }).eq("id", String(form.get("id")));
  revalidatePath("/calendario");
}

export async function borrarAgenda(form: FormData) {
  const { sb } = await usuarioActual();
  await sb.from("agenda").delete().eq("id", String(form.get("id")));
  revalidatePath("/calendario");
}

export async function agregarInhabil(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await usuarioActual();
  const fecha = txt(form, "fecha"), descripcion = txt(form, "descripcion");
  if (!fecha || !descripcion) return { error: "Indica la fecha y el motivo." };
  const { error } = await sb.from("dias_inhabiles").insert({ fecha, descripcion, autoridad: txt(form, "autoridad") });
  if (error) return { error: mensaje(error.message) };
  revalidatePath("/calendario");
  return { ok: true };
}

export async function quitarInhabil(form: FormData) {
  const { sb, esAdmin } = await usuarioActual();
  if (!esAdmin) return;
  await sb.from("dias_inhabiles").delete().eq("id", Number(form.get("id")));
  revalidatePath("/calendario");
}
