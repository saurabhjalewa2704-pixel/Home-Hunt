import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/server/auth";

/** Magic-link landing: swap the one-time code for a session, then open the board. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await serverSupabase();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
