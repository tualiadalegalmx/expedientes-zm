"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { puedeCotizar, type Concepto } from "@/lib/cotizacion";

export type Resultado = { error?: string; ok?: boolean };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};
const num = (f: FormData, k: string, def = 0) => {
  const v = Number(String(f.get(k) ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : def;
};

function mensaje(m: string) {
  if ((m.includes("cotizaciones") || m.includes("empresas")) && (m.includes("does not exist") || m.includes("schema cache")))
    return "El generador todavía no está habilitado en la base de datos. Pide a Ricardo que corra la migración 010.";
  if (["cliente_direccion", "numero_proveedor", "plantilla", "firmante", "folio_con_anio", "\"pie\"", "\"logo\""].some((c) => m.includes(c)))
    return "Falta correr la migración 011 (formatos de empresa) en Supabase.";
  if (m.includes("row-level security")) return "Tu usuario no tiene permiso para el generador de cotizaciones.";
  if (m.includes("empresas_nombre_key")) return "Ya existe una empresa con ese nombre.";
  return m;
}

async function acceso() {
  const u = await usuarioActual();
  if (!puedeCotizar(u.perfil.rol)) redirect("/");
  return u;
}

export async function guardarCotizacion(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await acceso();
  const id = txt(form, "id");
  let conceptos: Concepto[] = [];
  try {
    conceptos = (JSON.parse(String(form.get("conceptos") ?? "[]")) as Concepto[])
      .map((c) => ({ descripcion: String(c.descripcion ?? "").trim(), unidad: String(c.unidad ?? "").trim(), cantidad: Number(c.cantidad) || 0, precio: Number(c.precio) || 0 }))
      .filter((c) => c.descripcion);
  } catch { return { error: "No se pudieron leer los conceptos." }; }
  if (!conceptos.length) return { error: "Agrega al menos un concepto con descripción." };
  if (conceptos.some((c) => c.cantidad <= 0)) return { error: "Cada concepto necesita una cantidad mayor a cero." };

  const datos = {
    empresa_id: Number(form.get("empresa_id")),
    fecha: txt(form, "fecha"),
    vigencia_dias: num(form, "vigencia_dias", 15),
    cliente: txt(form, "cliente"),
    atencion: txt(form, "atencion"),
    cliente_correo: txt(form, "cliente_correo"),
    cliente_tel: txt(form, "cliente_tel"),
    cliente_direccion: txt(form, "cliente_direccion"),
    numero_proveedor: txt(form, "numero_proveedor"),
    moneda: txt(form, "moneda") ?? "MXN",
    conceptos,
    iva_pct: num(form, "iva_pct", 16),
    descuento: num(form, "descuento", 0),
    notas: txt(form, "notas"),
    condiciones: txt(form, "condiciones"),
  };
  if (!datos.empresa_id) return { error: "Elige la empresa que emite la cotización." };
  if (!datos.cliente) return { error: "Escribe el nombre del cliente." };

  if (id) {
    const { empresa_id: _e, ...cambios } = datos;
    const { error } = await sb.from("cotizaciones").update(cambios).eq("id", id);
    if (error) return { error: mensaje(error.message) };
    revalidatePath("/cotizaciones");
    redirect(`/cotizaciones/${id}`);
  }
  const { data, error } = await sb.from("cotizaciones").insert(datos).select("id").single();
  if (error) return { error: mensaje(error.message) };
  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${data.id}`);
}

export async function cambiarEstado(form: FormData) {
  const { sb } = await acceso();
  const id = String(form.get("id"));
  await sb.from("cotizaciones").update({ estado: String(form.get("estado")) }).eq("id", id);
  revalidatePath(`/cotizaciones/${id}`);
  revalidatePath("/cotizaciones");
}

export async function borrarCotizacion(form: FormData) {
  const { sb, esAdmin } = await acceso();
  if (!esAdmin) return;
  await sb.from("cotizaciones").delete().eq("id", String(form.get("id")));
  revalidatePath("/cotizaciones");
  redirect("/cotizaciones");
}

export async function guardarEmpresa(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await acceso();
  const id = txt(form, "id");
  const datos = {
    nombre: txt(form, "nombre"),
    razon_social: txt(form, "razon_social"),
    rfc: txt(form, "rfc")?.toUpperCase() ?? null,
    direccion: txt(form, "direccion"),
    telefono: txt(form, "telefono"),
    correo: txt(form, "correo"),
    prefijo: (txt(form, "prefijo") ?? "COT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "COT",
    color: /^#[0-9a-f]{6}$/i.test(txt(form, "color") ?? "") ? txt(form, "color")! : "#2f3a30",
    condiciones: txt(form, "condiciones"),
    activa: form.get("activa") !== "no",
    plantilla: txt(form, "plantilla") === "clasica" ? "clasica" : "sencilla",
    logo: txt(form, "logo"),
    firmante_nombre: txt(form, "firmante_nombre"),
    firmante_cargo: txt(form, "firmante_cargo"),
    pie: txt(form, "pie"),
    numero_proveedor: txt(form, "numero_proveedor"),
    folio_con_anio: form.get("folio_con_anio") === "si",
  };
  if (datos.logo && datos.logo.length > 900_000) return { error: "El logo es demasiado pesado. Usa una imagen más pequeña." };
  if (!datos.nombre) return { error: "Escribe el nombre de la empresa." };
  const { error } = id
    ? await sb.from("empresas").update(datos).eq("id", Number(id))
    : await sb.from("empresas").insert(datos);
  if (error) return { error: mensaje(error.message) };
  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/empresas");
  redirect("/cotizaciones/empresas?ok=1");
}
