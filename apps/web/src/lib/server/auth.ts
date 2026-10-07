import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hasSupabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "../supabase";

export async function serverSupabase() {
  const jar = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list: Array<{ name: string; value: string; options: CookieOptions }>) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* called from a context that cannot set cookies */
        }
      },
    },
  });
}

/** Service-role client for storage writes. Never imported by client code. */
export function serviceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** In Supabase mode every API call needs a signed-in household member. Demo mode needs nothing. */
export async function requireMember(): Promise<{ ok: true; householdId: string | null } | { ok: false }> {
  if (!hasSupabase) return { ok: true, householdId: null };
  const sb = await serverSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { ok: false };
  const m = await sb.from("members").select("household_id").eq("user_id", data.user.id).limit(1).maybeSingle();
  return m.data ? { ok: true, householdId: m.data.household_id as string } : { ok: false };
}
