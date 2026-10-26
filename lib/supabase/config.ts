// Toma solo el origen de la dirección de Supabase (https://xxxx.supabase.co),
// aunque en Vercel se haya pegado con /rest/v1/ u otra ruta al final.
export function urlSupabase(): string {
  const cruda = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  try {
    return new URL(cruda).origin;
  } catch {
    return cruda;
  }
}

export function llaveSupabase(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}
