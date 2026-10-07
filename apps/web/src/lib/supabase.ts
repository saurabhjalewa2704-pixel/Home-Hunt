import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const hasSupabase = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
/** Browser client. There is no sign-in, so no session is kept. */
export function supabaseBrowser(): SupabaseClient {
  if (!hasSupabase) throw new Error("Supabase is not configured");
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
