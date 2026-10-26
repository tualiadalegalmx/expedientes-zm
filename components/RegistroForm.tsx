"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { agregarRegistro, type Resultado } from "@/app/(app)/expedientes/acciones";
import { TIPOS, type Tipo, type Opcion } from "@/lib/catalogos";
import { calcularVencimiento, fecha, fechaLarga, hoy } from "@/lib/fechas";

type PlazoAbierto = { id: string; actuacion: string; vencimiento: string };

const ARCHIVO: Record<Tipo, string | null> = {
  promocion: "Escaneo con sello de acuse",
  acuerdo: "Escaneo o PDF del acuerdo",
  audiencia: "Acta, si existe",
  visita: "Archivo (opcional)",
  cliente: "Archivo (opcional)",
  estudio: "Archivo (opcional)",
  pendiente: null,
};

function Plazo() {
  const [surte, setSurte] = useState(hoy());
  const [cantidad, setCantidad] = useState(3);
  const [unidad, setUnidad] = useState<"dias" | "horas">("dias");
  const [tipo, setTipo] = useState<"habiles" | "naturales">("habiles");
  const calculado = useMemo(
    () => (surte && cantidad > 0 ? calcularVencimiento(surte, cantidad, unidad, tipo) : ""),
    [surte, cantidad, unidad, tipo],
  );
  const [venc, setVenc] = useState(calculado);
  useEffect(() => setVenc(calculado), [calculado]);

  return (
    <div className="campos" style={{ marginTop: 6 }}>
      <div className="campo">
        <label htmlFor="surte_efectos">Surte efectos la notificación</label>
        <input id="surte_efectos" name="surte_efectos" type="date" value={surte} onChange={(e) => setSurte(e.target.value)} required />
      </div>
      <div className="campo">
        <label htmlFor="cantidad">Plazo</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input id="cantidad" name="cantidad" type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} required style={{ width: "5rem" }} />
          <select name="unidad" value={unidad} onChange={(e) => setUnidad(e.target.value as "dias")} aria-label="Unidad">
            <option value="dias">días</option>
            <option value="horas">horas</option>
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="tipo_dias">Se cuentan en días</label>
        <select id="tipo_dias" name="tipo_dias" value={tipo} onChange={(e) => setTipo(e.target.value as "habiles")}>
          <option value="habiles">hábiles</option>
          <option value="naturales">naturales</option>
        </select>
      </div>
      <div className="campo ancho">
        <label htmlFor="actuacion">Qué actuación vence</label>
        <input id="actuacion" name="actuacion" required placeholder="Ej. Rendir informe justificado" />
      </div>
      <div className="campo ancho">
        <label htmlFor="fundamento">Fundamento <small>(opcional)</small></label>
        <input id="fundamento" name="fundamento" placeholder="Ej. Art. 117 Ley de Amparo" />
      </div>
      <div className="campo ancho calculo">
        <span>Vence el <strong>{venc ? fechaLarga(venc) : "—"}</strong></span>
        <span className="aviso">
          {tipo === "habiles"
            ? "Cálculo sin sábados ni domingos. Los días inhábiles de cada tribunal se agregan en la siguiente fase: revisa si hay alguno en medio."
            : "Cálculo en días naturales."}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <label htmlFor="vencimiento" style={{ fontSize: "0.88rem" }}>Ajustar fecha</label>
          <input id="vencimiento" name="vencimiento" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} required style={{ width: "auto" }} />
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontWeight: 600, color: "var(--bosque)" }}>
            <input type="checkbox" name="confirmo" value="si" required style={{ width: "auto" }} /> Confirmo esta fecha
          </label>
        </div>
      </div>
    </div>
  );
}

