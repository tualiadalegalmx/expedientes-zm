"use client";
import { useActionState, useEffect, useRef } from "react";
import { agregarAgenda, agregarInhabil, type Resultado } from "@/app/(app)/calendario/acciones";

export function AgendaForm({ fecha, usuarios, usuarioId, esAdmin }: {
  fecha: string; usuarios: { id: string; nombre: string }[]; usuarioId: string; esAdmin: boolean;
}) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(agregarAgenda, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) form.current?.reset(); }, [estado]);
  return (
    <form ref={form} action={accion} className="tarea-form" style={{ margin: 0 }}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campo">
        <label htmlFor="a-titulo">Actividad</label>
        <input id="a-titulo" name="titulo" required placeholder="Ej. Llevar promoción al Quinto de Distrito" />
      </div>
      <div className="campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
        <div className="campo">
          <label htmlFor="a-fecha">Fecha</label>
          <input id="a-fecha" name="fecha" type="date" defaultValue={fecha} key={fecha} required />
        </div>
        <div className="campo">
          <label htmlFor="a-hora">Hora <small>(opcional)</small></label>
          <input id="a-hora" name="hora" type="time" />
        </div>
        <div className="campo">
          <label htmlFor="a-tipo">Tipo</label>
          <select id="a-tipo" name="tipo" defaultValue="diaria">
            <option value="diaria">Tarea diaria</option>
            <option value="secundaria">Tarea secundaria</option>
            <option value="cita">Cita o reunión</option>
          </select>
        </div>
        {esAdmin && (
          <div className="campo">
            <label htmlFor="a-resp">Para</label>
            <select id="a-resp" name="responsable_id" defaultValue={usuarioId}>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="campo">
        <label htmlFor="a-detalle">Detalle <small>(opcional)</small></label>
        <textarea id="a-detalle" name="detalle" style={{ minHeight: 56 }} />
      </div>
      <div className="acciones" style={{ marginTop: 0 }}>
        <button className="boton bronce" disabled={enviando}>{enviando ? "Guardando…" : "Agregar a la agenda"}</button>
      </div>
    </form>
  );
}

export function InhabilForm({ fecha }: { fecha: string }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(agregarInhabil, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ok) form.current?.reset(); }, [estado]);
  return (
    <form ref={form} action={accion} className="inhabil-form">
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div className="campo">
          <label htmlFor="i-fecha">Fecha</label>
          <input id="i-fecha" name="fecha" type="date" defaultValue={fecha} key={fecha} required />
        </div>
        <div className="campo">
          <label htmlFor="i-desc">Motivo</label>
          <input id="i-desc" name="descripcion" required placeholder="Ej. Vacaciones PJF" />
        </div>
        <div className="campo">
          <label htmlFor="i-aut">Tribunal <small>(vacío = todos)</small></label>
          <input id="i-aut" name="autoridad" placeholder="Ej. TRIJAEV" />
        </div>
      </div>
      <div className="acciones" style={{ marginTop: 8 }}>
        <button className="boton secundario chico" disabled={enviando}>Marcar día inhábil</button>
      </div>
    </form>
  );
}
