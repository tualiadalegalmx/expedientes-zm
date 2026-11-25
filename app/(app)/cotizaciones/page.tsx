import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { dinero, ESTADOS_COT, puedeCotizar, type Empresa } from "@/lib/cotizacion";
import { fecha } from "@/lib/fechas";

export const metadata = { title: "Cotizaciones" };

export default async function Cotizaciones({ searchParams }: { searchParams: Promise<{ empresa?: string; q?: string }> }) {
  const { sb, perfil } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const f = await searchParams;
  let consulta = sb.from("cotizaciones").select("id, folio, fecha, cliente, total, moneda, estado, empresa_id, created_by").order("created_at", { ascending: false }).limit(200);
  if (f.empresa) consulta = consulta.eq("empresa_id", Number(f.empresa));
  if (f.q) consulta = consulta.or(`cliente.ilike.%${f.q.replace(/[,()%]/g, " ")}%,folio.ilike.%${f.q.replace(/[,()%]/g, " ")}%`);
  const [{ data: cots, error }, { data: emp }, { data: us }] = await Promise.all([
    consulta,
    sb.from("empresas").select("*").order("nombre"),
    sb.from("perfiles").select("id, nombre"),
  ]);
  const empresas = (emp ?? []) as Empresa[];
  const em = new Map(empresas.map((e) => [e.id, e]));
  const nombre = new Map((us ?? []).map((u) => [u.id, u.nombre as string]));

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Generador de cotizaciones</h1>
          <p className="sub">Captura, guarda y descarga cotizaciones en Excel o PDF.</p>
        </div>
        <div className="mes-nav">
          <Link className="boton secundario" href="/cotizaciones/empresas">Empresas</Link>
          <Link className="boton bronce" href="/cotizaciones/nueva">+ Nueva cotización</Link>
        </div>
      </div>

      {error && <p className="error">El generador todavía no está habilitado en la base de datos. Corre la migración 010 en Supabase.</p>}

      {!error && (
        <div className="empresas-chips" role="group" aria-label="Nueva cotización por empresa">
          {empresas.filter((e) => e.activa).map((e) => (
            <Link key={e.id} href={`/cotizaciones/nueva?empresa=${e.id}`} className="empresa-chip" style={{ borderColor: e.color }}>
              <i style={{ background: e.color }} />{e.nombre}<span>Nueva</span>
            </Link>
          ))}
          {empresas.length === 0 && <p className="vacio">Aún no hay empresas. <Link href="/cotizaciones/empresas">Agrega la primera</Link>.</p>}
        </div>
      )}

      <form className="filtros" role="search" style={{ gridTemplateColumns: "2fr 1fr auto" }}>
        <div className="campo busqueda"><label htmlFor="q">Buscar</label><input id="q" name="q" type="search" defaultValue={f.q} placeholder="Cliente o folio" /></div>
        <div className="campo"><label htmlFor="empresa">Empresa</label>
          <select id="empresa" name="empresa" defaultValue={f.empresa ?? ""}><option value="">Todas</option>{empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </div>
        <button className="boton secundario">Filtrar</button>
      </form>

      {(cots ?? []).length === 0 ? (
        <div className="hoja"><p className="vacio">No hay cotizaciones todavía. Elige una empresa arriba para crear la primera.</p></div>
      ) : (
        <ul className="lista">
          {(cots ?? []).map((c) => {
            const e = em.get(c.empresa_id);
            return (
              <li key={c.id}>
                <Link href={`/cotizaciones/${c.id}`} className="fila cot-fila" style={{ boxShadow: `inset 4px 0 ${e?.color ?? "var(--bosque)"}` }}>
                  <span className="numero">{c.folio}</span>
                  <span><span className="cliente">{c.cliente}</span><span className="meta"> · {e?.nombre} · {fecha(c.fecha)}</span></span>
                  <span className="meta col-resp">{nombre.get(c.created_by)}</span>
                  <span className="cot-fila-der"><span className={`etq est-${c.estado}`}>{ESTADOS_COT[c.estado as keyof typeof ESTADOS_COT]}</span> <b>{dinero(Number(c.total), c.moneda)}</b></span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
