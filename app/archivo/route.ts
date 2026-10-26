import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Abre un adjunto con un enlace temporal de 10 minutos (el bucket es privado).
export async function GET(req: NextRequest) {
  const ruta = req.nextUrl.searchParams.get("ruta");
  if (!ruta) return new NextResponse("Falta el archivo", { status: 400 });
  const sb = await supabaseServidor();
  const { data } = await sb.storage.from("adjuntos").createSignedUrl(ruta, 600);
  if (!data) return new NextResponse("No se encontró el archivo o no tienes acceso.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
