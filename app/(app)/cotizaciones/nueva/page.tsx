import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { puedeCotizar, type Empresa } from "@/lib/cotizacion";
import { CotizacionForm } from "@/components/CotizacionForm";

export const metadata = { title: "Nueva cotización" };

export default async function Nueva({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { sb, perfil } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const { empresa } = await searchParams;
  const { data } = await sb.from("empresas").select("*").eq("activa", true).order("nombre");
  const empresas = (data ?? []) as Empresa[];
  return (
    <>
      <div className="encabezado">
        <h1>Nueva cotización</h1>
        <Link className="boton secundario" href="/cotizaciones">Cancelar</Link>
      </div>
      {empresas.length === 0 ? (
        <div className="hoja"><p className="vacio">Primero da de alta al menos una empresa. <Link href="/cotizaciones/empresas">Agregar empresa</Link></p></div>
      ) : (
        <CotizacionForm empresas={empresas} empresaInicial={empresa ? Number(empresa) : undefined} />
      )}
    </>
  );
}
