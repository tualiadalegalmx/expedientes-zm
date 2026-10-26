import { notFound } from "next/navigation";
import { ExpedienteForm } from "@/components/ExpedienteForm";
import { catalogos } from "@/lib/catalogos";
import { usuarioActual } from "@/lib/supabase/server";
import { eliminarExpediente } from "../../acciones";

export const metadata = { title: "Editar expediente" };

export default async function Editar({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, perfil, esAdmin } = await usuarioActual();
  const [{ data: exp }, c] = await Promise.all([sb.from("expedientes").select("*").eq("id", id).maybeSingle(), catalogos(sb)]);
  if (!exp) notFound();
  return (
    <>
      <div className="encabezado"><h1>Editar {exp.numero}</h1></div>
      <ExpedienteForm exp={exp} {...c} esAdmin={esAdmin} usuarioId={perfil.id} />
      {esAdmin && (
        <form action={eliminarExpediente} className="hoja" style={{ marginTop: 20 }}>
          <input type="hidden" name="id" value={exp.id} />
          <h2>Eliminar expediente</h2>
          <p className="aviso">Borra el expediente con toda su bitácora y plazos. El historial de cambios conserva una copia. Para dejar de verlo sin borrarlo, cámbialo a Archivado.</p>
          <div className="acciones"><button className="boton secundario" style={{ color: "var(--vencido)" }}>Eliminar definitivamente</button></div>
        </form>
      )}
    </>
  );
}
