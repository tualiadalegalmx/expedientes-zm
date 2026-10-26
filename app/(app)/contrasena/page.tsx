import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/supabase/server";

export const metadata = { title: "Contraseña" };

async function guardar(form: FormData) {
  "use server";
  const { sb } = await usuarioActual();
  const a = String(form.get("password")), b = String(form.get("confirmar"));
  if (a.length < 10) redirect("/contrasena?error=corta");
  if (a !== b) redirect("/contrasena?error=distintas");
  const { error } = await sb.auth.updateUser({ password: a });
  if (error) redirect("/contrasena?error=otro");
  redirect("/?bienvenida=1");
}

const ERR: Record<string, string> = {
  corta: "La contraseña necesita al menos 10 caracteres.",
  distintas: "Las dos contraseñas no coinciden.",
  otro: "No se pudo guardar. Intenta con otra contraseña.",
};

export default async function Contrasena({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { perfil } = await usuarioActual();
  const { error } = await searchParams;
  return (
    <form action={guardar} className="hoja" style={{ maxWidth: 460 }}>
      <h1>Tu contraseña</h1>
      <p className="sub">Hola, {perfil.nombre}. Elige la contraseña con la que vas a entrar.</p>
      {error && <p className="error">{ERR[error]}</p>}
      <div className="campo" style={{ marginTop: 16 }}>
        <label htmlFor="password">Nueva contraseña <small>(mínimo 10 caracteres)</small></label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </div>
      <div className="campo" style={{ marginTop: 12 }}>
        <label htmlFor="confirmar">Repite la contraseña</label>
        <input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required />
      </div>
      <div className="acciones"><button className="boton">Guardar contraseña</button></div>
    </form>
  );
}
