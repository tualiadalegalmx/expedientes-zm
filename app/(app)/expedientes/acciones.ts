"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usuarioActual } from "@/lib/supabase/server";
import { puedeAnularPlazo } from "@/lib/despacho";

export type Resultado = { error?: string; ok?: boolean };

const txt = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** Usa la opción elegida o, si se escribió una nueva, la agrega al catálogo. */
async function idCatalogo(sb: SupabaseClient, tabla: "materias" | "etapas", elegido: string | null, nuevo: string | null) {
  if (elegido && elegido !== "_nueva") return Number(elegido);
  if (!nuevo) return null;
  const { data: existe } = await sb.from(tabla).select("id").ilike("nombre", nuevo).maybeSingle();
  if (existe) return existe.id as number;
  const { data, error } = await sb.from(tabla).insert({ nombre: nuevo }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

const mensaje = (e: { message: string } | null | undefined) => {
  if (!e) return "No se pudo guardar.";
  if (e.message.includes("invalid input value for enum"))
    return "Este tipo de registro todavía no está habilitado en la base de datos. Pide a Ricardo que corra la migración más reciente (carpeta supabase/migraciones).";
  if (e.message.includes("recordar_dias"))
    return "Los recordatorios todavía no están habilitados. Pide a Ricardo que corra la migración 006, o elige \"Sin aviso adicional\".";
  if (e.message.includes("row-level security")) return "No tienes permiso para cambiar este registro; solo su autor o Zaida pueden hacerlo.";
  return e.message;
};

// ---------------------------------------------------------------- Expedientes

export async function guardarExpediente(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await usuarioActual();
  const id = txt(form, "id");
  let materia_id, etapa_id;
  try {
    materia_id = await idCatalogo(sb, "materias", txt(form, "materia_id"), txt(form, "materia_nueva"));
    etapa_id = await idCatalogo(sb, "etapas", txt(form, "etapa_id"), txt(form, "etapa_nueva"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!materia_id || !etapa_id) return { error: "Elige la materia y la etapa procesal, o escribe una nueva." };

  const datos = {
    numero: txt(form, "numero"),
    juzgado: txt(form, "juzgado"),
    // Un solo campo "Autoridad" en pantalla (se guarda en juzgado); la columna autoridad
    // se llena igual para no romper la base ni los datos anteriores.
    autoridad: txt(form, "juzgado"),
    lugar: txt(form, "lugar"),
    cliente: txt(form, "cliente"),
    contraparte: txt(form, "contraparte"),
    tipo_juicio: txt(form, "tipo_juicio"),
    responsable_id: txt(form, "responsable_id"),
    estado: txt(form, "estado") ?? "activo",
    notas: txt(form, "notas"),
    materia_id,
    etapa_id,
  };
  const faltan = (["numero", "juzgado", "lugar", "cliente", "responsable_id"] as const).filter((k) => !datos[k]);
  if (faltan.length) return { error: "Faltan datos obligatorios." };

  if (id) {
    const { error, count } = await sb.from("expedientes").update(datos, { count: "exact" }).eq("id", id);
    if (error || count === 0) return { error: mensaje(error ?? { message: "row-level security" }) };
    revalidatePath(`/expedientes/${id}`);
    redirect(`/expedientes/${id}`);
  }
  const { data: dup } = await sb.from("expedientes").select("id").eq("numero", datos.numero!).eq("juzgado", datos.juzgado!).maybeSingle();
  if (dup) return { error: `Ya existe el expediente ${datos.numero} en ${datos.juzgado}.` };
  const { data, error } = await sb.from("expedientes").insert(datos).select("id").single();
  if (error) return { error: mensaje(error) };
  revalidatePath("/expedientes");
  redirect(`/expedientes/${data.id}`);
}

export async function eliminarExpediente(form: FormData) {
  const { sb, esAdmin } = await usuarioActual();
  if (!esAdmin) return;
  await sb.from("expedientes").delete().eq("id", String(form.get("id")));
  revalidatePath("/expedientes");
  redirect("/expedientes");
}

// ---------------------------------------------------------------- Bitácora

async function subirArchivos(sb: SupabaseClient, expedienteId: string, bitacoraId: string, archivos: File[]) {
  for (const a of archivos) {
    if (!a.size) continue;
    const limpio = a.name.normalize("NFD").replace(/[^\w.\-]+/g, "_");
    const ruta = `${expedienteId}/${bitacoraId}/${Date.now()}_${limpio}`;
    const { error } = await sb.storage.from("adjuntos").upload(ruta, a, { contentType: a.type || undefined });
    if (error) throw new Error(`No se pudo subir ${a.name}: ${error.message}`);
    await sb.from("adjuntos").insert({
      expediente_id: expedienteId, bitacora_id: bitacoraId, ruta, nombre: a.name, tipo_mime: a.type, bytes: a.size,
    });
  }
}

export async function agregarRegistro(_: Resultado, form: FormData): Promise<Resultado> {
  const { sb } = await usuarioActual();
  const expediente_id = String(form.get("expediente_id"));
  const tipo = String(form.get("tipo"));
  const descripcion = txt(form, "descripcion");
  if (!descripcion) return { error: "Escribe una descripción breve." };

  const generaPlazo = tipo === "acuerdo" || tipo === "termino" ? form.get("genera_plazo") === "si" : null;
  const plazo = generaPlazo
    ? {
        fecha_surte_efectos: txt(form, "surte_efectos"),
        cantidad: Number(form.get("cantidad")),
        unidad: txt(form, "unidad") ?? "dias",
        tipo_dias: txt(form, "tipo_dias") ?? "habiles",
        actuacion: txt(form, "actuacion"),
        fundamento: txt(form, "fundamento"),
        vencimiento: txt(form, "vencimiento"),
        ...(txt(form, "recordar_dias") ? { recordar_dias: Number(txt(form, "recordar_dias")) } : {}),
      }
    : null;
  if (plazo) {
    if (!plazo.fecha_surte_efectos || !plazo.cantidad || !plazo.actuacion || !plazo.vencimiento)
      return { error: "Para registrar el plazo faltan datos: fecha en que surte efectos, número de días, actuación que vence o vencimiento." };
    if (form.get("confirmo") !== "si") return { error: "Confirma la fecha de vencimiento antes de guardar." };
  }

  const duracion = txt(form, "duracion_min");
  const { data: reg, error } = await sb
    .from("bitacora")
    .insert({
      expediente_id,
      tipo,
      fecha: txt(form, "fecha"),
      hora: txt(form, "hora"),
      descripcion,
      resultado: txt(form, "resultado"),
      duracion_min: duracion ? Number(duracion) : null,
      acuerdos: txt(form, "acuerdos"),
      genera_plazo: generaPlazo,
      responsable_id: tipo === "pendiente" ? txt(form, "responsable_id") : null,
      fecha_compromiso: tipo === "pendiente" ? txt(form, "fecha_compromiso") : null,
    })
    .select("id")
    .single();
  if (error) return { error: mensaje(error) };

  try {
    await subirArchivos(sb, expediente_id, reg.id, form.getAll("archivos").filter((x): x is File => x instanceof File));
  } catch (e) {
    revalidatePath(`/expedientes/${expediente_id}`);
    return { error: `El registro se guardó, pero ${(e as Error).message}` };
  }

  if (plazo) {
    const { error: e2 } = await sb.from("plazos").insert({ ...plazo, expediente_id, acuerdo_id: reg.id });
    if (e2) return { error: `El acuerdo se guardó, pero el plazo no: ${mensaje(e2)}` };
  }

  // Una promoción puede cumplir un plazo abierto: así se cierra.
  const cumple = txt(form, "cumple_plazo");
  if (tipo === "promocion" && cumple) {
    await sb.from("plazos")
      .update({ estado: "cumplido", cumplido_con: reg.id, cumplido_fecha: txt(form, "fecha") })
      .eq("id", cumple);
  }

  revalidatePath(`/expedientes/${expediente_id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function marcarPendiente(form: FormData) {
  const { sb } = await usuarioActual();
  const id = String(form.get("id"));
  await sb.from("bitacora").update({ cumplido: form.get("cumplido") === "si" }).eq("id", id);
  revalidatePath(`/expedientes/${form.get("expediente_id")}`);
  revalidatePath("/");
}

export async function eliminarRegistro(form: FormData) {
  const { sb, esAdmin } = await usuarioActual();
  if (!esAdmin) return;
  await sb.from("bitacora").delete().eq("id", String(form.get("id")));
  revalidatePath(`/expedientes/${form.get("expediente_id")}`);
}

export async function plazoSinEfecto(form: FormData) {
  const { sb, perfil } = await usuarioActual();
  const exp = String(form.get("expediente_id"));
  if (!puedeAnularPlazo(perfil.rol)) redirect(`/expedientes/${exp}?aviso=sin-permiso`);
  const { error } = await sb.rpc("anular_plazo", { p_id: String(form.get("id")) });
  if (error) {
    const falta = error.code === "PGRST202" || error.message.includes("anular_plazo");
    redirect(`/expedientes/${exp}?aviso=${falta ? "falta-008" : "error"}&detalle=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/expedientes/${exp}`);
  revalidatePath("/");
  redirect(`/expedientes/${exp}?aviso=sin-efecto`);
}
