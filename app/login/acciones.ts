"use server";
import { redirect } from "next/navigation";
import { supabaseServidor } from "@/lib/supabase/server";

export async function entrar(form: FormData) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) redirect("/login?error=config");
  const sb = await supabaseServidor();
  const { error } = await sb.auth.signInWithPassword({
    email: String(form.get("email")).trim().toLowerCase(),
    password: String(form.get("password")),
  });
  if (error) {
    const conocidos = ["invalid_credentials", "email_not_confirmed", "user_banned", "over_request_rate_limit"];
    const codigo = error.code && conocidos.includes(error.code) ? error.code : "otro";
    const detalle = codigo === "otro" ? `&detalle=${encodeURIComponent(`${error.status ?? ""} ${error.code ?? ""} ${error.message}`.trim())}` : "";
    redirect(`/login?error=${codigo}${detalle}`);
  }
  redirect("/");
}

export async function salir() {
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  redirect("/login");
}
