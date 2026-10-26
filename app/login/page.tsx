import { entrar } from "./acciones";

export const metadata = { title: "Entrar" };

const ERRORES: Record<string, string> = {
  credenciales: "El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.",
  enlace: "El enlace ya expiró o ya se usó. Pide a Ricardo uno nuevo.",
  "sin-perfil": "Tu cuenta existe pero no tiene perfil en la app. Pide a Ricardo que la revise.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="entrada">
      <form action={entrar} className="hoja">
        <div className="firma">
          <b>Zaida Marmen</b>
          <span>Tu aliada legal</span>
        </div>
        {error && <p className="error">{ERRORES[error] ?? "No se pudo entrar. Intenta de nuevo."}</p>}
        <div className="campo">
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="campo" style={{ marginTop: 14 }}>
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="boton" style={{ width: "100%", marginTop: 22 }}>Entrar</button>
      </form>
    </div>
  );
}
