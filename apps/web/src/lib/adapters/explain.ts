/**
 * Turn whatever a failed load threw into a plain sentence saying what to do.
 * Supabase errors are plain objects ({ message, code, status }), not Error instances.
 */
export function explainLoadError(e: unknown): string {
  const o = (e && typeof e === "object" ? e : {}) as { message?: unknown; code?: unknown; status?: unknown; hint?: unknown; name?: unknown };
  const msg = typeof o.message === "string" ? o.message : typeof e === "string" ? e : "";
  const code = typeof o.code === "string" ? o.code : "";
  const status = typeof o.status === "number" ? o.status : 0;

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg) || (e instanceof TypeError && !code)) {
    return "Couldn't reach the database. Check your connection, and that NEXT_PUBLIC_SUPABASE_URL is the right project URL.";
  }
  if (code === "42P01" || code === "PGRST205" || /could not find the table|relation .* does not exist|schema cache/i.test(msg)) {
    return "The database tables don't exist yet. Run supabase/migrations/0001_init.sql in the Supabase SQL editor, then reload.";
  }
  if (status === 401 || /invalid api key|jwt|no api key/i.test(msg)) {
    return "Supabase rejected the key. Check NEXT_PUBLIC_SUPABASE_ANON_KEY is the project's anon (public) key, then redeploy.";
  }
  if (code === "42501" || status === 403 || /row-level security|permission denied/i.test(msg)) {
    return "The database blocked the request. Re-run supabase/migrations/0001_init.sql so the access policies exist.";
  }
  return `Couldn't load your data${msg ? `: ${msg}` : ""}.`;
}

/** True when the failure looks like having no connection, so a cached copy is worth using. */
export function looksOffline(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg) || (e instanceof TypeError && !(e as { code?: unknown }).code);
}
