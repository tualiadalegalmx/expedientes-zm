import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { diasDesde, diasRestantes, fecha, hoy } from "@/lib/fechas";
import { cargarDespacho, diaLocal, lunesDe, puedeVerTablero, resumenPorPersona, sumarDias } from "@/lib/despacho";
import { PlazoChip } from "@/components/Semaforo";
import { TIPOS, type Tipo } from "@/lib/catalogos";

export const metadata = { title: "Tablero" };

export default async function Tablero() {
  const { sb, perfil } = await usuarioActual();
  if (!puedeVerTablero(perfil.rol)) redirect("/");

  const h = hoy();
  const lunes = lunesDe(h);
  const hace7 = sumarDias(h, -6);
  const d = await cargarDespacho(sb, sumarDias(h, -30));
  const porPersona = resumenPorPersona(d, hace7, h);
  const abogados = porPersona.filter((p) => p.rol === "abogado" || p.rol === "admin" || p.expedientes > 0);

  const activos = d.expedientes.filter((x) => x.estado === "activo");
  const abiertos = d.plazos.filter((x) => x.estado === "abierto");
  const vencidos = abiertos.filter((x) => x.vencimiento < h).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const semana = abiertos.filter((x) => x.vencimiento >= h && diasRestantes(x.vencimiento, h) <= 5).sort((a, b) => a.vencimiento.localeCompare(b.vencimiento));
  const quietos = activos.filter((x) => diasDesde(x.ultimo_movimiento) >= 3).sort((a, b) => a.ultimo_movimiento.localeCompare(b.ultimo_movimiento));
  const pendAtrasados = d.registros.filter((r) => r.tipo === "pendiente" && !r.cumplido && r.fecha_compromiso && r.fecha_compromiso < h);

  const regsSemana = d.registros.filter((r) => diaLocal(r.created_at) >= lunes);
  const porTipo = new Map<string, number>();
  regsSemana.forEach((r) => porTipo.set(r.tipo, (porTipo.get(r.tipo) ?? 0) + 1));
  const maxTipo = Math.max(1, ...porTipo.values());

  // Las tareas son personales: Zaida ve las de todos; Ricardo, solo las suyas.
  const apoyo = porPersona.filter((p) => (p.rol === "administrativo" || p.rol === "desarrollo") && (perfil.rol === "admin" || p.id === perfil.id));
  const nombre = new Map(d.personas.map((p) => [p.id, p.nombre]));
  const numExp = new Map(d.expedientes.map((x) => [x.id, x.numero]));

  const indicadores = [
    { n: activos.length, t: "Expedientes activos", c: "" },
    { n: abiertos.length, t: "Plazos abiertos", c: "" },
    { n: vencidos.length, t: "Plazos vencidos sin promoción", c: vencidos.length ? "mal" : "bien" },
    { n: semana.length, t: "Vencen en 5 días hábiles", c: semana.length ? "atento" : "" },
    { n: quietos.length, t: "Expedientes sin movimiento (3+ días)", c: quietos.length ? "atento" : "bien" },
    { n: pendAtrasados.length, t: "Pendientes atrasados", c: pendAtrasados.length ? "mal" : "bien" },
  ];

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Tablero del despacho</h1>
          <p className="sub">Estado general al día de hoy. La actividad cuenta desde el lunes {fecha(lunes)}.</p>
        </div>
        <Link className="boton bronce" href="/reporte">Reporte semanal</Link>
      </div>

      <section className="indicadores" aria-label="Indicadores">
        {indicadores.map((k) => (
          <div key={k.t} className={`indicador ${k.c}`}>
            <span className="ind-n">{k.n}</span>
            <span className="ind-t">{k.t}</span>
          </div>
        ))}
      </section>

      <section className="hoja tablero seccion-tab">
        <header className="tablero-cabeza"><h2>Por abogado</h2><span className="aviso">Registros de los últimos 7 días</span></header>
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Abogado</th>
                <th scope="col">Expedientes</th>
                <th scope="col">Plazos abiertos</th>
                <th scope="col">Vencidos</th>
                <th scope="col">Próximos 5 días</th>
                <th scope="col">Sin movimiento</th>
                <th scope="col">Registros 7 días</th>
                <th scope="col">Última captura</th>
              </tr>
            </thead>
            <tbody>
              {abogados.map((p) => {
                const sinCaptura = p.ultimoRegistro ? diasDesde(diaLocal(p.ultimoRegistro)) : null;
                return (
                  <tr key={p.id}>
                    <th scope="row"><Link href={`/expedientes?responsable=${p.id}`}>{p.nombre}</Link></th>
                    <td>{p.expedientes}</td>
                    <td>{p.plazosAbiertos}</td>
                    <td><span className={p.vencidos ? "num mal" : "num"}>{p.vencidos}</span></td>
                    <td><span className={p.proximos ? "num atento" : "num"}>{p.proximos}</span></td>
                    <td><span className={p.sinMovimiento ? "num atento" : "num"}>{p.sinMovimiento}</span></td>
                    <td>{p.registros}</td>
                    <td className={sinCaptura === null || sinCaptura >= 3 ? "txt-mal" : ""}>
                      {sinCaptura === null ? "Sin registros" : sinCaptura === 0 ? "Hoy" : sinCaptura === 1 ? "Ayer" : `Hace ${sinCaptura} días`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rejilla" style={{ marginTop: 20 }}>
        <section className="hoja tablero">
          <header className="tablero-cabeza"><h2>Vencidos sin promoción</h2><span className="aviso">{vencidos.length}</span></header>
          <div className="lista-tab">
            {vencidos.length === 0 ? <p className="vacio">Ningún plazo vencido. Todo en orden.</p> : (
              <ul className="tabla-simple">
                {vencidos.slice(0, 12).map((p) => (
                  <li key={p.id}>
                    <Link href={`/expedientes/${p.expediente_id}`}><span className="numero-chico">{p.numero}</span> <span>{p.actuacion}</span> <span className="aviso">· {nombre.get(p.responsable_id)}</span></Link>
                    <PlazoChip vencimiento={p.vencimiento} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="hoja tablero">
          <header className="tablero-cabeza"><h2>Vencen esta semana</h2><span className="aviso">{semana.length}</span></header>
          <div className="lista-tab">
            {semana.length === 0 ? <p className="vacio">Nada vence en los próximos 5 días hábiles.</p> : (
              <ul className="tabla-simple">
                {semana.map((p) => (
                  <li key={p.id}>
                    <Link href={`/expedientes/${p.expediente_id}`}><span className="numero-chico">{p.numero}</span> <span>{p.actuacion}</span> <span className="aviso">· {nombre.get(p.responsable_id)}</span></Link>
                    <PlazoChip vencimiento={p.vencimiento} conFecha />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="hoja tablero">
          <header className="tablero-cabeza"><h2>Sin movimiento</h2><span className="aviso">3 días o más</span></header>
          <div className="lista-tab">
            {quietos.length === 0 ? <p className="vacio">Todos los expedientes activos tienen movimiento reciente.</p> : (
              <ul className="tabla-simple">
                {quietos.slice(0, 12).map((x) => (
                  <li key={x.id}>
                    <Link href={`/expedientes/${x.id}`}><span className="numero-chico">{x.numero}</span> <span className="aviso">{x.responsable}</span></Link>
                    <span className="quieto-etiqueta">{diasDesde(x.ultimo_movimiento)} días</span>
                  </li>
                ))}
                {quietos.length > 12 && <li><Link href="/expedientes?quietos=1" className="aviso">Ver los {quietos.length}</Link></li>}
              </ul>
            )}
          </div>
        </section>

        <section className="hoja tablero">
          <header className="tablero-cabeza"><h2>Actividad de la semana</h2><span className="aviso">{regsSemana.length} registros</span></header>
          <div className="lista-tab">
            {porTipo.size === 0 ? <p className="vacio">Sin registros desde el lunes.</p> : (
              <ul className="barras">
                {[...porTipo].sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                  <li key={t}>
                    <span className="barra-t">{TIPOS[t as Tipo] ?? t}</span>
                    <span className="barra-b"><i style={{ width: `${(n / maxTipo) * 100}%` }} /></span>
                    <span className="barra-n">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {pendAtrasados.length > 0 && (
          <section className="hoja tablero">
            <header className="tablero-cabeza"><h2>Pendientes atrasados</h2><span className="aviso">{pendAtrasados.length}</span></header>
            <div className="lista-tab">
              <ul className="tabla-simple">
                {pendAtrasados.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <Link href={`/expedientes/${r.expediente_id}`}><span className="numero-chico">{numExp.get(r.expediente_id)}</span> {r.descripcion} <span className="aviso">· {nombre.get(r.responsable_id ?? "")}</span></Link>
                    <span className="quieto-etiqueta" style={{ whiteSpace: "nowrap" }}>{fecha(r.fecha_compromiso)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {apoyo.length > 0 && (
          <section className="hoja tablero">
            <header className="tablero-cabeza"><h2>Tareas</h2><Link href="/tareas" className="aviso" style={{ color: "var(--bronce-claro)" }}>Abrir</Link></header>
            <div className="lista-tab">
              <ul className="tabla-simple">
                {apoyo.map((p) => {
                  const suyas = d.tareas.filter((t) => t.responsable_id === p.id);
                  const abiertas = suyas.filter((t) => t.estado !== "terminada");
                  const vencidasT = abiertas.filter((t) => t.fecha_limite && t.fecha_limite < h).length;
                  const enProceso = abiertas.filter((t) => t.estado === "en_proceso").length;
                  const terminadasSemana = suyas.filter((t) => t.terminada_at && diaLocal(t.terminada_at) >= lunes).length;
                  return (
                    <li key={p.id}>
                      <strong>{p.nombre}</strong>
                      <span className="aviso" style={{ textAlign: "right" }}>
                        {abiertas.length} abiertas, {enProceso} en proceso, {terminadasSemana} terminadas esta semana
                        {vencidasT > 0 && <span className="txt-mal">, {vencidasT} vencidas</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
