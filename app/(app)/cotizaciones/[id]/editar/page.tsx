import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";
import { puedeCotizar, type Cotizacion, type Empresa } from "@/lib/cotizacion";
import { CotizacionForm } from "@/components/CotizacionForm";

export const metadata = { title: "Editar cotización" };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, perfil } = await usuarioActual();
  if (!puedeCotizar(perfil.rol)) redirect("/");
  const [{ data: cot }, { data: emp }] = await Promise.all([
    sb.from("cotizaciones").select("*").eq("id", id).maybeSingle(),
    sb.from("empresas").select("*").order("nombre"),
  ]);
  if (!cot) notFound();
  return (
    <>
      <div className="encabezado">
        <h1>Editar {cot.folio}</h1>
        <Link className="boton secundario" href={`/cotizaciones/${id}`}>Cancelar</Link>
      </div>
      <CotizacionForm empresas={(emp ?? []) as Empresa[]} cot={cot as Cotizacion} />
    </>
  );
}
