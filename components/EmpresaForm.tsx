"use client";
import { useActionState, useState } from "react";
import { guardarEmpresa, type Resultado } from "@/app/(app)/cotizaciones/acciones";
import type { Empresa } from "@/lib/cotizacion";

/** Sube el logo y lo reduce en el navegador (máx. 600 px de ancho) para guardarlo junto con la empresa. */
function LogoInput({ inicial, k }: { inicial?: string | null; k: string | number }) {
  const [logo, setLogo] = useState(inicial ?? "");
  const [error, setError] = useState("");
  const leer = (archivo?: File) => {
    setError("");
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) { setError("Elige una imagen PNG o JPG."); return; }
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 600 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      setLogo(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => setError("No se pudo leer la imagen.");
    img.src = URL.createObjectURL(archivo);
  };
  return (
    <div className="campo ancho">
      <label htmlFor={`l-${k}`}>Logo <small>(PNG o JPG)</small></label>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {logo && <img src={logo} alt="Logo actual" style={{ maxHeight: 64, maxWidth: 200, border: "1px solid var(--greige)", borderRadius: 4, background: "#fff", padding: 4 }} />}
        <input id={`l-${k}`} type="file" accept="image/png,image/jpeg" onChange={(e) => leer(e.target.files?.[0])} style={{ width: "auto" }} />
        {logo && <button type="button" className="boton secundario chico" onClick={() => setLogo("")}>Quitar logo</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <input type="hidden" name="logo" value={logo} />
    </div>
  );
}

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
        <div className="campo"><label htmlFor={`pl-${k}`}>Estilo del formato</label>
          <select id={`pl-${k}`} name="plantilla" defaultValue={empresa?.plantilla ?? "sencilla"}>
            <option value="sencilla">Sencillo (como Poiesis)</option>
            <option value="clasica">Con franjas de color (como TXX)</option>
          </select>
        </div>
        <div className="campo"><label htmlFor={`fa-${k}`}>Folio</label>
          <select id={`fa-${k}`} name="folio_con_anio" defaultValue={empresa?.folio_con_anio ? "si" : "no"}>
            <option value="no">Consecutivo (COT-01, COT-02…)</option>
            <option value="si">Con año (SEF-01-26), reinicia cada año</option>
          </select>
        </div>
        <div className="campo"><label htmlFor={`np-${k}`}>Número de proveedor <small>(opcional)</small></label><input id={`np-${k}`} name="numero_proveedor" defaultValue={empresa?.numero_proveedor ?? ""} placeholder="Ej. 54157" /></div>
        <LogoInput inicial={empresa?.logo} k={k} />
        <div className="campo"><label htmlFor={`fn-${k}`}>Firma: nombre</label><input id={`fn-${k}`} name="firmante_nombre" defaultValue={empresa?.firmante_nombre ?? ""} placeholder="Ej. RAFAEL LINALDI CHIPULI" /></div>
        <div className="campo"><label htmlFor={`fc-${k}`}>Firma: cargo</label><input id={`fc-${k}`} name="firmante_cargo" defaultValue={empresa?.firmante_cargo ?? ""} placeholder="Ej. DIRECTOR" /></div>
        <div className="campo ancho"><label htmlFor={`pi-${k}`}>Pie de página <small>(opcional, p. ej. la dirección)</small></label><input id={`pi-${k}`} name="pie" defaultValue={empresa?.pie ?? ""} /></div>
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
