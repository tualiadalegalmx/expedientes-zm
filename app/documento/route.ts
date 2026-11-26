import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { BUCKET_DOCS } from "@/lib/entidades";

// Ver o descargar un documento de empresa con un enlace temporal (el espacio es privado).
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const descargar = req.nextUrl.searchParams.has("descargar");
  if (!id) return new NextResponse("Falta el documento", { status: 400 });
  const sb = await supabaseServidor();
  const { data: doc } = await sb.from("documentos_entidad").select("ruta, nombre").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("No se encontró el documento o no tienes acceso.", { status: 404 });
  const { data } = await sb.storage.from(BUCKET_DOCS).createSignedUrl(doc.ruta, 600, descargar ? { download: doc.nombre } : undefined);
  if (!data) return new NextResponse("No se pudo abrir el archivo.", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
