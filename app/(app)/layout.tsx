import Link from "next/link";
import { Nav } from "@/components/Nav";
import { usuarioActual } from "@/lib/supabase/server";
import { salir } from "@/app/login/acciones";
import { recordatorios } from "@/lib/recordatorios";
import { puedeVerTablero } from "@/lib/despacho";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { perfil } = await usuarioActual();
  const avisos = (await recordatorios()).length;
  return (
    <>
      <header className="barra">
        <Link href="/" className="marca">
          <b>Zaida Marmen</b>
          <span>Tu aliada legal</span>
        </Link>
        <Nav avisos={avisos} tablero={puedeVerTablero(perfil.rol)} />
        <form action={salir} className="usuario">
          <Link href="/contrasena" title="Cambiar mi contraseña" style={{ textDecoration: "none" }}>{perfil.nombre}</Link>
          <button>Salir</button>
        </form>
      </header>
      <main>{children}</main>
    </>
  );
}
