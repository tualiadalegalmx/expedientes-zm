import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { catalogos, ESTADOS, TIPOS, type Tipo } from "@/lib/catalogos";
import { diasDesde, diasRestantes, fecha, semaforo, textoRestantes } from "@/lib/fechas";
import { PlazoChip } from "@/components/Semaforo";
import { RegistroForm } from "@/components/RegistroForm";
import { eliminarRegistro, marcarPendiente, plazoSinEfecto } from "../acciones";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb } = await usuarioActual();
  const { data } = await sb.from("expedientes").select("numero").eq("id", id).maybeSingle();
  return { title: data?.numero ?? "Expediente" };
}

type Registro = {
  id: string; tipo: Tipo; fecha: string; hora: string | null; descripcion: string; resultado: string | null;
  duracion_min: number | null; acuerdos: string | null; genera_plazo: boolean | null; responsable_id: string | null;
  fecha_compromiso: string | null; cumplido: boolean; cumplido_at: string | null; created_by: string; created_at: string; updated_at: string;
};
type Plazo = {
  id: string; acuerdo_id: string | null; fecha_surte_efectos: string; cantidad: number; unidad: string; tipo_dias: string;
  actuacion: string; fundamento: string | null; vencimiento: string; estado: string; cumplido_fecha: string | null; folio: string | null;
};

