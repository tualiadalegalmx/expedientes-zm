import { urlSupabase, llaveSupabase } from "@/lib/supabase/config";
import { createBrowserClient } from "@supabase/ssr";

export const supabaseNavegador = () =>
  createBrowserClient(urlSupabase(), llaveSupabase());
