const hits = new Map<string, number[]>();

/** Small in-memory limiter: enough to stop accidental loops; not a security boundary. */
export function limited(key: string, max = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return arr.length > max;
}

export const clientKey = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
