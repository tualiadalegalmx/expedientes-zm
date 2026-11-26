import Link from "next/link";
import { usuarioActual } from "@/lib/supabase/server";
import { nombreMes, puedeSubirDocs, textoSobre, type Entidad } from "@/lib/entidades";
import { hoy } from "@/lib/fechas";
import { guardarEntidad } from "./acciones";

export const metadata = { title: "Empresas" };

const AVISOS: Record<string, { ok: boolean; texto: string }> = {
  agregada: { ok: true, texto: "Agregada." },
  repetida: { ok: false, texto: "Ya existe una con ese nombre." },
  "sin-nombre": { ok: false, texto: "Escribe el nombre." },
  error: { ok: false, texto: "No se pudo guardar." },
};

export default async function Empresas({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { sb, perfil } = await usuarioActual();
  const aviso = AVISOS[(await searchParams).aviso ?? ""];
  const mesActual = hoy().slice(0, 7) + "-01";
  const [{ data, error }, { data: docs }] = await Promise.all([
    sb.from("entidades").select("*").eq("activa", true).order("orden").order("nombre"),
    sb.from("documentos_entidad").select("entidad_id, periodo"),
  ]);
  const entidades = (data ?? []) as Entidad[];
  const delMes = new Map<number, number>();
  (docs ?? []).forEach((d) => {
    if (d.periodo === mesActual) delMes.set(d.entidad_id, (delMes.get(d.entidad_id) ?? 0) + 1);
  });
  const puede = puedeSubirDocs(perfil.rol);

  const grupo = (tipo: "fisica" | "moral", titulo: string) => {
    const lista = entidades.filter((e) => e.tipo === tipo);
    return (
      <section className="ent-grupo" aria-labelledby={`g-${tipo}`}>
        <h2 id={`g-${tipo}`}>{titulo}</h2>
        {lista.length === 0 ? <p className="vacio">Ninguna todavía.</p> : (
          <div className="ent-botones">
            {lista.map((e) => {
              const n = delMes.get(e.id) ?? 0;
              return (
                <Link key={e.id} href={`/empresas/${e.id}`} className="ent-boton" style={{ background: e.color, color: textoSobre(e.color) }}>
                  <b>{e.nombre}</b>
                  <span>{n ? `${n} ${n === 1 ? "documento" : "documentos"} de ${nombreMes(mesActual).toLowerCase()}` : `Falta cargar ${nombreMes(mesActual).toLowerCase()}`}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Empresas</h1>
          <p className="sub">Expediente de cada persona y empresa: constancias y documentos del mes.</p>
        </div>
      </div>
      {error && <p className="error">Esta sección todavía no está habilitada en la base de datos. Corre la migración 014 en Supabase.</p>}
      {aviso && <p className={aviso.ok ? "aviso-ok" : "error"} role={aviso.ok ? "status" : "alert"}>{aviso.texto}</p>}

      {grupo("fisica", "Personas físicas")}
      {grupo("moral", "Personas morales")}

      {puede && !error && (
        <details className="hoja ent-nueva">
          <summary><h2 style={{ display: "inline", fontSize: "1.15rem" }}>Agregar persona o empresa</h2></summary>
          <form action={guardarEntidad} className="campos" style={{ marginTop: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
            <div className="campo ancho"><label htmlFor="e-nombre">Nombre o razón social</label><input id="e-nombre" name="nombre" required /></div>
            <div className="campo"><label htmlFor="e-tipo">Tipo</label>
              <select id="e-tipo" name="tipo" defaultValue="moral"><option value="moral">Persona moral</option><option value="fisica">Persona física</option></select>
            </div>
            <div className="campo"><label htmlFor="e-rfc">RFC <small>(opcional)</small></label><input id="e-rfc" name="rfc" /></div>
            <div className="campo"><label htmlFor="e-color">Color del botón</label><input id="e-color" name="color" type="color" defaultValue="#3d4a3e" style={{ height: 40, padding: 4 }} /></div>
            <div className="campo"><button className="boton">Agregar</button></div>
          </form>
        </details>
      )}
    </>
  );
}
