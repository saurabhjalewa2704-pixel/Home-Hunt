import { NextResponse } from "next/server";
import { THIS_BUILD } from "@/lib/update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Any copy of the app may ask the live app what the newest build is, so allow other origins to read this (it holds nothing private).
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET", "Cache-Control": "no-store, max-age=0" };

/** The build this deployment is running. Asked of the live address, it tells an older copy that it is out of date. */
export function GET() {
  return NextResponse.json(THIS_BUILD, { headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "600" } });
}
