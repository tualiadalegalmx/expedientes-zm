import { usuarioActual } from "@/lib/supabase/server";
import { diasRestantes, fecha } from "@/lib/fechas";
import { TareaForm } from "@/components/TareaForm";
import { borrarTarea, moverTarea } from "./acciones";

export const metadata = { title: "Tareas" };

type Tarea = {
  id: string; responsable_id: string; titulo: string; descripcion: string | null; fecha_limite: string | null;
  estado: "pendiente" | "en_proceso" | "terminada"; terminada_at: string | null; created_by: string; created_at: string;
};

const COLUMNAS = [
  { estado: "pendiente", titulo: "Pendientes" },
  { estado: "en_proceso", titulo: "En proceso" },
  { estado: "terminada", titulo: "Terminadas" },
] as const;

const SIGUIENTE: Record<Tarea["estado"], { a: Tarea["estado"]; texto: string }[]> = {
  pendiente: [{ a: "en_proceso", texto: "Empezar" }, { a: "terminada", texto: "Terminar" }],
  en_proceso: [{ a: "terminada", texto: "Terminar" }, { a: "pendiente", texto: "Regresar a pendiente" }],
  terminada: [{ a: "en_proceso", texto: "Reabrir" }],
};

const momento = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });

function Limite({ f, estado }: { f: string; estado: Tarea["estado"] }) {
  if (estado === "terminada") return <span className="t-fecha">Límite {fecha(f)}</span>;
  const n = diasRestantes(f);
  const clase = n < 0 ? "vencida" : n <= 1 ? "pronto" : "";
  const texto = n < 0 ? `Venció ${fecha(f)}` : n === 0 ? "Vence hoy" : n === 1 ? "Vence mañana" : `Vence ${fecha(f)}`;
  return <span className={`t-fecha ${clase}`}>{texto}</span>;
}

export default async function Tareas() {
  const { sb, perfil, esAdmin } = await usuarioActual();

  const [{ data: personasRol }, { data: tareas, error }] = await Promise.all([
    sb.from("perfiles").select("id, nombre").in("rol", ["administrativo", "desarrollo"]).eq("activo", true).order("nombre", { ascending: false }),
    sb.from("tareas").select("*").order("fecha_limite", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
  ]);
  // Si aún no tienen rol asignado, se buscan por nombre.
  let personas = personasRol ?? [];
  if (personas.length === 0) {
    const { data } = await sb.from("perfiles").select("id, nombre").or("nombre.ilike.Ricardo%,nombre.ilike.Rafael%").order("nombre", { ascending: false });
    personas = data ?? [];
  }

  const sinTabla = error && (error.message.includes("tareas") || error.code === "PGRST205" || error.code === "42P01");
  const lista = (tareas ?? []) as Tarea[];

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Tareas</h1>
          <p className="sub">Cada quien agrega sus tareas y las mueve conforme avanza.</p>
        </div>
      </div>

      {sinTabla && <p className="error">La sección de tareas todavía no está habilitada en la base de datos. Corre la migración 004 en Supabase.</p>}

      <div className="tableros">
        {personas.map((p) => {
          const suyas = lista.filter((t) => t.responsable_id === p.id);
          const puede = esAdmin || p.id === perfil.id;
          const abiertas = suyas.filter((t) => t.estado !== "terminada").length;
          return (
            <section key={p.id} className="tablero hoja">
              <header className="tablero-cabeza">
                <h2>{p.nombre}</h2>
                <span className="aviso">{abiertas === 0 ? "Sin tareas abiertas" : `${abiertas} ${abiertas === 1 ? "tarea abierta" : "tareas abiertas"}`}</span>
              </header>
              {puede && !sinTabla && <TareaForm responsableId={p.id} />}

              {COLUMNAS.map((c) => {
                let enColumna = suyas.filter((t) => t.estado === c.estado);
                if (c.estado === "terminada")
                  enColumna = enColumna.sort((a, b) => (b.terminada_at ?? "").localeCompare(a.terminada_at ?? "")).slice(0, 15);
                return (
                  <div key={c.estado} className={`grupo g-${c.estado}`}>
                    <h3>{c.titulo} <span>{suyas.filter((t) => t.estado === c.estado).length}</span></h3>
                    {enColumna.length === 0 ? (
                      <p className="vacio">{c.estado === "pendiente" ? "Nada pendiente." : c.estado === "en_proceso" ? "Nada en proceso." : "Aún no hay tareas terminadas."}</p>
                    ) : (
                      <ul className="tareas">
                        {enColumna.map((t) => (
                          <li key={t.id} className={`tarea e-${t.estado}`}>
                            <div className="tarea-texto">
                              <strong>{t.titulo}</strong>
                              {t.descripcion && <p>{t.descripcion}</p>}
                              <div className="tarea-pie">
                                {t.fecha_limite && <Limite f={t.fecha_limite} estado={t.estado} />}
                                {t.estado === "terminada" && t.terminada_at && <span>Terminada el {momento.format(new Date(t.terminada_at))}</span>}
                                {t.created_by !== t.responsable_id && <span>Asignada por Zaida</span>}
                              </div>
                            </div>
                            {puede && (
                              <div className="tarea-botones">
                                {SIGUIENTE[t.estado].map((s) => (
                                  <form key={s.a} action={moverTarea}>
                                    <input type="hidden" name="id" value={t.id} />
                                    <input type="hidden" name="estado" value={s.a} />
                                    <button className={`boton chico ${s.a === "terminada" ? "" : "secundario"}`}>{s.texto}</button>
                                  </form>
                                ))}
                                {esAdmin && (
                                  <form action={borrarTarea}>
                                    <input type="hidden" name="id" value={t.id} />
                                    <button className="boton chico secundario" title="Borrar tarea">Borrar</button>
                                  </form>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
        {personas.length === 0 && (
          <div className="hoja"><p className="vacio">No se encontraron a Ricardo ni a Rafael entre los usuarios. Revisa que estén dados de alta en Supabase.</p></div>
        )}
      </div>
    </>
  );
}