const momento = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, perfil, esAdmin } = await usuarioActual();
  const [{ data: e }, { data: regs }, { data: plazos }, { data: adj }, c] = await Promise.all([
    sb.from("v_expedientes").select("*").eq("id", id).maybeSingle(),
    sb.from("bitacora").select("*").eq("expediente_id", id).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
    sb.from("plazos").select("*").eq("expediente_id", id).order("vencimiento"),
    sb.from("adjuntos").select("id, bitacora_id, ruta, nombre").eq("expediente_id", id),
    catalogos(sb),
  ]);
  if (!e) notFound();

  const nombre = new Map(c.usuarios.map((u) => [u.id, u.nombre]));
  const registros = (regs ?? []) as Registro[];
  const todosPlazos = (plazos ?? []) as Plazo[];
  const abiertos = todosPlazos.filter((p) => p.estado === "abierto");
  const plazoDeAcuerdo = new Map(todosPlazos.filter((p) => p.acuerdo_id).map((p) => [p.acuerdo_id!, p]));
  const pendientes = registros.filter((r) => r.tipo === "pendiente" && !r.cumplido);
  const archivos = new Map<string, { ruta: string; nombre: string }[]>();
  (adj ?? []).forEach((a) => archivos.set(a.bitacora_id, [...(archivos.get(a.bitacora_id) ?? []), a]));

  const proximo = abiertos[0];
  const n = proximo ? diasRestantes(proximo.vencimiento) : null;
  const quieto = diasDesde(e.ultimo_movimiento);

  return (
    <>
      <section className="ficha-cabeza">
        <div>
          <div className="numero">{e.numero}</div>
          <div className="juzgado">{e.juzgado} · {e.autoridad}</div>
          <dl className="datos" style={{ marginTop: 16 }}>
            <div><dt>Cliente</dt><dd>{e.cliente}</dd></div>
            {e.contraparte && <div><dt>Contraparte</dt><dd>{e.contraparte}</dd></div>}
            <div><dt>Materia</dt><dd>{e.materia}{e.tipo_juicio && ` · ${e.tipo_juicio}`}</dd></div>
            <div><dt>Lugar</dt><dd>{e.lugar}</dd></div>
            <div><dt>Responsable</dt><dd>{e.responsable}</dd></div>
            <div><dt>Etapa procesal</dt><dd>{e.etapa}</dd></div>
            <div><dt>Estado</dt><dd><span className={`estado ${e.estado}`}>{ESTADOS[e.estado as keyof typeof ESTADOS]}</span></dd></div>
            <div>
              <dt>Último movimiento</dt>
              <dd style={quieto >= 3 ? { color: "#7c5d2f" } : undefined}>{quieto === 0 ? "Hoy" : `Hace ${quieto} ${quieto === 1 ? "día" : "días"}`}</dd>
            </div>
          </dl>
          <p style={{ marginTop: 14 }}><Link href={`/expedientes/${id}/editar`} className="boton secundario chico">Editar datos</Link></p>
        </div>
        {proximo && n !== null ? (
          <div className={`cuenta s-${semaforo(n)}`} aria-label="Próximo vencimiento">
            <span className="n">{n < 0 ? `−${-n}` : n}</span>
            <span className="t" style={{ display: "block" }}>{textoRestantes(n)}</span>
            <span className="t" style={{ display: "block", color: "var(--tinta)", fontWeight: 600 }}>{proximo.actuacion}</span>
            <span className="t">{fecha(proximo.vencimiento)}</span>
          </div>
        ) : (
          <div className="cuenta"><span className="t">Sin plazos abiertos</span></div>
        )}
      </section>

      {(pendientes.length > 0 || abiertos.length > 1) && (
        <section className="hoja seccion" style={{ marginBottom: 20 }}>
          <h2>Acciones inmediatas</h2>
          <ul className="inmediato" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {abiertos.map((p) => (
              <li key={p.id}>
                <span>{p.actuacion}</span>
                <PlazoChip vencimiento={p.vencimiento} conFecha />
              </li>
            ))}
            {pendientes.map((r) => (
              <li key={r.id}>
                <span>{r.descripcion} <span className="aviso">· {nombre.get(r.responsable_id ?? "") ?? "Sin responsable"}{r.fecha_compromiso && `, para el ${fecha(r.fecha_compromiso)}`}</span></span>
                <form action={marcarPendiente}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="expediente_id" value={id} />
                  <input type="hidden" name="cumplido" value="si" />
                  <button className="boton secundario chico">Marcar cumplido</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dos-col">
        <section className="hoja">
          <h2 style={{ marginBottom: 8 }}>Historia del expediente</h2>
          {registros.length === 0 ? (
            <p className="vacio">Todavía no hay registros. Usa el formulario para capturar el primero.</p>
          ) : (
            <ol className="linea">
              {registros.map((r) => {
                const plazo = plazoDeAcuerdo.get(r.id);
                const editado = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > 60_000;
                return (
                  <li key={r.id} className={`evento t-${r.tipo}`}>
                    <div className="cuando">{fecha(r.fecha)}{r.hora && <><br />{r.hora.slice(0, 5)}</>}</div>
                    <div>
                      <div className="tipo">{TIPOS[r.tipo]}</div>
                      <p className={`texto${r.tipo === "pendiente" && r.cumplido ? " hecho" : ""}`}>{r.descripcion}</p>
                      {r.resultado && <p className="texto"><b>Resultado:</b> {r.resultado}</p>}
                      {r.acuerdos && <p className="texto"><b>Acuerdos:</b> {r.acuerdos}{r.duracion_min && ` (${r.duracion_min} min)`}</p>}
                      {r.tipo === "pendiente" && (
                        <p className="texto aviso">
                          {nombre.get(r.responsable_id ?? "")} · compromiso {fecha(r.fecha_compromiso)}
                          {r.cumplido && r.cumplido_at && ` · cumplido el ${momento.format(new Date(r.cumplido_at))}`}
                        </p>
                      )}
                      {plazo && (
                        <p className="texto" style={{ marginTop: 6 }}>
                          Plazo: {plazo.cantidad} {plazo.unidad === "horas" ? "horas" : `días ${plazo.tipo_dias}`} para {plazo.actuacion.toLowerCase()}
                          {plazo.fundamento && ` (${plazo.fundamento})`}.{" "}
                          {plazo.estado === "abierto" ? <PlazoChip vencimiento={plazo.vencimiento} conFecha /> :
                            plazo.estado === "cumplido" ? <span className="aviso">Cumplido el {fecha(plazo.cumplido_fecha)}; vencía {fecha(plazo.vencimiento)}.</span> :
                            <span className="aviso">Sin efecto.</span>}
                        </p>
                      )}
                      {archivos.get(r.id) && (
                        <p className="pie archivos">
                          {archivos.get(r.id)!.map((a) => (
                            <a key={a.ruta} href={`/archivo?ruta=${encodeURIComponent(a.ruta)}`} target="_blank" rel="noopener">{a.nombre}</a>
                          ))}
                        </p>
                      )}
                      <div className="pie">
                        <span>{nombre.get(r.created_by) ?? "—"} · {momento.format(new Date(r.created_at))}{editado && " · editado"}</span>
                        {plazo?.estado === "abierto" && (esAdmin || r.created_by === perfil.id || e.responsable_id === perfil.id) && (
                          <form action={plazoSinEfecto}>
                            <input type="hidden" name="id" value={plazo.id} />
                            <input type="hidden" name="expediente_id" value={id} />
                            <button className="boton secundario chico">Plazo sin efecto</button>
                          </form>
                        )}
                        {esAdmin && (
                          <form action={eliminarRegistro}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="expediente_id" value={id} />
                            <button className="boton secundario chico">Eliminar</button>
                          </form>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <RegistroForm
          expedienteId={id}
          usuarios={c.usuarios}
          usuarioId={perfil.id}
          plazosAbiertos={abiertos.map((p) => ({ id: p.id, actuacion: p.actuacion, vencimiento: p.vencimiento }))}
        />
      </div>
    </>
  );
}
