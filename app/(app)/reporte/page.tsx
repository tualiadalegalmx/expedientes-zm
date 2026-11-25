import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { fecha, hoy } from "@/lib/fechas";
import { cargarDespacho, diaLocal, lunesDe, puedeVerTablero, sumarDias } from "@/lib/despacho";
import { BotonImprimir } from "@/components/BotonImprimir";

export const metadata = { title: "Reporte semanal" };

const fmtLargo = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const largo = (iso: string) => fmtLargo.format(new Date(iso + "T00:00:00Z"));
const ahora = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" });

export default async function Reporte({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const { sb, perfil } = await usuarioActual();
  if (!puedeVerTablero(perfil.rol)) redirect("/");
  const sp = await searchParams;
  const h = hoy();
  const lunes = lunesDe(sp.semana && /^\d{4}-\d{2}-\d{2}$/.test(sp.semana) ? sp.semana : h);
  const domingo = sumarDias(lunes, 6);
  const corte = domingo < h ? domingo : h;           // hasta dónde "hoy" para esta semana
  const sigLunes = sumarDias(lunes, 7), sigViernes = sumarDias(lunes, 11);
  const enSemana = (f: string | null | undefined) => !!f && f >= lunes && f <= domingo;

  const d = await cargarDespacho(sb, lunes);
  const nombre = new Map(d.personas.map((p) => [p.id, p.nombre]));
  const numExp = new Map(d.expedientes.map((x) => [x.id, x.numero]));

  const regs = d.registros.filter((r) => enSemana(diaLocal(r.created_at)));
  const cuenta = (t: string) => regs.filter((r) => r.tipo === t).length;
  const cumplidos = d.plazos.filter((p) => p.estado === "cumplido" && enSemana(p.cumplido_fecha))
    .sort((a, b) => (a.cumplido_fecha ?? "").localeCompare(b.cumplido_fecha ?? ""));
  const aTiempo = cumplidos.filter((p) => (p.cumplido_fecha ?? "") <= p.vencimiento).length;
  const vencidos = d.plazos.filter((p) => p.estado === "abierto" && p.vencimiento < corte).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const proximos = d.plazos.filter((p) => p.estado === "abierto" && p.vencimiento >= sigLunes && p.vencimiento <= sigViernes).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const nuevos = d.expedientes.filter((x) => enSemana(diaLocal(x.created_at)));
  const retro = regs.filter((r) => r.tipo === "retroalimentacion");
  const tareasHechas = d.tareas.filter((t) => t.terminada_at && enSemana(diaLocal(t.terminada_at)));

  const abogados = d.personas.filter((p) => p.rol === "abogado" || p.rol === "admin" || d.expedientes.some((x) => x.responsable_id === p.id));

  const numeros = [
    { n: regs.length, t: "registros en bitácora" },
    { n: cuenta("promocion"), t: "promociones presentadas" },
    { n: cuenta("acuerdo"), t: "acuerdos recibidos" },
    { n: cuenta("audiencia"), t: "audiencias" },
    { n: cumplidos.length, t: `plazos cumplidos${cumplidos.length ? ` (${aTiempo} a tiempo)` : ""}` },
    { n: vencidos.length, t: "plazos vencidos sin promoción" },
  ];

  return (
    <>
      <div className="encabezado no-imprimir">
        <div>
          <h1>Reporte semanal</h1>
          <p className="sub">Para guardarlo, usa Descargar PDF y elige “Guardar como PDF” como impresora.</p>
        </div>
        <div className="mes-nav">
          <Link className="boton secundario chico" href={`/reporte?semana=${sumarDias(lunes, -7)}`}>‹ Semana anterior</Link>
          {lunes !== lunesDe(h) && <Link className="boton secundario chico" href="/reporte">Esta semana</Link>}
          {lunes < lunesDe(h) && <Link className="boton secundario chico" href={`/reporte?semana=${sigLunes}`}>Semana siguiente ›</Link>}
          <BotonImprimir />
        </div>
      </div>

      <article className="reporte">
        <header className="rep-cabeza">
          <div className="rep-marca"><b>Zaida Marmen</b><span>Tu aliada legal</span></div>
          <div className="rep-titulo">
            <h1>Reporte semanal</h1>
            <p>Del {largo(lunes)} al {largo(domingo)}</p>
          </div>
        </header>

        <section className="rep-numeros">
          {numeros.map((k) => (
            <div key={k.t}><b>{k.n}</b><span>{k.t}</span></div>
          ))}
        </section>

        <section className="rep-sec">
          <h2>Por abogado</h2>
          <table className="tabla rep-tabla">
            <thead><tr><th>Abogado</th><th>Registros</th><th>Promociones</th><th>Acuerdos</th><th>Plazos cumplidos</th><th>Vencidos sin promoción</th></tr></thead>
            <tbody>
              {abogados.map((p) => {
                const suyos = regs.filter((r) => r.created_by === p.id);
                return (
                  <tr key={p.id}>
                    <th scope="row">{p.nombre}</th>
                    <td>{suyos.length}</td>
                    <td>{suyos.filter((r) => r.tipo === "promocion").length}</td>
                    <td>{suyos.filter((r) => r.tipo === "acuerdo").length}</td>
                    <td>{cumplidos.filter((x) => x.responsable_id === p.id).length}</td>
                    <td className={vencidos.some((x) => x.responsable_id === p.id) ? "txt-mal" : ""}>{vencidos.filter((x) => x.responsable_id === p.id).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rep-sec">
          <h2>Plazos cumplidos en la semana</h2>
          {cumplidos.length === 0 ? <p className="vacio">No se cumplió ningún plazo esta semana.</p> : (
            <table className="tabla rep-tabla">
              <thead><tr><th>Expediente</th><th>Actuación</th><th>Vencía</th><th>Presentado</th><th>Resultado</th></tr></thead>
              <tbody>
                {cumplidos.map((p) => {
                  const ok = (p.cumplido_fecha ?? "") <= p.vencimiento;
                  return (
                    <tr key={p.id}>
                      <th scope="row">{p.numero}</th><td>{p.actuacion}</td><td>{fecha(p.vencimiento)}</td><td>{fecha(p.cumplido_fecha)}</td>
                      <td><span className={`etq ${ok ? "etq-bien" : "etq-mal"}`}>{ok ? "A tiempo" : "Fuera de término"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="rep-sec">
          <h2>Plazos vencidos sin promoción</h2>
          {vencidos.length === 0 ? <p className="vacio">Ninguno. Todo en orden.</p> : (
            <table className="tabla rep-tabla">
              <thead><tr><th>Expediente</th><th>Actuación</th><th>Venció</th><th>Responsable</th></tr></thead>
              <tbody>
                {vencidos.map((p) => (
                  <tr key={p.id}><th scope="row">{p.numero}</th><td>{p.actuacion}</td><td className="txt-mal">{fecha(p.vencimiento)}</td><td>{nombre.get(p.responsable_id)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rep-sec">
          <h2>Vencen la próxima semana</h2>
          {proximos.length === 0 ? <p className="vacio">Nada vence del {largo(sigLunes)} al {largo(sigViernes)}.</p> : (
            <table className="tabla rep-tabla">
              <thead><tr><th>Expediente</th><th>Actuación</th><th>Vence</th><th>Responsable</th></tr></thead>
              <tbody>
                {proximos.map((p) => (
                  <tr key={p.id}><th scope="row">{p.numero}</th><td>{p.actuacion}</td><td>{fecha(p.vencimiento)}</td><td>{nombre.get(p.responsable_id)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {(nuevos.length > 0 || retro.length > 0 || tareasHechas.length > 0) && (
          <section className="rep-sec rep-dos">
            {nuevos.length > 0 && (
              <div>
                <h2>Expedientes nuevos</h2>
                <ul>{nuevos.map((x) => <li key={x.id}><b>{x.numero}</b> · {x.cliente} · {x.responsable}</li>)}</ul>
              </div>
            )}
            {retro.length > 0 && (
              <div>
                <h2>Retroalimentación</h2>
                <ul>{retro.map((r) => <li key={r.id}><b>{numExp.get(r.expediente_id)}</b> · {r.descripcion}</li>)}</ul>
              </div>
            )}
            {tareasHechas.length > 0 && (
              <div>
                <h2>Tareas terminadas</h2>
                <ul>{tareasHechas.map((t) => <li key={t.id}>{t.titulo} · {nombre.get(t.responsable_id)}</li>)}</ul>
              </div>
            )}
          </section>
        )}

        <footer className="rep-pie">Generado el {ahora.format(new Date())} por {perfil.nombre} · Uso interno y confidencial</footer>
      </article>
    </>
  );
}
