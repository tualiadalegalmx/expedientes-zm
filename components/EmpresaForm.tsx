"use client";
import { useActionState } from "react";
import { guardarEmpresa, type Resultado } from "@/app/(app)/cotizaciones/acciones";
import type { Empresa } from "@/lib/cotizacion";

export function EmpresaForm({ empresa }: { empresa?: Empresa }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(guardarEmpresa, {});
  const k = empresa?.id ?? "nueva";
  return (
    <form action={accion} className="tarea-form" style={{ margin: 0 }}>
      {empresa && <input type="hidden" name="id" value={empresa.id} />}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="campo"><label htmlFor={`n-${k}`}>Nombre corto</label><input id={`n-${k}`} name="nombre" defaultValue={empresa?.nombre} required placeholder="Ej. Poiesis" /></div>
        <div className="campo"><label htmlFor={`p-${k}`}>Prefijo del folio</label><input id={`p-${k}`} name="prefijo" defaultValue={empresa?.prefijo ?? ""} maxLength={6} placeholder="Ej. POI" /></div>
        <div className="campo"><label htmlFor={`c-${k}`}>Color</label><input id={`c-${k}`} name="color" type="color" defaultValue={empresa?.color ?? "#2f3a30"} style={{ height: 40, padding: 4 }} /></div>
        <div className="campo ancho"><label htmlFor={`r-${k}`}>Razón social</label><input id={`r-${k}`} name="razon_social" defaultValue={empresa?.razon_social ?? ""} /></div>
        <div className="campo"><label htmlFor={`f-${k}`}>RFC</label><input id={`f-${k}`} name="rfc" defaultValue={empresa?.rfc ?? ""} /></div>
        <div className="campo"><label htmlFor={`t-${k}`}>Teléfono</label><input id={`t-${k}`} name="telefono" defaultValue={empresa?.telefono ?? ""} /></div>
        <div className="campo"><label htmlFor={`e-${k}`}>Correo</label><input id={`e-${k}`} name="correo" type="email" defaultValue={empresa?.correo ?? ""} /></div>
        <div className="campo ancho"><label htmlFor={`d-${k}`}>Dirección</label><input id={`d-${k}`} name="direccion" defaultValue={empresa?.direccion ?? ""} /></div>
        <div className="campo ancho"><label htmlFor={`q-${k}`}>Condiciones por omisión <small>(se copian en cada cotización nueva)</small></label><textarea id={`q-${k}`} name="condiciones" defaultValue={empresa?.condiciones ?? ""} style={{ minHeight: 60 }} /></div>
        {empresa && (
          <div className="campo"><label htmlFor={`a-${k}`}>Estado</label>
            <select id={`a-${k}`} name="activa" defaultValue={empresa.activa ? "si" : "no"}><option value="si">Activa</option><option value="no">Oculta</option></select>
          </div>
        )}
      </div>
      <div className="acciones" style={{ marginTop: 4 }}>
        <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : empresa ? "Guardar empresa" : "Agregar empresa"}</button>
      </div>
    </form>
  );
}
