"use server";
import { revalidatePath } from "next/cache";
import { usuarioActual } from "@/lib/supabase/server";

export type Resultado = { error?: string; ok?: boolean };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

function mensaje(m: string) {
  if (m.includes("tareas") && (m.includes("does not exist") || m.includes("schema cache")))
    return "La sección de tareas todavía no está habilitada en la base de datos. Pide a Ricardo que corra la migración 004.";
  if (m.includes("row-level security")) return "Solo puedes agregar o mover tus propias tareas.";
  return m;
}

export async function agregarTarea(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await usuarioActual();
  const titulo = txt(form, "titulo");
  if (!titulo) return { error: "Escribe la tarea." };
  const { error } = await sb.from("tareas").insert({
    responsable_id: String(form.get("responsable_id")),
    titulo,
    descripcion: txt(form, "descripcion"),
    fecha_limite: txt(form, "fecha_limite"),
    estado: txt(form, "estado") ?? "pendiente",
  });
  if (error) return { error: mensaje(error.message) };
  revalidatePath("/tareas");
  return { ok: true };
}

export async function moverTarea(form: FormData) {
  const { sb } = await usuarioActual();
  await sb.from("tareas").update({ estado: String(form.get("estado")) }).eq("id", String(form.get("id")));
  revalidatePath("/tareas");
}

export async function borrarTarea(form: FormData) {
  const { sb, esAdmin } = await usuarioActual();
  if (!esAdmin) return;
  await sb.from("tareas").delete().eq("id", String(form.get("id")));
  revalidatePath("/tareas");
}
