import { ExpedienteForm } from "@/components/ExpedienteForm";
import { catalogos } from "@/lib/catalogos";
import { usuarioActual } from "@/lib/supabase/server";

export const metadata = { title: "Nuevo expediente" };

export default async function Nuevo() {
  const { sb, perfil, esAdmin } = await usuarioActual();
  const c = await catalogos(sb);
  return (
    <>
      <div className="encabezado"><h1>Nuevo expediente</h1></div>
      <ExpedienteForm {...c} esAdmin={esAdmin} usuarioId={perfil.id} />
    </>
  );
}
