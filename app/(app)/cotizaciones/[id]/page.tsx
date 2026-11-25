import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { conLetra, dinero, ESTADOS_COT, puedeCotizar, type Cotizacion, type Empresa } from "@/lib/cotizacion";
import { DescargarCotizacion } from "@/components/DescargarCotizacion";
import { borrarCotizacion, cambiarEstado } from "../acciones";

export const metadata = { title: "Cotización" };

const largo = (iso: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

export default async function Ver({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, perfil, esAdmin } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const { data } = await sb.from("cotizaciones").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Cotizacion;
  const { data: e } = await sb.from("empresas").select("*").eq("id", c.empresa_id).single();
  const em = e as Empresa;
  const vence = new Date(c.fecha + "T00:00:00Z"); vence.setUTCDate(vence.getUTCDate() + c.vigencia_dias);

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

      <article className="reporte cotizacion" style={{ ["--emp" as string]: em.color }}>
        <header className="cz-cabeza">
          <div>
            <b className="cz-emp">{em.razon_social || em.nombre}</b>
            <div className="cz-datos">
              {em.rfc && <span>RFC: {em.rfc}</span>}
              {em.direccion && <span>{em.direccion}</span>}
              {(em.telefono || em.correo) && <span>{[em.telefono, em.correo].filter(Boolean).join("  ·  ")}</span>}
            </div>
          </div>
          <div className="cz-folio">
            <h1>Cotización</h1>
            <dl>
              <div><dt>Folio</dt><dd>{c.folio}</dd></div>
              <div><dt>Fecha</dt><dd>{largo(c.fecha)}</dd></div>
              <div><dt>Vigencia</dt><dd>Hasta el {largo(vence.toISOString().slice(0, 10))}</dd></div>
            </dl>
          </div>
        </header>

        <section className="cz-cliente">
          <span>Cliente</span>
          <b>{c.cliente}</b>
          {c.atencion && <p>Atención: {c.atencion}</p>}
          {(c.cliente_correo || c.cliente_tel) && <p>{[c.cliente_correo, c.cliente_tel].filter(Boolean).join("  ·  ")}</p>}
        </section>

        <table className="tabla cz-tabla">
          <thead><tr><th>#</th><th>Descripción</th><th>Unidad</th><th className="der">Cantidad</th><th className="der">Precio unitario</th><th className="der">Importe</th></tr></thead>
          <tbody>
            {c.conceptos.map((k, i) => (
              <tr key={i}>
                <td>{i + 1}</td><td style={{ whiteSpace: "pre-line" }}>{k.descripcion}</td><td>{k.unidad}</td>
                <td className="der">{k.cantidad}</td><td className="der">{dinero(k.precio, c.moneda)}</td><td className="der">{dinero(k.cantidad * k.precio, c.moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cz-pie">
          <p className="cz-letra"><span>Importe con letra</span>{conLetra(Number(c.total), c.moneda)}</p>
          <dl className="cot-suma">
            <div><dt>Subtotal</dt><dd>{dinero(Number(c.subtotal), c.moneda)}</dd></div>
            {Number(c.descuento) > 0 && <div><dt>Descuento</dt><dd>− {dinero(Number(c.descuento), c.moneda)}</dd></div>}
            <div><dt>IVA {Number(c.iva_pct)} %</dt><dd>{dinero(Number(c.iva), c.moneda)}</dd></div>
            <div className="cot-total"><dt>Total</dt><dd>{dinero(Number(c.total), c.moneda)}</dd></div>
          </dl>
        </div>

        {c.notas && <section className="rep-sec"><h2>Notas</h2><p style={{ whiteSpace: "pre-line", margin: 0 }}>{c.notas}</p></section>}
        {c.condiciones && <section className="rep-sec"><h2>Condiciones</h2><p style={{ whiteSpace: "pre-line", margin: 0 }}>{c.condiciones}</p></section>}
      </article>
    </>
  );
}
