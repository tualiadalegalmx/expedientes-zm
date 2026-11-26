import Link from "next/link";
import { notFound } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { hoy } from "@/lib/fechas";
import { nombreMes, puedeSubirDocs, tamano, textoSobre, type Documento, type Entidad } from "@/lib/entidades";
import { SubirDocumentos } from "@/components/SubirDocumentos";
import { eliminarDocumento, eliminarMes, guardarEntidad } from "../acciones";

export const metadata = { title: "Expediente de empresa" };

const AVISOS: Record<string, { ok: boolean; texto: string }> = {
  borrado: { ok: true, texto: "Documento eliminado." },
  "mes-borrado": { ok: true, texto: "Documentos del mes eliminados." },
  guardada: { ok: true, texto: "Datos guardados." },
  repetida: { ok: false, texto: "Ya existe otra con ese nombre." },
  error: { ok: false, texto: "No se pudo guardar." },
};

const momento = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" });
const icono = (mime: string | null, nombre: string) => {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.includes("pdf") || ext === "pdf") return "PDF";
  if (mime?.startsWith("image/")) return "IMG";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (ext === "xml") return "XML";
  return ext.slice(0, 4).toUpperCase() || "ARCH";
};

export default async function ExpedienteEmpresa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string; aviso?: string; n?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { sb, perfil } = await usuarioActual();
  const [{ data: ent }, { data: docs }, { data: us }] = await Promise.all([
    sb.from("entidades").select("*").eq("id", Number(id)).maybeSingle(),
    sb.from("documentos_entidad").select("*").eq("entidad_id", Number(id)).order("periodo", { ascending: false }).order("categoria").order("created_at", { ascending: false }),
    sb.from("perfiles").select("id, nombre"),
  ]);
  if (!ent) notFound();
  const e = ent as Entidad;
  const todos = (docs ?? []) as Documento[];
  const permanentes = todos.filter((d) => d.permanente);
  const lista = todos.filter((d) => !d.permanente);
  const nombre = new Map((us ?? []).map((u) => [u.id, u.nombre as string]));
  const puede = puedeSubirDocs(perfil.rol);
  const aviso = AVISOS[sp.aviso ?? ""];

  const mesHoy = hoy().slice(0, 7);
  const meses = [...new Set(lista.map((d) => d.periodo.slice(0, 7)))].sort().reverse();
  if (!meses.includes(mesHoy)) meses.unshift(mesHoy);
  const mesSel = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : meses[0];
  if (!meses.includes(mesSel)) meses.push(mesSel);
  const delMes = lista.filter((d) => d.periodo.slice(0, 7) === mesSel);
  const agrupar = (ds: Documento[]) => {
    const m = new Map<string, Documento[]>();
    ds.forEach((d) => m.set(d.categoria, [...(m.get(d.categoria) ?? []), d]));
    return [...m];
  };
  const anteriores = meses.filter((m) => m < mesHoy && lista.some((d) => d.periodo.slice(0, 7) === m));
  const color = textoSobre(e.color);
  const grupos = (gs: [string, Documento[]][]) => gs.map(([cat, ds]) => (
                <div key={cat} className="ent-cat">
                  <h3 style={{ borderColor: e.color }}>{cat}</h3>
                  <ul>
                    {ds.map((d) => (
                      <li key={d.id} className="doc">
                        <span className="doc-ico" style={{ background: e.color, color }}>{icono(d.tipo_mime, d.nombre)}</span>
                        <div className="doc-txt">
                          <a href={`/documento?id=${d.id}`} target="_blank" rel="noopener"><strong>{d.nombre}</strong></a>
                          <span className="aviso">{[tamano(d.bytes), `${nombre.get(d.created_by) ?? "—"}, ${momento.format(new Date(d.created_at))}`].filter(Boolean).join(" · ")}</span>
                          {d.notas && <span className="doc-notas">{d.notas}</span>}
                        </div>
                        <div className="doc-acc">
                          <a className="boton secundario chico" href={`/documento?id=${d.id}`} target="_blank" rel="noopener">Ver</a>
                          <a className="boton chico" href={`/documento?id=${d.id}&descargar`}>Descargar</a>
                          {puede && (
                            <form action={eliminarDocumento}>
                              <input type="hidden" name="id" value={d.id} /><input type="hidden" name="entidad_id" value={e.id} /><input type="hidden" name="mes" value={d.permanente ? "" : mesSel} />
                              <button className="boton secundario chico peligro">Eliminar</button>
                            </form>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ));


  return (
    <>
      <header className="ent-cabeza" style={{ background: e.color, color }}>
        <div>
          <Link href="/empresas" className="ent-volver" style={{ color }}>‹ Empresas</Link>
          <h1>{e.nombre}</h1>
          <p>{e.tipo === "fisica" ? "Persona física" : "Persona moral"}{e.rfc && ` · RFC ${e.rfc}`} · {permanentes.length} {permanentes.length === 1 ? "permanente" : "permanentes"} · {lista.length} {lista.length === 1 ? "mensual" : "mensuales"}</p>
        </div>
      </header>

      {aviso && <p className={aviso.ok ? "aviso-ok" : "error"} role={aviso.ok ? "status" : "alert"}>{aviso.texto}{sp.aviso === "mes-borrado" && sp.n ? ` (${sp.n})` : ""}</p>}
      {puede && anteriores.length > 0 && mesSel === mesHoy && (
        <p className="ent-recordatorio">
          Hay documentos de meses anteriores ({anteriores.map(nombreMes).join(", ")}). Cuando termines de subir los de {nombreMes(mesHoy).toLowerCase()}, puedes eliminarlos desde su mes.
        </p>
      )}

      <div className="ent-layout">
        <div className="ent-col">
        <section className="hoja tablero ent-perm">
          <header className="tablero-cabeza" style={{ background: e.color, color }}>
            <h2>Documentos permanentes</h2>
            <span className="aviso" style={{ color }}>{permanentes.length} · no se borran al cambiar de mes</span>
          </header>
          <div className="ent-docs">
            {permanentes.length === 0
              ? <p className="vacio">Aquí van el acta constitutiva, poderes, currículum y lo que no cambia cada mes.</p>
              : grupos(agrupar(permanentes))}
          </div>
        </section>

        <section className="hoja tablero">
          <header className="tablero-cabeza" style={{ background: e.color, color }}>
            <h2>{nombreMes(mesSel + "-01")}</h2>
            <span className="aviso" style={{ color }}>{delMes.length} {delMes.length === 1 ? "documento" : "documentos"}</span>
          </header>
          <nav className="ent-meses" aria-label="Meses">
            {meses.map((m) => (
              <Link key={m} href={`/empresas/${e.id}?mes=${m}`} className={`ent-mes${m === mesSel ? " sel" : ""}`} aria-current={m === mesSel ? "page" : undefined}
                style={m === mesSel ? { background: e.color, color, borderColor: e.color } : undefined}>
                {nombreMes(m + "-01")}{m === mesHoy && " (actual)"}
              </Link>
            ))}
          </nav>

          <div className="ent-docs">
            {delMes.length === 0 ? (
              <p className="vacio">{mesSel === mesHoy ? "Todavía no se cargan los documentos de este mes." : "No hay documentos de este mes."}</p>
            ) : (
              grupos(agrupar(delMes))
            )}
          </div>

          {puede && delMes.length > 0 && (
            <details className="ent-borrar-mes">
              <summary className="boton secundario chico peligro">Eliminar todos los documentos de {nombreMes(mesSel + "-01").toLowerCase()}</summary>
              <form action={eliminarMes}>
                <input type="hidden" name="entidad_id" value={e.id} /><input type="hidden" name="periodo" value={`${mesSel}-01`} />
                <p>Se borrarán <b>{delMes.length}</b> {delMes.length === 1 ? "archivo" : "archivos"} de {nombreMes(mesSel + "-01").toLowerCase()}. No se pueden recuperar.</p>
                <button className="boton chico" style={{ background: "var(--rojo)", borderColor: "var(--rojo)" }}>Sí, eliminar {delMes.length}</button>
              </form>
            </details>
          )}
        </section>
        </div>

        {puede && (
          <aside className="hoja tablero">
            <header className="tablero-cabeza" style={{ background: e.color, color }}><h2>Subir documentos</h2></header>
            <div style={{ padding: "16px 20px 0" }}>
              <SubirDocumentos entidadId={e.id} mesInicial={mesSel} />
            </div>
            <details className="ent-editar">
              <summary>Editar nombre, RFC o color</summary>
              <form action={guardarEntidad} className="campos" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <input type="hidden" name="id" value={e.id} />
                <div className="campo ancho"><label htmlFor="x-nombre">Nombre</label><input id="x-nombre" name="nombre" defaultValue={e.nombre} required /></div>
                <div className="campo"><label htmlFor="x-tipo">Tipo</label>
                  <select id="x-tipo" name="tipo" defaultValue={e.tipo}><option value="moral">Persona moral</option><option value="fisica">Persona física</option></select>
                </div>
                <div className="campo"><label htmlFor="x-rfc">RFC</label><input id="x-rfc" name="rfc" defaultValue={e.rfc ?? ""} /></div>
                <div className="campo"><label htmlFor="x-color">Color</label><input id="x-color" name="color" type="color" defaultValue={e.color} style={{ height: 40, padding: 4 }} /></div>
                <div className="campo"><label htmlFor="x-activa">Mostrar</label>
                  <select id="x-activa" name="activa" defaultValue="si"><option value="si">Sí</option><option value="no">Ocultar</option></select>
                </div>
                <div className="campo ancho"><button className="boton secundario">Guardar</button></div>
              </form>
            </details>
          </aside>
        )}
      </div>
    </>
  );
}
