import { NextResponse } from "next/server";
import { requireMember, serverSupabase } from "@/lib/server/auth";

export const runtime = "nodejs";

/** Private images are served through short-lived signed URLs, only to household members (PRD 9.5). */
export async function GET(req: Request) {
  const who = await requireMember();
  if (!who.ok || !who.householdId) return new NextResponse("Not found", { status: 404 });
  const path = new URL(req.url).searchParams.get("path") ?? "";
  const bucket = path.startsWith("photos/") ? "property-photos" : "listing-images";
  const key = path.replace(/^photos\//, "");
  // A member may only read their own household's folder.
  if (!key.startsWith(`${who.householdId}/`) || key.includes("..")) return new NextResponse("Not found", { status: 404 });
  const sb = await serverSupabase();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(key, 300);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: { "cache-control": "private, max-age=240" } });
}
