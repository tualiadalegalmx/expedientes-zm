import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { ESTADOS_COT, puedeCotizar, type Cotizacion, type Empresa } from "@/lib/cotizacion";
import { DescargarCotizacion } from "@/components/DescargarCotizacion";
import { HojaCotizacion } from "@/components/HojaCotizacion";
import { borrarCotizacion, cambiarEstado } from "../acciones";

export const metadata = { title: "Cotización" };


export default async function Ver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
