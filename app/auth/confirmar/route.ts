import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabase/server";

// Enlace de invitación o recuperación: abre sesión y lleva a poner contraseña.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const destino = url.clone();
  destino.search = "";
  if (token_hash && type) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) {
      destino.pathname = "/contrasena";
      return NextResponse.redirect(destino);
    }
  }
  destino.pathname = "/login";
  destino.searchParams.set("error", "enlace");
  return NextResponse.redirect(destino);
}
