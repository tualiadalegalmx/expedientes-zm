"use client";
import { useState } from "react";
import type { Cotizacion, Empresa } from "@/lib/cotizacion";


async function generarExcel(c: Cotizacion, e: Empresa) {
  const { libroCotizacion } = await import("@/lib/excelCotizacion");
  const buf = await (await libroCotizacion(c, e)).xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.folio} ${c.cliente}.xlsx`.replace(/[\\/:*?"<>|]+/g, " ");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function DescargarCotizacion({ cot, empresa }: { cot: Cotizacion; empresa: Empresa }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <button
        className="boton"
        disabled={generando}
        onClick={async () => {
          setGenerando(true); setError("");
          try { await generarExcel(cot, empresa); } catch (e) { setError(`No se pudo generar el Excel: ${(e as Error).message}`); }
          setGenerando(false);
        }}
      >
        {generando ? "Generando…" : "Descargar Excel"}
      </button>
      <button className="boton bronce" onClick={() => {
        const t = document.title; document.title = `${cot.folio} ${cot.cliente}`; window.print(); document.title = t;
      }}>
        Descargar PDF
      </button>
      {error && <p className="error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
    </>
  );
}
