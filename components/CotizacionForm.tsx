"use client";
import { useActionState, useMemo, useState } from "react";
import { guardarCotizacion, type Resultado } from "@/app/(app)/cotizaciones/acciones";
import { conLetra, dinero, totales, type Concepto, type Cotizacion, type Empresa } from "@/lib/cotizacion";
import { hoy } from "@/lib/fechas";

const vacio = (): Concepto => ({ descripcion: "", unidad: "Servicio", cantidad: 1, precio: 0 });

export function CotizacionForm({ empresas, cot, empresaInicial }: { empresas: Empresa[]; cot?: Cotizacion; empresaInicial?: number }) {
  const [estado, accion, enviando] = useActionState<Resultado, FormData>(guardarCotizacion, {});
  const [empresaId, setEmpresaId] = useState<number>(cot?.empresa_id ?? empresaInicial ?? empresas[0]?.id ?? 0);
  const [conceptos, setConceptos] = useState<Concepto[]>(cot?.conceptos?.length ? cot.conceptos : [vacio()]);
  const [ivaPct, setIvaPct] = useState<number>(cot ? Number(cot.iva_pct) : 16);
  const [descuento, setDescuento] = useState<number>(cot ? Number(cot.descuento) : 0);
  const [moneda, setMoneda] = useState(cot?.moneda ?? "MXN");
  const empresa = empresas.find((e) => e.id === empresaId);
  const [condiciones, setCondiciones] = useState(cot?.condiciones ?? empresa?.condiciones ?? "");
  const [conProveedor, setConProveedor] = useState(!!cot?.numero_proveedor);
  const [proveedor, setProveedor] = useState(cot?.numero_proveedor ?? empresa?.numero_proveedor ?? "");
  const t = useMemo(() => totales(conceptos, ivaPct, descuento), [conceptos, ivaPct, descuento]);

  const cambiar = (i: number, campo: keyof Concepto, valor: string) =>
    setConceptos((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: campo === "cantidad" || campo === "precio" ? Number(valor) : valor } : c)));
  const quitar = (i: number) => setConceptos((cs) => (cs.length === 1 ? [vacio()] : cs.filter((_, j) => j !== i)));
  const mover = (i: number, d: -1 | 1) => setConceptos((cs) => {
    const n = [...cs]; const j = i + d; if (j < 0 || j >= n.length) return cs;
    [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  return (
    <form action={accion} className="cot-form">
      {cot && <input type="hidden" name="id" value={cot.id} />}
      <input type="hidden" name="conceptos" value={JSON.stringify(conceptos)} />
      {estado.error && <p className="error" role="alert">{estado.error}</p>}

      <section className="hoja tablero cot-bloque">
        <header className="tablero-cabeza" style={{ background: empresa?.color }}><h2>Empresa y cliente</h2>{cot && <span className="aviso">{cot.folio}</span>}</header>
        <div className="campos cot-campos">
          <div className="campo">
            <label htmlFor="empresa_id">Empresa que cotiza</label>
            <select id="empresa_id" name="empresa_id" value={empresaId} disabled={!!cot}
              onChange={(e) => { const id = Number(e.target.value); setEmpresaId(id); const em = empresas.find((x) => x.id === id); if (!cot && em?.condiciones) setCondiciones(em.condiciones); if (!cot) setProveedor(em?.numero_proveedor ?? ""); }}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            {cot && <input type="hidden" name="empresa_id" value={empresaId} />}
          </div>
          <div className="campo">
            <label htmlFor="fecha">Fecha</label>
            <input id="fecha" name="fecha" type="date" defaultValue={cot?.fecha ?? hoy()} required />
          </div>
          <div className="campo">
            <label htmlFor="vigencia_dias">Vigencia <small>(días)</small></label>
            <input id="vigencia_dias" name="vigencia_dias" type="number" min={1} defaultValue={cot?.vigencia_dias ?? 15} />
          </div>
          <div className="campo">
            <label htmlFor="moneda">Moneda</label>
            <select id="moneda" name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              <option value="MXN">Pesos (MXN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="campo ancho">
            <label htmlFor="cliente">Cliente <small>(nombre, cargo y dependencia o empresa; un dato por renglón)</small></label>
            <textarea id="cliente" name="cliente" defaultValue={cot?.cliente} required rows={3} style={{ minHeight: 70 }}
              placeholder={"Ing. Silvia Mejía Zaragoza\nDirectora General de Contrataciones Gubernamentales\nSecretaría de Finanzas y Planeación"} />
          </div>
          <div className="campo ancho">
            <label htmlFor="cliente_direccion">Dirección del cliente <small>(opcional)</small></label>
            <input id="cliente_direccion" name="cliente_direccion" defaultValue={cot?.cliente_direccion ?? ""} placeholder="Ej. Xalapa-Enríquez, Veracruz" />
          </div>
          <div className="campo">
            <label htmlFor="atencion">Atención a <small>(opcional)</small></label>
            <input id="atencion" name="atencion" defaultValue={cot?.atencion ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="cliente_correo">Correo <small>(opcional)</small></label>
            <input id="cliente_correo" name="cliente_correo" type="email" defaultValue={cot?.cliente_correo ?? ""} />
          </div>
          <div className="campo">
            <label htmlFor="cliente_tel">Teléfono <small>(opcional)</small></label>
            <input id="cliente_tel" name="cliente_tel" defaultValue={cot?.cliente_tel ?? ""} />
          </div>
          <div className="campo ancho proveedor-campo">
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={conProveedor} onChange={(e) => setConProveedor(e.target.checked)} style={{ width: "auto" }} />
              Incluir número de proveedor <small>(para SEFIPLAN u otro padrón de proveedores)</small>
            </label>
            {conProveedor && (
              <input name="numero_proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} required
                placeholder="Número de proveedor de esta empresa" aria-label="Número de proveedor" />
            )}
          </div>
        </div>
      </section>

      <section className="hoja tablero cot-bloque">
        <header className="tablero-cabeza" style={{ background: empresa?.color }}><h2>Conceptos</h2><span className="aviso">{conceptos.filter((c) => c.descripcion).length} conceptos</span></header>
        <div className="cot-tabla-wrap">
          <table className="tabla cot-tabla">
            <thead><tr><th style={{ width: "2.5rem" }}>#</th><th>Descripción</th><th style={{ width: "8rem" }}>Unidad</th><th style={{ width: "6.5rem" }}>Cantidad</th><th style={{ width: "9rem" }}>Precio unitario</th><th style={{ width: "9rem", textAlign: "right" }}>Importe</th><th style={{ width: "7.5rem" }} /></tr></thead>
            <tbody>
              {conceptos.map((c, i) => (
                <tr key={i}>
                  <td className="aviso">{i + 1}</td>
                  <td><textarea aria-label={`Descripción ${i + 1}`} value={c.descripcion} onChange={(e) => cambiar(i, "descripcion", e.target.value)} rows={2} placeholder="Ej. Elaboración de demanda de amparo indirecto" /></td>
                  <td><input aria-label={`Unidad ${i + 1}`} value={c.unidad ?? ""} onChange={(e) => cambiar(i, "unidad", e.target.value)} /></td>
                  <td><input aria-label={`Cantidad ${i + 1}`} type="number" min={0} step="any" value={c.cantidad} onChange={(e) => cambiar(i, "cantidad", e.target.value)} /></td>
                  <td><input aria-label={`Precio ${i + 1}`} type="number" min={0} step="0.01" value={c.precio} onChange={(e) => cambiar(i, "precio", e.target.value)} /></td>
                  <td className="cot-importe">{dinero((Number(c.cantidad) || 0) * (Number(c.precio) || 0), moneda)}</td>
                  <td className="cot-acc">
                    <button type="button" className="boton secundario chico" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                    <button type="button" className="boton secundario chico" onClick={() => mover(i, 1)} disabled={i === conceptos.length - 1} aria-label="Bajar">↓</button>
                    <button type="button" className="boton secundario chico" onClick={() => quitar(i)} aria-label="Quitar concepto">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "12px 20px 0" }}>
          <button type="button" className="boton bronce chico" onClick={() => setConceptos((cs) => [...cs, vacio()])}>+ Agregar concepto</button>
        </div>

        <div className="cot-totales">
          <div className="campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", alignContent: "start" }}>
            <div className="campo">
              <label htmlFor="iva_pct">IVA</label>
              <select id="iva_pct" name="iva_pct" value={ivaPct} onChange={(e) => setIvaPct(Number(e.target.value))}>
                <option value={16}>16 %</option>
                <option value={8}>8 % (frontera)</option>
                <option value={0}>Sin IVA</option>
              </select>
            </div>
            <div className="campo">
              <label htmlFor="descuento">Descuento <small>({moneda})</small></label>
              <input id="descuento" name="descuento" type="number" min={0} step="0.01" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} />
            </div>
          </div>
          <dl className="cot-suma">
            <div><dt>Subtotal</dt><dd>{dinero(t.subtotal, moneda)}</dd></div>
            {t.descuento > 0 && <div><dt>Descuento</dt><dd>− {dinero(t.descuento, moneda)}</dd></div>}
            <div><dt>IVA {ivaPct} %</dt><dd>{dinero(t.iva, moneda)}</dd></div>
            <div className="cot-total"><dt>Total</dt><dd>{dinero(t.total, moneda)}</dd></div>
            <p className="cot-letra">{conLetra(t.total, moneda)}</p>
          </dl>
        </div>
      </section>

      <section className="hoja tablero cot-bloque">
        <header className="tablero-cabeza" style={{ background: empresa?.color }}><h2>Notas y condiciones</h2></header>
        <div className="campos cot-campos">
          <div className="campo ancho">
            <label htmlFor="notas">Notas para el cliente <small>(opcional)</small></label>
            <textarea id="notas" name="notas" defaultValue={cot?.notas ?? ""} />
          </div>
          <div className="campo ancho">
            <label htmlFor="condiciones">Condiciones comerciales <small>(forma de pago, tiempos, etc.)</small></label>
            <textarea id="condiciones" name="condiciones" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} />
          </div>
        </div>
      </section>

      <div className="acciones">
        <button className="boton" disabled={enviando}>{enviando ? "Guardando…" : cot ? "Guardar cambios" : "Guardar y ver cotización"}</button>
      </div>
    </form>
  );
}
