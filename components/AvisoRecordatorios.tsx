import Link from "next/link";
import type { Recordatorio } from "@/lib/recordatorios";

const ETIQUETA = { vencido: "Vencido", hoy: "Hoy", pronto: "Pronto", recordatorio: "Recordatorio" } as const;

export function AvisoRecordatorios({ lista }: { lista: Recordatorio[] }) {
  if (lista.length === 0)
    return <p className="aviso-ok" role="status">Sin pendientes urgentes. Nada vence hoy ni mañana.</p>;
  const vencidos = lista.filter((r) => r.nivel === "vencido").length;
  const hoy = lista.filter((r) => r.nivel === "hoy").length;
  const partes = [
    vencidos && `${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}`,
    hoy && `${hoy} para hoy`,
    lista.length - vencidos - hoy && `${lista.length - vencidos - hoy} próximos`,
  ].filter(Boolean);
  const visibles = lista.slice(0, 6), resto = lista.slice(6);
  const fila = (r: Recordatorio, i: number) => (
    <li key={i} className={`rec r-${r.nivel}`}>
      <span className="rec-nivel">{ETIQUETA[r.nivel]}</span>
      <Link href={r.href} className="rec-texto"><strong>{r.texto}</strong></Link>
      <span className="rec-cuando">{r.cuando}{r.quien && ` · ${r.quien}`}</span>
    </li>
  );
  return (
    <section className={`avisos${vencidos ? " con-vencidos" : ""}`} aria-labelledby="avisos-titulo" role="alert">
      <h2 id="avisos-titulo">Requiere tu atención <span>{partes.join(", ")}</span></h2>
      <ul>{visibles.map(fila)}</ul>
      {resto.length > 0 && (
        <details><summary>Ver {resto.length} más</summary><ul>{resto.map(fila)}</ul></details>
      )}
    </section>
  );
}
