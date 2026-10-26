import Link from "next/link";
import { usuarioActual } from "@/lib/supabase/server";
import { catalogos, ESTADOS } from "@/lib/catalogos";
import { diasDesde } from "@/lib/fechas";
import { PlazoChip } from "@/components/Semaforo";

export const metadata = { title: "Expedientes" };

type Filtros = { q?: string; materia?: string; responsable?: string; etapa?: string; estado?: string; quietos?: string };

const SIN_MOVIMIENTO = 3;

export default async function Expedientes({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams;
  const { sb } = await usuarioActual();
  const c = await catalogos(sb);
  const estado = f.estado ?? "activo";

  let consulta = sb.from("v_expedientes").select("*").order("proximo_vencimiento", { ascending: true, nullsFirst: false }).order("numero");
  if (estado !== "todos") consulta = consulta.eq("estado", estado);
  if (f.materia) consulta = consulta.eq("materia_id", f.materia);
  if (f.responsable) consulta = consulta.eq("responsable_id", f.responsable);
  if (f.etapa) consulta = consulta.eq("etapa_id", f.etapa);
  if (f.q) {
    const t = f.q.replace(/[,()%]/g, " ").trim();
    consulta = consulta.or(["numero", "cliente", "contraparte", "autoridad", "lugar", "juzgado"].map((k) => `${k}.ilike.%${t}%`).join(","));
  }
  const { data, error } = await consulta;
  let lista = data ?? [];
  if (f.quietos) lista = lista.filter((e) => diasDesde(e.ultimo_movimiento) >= SIN_MOVIMIENTO);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Expedientes</h1>
          <p className="sub">{lista.length} {lista.length === 1 ? "expediente" : "expedientes"} · ordenados por el próximo vencimiento</p>
        </div>
        <Link className="boton" href="/expedientes/nuevo">Nuevo expediente</Link>
      </div>

      <form className="filtros" role="search">
        <div className="campo busqueda">
          <label htmlFor="q">Buscar</label>
          <input id="q" name="q" type="search" defaultValue={f.q} placeholder="Número, cliente, autoridad, lugar…" />
        </div>
        <div className="campo">
          <label htmlFor="materia">Materia</label>
          <select id="materia" name="materia" defaultValue={f.materia ?? ""}>
            <option value="">Todas</option>
            {c.materias.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="responsable">Responsable</label>
          <select id="responsable" name="responsable" defaultValue={f.responsable ?? ""}>
            <option value="">Todos</option>
            {c.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="etapa">Etapa</label>
          <select id="etapa" name="etapa" defaultValue={f.etapa ?? ""}>
            <option value="">Todas</option>
            {c.etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={estado}>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="todos">Todos</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.88rem", whiteSpace: "nowrap" }}>
            <input type="checkbox" name="quietos" value="1" defaultChecked={!!f.quietos} style={{ width: "auto" }} />
            Sin movimiento
          </label>
          <button className="boton secundario">Filtrar</button>
        </div>
      </form>

      {error && <p className="error">No se pudo cargar la lista: {error.message}</p>}
      {lista.length === 0 ? (
        <div className="hoja"><p className="vacio">Ningún expediente coincide con estos filtros.</p></div>
      ) : (
        <ul className="lista">
          {lista.map((e) => {
            const quieto = diasDesde(e.ultimo_movimiento);
            return (
              <li key={e.id}>
                <Link href={`/expedientes/${e.id}`} className={`fila${quieto >= SIN_MOVIMIENTO ? " quieto" : ""}`}>
                  <span className="numero">{e.numero}</span>
                  <span>
                    <span className="cliente">{e.cliente}</span>
                    <span className="meta"> · {e.juzgado} · {e.materia}</span>
                    {quieto >= SIN_MOVIMIENTO && <span className="quieto-etiqueta" style={{ display: "block" }}>{quieto} días sin movimiento</span>}
                  </span>
                  <span className="meta col-resp">{e.responsable} · {e.etapa}</span>
                  <span>{e.proximo_vencimiento ? <PlazoChip vencimiento={e.proximo_vencimiento} /> : <span className="meta">Sin plazos abiertos</span>}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
