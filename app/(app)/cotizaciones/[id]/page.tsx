import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { ESTADOS_COT, puedeCotizar, type Cotizacion, type Empresa } from "@/lib/cotizacion";
import { DescargarCotizacion } from "@/components/DescargarCotizacion";
import { HojaCotizacion } from "@/components/HojaCotizacion";
import { borrarCotizacion, cambiarEstado, editarFolio } from "../acciones";

export const metadata = { title: "Cotización" };


const AVISOS: Record<string, { ok: boolean; texto: string }> = {
  "folio-ok": { ok: true, texto: "Número de cotización actualizado." },
  "folio-repetido": { ok: false, texto: "Ese número ya existe en otra cotización de esta empresa. Elige uno diferente." },
  "folio-vacio": { ok: false, texto: "Escribe el nuevo número de cotización." },
  "folio-largo": { ok: false, texto: "El número de cotización es demasiado largo (máximo 40 caracteres)." },
  "falta-013": { ok: false, texto: "No se pudo cambiar: falta correr la migración 013 en Supabase." },
  "folio-error": { ok: false, texto: "No se pudo cambiar el número de cotización." },
};

export default async function Ver({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string }> }) {
  const { id } = await params;
  const aviso = AVISOS[(await searchParams).aviso ?? ""];
  const { sb, perfil, esAdmin } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const { data } = await sb.from("cotizaciones").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cotizacion;
  const { data: e } = await sb.from("empresas").select("*").eq("id", c.empresa_id).single();
  const em = e as Empresa;

  return (
    <>
      <div className="encabezado no-imprimir">
        <div>
          <h1>{c.folio}</h1>
          <p className="sub">{em.nombre} · {c.cliente}</p>
        </div>
        <div className="mes-nav">
          <Link className="boton secundario" href="/cotizaciones">Todas</Link>
          <Link className="boton secundario" href={`/cotizaciones/${id}/editar`}>Editar</Link>
          <Link className="boton secundario" href={`/cotizaciones/nueva?empresa=${c.empresa_id}`}>Nueva de {em.nombre}</Link>
          <DescargarCotizacion cot={c} empresa={em} />
        </div>
      </div>

      {aviso && <p className={`no-imprimir ${aviso.ok ? "aviso-ok" : "error"}`} role={aviso.ok ? "status" : "alert"}>{aviso.texto}</p>}

      <details className="no-imprimir editar-folio" open={!!aviso && !aviso.ok && aviso !== AVISOS["folio-ok"]}>
        <summary className="boton secundario chico">Editar número de cotización</summary>
        <form action={editarFolio} className="editar-folio-form">
          <input type="hidden" name="id" value={c.id} />
          <label htmlFor="folio">Nuevo número</label>
          <input id="folio" name="folio" defaultValue={c.folio} required maxLength={40} style={{ textTransform: "uppercase" }} />
          <button className="boton chico">Guardar número</button>
          <span className="aviso">El consecutivo automático de las siguientes cotizaciones no cambia.</span>
        </form>
      </details>

      <div className="no-imprimir cot-estado">
        <span className="aviso">Estado:</span>
        {Object.entries(ESTADOS_COT).map(([k, v]) => (
          <form key={k} action={cambiarEstado}>
            <input type="hidden" name="id" value={c.id} /><input type="hidden" name="estado" value={k} />
            <button className={`boton chico ${c.estado === k ? "" : "secundario"}`} aria-pressed={c.estado === k}>{v}</button>
          </form>
        ))}
        {esAdmin && (
          <form action={borrarCotizacion} style={{ marginLeft: "auto" }}>
            <input type="hidden" name="id" value={c.id} />
            <button className="boton chico secundario" style={{ color: "var(--vencido)" }}>Eliminar</button>
          </form>
        )}
      </div>

      <HojaCotizacion cot={c} empresa={em} />
    </>
  );
}
