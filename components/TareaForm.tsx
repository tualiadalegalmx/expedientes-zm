"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { agregarTarea, type Resultado } from "@/app/(app)/tareas/acciones";

export function TareaForm({ responsableId }: { responsableId: string }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(agregarTarea, {});
  const [abierto, setAbierto] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) { form.current?.reset(); setAbierto(false); } }, [estado]);

  if (!abierto)
    return <button className="boton bronce tarea-nueva" onClick={() => setAbierto(true)}>+ Agregar tarea</button>;

  return (
    <form ref={form} action={accion} className="tarea-form">
      <input type="hidden" name="responsable_id" value={responsableId} />
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campo">
        <label htmlFor={`t-${responsableId}`}>Tarea</label>
        <input id={`t-${responsableId}`} name="titulo" required autoFocus placeholder="Ej. Pagar IVA de octubre de Poiesis" />
      </div>
      <div className="campo">
        <label htmlFor={`d-${responsableId}`}>Detalle <small>(opcional)</small></label>
        <textarea id={`d-${responsableId}`} name="descripcion" style={{ minHeight: 60 }} />
      </div>
      <div className="campos" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="campo">
          <label htmlFor={`f-${responsableId}`}>Fecha límite <small>(opcional)</small></label>
          <input id={`f-${responsableId}`} name="fecha_limite" type="date" />
        </div>
        <div className="campo">
          <label htmlFor={`e-${responsableId}`}>Estado</label>
          <select id={`e-${responsableId}`} name="estado" defaultValue="pendiente">
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
          </select>
        </div>
      </div>
      <div className="acciones" style={{ marginTop: 10 }}>
        <button type="button" className="boton secundario" onClick={() => setAbierto(false)}>Cancelar</button>
        <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : "Guardar tarea"}</button>
      </div>
    </form>
  );
}
