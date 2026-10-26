import { urlSupabase, llaveSupabase } from "@/lib/supabase/config";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient(
    urlSupabase(),
    llaveSupabase(),
    {
      cookies: {
        getAll: () => almacen.getAll(),
        setAll: (lista) => {
          try {
            lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: el proxy refresca la sesión.
          }
        },
      },
    },
  );
}

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "abogado" | "administrativo" | "desarrollo";
};

/** Usuario actual con su perfil; manda a /login si no hay sesión. */
export const usuarioActual = cache(async () => {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: perfil } = await sb.from("perfiles").select("*").eq("id", data.user.id).single();
  if (!perfil) redirect("/login?error=sin-perfil");
  return { sb, perfil: perfil as Perfil, esAdmin: perfil.rol === "admin" };
});
