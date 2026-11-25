import Link from "next/link";
import { usuarioActual } from "@/lib/supabase/server";
import { diasRestantes, fechaLarga, hoy, semaforo } from "@/lib/fechas";
import { AgendaForm, InhabilForm } from "@/components/CalendarioForms";
import { borrarAgenda, marcarAgenda, quitarInhabil } from "./acciones";

export const metadata = { title: "Calendario" };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Evento = {
  clase: string;       // color: plazo-verde, plazo-rojo, pendiente, audiencia, tarea, agenda…
  texto: string;
  detalle?: string;
  href?: string;
  hora?: string | null;
  id?: string;         // agenda: para marcar/borrar
  hecho?: boolean;
  puede?: boolean;
  quien?: string;
};

const iso = (a: number, m: number, d: number) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default async function Calendario({ searchParams }: { searchParams: Promise<{ mes?: string; dia?: string }> }) {
  const sp = await searchParams;
  const { sb, perfil, esAdmin } = await usuarioActual();
  const hoyIso = hoy();
  const [a, m] = (sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hoyIso.slice(0, 7)).split("-").map(Number);
  const diaSel = sp.dia && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) ? sp.dia : hoyIso.slice(0, 7) === iso(a, m, 1).slice(0, 7) ? hoyIso : iso(a, m, 1);

  // Rango visible: de lunes a domingo completos alrededor del mes.
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const inicio = new Date(primero); inicio.setUTCDate(1 - ((primero.getUTCDay() + 6) % 7));
  const ultimo = new Date(Date.UTC(a, m, 0));
  const fin = new Date(ultimo); fin.setUTCDate(ultimo.getUTCDate() + (6 - ((ultimo.getUTCDay() + 6) % 7)));
  const desde = inicio.toISOString().slice(0, 10), hasta = fin.toISOString().slice(0, 10);

  const [rInh, rPla, rPen, rAud, rTar, rAge, rUsr] = await Promise.all([
    sb.from("dias_inhabiles").select("id, fecha, descripcion, autoridad").gte("fecha", desde).lte("fecha", hasta),
    sb.from("plazos").select("id, vencimiento, actuacion, estado, expediente_id, expedientes(numero)").gte("vencimiento", desde).lte("vencimiento", hasta).neq("estado", "sin_efecto"),
    sb.from("bitacora").select("id, fecha_compromiso, descripcion, cumplido, expediente_id, responsable_id, expedientes(numero)").eq("tipo", "pendiente").gte("fecha_compromiso", desde).lte("fecha_compromiso", hasta),
    sb.from("bitacora").select("id, fecha, hora, descripcion, expediente_id, expedientes(numero)").eq("tipo", "audiencia").gte("fecha", desde).lte("fecha", hasta),
    sb.from("tareas").select("id, fecha_limite, titulo, estado, responsable_id").gte("fecha_limite", desde).lte("fecha_limite", hasta),
    sb.from("agenda").select("*").gte("fecha", desde).lte("fecha", hasta).order("hora", { nullsFirst: true }),
    sb.from("perfiles").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  const sinTablas = !!rInh.error || !!rAge.error;
  const nombre = new Map((rUsr.data ?? []).map((u) => [u.id, u.nombre as string]));

  const inhabiles = new Map<string, { id: number; descripcion: string; autoridad: string | null }[]>();
  (rInh.data ?? []).forEach((d) => inhabiles.set(d.fecha, [...(inhabiles.get(d.fecha) ?? []), d]));

  const eventos = new Map<string, Evento[]>();
  const poner = (f: string, e: Evento) => eventos.set(f, [...(eventos.get(f) ?? []), e]);
  type ConExp = { expedientes: { numero: string } | null };

  (rPla.data as unknown as ({ vencimiento: string; actuacion: string; estado: string; expediente_id: string } & ConExp)[] ?? []).forEach((p) => {
    const abierto = p.estado === "abierto";
    poner(p.vencimiento, {
      clase: abierto ? `plazo s-${semaforo(diasRestantes(p.vencimiento, hoyIso))}` : "plazo-cumplido",
      texto: `${p.expedientes?.numero ?? ""} · ${p.actuacion}`,
      detalle: abierto ? "Vence el plazo" : "Plazo cumplido",
      href: `/expedientes/${p.expediente_id}`,
      hecho: !abierto,
    });
  });
  (rAud.data as unknown as ({ fecha: string; hora: string | null; descripcion: string; expediente_id: string } & ConExp)[] ?? []).forEach((r) =>
    poner(r.fecha, { clase: "audiencia", texto: `${r.expedientes?.numero ?? ""} · Audiencia`, detalle: r.descripcion, href: `/expedientes/${r.expediente_id}`, hora: r.hora }));
  (rPen.data as unknown as ({ fecha_compromiso: string; descripcion: string; cumplido: boolean; expediente_id: string; responsable_id: string } & ConExp)[] ?? []).forEach((r) =>
    poner(r.fecha_compromiso, { clase: "pendiente", texto: `${r.expedientes?.numero ?? ""} · ${r.descripcion}`, detalle: "Pendiente del expediente", href: `/expedientes/${r.expediente_id}`, hecho: r.cumplido, quien: nombre.get(r.responsable_id) }));
  (rTar.data ?? []).forEach((t) =>
    poner(t.fecha_limite, { clase: `tarea-${t.estado}`, texto: t.titulo, detalle: "Fecha límite de tarea", href: "/tareas", hecho: t.estado === "terminada", quien: nombre.get(t.responsable_id) }));
  (rAge.data ?? []).forEach((g) =>
    poner(g.fecha, {
      clase: `agenda-${g.tipo}`, texto: g.titulo, detalle: g.detalle ?? undefined, hora: g.hora, id: g.id, hecho: g.hecho,
      puede: esAdmin || g.responsable_id === perfil.id, quien: nombre.get(g.responsable_id),
    }));

  const semanas: string[][] = [];
  for (const d = new Date(inicio); d <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    if ((d.getUTCDay() + 6) % 7 === 0) semanas.push([]);
    semanas[semanas.length - 1].push(d.toISOString().slice(0, 10));
  }
  const mesAnt = m === 1 ? iso(a - 1, 12, 1).slice(0, 7) : iso(a, m - 1, 1).slice(0, 7);
  const mesSig = m === 12 ? iso(a + 1, 1, 1).slice(0, 7) : iso(a, m + 1, 1).slice(0, 7);
  const mesAct = iso(a, m, 1).slice(0, 7);

  const tipoDia = (f: string) => {
    const wd = new Date(f + "T00:00:00Z").getUTCDay();
    if (inhabiles.has(f)) return "inhabil";
    if (wd === 0 || wd === 6) return "finde";
    return "habil";
  };
  const evSel = (eventos.get(diaSel) ?? []).sort((x, y) => (x.hora ?? "99").localeCompare(y.hora ?? "99"));
  const tipoSel = tipoDia(diaSel);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Calendario</h1>
          <p className="sub">
            {esAdmin
              ? "Vencimientos y audiencias del despacho, más las tareas y la agenda de todo el equipo."
              : "Vencimientos y audiencias del despacho, más tus tareas y tu agenda personal."}
          </p>
        </div>
        <nav className="mes-nav" aria-label="Cambiar de mes">
          <Link className="boton secundario chico" href={`/calendario?mes=${mesAnt}`}>‹ Anterior</Link>
          <Link className="boton secundario chico" href="/calendario">Hoy</Link>
          <Link className="boton secundario chico" href={`/calendario?mes=${mesSig}`}>Siguiente ›</Link>
        </nav>
      </div>

      {sinTablas && <p className="error">El calendario todavía no está habilitado en la base de datos. Corre la migración 005 en Supabase.</p>}

      <div className="cal-layout">
        <section className="hoja cal" aria-label={`${MESES[m - 1]} ${a}`}>
          <header className="tablero-cabeza cal-cabeza">
            <h2>{MESES[m - 1].replace(/^./, (c) => c.toUpperCase())} {a}</h2>
            <ul className="leyenda">
              <li><i className="lz habil" />Hábil</li>
              <li><i className="lz finde" />Fin de semana</li>
              <li><i className="lz inhabil" />Inhábil</li>
            </ul>
          </header>
          <div className="cal-rejilla" role="grid">
            {DIAS.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
            {semanas.flat().map((f) => {
              const ev = eventos.get(f) ?? [];
              const fuera = f.slice(0, 7) !== mesAct;
              const t = tipoDia(f);
              const urg = ev.some((e) => e.clase.includes("s-rojo") || e.clase.includes("s-vencido"));
              return (
                <Link
                  key={f}
                  href={`/calendario?mes=${mesAct}&dia=${f}`}
                  className={`cal-dia d-${t}${fuera ? " fuera" : ""}${f === hoyIso ? " hoy" : ""}${f === diaSel ? " sel" : ""}`}
                  aria-label={`${fechaLarga(f)}${ev.length ? `, ${ev.length} actividades` : ""}`}
                >
                  <span className="cal-num">{Number(f.slice(8))}{urg && <b className="cal-alerta" aria-hidden>!</b>}</span>
                  {t === "inhabil" && <span className="cal-inh">{inhabiles.get(f)![0].descripcion.replace("Inhábil · ", "")}</span>}
                  <span className="cal-evs">
                    {ev.slice(0, 3).map((e, i) => <span key={i} className={`cal-ev ${e.clase}${e.hecho ? " hecho-ev" : ""}`}>{e.texto}</span>)}
                    {ev.length > 3 && <span className="cal-mas">+{ev.length - 3} más</span>}
                  </span>
                  {ev.length > 0 && <span className="cal-puntos" aria-hidden>{ev.slice(0, 4).map((e, i) => <i key={i} className={e.clase} />)}</span>}
                </Link>
              );
            })}
          </div>
          <ul className="leyenda leyenda-ev">
            <li><i className="lz ev-plazo" />Vencimiento de plazo</li>
            <li><i className="lz ev-aud" />Audiencia</li>
            <li><i className="lz ev-pend" />Pendiente de expediente</li>
            <li><i className="lz ev-tarea" />Tarea</li>
            <li><i className="lz ev-agenda" />Agenda</li>
          </ul>
        </section>

        <aside className="hoja tablero dia-panel">
          <header className="tablero-cabeza">
            <h2>{fechaLarga(diaSel).replace(/^./, (c) => c.toUpperCase())}</h2>
            <span className={`dia-tipo t-${tipoSel}`}>{tipoSel === "habil" ? "Día hábil" : tipoSel === "finde" ? "Fin de semana" : "Día inhábil"}</span>
          </header>

          {tipoSel === "inhabil" && (
            <ul className="inh-lista">
              {inhabiles.get(diaSel)!.map((d) => (
                <li key={d.id}>
                  <span>{d.descripcion}{d.autoridad && ` · ${d.autoridad}`}</span>
                  {esAdmin && (
                    <form action={quitarInhabil}><input type="hidden" name="id" value={d.id} /><button className="boton secundario chico">Quitar</button></form>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="grupo g-en_proceso">
            <h3>Actividades del día <span>{evSel.length}</span></h3>
            {evSel.length === 0 ? <p className="vacio">Nada programado para este día.</p> : (
              <ul className="tareas">
                {evSel.map((e, i) => (
                  <li key={i} className={`tarea dia-ev ${e.clase}${e.hecho ? " e-terminada" : ""}`}>
                    <div className="tarea-texto">
                      {e.href ? <Link href={e.href}><strong>{e.texto}</strong></Link> : <strong>{e.texto}</strong>}
                      {e.detalle && <p>{e.detalle}</p>}
                      <div className="tarea-pie">
                        {e.hora && <span>{e.hora.slice(0, 5)} h</span>}
                        {e.quien && <span>{e.quien}</span>}
                      </div>
                    </div>
                    {e.id && e.puede && (
                      <div className="tarea-botones">
                        <form action={marcarAgenda}>
                          <input type="hidden" name="id" value={e.id} />
                          <input type="hidden" name="hecho" value={e.hecho ? "no" : "si"} />
                          <button className={`boton chico ${e.hecho ? "secundario" : ""}`}>{e.hecho ? "Reabrir" : "Hecho"}</button>
                        </form>
                        <form action={borrarAgenda}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="boton chico secundario">Borrar</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!sinTablas && (
            <div className="grupo g-pendiente">
              <h3>Agendar en este día</h3>
              <p className="aviso" style={{ margin: "0 0 8px" }}>{esAdmin ? "Puedes agendar para cualquier persona." : "Solo tú y Zaida verán lo que agendes."}</p>
              <AgendaForm fecha={diaSel} usuarios={(rUsr.data ?? []) as { id: string; nombre: string }[]} usuarioId={perfil.id} esAdmin={esAdmin} />
            </div>
          )}

          {!sinTablas && (
            <details className="grupo g-terminada inh-detalles">
              <summary><h3 style={{ display: "inline" }}>Marcar un día inhábil</h3></summary>
              <p className="aviso">Para vacaciones o suspensiones de labores. Ya están cargados los días inhábiles de la Ley de Amparo (art. 19) de 2026 y 2027.</p>
              <InhabilForm fecha={diaSel} />
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
