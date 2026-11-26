"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { BUCKET_DOCS, puedeSubirDocs } from "@/lib/entidades";

async function equipo() {
  const u = await usuarioActual();
  if (!puedeSubirDocs(u.perfil.rol)) redirect("/empresas");
  return u;
}

export async function eliminarDocumento(form: FormData) {
  const { sb } = await equipo();
  const id = String(form.get("id")), entidad = String(form.get("entidad_id"));
  const { data: doc } = await sb.from("documentos_entidad").select("ruta").eq("id", id).maybeSingle();
  if (doc) {
    await sb.storage.from(BUCKET_DOCS).remove([doc.ruta]);
    await sb.from("documentos_entidad").delete().eq("id", id);
  }
  revalidatePath(`/empresas/${entidad}`);
  const mes = String(form.get("mes") ?? "");
  redirect(`/empresas/${entidad}?${mes ? `mes=${mes}&` : ""}aviso=borrado`);
}

export async function eliminarMes(form: FormData) {
  const { sb } = await equipo();
  const entidad = String(form.get("entidad_id")), periodo = String(form.get("periodo"));
  // Solo los mensuales de ese mes; los permanentes nunca se borran en bloque.
  const { data: todos } = await sb.from("documentos_entidad").select("*").eq("entidad_id", Number(entidad)).eq("periodo", periodo);
  const docs = (todos ?? []).filter((d) => !d.permanente);
  if (docs?.length) {
    await sb.storage.from(BUCKET_DOCS).remove(docs.map((d) => d.ruta));
    await sb.from("documentos_entidad").delete().in("id", docs.map((d) => d.id));
  }
  revalidatePath(`/empresas/${entidad}`);
  redirect(`/empresas/${entidad}?aviso=mes-borrado&n=${docs?.length ?? 0}`);
}

export async function guardarEntidad(form: FormData) {
  const { sb } = await equipo();
  const id = form.get("id") ? Number(form.get("id")) : null;
  const nombre = String(form.get("nombre") ?? "").trim().toUpperCase();
  const color = /^#[0-9a-f]{6}$/i.test(String(form.get("color"))) ? String(form.get("color")) : "#2f3a30";
  const tipo = form.get("tipo") === "fisica" ? "fisica" : "moral";
  const rfc = String(form.get("rfc") ?? "").trim().toUpperCase() || null;
  if (!nombre) redirect("/empresas?aviso=sin-nombre");
  const datos = { nombre, color, tipo, rfc, ...(form.get("activa") ? { activa: form.get("activa") === "si" } : {}) };
  const { error } = id ? await sb.from("entidades").update(datos).eq("id", id) : await sb.from("entidades").insert(datos);
  revalidatePath("/empresas");
  if (error) redirect(`/empresas${id ? `/${id}` : ""}?aviso=${error.message.includes("duplicate") ? "repetida" : "error"}`);
  redirect(id ? `/empresas/${id}?aviso=guardada` : "/empresas?aviso=agregada");
}
