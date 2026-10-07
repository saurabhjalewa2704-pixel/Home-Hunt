import { createClient } from "@supabase/supabase-js";
import { hasSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase";

/** Server-side Supabase client: the service-role key when set, otherwise the public key. */
export function serverSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** The single household's id, used to file images under its folder. Null in demo mode. */
export async function householdId(): Promise<string | null> {
  if (!hasSupabase) return null;
  const { data } = await serverSupabase().from("households").select("id").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Service-role client for writing listing images. Null when the key isn't set. Never imported by client code. */
export function serviceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
