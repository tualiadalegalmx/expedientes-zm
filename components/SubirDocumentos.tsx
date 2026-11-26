"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { BUCKET_DOCS, CATEGORIAS, tamano } from "@/lib/entidades";

const LIMITE = 25 * 1024 * 1024;

/** Sube los archivos directo al almacenamiento (sin pasar por el servidor) y los registra. */
export function SubirDocumentos({ entidadId, mesInicial }: { entidadId: number; mesInicial: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [otra, setOtra] = useState("");
  const [mes, setMes] = useState(mesInicial);
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<{ subiendo?: string; error?: string; ok?: string }>({});

  const subir = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categoria === "Otro" ? otra.trim() || "Otro" : categoria;
    if (!archivos.length) return setEstado({ error: "Elige al menos un archivo." });
    const grande = archivos.find((a) => a.size > LIMITE);
    if (grande) return setEstado({ error: `${grande.name} pesa ${tamano(grande.size)}; el máximo es 25 MB por archivo.` });
    const sb = supabaseNavegador();
    const { data: u } = await sb.auth.getUser();
    let hechos = 0;
    for (const a of archivos) {
      setEstado({ subiendo: `Subiendo ${hechos + 1} de ${archivos.length}: ${a.name}` });
      const limpio = a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
      const ruta = `${entidadId}/${mes}/${Date.now()}_${limpio}`;
      const { error: e1 } = await sb.storage.from(BUCKET_DOCS).upload(ruta, a, { contentType: a.type || undefined });
      if (e1) {
        const sinPermiso = e1.message.includes("row-level security") || e1.message.includes("Unauthorized");
        const sinEspacio = e1.message.toLowerCase().includes("bucket not found");
        return setEstado({ error: sinEspacio ? "Falta correr la migración 014 en Supabase." : sinPermiso ? "Tu usuario no tiene permiso para subir documentos." : `No se pudo subir ${a.name}: ${e1.message}` });
      }
      const { error: e2 } = await sb.from("documentos_entidad").insert({
        entidad_id: entidadId, categoria: cat, periodo: `${mes}-01`, nombre: a.name, ruta,
        tipo_mime: a.type || null, bytes: a.size, notas: notas.trim() || null, created_by: u.user?.id,
      });
      if (e2) { await sb.storage.from(BUCKET_DOCS).remove([ruta]); return setEstado({ error: `No se pudo registrar ${a.name}: ${e2.message}` }); }
      hechos++;
    }
    setArchivos([]); setNotas(""); if (input.current) input.current.value = "";
    setEstado({ ok: `${hechos} ${hechos === 1 ? "archivo subido" : "archivos subidos"}.` });
    router.push(`?mes=${mes}`);
    router.refresh();
  };

  return (
    <form onSubmit={subir} className="tarea-form subir-docs" style={{ margin: 0 }}>
      {estado.error && <p className="error" role="alert">{estado.error}</p>}
      {estado.ok && <p className="aviso-ok" role="status" style={{ margin: 0 }}>{estado.ok}</p>}
      <div className="campos" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="campo">
          <label htmlFor="d-cat">Tipo de documento</label>
          <select id="d-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
          {categoria === "Otro" && <input value={otra} onChange={(e) => setOtra(e.target.value)} placeholder="¿Qué documento es?" aria-label="Nombre del documento" />}
        </div>
        <div className="campo">
          <label htmlFor="d-mes">Mes al que corresponde</label>
          <input id="d-mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} required />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="d-arch">Archivos <small>(PDF, imagen, Word o Excel; máx. 25 MB cada uno)</small></label>
        <input ref={input} id="d-arch" type="file" multiple
          accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.xml,.zip"
          onChange={(e) => setArchivos(Array.from(e.target.files ?? []))} />
        {archivos.length > 0 && <span className="aviso">{archivos.map((a) => `${a.name} (${tamano(a.size)})`).join(", ")}</span>}
      </div>
      <div className="campo">
        <label htmlFor="d-notas">Notas <small>(opcional)</small></label>
        <input id="d-notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Emitida el 01/12/2026, positiva" />
      </div>
      <div className="acciones" style={{ marginTop: 0 }}>
        <button className="boton bronce" disabled={!!estado.subiendo}>{estado.subiendo ?? "Subir documentos"}</button>
      </div>
    </form>
  );
}
