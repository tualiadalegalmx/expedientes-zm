"use client";
import { useActionState, useState } from "react";
import { guardarExpediente, type Resultado } from "@/app/(app)/expedientes/acciones";
import type { Opcion } from "@/lib/catalogos";
import { ESTADOS } from "@/lib/catalogos";

type Exp = {
  id?: string; numero?: string; juzgado?: string; autoridad?: string; lugar?: string; cliente?: string;
  contraparte?: string | null; tipo_juicio?: string | null; responsable_id?: string; materia_id?: number;
  etapa_id?: number; estado?: string; notas?: string | null;
};

function CatalogoAbierto({ nombre, etiqueta, opciones, valor }: { nombre: string; etiqueta: string; opciones: Opcion[]; valor?: number }) {
  const [sel, setSel] = useState(valor ? String(valor) : "");
  return (
    <div className="campo">
      <label htmlFor={nombre}>{etiqueta}</label>
      <select id={nombre} name={`${nombre}_id`} value={sel} onChange={(e) => setSel(e.target.value)} required>
        <option value="" disabled>Elige una opción</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        <option value="_nueva">Agregar otra…</option>
      </select>
      {sel === "_nueva" && <input name={`${nombre}_nueva`} placeholder={`Nombre de la nueva ${etiqueta.toLowerCase()}`} required autoFocus />}
    </div>
  );
}

export function ExpedienteForm({
  exp = {}, materias, etapas, usuarios, esAdmin, usuarioId,
}: {
  exp?: Exp; materias: Opcion[]; etapas: Opcion[]; usuarios: Opcion[]; esAdmin: boolean; usuarioId: string;
}) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(guardarExpediente, {});
  const nuevo = !exp.id;
  // Al crear, cualquiera elige responsable; después solo Zaida reasigna.
  const puedeReasignar = nuevo || esAdmin;
  const estados = Object.entries(ESTADOS).filter(([k]) => esAdmin || !["concluido", "archivado"].includes(k) || k === exp.estado);

  return (
    <form action={accion} className="hoja">
      {exp.id && <input type="hidden" name="id" value={exp.id} />}
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      <div className="campos">
        <div className="campo">
          <label htmlFor="numero">Número de juicio o expediente</label>
          <input id="numero" name="numero" defaultValue={exp.numero} required placeholder="Ej. 1029/2026" />
        </div>
        <div className="campo">
          <label htmlFor="juzgado">Juzgado o sala</label>
          <input id="juzgado" name="juzgado" defaultValue={exp.juzgado} required placeholder="Ej. Quinto Juzgado de Distrito" />
        </div>
        <div className="campo ancho">
          <label htmlFor="autoridad">Autoridad ante quien se promueve</label>
          <input id="autoridad" name="autoridad" defaultValue={exp.autoridad} required />
        </div>
        <div className="campo">
          <label htmlFor="lugar">Lugar donde se promueve</label>
          <input id="lugar" name="lugar" defaultValue={exp.lugar ?? "Veracruz, Ver."} required />
        </div>
        <div className="campo">
          <label htmlFor="cliente">Cliente</label>
          <input id="cliente" name="cliente" defaultValue={exp.cliente} required />
        </div>
        <div className="campo">
          <label htmlFor="contraparte">Contraparte <small>(opcional)</small></label>
          <input id="contraparte" name="contraparte" defaultValue={exp.contraparte ?? ""} />
        </div>
        <CatalogoAbierto nombre="materia" etiqueta="Materia" opciones={materias} valor={exp.materia_id} />
        <div className="campo">
          <label htmlFor="tipo_juicio">Tipo de juicio o trámite <small>(opcional)</small></label>
          <input id="tipo_juicio" name="tipo_juicio" defaultValue={exp.tipo_juicio ?? ""} />
        </div>
        <CatalogoAbierto nombre="etapa" etiqueta="Etapa procesal" opciones={etapas} valor={exp.etapa_id} />
        <div className="campo">
          <label htmlFor="responsable_id">Abogado responsable</label>
          {puedeReasignar ? (
            <select id="responsable_id" name="responsable_id" defaultValue={exp.responsable_id ?? usuarioId} required>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : (
            <>
              <input value={usuarios.find((u) => u.id === exp.responsable_id)?.nombre ?? ""} disabled />
              <input type="hidden" name="responsable_id" value={exp.responsable_id} />
            </>
          )}
        </div>
        <div className="campo">
          <label htmlFor="estado">Estado</label>
          <select id="estado" name="estado" defaultValue={exp.estado ?? "activo"}>
            {estados.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="campo ancho">
          <label htmlFor="notas">Notas generales <small>(opcional)</small></label>
          <textarea id="notas" name="notas" defaultValue={exp.notas ?? ""} />
        </div>
      </div>
      {!esAdmin && !nuevo && <p className="aviso">Solo Zaida puede reasignar, concluir o archivar un expediente.</p>}
      <div className="acciones">
        <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : nuevo ? "Crear expediente" : "Guardar cambios"}</button>
      </div>
    </form>
  );
}
