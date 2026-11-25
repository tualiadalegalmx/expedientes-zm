import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { puedeCotizar, type Empresa } from "@/lib/cotizacion";
import { EmpresaForm } from "@/components/EmpresaForm";

export const metadata = { title: "Empresas" };

export default async function Empresas({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { sb, perfil } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const { ok } = await searchParams;
  const { data, error } = await sb.from("empresas").select("*").order("nombre");
  const empresas = (data ?? []) as Empresa[];
  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Empresas que cotizan</h1>
          <p className="sub">Sus datos aparecen en el encabezado de cada cotización, en Excel y en PDF.</p>
        </div>
        <Link className="boton secundario" href="/cotizaciones">Volver a cotizaciones</Link>
      </div>
      {error && <p className="error">El generador todavía no está habilitado en la base de datos. Corre la migración 010 en Supabase.</p>}
      {ok && <p className="aviso-ok" role="status">Empresa guardada.</p>}
      <div className="tableros">
        <section className="hoja tablero">
          <header className="tablero-cabeza"><h2>Nueva empresa</h2></header>
          <div style={{ padding: "16px 20px 0" }}><EmpresaForm /></div>
        </section>
        {empresas.map((e) => (
          <details key={e.id} className="hoja tablero empresa-det">
            <summary className="tablero-cabeza" style={{ background: e.color }}>
              <h2>{e.nombre}</h2>
              <span className="aviso">{e.prefijo}-0001{!e.activa && " · oculta"}</span>
            </summary>
            <div style={{ padding: "16px 20px 0" }}><EmpresaForm empresa={e} /></div>
          </details>
        ))}
      </div>
    </>
  );
}