export function RegistroForm({
  expedienteId, usuarios, usuarioId, plazosAbiertos,
}: {
  expedienteId: string; usuarios: Opcion[]; usuarioId: string; plazosAbiertos: PlazoAbierto[];
}) {
  const [tipo, setTipo] = useState<Tipo>("estudio");
  const [genera, setGenera] = useState<"si" | "no" | "">("");
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(agregarRegistro, {});
  const form = useRef<HTMLFormElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (estado.ok) { form.current?.reset(); setGenera(""); setVersion((v) => v + 1); }
  }, [estado]);

  const etiquetaDesc: Record<Tipo, string> = {
    promocion: "Descripción breve de la promoción",
    acuerdo: "Contenido breve del acuerdo",
    audiencia: "Tipo de audiencia",
    visita: "Motivo de la visita",
    cliente: "Temas tratados",
    estudio: "Qué se trabajó",
    pendiente: "Qué falta",
  };

  return (
    <form ref={form} action={accion} className="hoja" key={version}>
      <h2 style={{ marginBottom: 12 }}>Registrar en la bitácora</h2>
      <input type="hidden" name="expediente_id" value={expedienteId} />
      <input type="hidden" name="tipo" value={tipo} />
      <div className="pestanas" role="group" aria-label="Tipo de registro">
        {(Object.keys(TIPOS) as Tipo[]).map((t) => (
          <button type="button" key={t} aria-pressed={tipo === t} onClick={() => setTipo(t)}>{TIPOS[t]}</button>
        ))}
      </div>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso" role="status">Registro guardado.</p>}

      <div className="campos">
        {tipo !== "pendiente" && (
          <div className="campo">
            <label htmlFor="fecha">{tipo === "acuerdo" ? "Fecha de notificación" : "Fecha"}</label>
            <input id="fecha" name="fecha" type="date" defaultValue={hoy()} required />
          </div>
        )}
        {tipo === "audiencia" && (
          <div className="campo">
            <label htmlFor="hora">Hora</label>
            <input id="hora" name="hora" type="time" />
          </div>
        )}
        {tipo === "cliente" && (
          <div className="campo">
            <label htmlFor="duracion_min">Duración <small>(minutos)</small></label>
            <input id="duracion_min" name="duracion_min" type="number" min={1} />
          </div>
        )}
        <div className="campo ancho">
          <label htmlFor="descripcion">{etiquetaDesc[tipo]}</label>
          <textarea id="descripcion" name="descripcion" required />
        </div>
        {(tipo === "audiencia" || tipo === "visita") && (
          <div className="campo ancho">
            <label htmlFor="resultado">Resultado</label>
            <textarea id="resultado" name="resultado" />
          </div>
        )}
        {tipo === "cliente" && (
          <div className="campo ancho">
            <label htmlFor="acuerdos">Acuerdos con el cliente</label>
            <textarea id="acuerdos" name="acuerdos" />
          </div>
        )}
        {tipo === "pendiente" && (
          <>
            <div className="campo">
              <label htmlFor="responsable_id">Responsable</label>
              <select id="responsable_id" name="responsable_id" defaultValue={usuarioId}>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="fecha_compromiso">Fecha compromiso</label>
              <input id="fecha_compromiso" name="fecha_compromiso" type="date" required />
            </div>
          </>
        )}
        {tipo === "promocion" && plazosAbiertos.length > 0 && (
          <div className="campo ancho">
            <label htmlFor="cumple_plazo">¿Esta promoción cumple un plazo abierto?</label>
            <select id="cumple_plazo" name="cumple_plazo" defaultValue="">
              <option value="">No cumple ningún plazo</option>
              {plazosAbiertos.map((p) => (
                <option key={p.id} value={p.id}>{p.actuacion} — vence {fecha(p.vencimiento)}</option>
              ))}
            </select>
          </div>
        )}
        {tipo === "acuerdo" && (
          <fieldset className="campo ancho" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--bosque)", marginBottom: 4 }}>¿Genera plazo?</legend>
            <div style={{ display: "flex", gap: 18 }}>
              {(["si", "no"] as const).map((v) => (
                <label key={v} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="radio" name="genera_plazo" value={v} checked={genera === v} onChange={() => setGenera(v)} required style={{ width: "auto" }} />
                  {v === "si" ? "Sí" : "No"}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      {tipo === "acuerdo" && genera === "si" && <Plazo />}

      {ARCHIVO[tipo] && (
        <div className="campo" style={{ marginTop: 14 }}>
          <label htmlFor="archivos">{ARCHIVO[tipo]}</label>
          <input id="archivos" name="archivos" type="file" multiple accept="application/pdf,image/*" />
        </div>
      )}
      <div className="acciones">
        <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : "Guardar registro"}</button>
      </div>
    </form>
  );
}
