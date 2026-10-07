import { NextResponse } from "next/server";
import { householdId, serverSupabase } from "@/lib/server/auth";

export const runtime = "nodejs";

/** Private images are served through short-lived signed URLs, only from this household's folder. */
export async function GET(req: Request) {
  const hid = await householdId();
  if (!hid) return new NextResponse("Not found", { status: 404 });
  const path = new URL(req.url).searchParams.get("path") ?? "";
  const bucket = path.startsWith("photos/") ? "property-photos" : "listing-images";
  const key = path.replace(/^photos\//, "");
  if (!key.startsWith(`${hid}/`) || key.includes("..")) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await serverSupabase().storage.from(bucket).createSignedUrl(key, 300);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "cache-control": "private, max-age=240" } });
}
