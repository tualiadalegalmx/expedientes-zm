import Link from "next/link";
import { usuarioActual } from "@/lib/supabase/server";
import { diasDesde, diasRestantes, fecha, fechaLarga, hoy } from "@/lib/fechas";
import { PlazoChip } from "@/components/Semaforo";
import { TIPOS, type Tipo } from "@/lib/catalogos";

export const metadata = { title: "Hoy" };

export default async function Hoy() {
  const { sb, perfil } = await usuarioActual();
  const ayer = new Date(Date.now() - 2 * 86_400_000).toISOString();

  const [{ data: plazos }, { data: pendientes }, { data: exps }, { data: actividad }, { data: usuarios }] = await Promise.all([
    sb.from("plazos").select("id, actuacion, vencimiento, expediente_id, expedientes(numero, responsable_id)").eq("estado", "abierto").order("vencimiento"),
    sb.from("bitacora").select("id, descripcion, fecha_compromiso, expediente_id, expedientes(numero)").eq("tipo", "pendiente").eq("cumplido", false).eq("responsable_id", perfil.id).order("fecha_compromiso"),
    sb.from("v_expedientes").select("id, numero, cliente, responsable, ultimo_movimiento").eq("estado", "activo").order("ultimo_movimiento"),
    sb.from("bitacora").select("id, tipo, created_by, created_at, expediente_id, expedientes(numero)").gte("created_at", ayer).order("created_at", { ascending: false }),
    sb.from("perfiles").select("id, nombre, rol").eq("activo", true).order("nombre"),
  ]);

  const urgentes = (plazos ?? []).filter((p) => diasRestantes(p.vencimiento) <= 3) as unknown as
    { id: string; actuacion: string; vencimiento: string; expediente_id: string; expedientes: { numero: string } | null }[];
  const quietos = (exps ?? []).filter((e) => diasDesde(e.ultimo_movimiento) >= 3);
  const hoyIso = hoy();
  const ultimoDia = (actividad ?? []).filter((a) => a.created_at >= ayer);
  const porUsuario = new Map<string, typeof ultimoDia>();
  ultimoDia.forEach((a) => porUsuario.set(a.created_by, [...(porUsuario.get(a.created_by) ?? []), a]));
  const abogados = (usuarios ?? []).filter((u) => u.rol === "abogado" || u.rol === "admin");

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Buen día, {perfil.nombre}</h1>
          <p className="sub" style={{ textTransform: "none" }}>{fechaLarga(hoyIso).replace(/^./, (c) => c.toUpperCase())}</p>
        </div>
        <form action="/expedientes" role="search" style={{ display: "flex", gap: 8, minWidth: "min(100%, 360px)" }}>
          <input name="q" type="search" placeholder="Buscar expediente…" aria-label="Buscar expediente" />
          <button className="boton">Buscar</button>
        </form>
      </div>

      <section className="hoja seccion">
        <h2>Vence hoy y en los próximos 3 días</h2>
        {urgentes.length === 0 ? (
          <p className="vacio">No hay plazos por vencer en los próximos 3 días hábiles.</p>
        ) : (
          <ul className="tabla-simple">
            {urgentes.map((p) => (
              <li key={p.id}>
                <Link href={`/expedientes/${p.expediente_id}`}>
                  <span className="numero-chico">{p.expedientes?.numero}</span>{" "}
                  <span>{p.actuacion}</span>
                </Link>
                <PlazoChip vencimiento={p.vencimiento} conFecha />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="rejilla" style={{ marginTop: 20 }}>
        <section className="hoja">
          <h2 style={{ marginBottom: 8 }}>Mis pendientes</h2>
          {(pendientes ?? []).length === 0 ? <p className="vacio">No tienes pendientes abiertos.</p> : (
            <ul className="tabla-simple">
              {(pendientes as unknown as { id: string; descripcion: string; fecha_compromiso: string | null; expediente_id: string; expedientes: { numero: string } | null }[]).map((p) => (
                <li key={p.id}>
                  <Link href={`/expedientes/${p.expediente_id}`}><span className="numero-chico">{p.expedientes?.numero}</span> {p.descripcion}</Link>
                  <span className="aviso" style={{ whiteSpace: "nowrap" }}>{fecha(p.fecha_compromiso)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hoja">
          <h2 style={{ marginBottom: 8 }}>Sin movimiento en 3 días o más</h2>
          {quietos.length === 0 ? <p className="vacio">Todos los expedientes activos tienen movimiento reciente.</p> : (
            <ul className="tabla-simple">
              {quietos.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <Link href={`/expedientes/${e.id}`}><span className="numero-chico">{e.numero}</span> <span className="aviso">{e.responsable}</span></Link>
                  <span className="quieto-etiqueta">{diasDesde(e.ultimo_movimiento)} días</span>
                </li>
              ))}
              {quietos.length > 8 && <li><Link href="/expedientes?quietos=1" className="aviso">Ver los {quietos.length}</Link></li>}
            </ul>
          )}
        </section>

        <section className="hoja">
          <h2 style={{ marginBottom: 8 }}>Actividad de ayer y hoy</h2>
          <ul className="tabla-simple">
            {abogados.map((u) => {
              const regs = porUsuario.get(u.id) ?? [];
              const conteo = new Map<string, number>();
              regs.forEach((r) => conteo.set(r.tipo, (conteo.get(r.tipo) ?? 0) + 1));
              return (
                <li key={u.id}>
                  <span style={{ fontWeight: 600 }}>{u.nombre}</span>
                  <span className={regs.length ? "aviso" : "quieto-etiqueta"} style={{ textAlign: "right" }}>
                    {regs.length === 0 ? "Sin registros" : [...conteo].map(([t, k]) => `${k} ${TIPOS[t as Tipo].toLowerCase()}`).join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
