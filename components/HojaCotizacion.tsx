import { conLetra, dinero, type Cotizacion, type Empresa } from "@/lib/cotizacion";

const corta = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}/${m}/${a}`; };
const larga = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
export function venceEl(c: Cotizacion) {
  const d = new Date(c.fecha + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + c.vigencia_dias);
  return d.toISOString().slice(0, 10);
}
const renglones = (t: string) => t.split("\n").map((l, i) => <span key={i} style={{ display: "block" }}>{l}</span>);

function Totales({ c, clase }: { c: Cotizacion; clase: string }) {
  const m = c.moneda;
  return (
    <table className={clase}>
      <tbody>
        <tr><th>{clase.includes("hc") ? "SUBTOTAL" : "Subtotal"}</th><td>{dinero(Number(c.subtotal), m)}</td></tr>
        {Number(c.descuento) > 0 && <tr><th>{clase.includes("hc") ? "DESCUENTO" : "Descuento"}</th><td>− {dinero(Number(c.descuento), m)}</td></tr>}
        <tr><th>{clase.includes("hc") ? "IVA" : "IVA"}{Number(c.iva_pct) !== 16 ? ` ${Number(c.iva_pct)} %` : ""}</th><td>{dinero(Number(c.iva), m)}</td></tr>
        <tr className="tt"><th>{clase.includes("hc") ? "TOTAL" : "Total"}</th><td>{dinero(Number(c.total), m)}</td></tr>
      </tbody>
    </table>
  );
}

/** Formato "con franjas de color" (TXX). */
function Clasica({ c, e }: { c: Cotizacion; e: Empresa }) {
  return (
    <article className="hoja-cot hc" style={{ ["--emp" as string]: e.color }}>
      <header className="hc-cabeza">
        <div className="hc-logo">
          {e.logo ? <img src={e.logo} alt={e.nombre} /> : <b className="hc-nombre">{e.nombre}</b>}
          {e.razon_social && <span className="hc-razon">{e.razon_social.replace(/^TXX\s*/i, "")}</span>}
        </div>
        <div className="hc-datos">
          <b>COTIZACIÓN</b>
          <b className="hc-folio">{c.folio}</b>
          <b>FECHA: {corta(c.fecha)}</b>
          <div className="hc-emp">
            {e.rfc && <span><b>RFC:</b> {e.rfc}</span>}
            {e.telefono && <span><b>TEL:</b> {e.telefono}</span>}
            {e.correo && <span><b>CORREO:</b> {e.correo}</span>}
            {c.numero_proveedor && <span><b>NO. PROVEEDOR:</b> {c.numero_proveedor}</span>}
          </div>
        </div>
      </header>

      <table className="hc-cliente">
        <thead><tr><th colSpan={2}>DATOS DEL CLIENTE</th></tr></thead>
        <tbody>
          <tr><th>NOMBRE:</th><td><b>{renglones(c.cliente)}</b></td></tr>
          {c.atencion && <tr><th>ATENCIÓN:</th><td>{c.atencion}</td></tr>}
          {c.cliente_direccion && <tr><th>DIRECCIÓN:</th><td>{c.cliente_direccion}</td></tr>}
          {c.cliente_correo && <tr><th>CORREO:</th><td>{c.cliente_correo}</td></tr>}
          {c.cliente_tel && <tr><th>TELÉFONO:</th><td>{c.cliente_tel}</td></tr>}
        </tbody>
      </table>

      <table className="hc-tabla">
        <thead><tr><th>CANTIDAD</th><th>DESCRIPCIÓN</th><th>UNIDAD</th><th>P.U. COMPRA</th><th>TOTAL</th></tr></thead>
        <tbody>
          {c.conceptos.map((k, i) => (
            <tr key={i}>
              <td className="cen">{k.cantidad.toLocaleString("es-MX")}</td>
              <td className="desc">{k.descripcion}</td>
              <td className="cen">{k.unidad}</td>
              <td className="imp">{dinero(k.precio, c.moneda)}</td>
              <td className="imp">{dinero(k.cantidad * k.precio, c.moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hc-suma">
        <p className="hc-letra">{conLetra(Number(c.total), c.moneda)}</p>
        <Totales c={c} clase="hc-totales" />
      </div>

      {c.notas && <p className="hc-notas">{renglones(c.notas)}</p>}
      {c.condiciones && (
        <table className="hc-cond"><tbody><tr><th>CONDICIONES COMERCIALES:</th><td>{renglones(c.condiciones)}</td></tr></tbody></table>
      )}
      <Firma e={e} />
      {e.pie && <footer className="hoja-pie">{e.pie}</footer>}
    </article>
  );
}

/** Formato "sencillo" (Poiesis). */
function Sencilla({ c, e }: { c: Cotizacion; e: Empresa }) {
  return (
    <article className="hoja-cot hs" style={{ ["--emp" as string]: e.color }}>
      <header className="hs-cabeza">
        {e.logo ? <img src={e.logo} alt={e.nombre} className="hs-logo" /> : <b className="hs-nombre">{e.razon_social || e.nombre}</b>}
        <h1>COTIZACIÓN</h1>
      </header>
      <p className="hs-folio"><b>No. Cotización:</b> <span>{c.folio}</span></p>
      <table className="hs-datos">
        <tbody>
          <tr><th>Cliente:</th><td>{renglones(c.cliente)}</td></tr>
          {c.atencion && <tr><th>Atención:</th><td>{c.atencion}</td></tr>}
          <tr><th>Teléfono:</th><td>{c.cliente_tel || "N/A"}</td></tr>
          {c.cliente_correo && <tr><th>Correo:</th><td>{c.cliente_correo}</td></tr>}
          <tr><th>Fecha:</th><td>{corta(c.fecha)}</td></tr>
          <tr><th>Vigencia:</th><td>{corta(venceEl(c))}</td></tr>
          {c.cliente_direccion && <tr><th>Dirección:</th><td>{c.cliente_direccion}</td></tr>}
          {c.numero_proveedor && <tr><th>No. Proveedor:</th><td>{c.numero_proveedor}</td></tr>}
        </tbody>
      </table>
      <table className="hs-tabla">
        <thead><tr><th>No.</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th><th>P. Unitario</th><th>Importe</th></tr></thead>
        <tbody>
          {c.conceptos.map((k, i) => (
            <tr key={i}>
              <td className="cen">{i + 1}</td><td className="desc">{k.descripcion}</td><td className="cen">{k.unidad}</td>
              <td className="cen">{k.cantidad.toLocaleString("es-MX")}</td><td className="imp">{dinero(k.precio, c.moneda)}</td><td className="imp">{dinero(k.cantidad * k.precio, c.moneda)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="hs-suma">
        <Totales c={c} clase="hs-totales" />
        <p className="hs-letra">{conLetra(Number(c.total), c.moneda)}</p>
      </div>
      {c.notas && <p className="hs-notas">{renglones(c.notas)}</p>}
      {c.condiciones && (
        <div className="hs-cond"><b>Condiciones:</b><div>{renglones(c.condiciones)}</div></div>
      )}
      <Firma e={e} />
      {e.pie && <footer className="hoja-pie">{e.pie}</footer>}
    </article>
  );
}

function Firma({ e }: { e: Empresa }) {
  if (!e.firmante_nombre) return null;
  return (
    <div className="firma">
      <b>ATENTAMENTE</b>
      <span className="firma-linea" />
      <span>{e.firmante_nombre}</span>
      {e.firmante_cargo && <span>{e.firmante_cargo}</span>}
    </div>
  );
}

export function HojaCotizacion({ cot, empresa }: { cot: Cotizacion; empresa: Empresa }) {
  return empresa.plantilla === "clasica" ? <Clasica c={cot} e={empresa} /> : <Sencilla c={cot} e={empresa} />;
}

export { larga as fechaLargaCot };
