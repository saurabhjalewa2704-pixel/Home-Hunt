import { ImportError, importFromText, importFromUrl } from "@homehunt/importers";
import { NextResponse } from "next/server";
import { householdId } from "@/lib/server/auth";
import { storeCover } from "@/lib/server/images";
import { clientKey, limited } from "@/lib/server/ratelimit";
import { cleanApiKey } from "@/lib/server/screenshots";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/import { url } or { text }
 * Fetches only the single URL the buyer pasted, once, on request. Nothing is
 * saved here: the client shows the preview and saves after review (FR-I6).
 */
export async function POST(req: Request) {
  if (limited(clientKey(req))) return NextResponse.json({ error: { code: "rate", message: "Slow down a little and try again in a minute." } }, { status: 429 });

  let body: { url?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "That request didn't make sense." } }, { status: 400 });
  }

  try {
    // A malformed key just turns AI extraction off here: the structured result still works.
    let apiKey: string | undefined;
    try {
      apiKey = cleanApiKey(process.env.ANTHROPIC_API_KEY);
    } catch {
      apiKey = undefined;
    }
    const ai = apiKey ? { apiKey, model: process.env.ANTHROPIC_MODEL || undefined } : null;
    let result;
    if (typeof body.text === "string" && body.text.trim()) {
      result = importFromText(body.text.slice(0, 60_000));
      if (result.needsAi && ai) {
        const { extractWithClaude, buildResult } = await import("@homehunt/importers");
        const extra = await extractWithClaude(body.text.slice(0, 24_000), ai).catch(() => ({}));
        const merged = { ...extra, ...Object.fromEntries(Object.entries(result.draft).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))) };
        const inferred = Object.keys(extra) as never[];
        result = buildResult(merged, { portal: null, listing_url: null, listing_id: null }, inferred);
      }
    } else if (typeof body.url === "string") {
      result = await importFromUrl(body.url, { ai });
    } else {
      return NextResponse.json({ error: { code: "bad_request", message: "Paste a listing link or the listing text." } }, { status: 400 });
    }
    const first = result.draft.image_urls[0];
    const stored = first ? await storeCover(first, await householdId()) : null;
    return NextResponse.json({ result, cover: stored?.cover ?? null });
  } catch (e) {
    if (e instanceof ImportError) {
      return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.code === "bad_url" || e.code === "unsupported_host" ? 400 : 422 });
    }
    return NextResponse.json({ error: { code: "unknown", message: "Something went wrong reading that listing." } }, { status: 500 });
  }
}
