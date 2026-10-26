import { diasRestantes, semaforo, textoRestantes, fecha } from "@/lib/fechas";

export function PlazoChip({ vencimiento, conFecha = false }: { vencimiento: string; conFecha?: boolean }) {
  const n = diasRestantes(vencimiento);
  return (
    <span className={`plazo-chip s-${semaforo(n)}`} title={`Vence ${fecha(vencimiento)}`}>
      {textoRestantes(n)}{conFecha && ` · ${fecha(vencimiento)}`}
    </span>
  );
}
