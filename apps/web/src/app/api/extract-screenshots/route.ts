import { NextResponse } from "next/server";
import { householdId } from "@/lib/server/auth";
import { storeCoverFromBuffer } from "@/lib/server/images";
import { clientKey, limited } from "@/lib/server/ratelimit";
import { MAX_SCREENSHOTS, MAX_SCREENSHOT_BYTES, ScreenshotError, cropPhoto, normaliseScreenshot, readScreenshots } from "@/lib/server/screenshots";
import { buildResult } from "@homehunt/importers";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (code: string, message: string, status: number) => NextResponse.json({ error: { code, message } }, { status });

/**
 * POST multipart/form-data with `images` (1 to 6 listing screenshots).
 * Claude reads the facts off them and finds the main photo, which is cropped out
 * to become the home's picture. Nothing is saved here: the buyer reviews first (FR-I6).
 */
export async function POST(req: Request) {
  if (limited(clientKey(req), 10)) return fail("rate", "Slow down a little and try again in a minute.", 429);

  let files: File[];
  try {
    const form = await req.formData();
    files = form.getAll("images").filter((f): f is File => typeof f !== "string");
  } catch {
    return fail("bad_request", "That upload didn't come through. Try again.", 400);
  }
  if (!files.length) return fail("bad_request", "Paste or choose at least one screenshot.", 400);
  if (files.length > MAX_SCREENSHOTS) return fail("too_many", `Use at most ${MAX_SCREENSHOTS} screenshots at a time.`, 400);
  if (files.some((f) => f.size > MAX_SCREENSHOT_BYTES)) return fail("too_big", "One of those screenshots is too large. Try a smaller capture.", 413);

  const images: Buffer[] = [];
  for (const f of files) {
    const norm = await normaliseScreenshot(Buffer.from(await f.arrayBuffer()));
    if (!norm) return fail("bad_image", "One of those files isn't an image we can read.", 400);
    images.push(norm);
  }

  try {
    const read = await readScreenshots(images);
    const cropped = await cropPhoto(images, read.photo).catch(() => null);
    const stored = cropped ? await storeCoverFromBuffer(cropped, await householdId()) : null;
    // Everything read from a picture is flagged "please check": it is the model's reading, not the portal's data.
    const result = buildResult(read.draft, { portal: null, listing_url: null, listing_id: read.draft.listing_id ?? null }, read.fieldsRead);
    return NextResponse.json({ result, cover: stored?.cover ?? null, photoFound: !!cropped, unreadable: read.unreadable });
  } catch (e) {
    if (e instanceof ScreenshotError) {
      const status = e.code === "no_key" ? 501 : e.code === "rate" ? 429 : e.code === "bad_key" ? 502 : 422;
      return fail(e.code, e.message, status);
    }
    return fail("unknown", "Something went wrong reading the screenshots.", 500);
  }
}
