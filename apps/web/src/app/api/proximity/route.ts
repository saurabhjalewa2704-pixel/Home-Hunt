import {
  DEFAULT_GEO_CONFIG,
  EstimateRouter,
  GooglePlacesFinder,
  GoogleWalkRouter,
  OrsWalkRouter,
  OverpassFinder,
  PostcodesIo,
  calculateProximity,
  type PlaceFinder,
  type WalkRouter,
} from "@homehunt/geo";
import { NextResponse } from "next/server";
import { clientKey, limited } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/proximity { lat?, lng?, postcode? }
 * Stations and parks come from OpenStreetMap. Shops, gyms and restaurants come
 * from Google Places when GOOGLE_MAPS_API_KEY is set, else from OpenStreetMap
 * too. Routing uses Google Routes, then OpenRouteService, else an estimate
 * that is labelled as one. All providers sit behind the same interfaces.
 */
export async function POST(req: Request) {
  if (limited(clientKey(req), 20)) return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown; postcode?: unknown; parkMinHectares?: unknown };
  const lat = typeof b.lat === "number" ? b.lat : null;
  const lng = typeof b.lng === "number" ? b.lng : null;
  const postcode = typeof b.postcode === "string" ? b.postcode.slice(0, 12) : null;
  if ((lat === null || lng === null) && !postcode) return NextResponse.json({ error: "Need coordinates or a postcode." }, { status: 400 });

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const minHa = typeof b.parkMinHectares === "number" && b.parkMinHectares > 0 && b.parkMinHectares < 100 ? b.parkMinHectares : DEFAULT_GEO_CONFIG.parkMinHectares;
  const geoCfg = { ...DEFAULT_GEO_CONFIG, parkMinHectares: minHa };
  const osm: PlaceFinder = new OverpassFinder(fetch, geoCfg);
  const places: Array<{ categories: Array<"station" | "park" | "supermarket" | "convenience" | "gym" | "restaurants">; finder: PlaceFinder }> = gKey
    ? [
        { categories: ["station", "park"], finder: osm },
        { categories: ["supermarket", "convenience", "gym", "restaurants"], finder: new GooglePlacesFinder(gKey) },
      ]
    : [{ categories: ["station", "park", "supermarket", "convenience", "gym", "restaurants"], finder: osm }];

  const provider = process.env.ROUTING_PROVIDER;
  const router: WalkRouter =
    (provider === "ors" || (!provider && !gKey)) && process.env.ORS_API_KEY
      ? new OrsWalkRouter(process.env.ORS_API_KEY)
      : gKey && provider !== "ors"
        ? new GoogleWalkRouter(gKey)
        : new EstimateRouter();

  try {
    const out = await calculateProximity({ lat, lng, postcode }, { geocoder: new PostcodesIo(), places, router, config: geoCfg });
    if (!out) return NextResponse.json({ error: "We couldn't find that location." }, { status: 404 });
    return NextResponse.json({ ...out, approximate: out.origin.precision === "approximate" });
  } catch {
    return NextResponse.json({ error: "The map services didn't answer. You can enter walking times by hand." }, { status: 502 });
  }
}
