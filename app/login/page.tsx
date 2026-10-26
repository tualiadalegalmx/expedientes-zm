import { entrar } from "./acciones";
import { SesionDesdeEnlace } from "@/components/SesionDesdeEnlace";

export const metadata = { title: "Entrar" };

const ERRORES: Record<string, string> = {
  credenciales: "El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.",
  invalid_credentials: "El correo o la contraseña no coinciden. Revísalos e intenta de nuevo (cuidado con mayúsculas y espacios).",
  email_not_confirmed: "Tu cuenta existe pero no está confirmada. En Supabase hay que crearla con la casilla Auto Confirm User marcada.",
  user_banned: "Esta cuenta está desactivada.",
  over_request_rate_limit: "Demasiados intentos seguidos. Espera unos minutos e intenta de nuevo.",
  config: "La página no tiene configuradas las llaves de Supabase en Vercel.",
  enlace: "El enlace ya expiró o ya se usó. Pide a Ricardo uno nuevo.",
  "sin-perfil": "Tu cuenta existe pero no tiene perfil en la app. Pide a Ricardo que la revise.",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; detalle?: string }> }) {
  const { error, detalle } = await searchParams;
  return (
    <div className="entrada">
      <form action={entrar} className="hoja">
        <div className="firma">
          <b>Zaida Marmen</b>
          <span>Tu aliada legal</span>
        </div>
        <SesionDesdeEnlace />
        {error && <p className="error">{ERRORES[error] ?? "No se pudo conectar con el sistema de usuarios."}{detalle && <><br /><small>Detalle técnico: {detalle}</small></>}</p>}
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
