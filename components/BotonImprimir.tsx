"use client";

export function BotonImprimir() {
  return (
    <button className="boton bronce" onClick={() => window.print()}>
      Descargar PDF
    </button>
  );
}
