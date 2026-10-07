import { estimateWalk, haversine, polygonHectares } from "./geometry";
import type { GeoConfig, Geocoded, Geocoder, LatLng, Place, PlaceFinder, ProximityCategory, WalkResult, WalkRouter } from "./types";
import { DEFAULT_GEO_CONFIG } from "./types";

type F = typeof fetch;

/** postcodes.io: free, UK-specific. Falls back to the outward code centroid. */
export class PostcodesIo implements Geocoder {
  constructor(private f: F = fetch) {}
  async geocode(postcode: string): Promise<Geocoded | null> {
    const pc = postcode.trim().toUpperCase();
    const full = /\d[A-Z]{2}$/.test(pc);
    const url = full
      ? `https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`
      : `https://api.postcodes.io/outcodes/${encodeURIComponent(pc.replace(/\s+/g, ""))}`;
    const res = await this.f(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { latitude?: number; longitude?: number } };
    const r = body.result;
    if (!r || typeof r.latitude !== "number" || typeof r.longitude !== "number") return null;
    return { lat: r.latitude, lng: r.longitude, precision: full ? "exact" : "approximate" };
  }
}

interface OverpassElement {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

/** Stations and parks from OpenStreetMap via Overpass; park boundaries allow the 1 ha rule. */
export class OverpassFinder implements PlaceFinder {
  constructor(
    private f: F = fetch,
    private cfg: GeoConfig = DEFAULT_GEO_CONFIG,
    private endpoint = "https://overpass-api.de/api/interpreter",
  ) {}

  private async query(q: string): Promise<OverpassElement[]> {
    const res = await this.f(this.endpoint, { method: "POST", body: new URLSearchParams({ data: q }) });
    if (!res.ok) throw new Error(`Overpass error ${res.status}`);
    return ((await res.json()) as { elements?: OverpassElement[] }).elements ?? [];
  }

  async find(category: ProximityCategory, near: LatLng, radiusM: number): Promise<Place[]> {
    const around = `(around:${radiusM},${near.lat},${near.lng})`;
    if (category === "station") {
      const els = await this.query(
        `[out:json][timeout:20];(node["railway"="station"]${around};node["railway"="halt"]${around};node["station"="subway"]${around};node["station"="light_rail"]${around};);out;`,
      );
      return els.filter((e) => e.lat !== undefined && e.tags?.name).map((e) => ({ name: e.tags!.name, lat: e.lat!, lng: e.lon! }));
    }
    if (category === "park") {
      const els = await this.query(`[out:json][timeout:25];(way["leisure"="park"]${around};relation["leisure"="park"]${around};);out geom;`);
      const out: Place[] = [];
      for (const e of els) {
        const ring = (e.geometry ?? []).map((g) => ({ lat: g.lat, lng: g.lon }));
        if (ring.length < 3 || !e.tags?.name) continue;
        const ha = polygonHectares(ring);
        if (ha < this.cfg.parkMinHectares) continue;
        // Walk to the boundary point closest to the home, a proxy for the nearest entrance.
        const edge = ring.reduce((best, p) => (haversine(near, p) < haversine(near, best) ? p : best));
        out.push({ name: e.tags.name, lat: edge.lat, lng: edge.lng, hectares: ha });
      }
      return out;
    }
    return [];
  }
}

interface GPlace {
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  primaryType?: string;
}

const CONVENIENCE = /\b(express|local|metro|convenience|central|food to go|simply food)\b/i;

/** Supermarkets, gyms and restaurants from Google Places (New) Nearby Search. */
export class GooglePlacesFinder implements PlaceFinder {
  constructor(
    private apiKey: string,
    private f: F = fetch,
    private cfg: GeoConfig = DEFAULT_GEO_CONFIG,
  ) {}

  private async nearby(types: string[], near: LatLng, radiusM: number): Promise<GPlace[]> {
    const res = await this.f("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.apiKey,
        "x-goog-fieldmask": "places.displayName,places.location,places.primaryType",
      },
      body: JSON.stringify({
        includedTypes: types,
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: radiusM } },
      }),
    });
    if (!res.ok) throw new Error(`Places error ${res.status}`);
    return ((await res.json()) as { places?: GPlace[] }).places ?? [];
  }

  private brandMatch(name: string) {
    const n = name.toLowerCase();
    return this.cfg.supermarketBrands.some((b) => n.includes(b.toLowerCase()));
  }

  async find(category: ProximityCategory, near: LatLng, radiusM: number): Promise<Place[]> {
    const toPlace = (p: GPlace): Place | null =>
      p.location && p.displayName?.text ? { name: p.displayName.text, lat: p.location.latitude, lng: p.location.longitude } : null;
    const clean = (xs: Array<Place | null>) => xs.filter((x): x is Place => !!x);
    if (category === "supermarket") {
      const ps = clean((await this.nearby(["supermarket", "grocery_store"], near, radiusM)).map(toPlace));
      return ps.filter((p) => this.brandMatch(p.name) && !CONVENIENCE.test(p.name));
    }
    if (category === "convenience") {
      const ps = clean((await this.nearby(["convenience_store", "supermarket", "grocery_store"], near, radiusM)).map(toPlace));
      return ps.filter((p) => CONVENIENCE.test(p.name) || !this.brandMatch(p.name));
    }
    if (category === "gym") return clean((await this.nearby(["gym", "fitness_center"], near, radiusM)).map(toPlace));
    if (category === "restaurants") return clean((await this.nearby(["restaurant", "cafe"], near, radiusM)).map(toPlace));
    return [];
  }
}

/** Google Routes in walking mode (default router). */
export class GoogleWalkRouter implements WalkRouter {
  constructor(
    private apiKey: string,
    private f: F = fetch,
  ) {}
  async walk(from: LatLng, to: LatLng[]): Promise<WalkResult[]> {
    return Promise.all(
      to.map(async (t) => {
        const res = await this.f("https://routes.googleapis.com/directions/v2:computeRoutes", {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey, "x-goog-fieldmask": "routes.duration,routes.distanceMeters" },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
            destination: { location: { latLng: { latitude: t.lat, longitude: t.lng } } },
            travelMode: "WALK",
          }),
        });
        if (!res.ok) return estimateWalk(from, t);
        const r = ((await res.json()) as { routes?: Array<{ duration?: string; distanceMeters?: number }> }).routes?.[0];
        if (!r?.duration) return estimateWalk(from, t);
        const seconds = Number.parseInt(r.duration, 10);
        return { minutes: Math.max(1, Math.round(seconds / 60)), metres: r.distanceMeters ?? 0, method: "routed" as const };
      }),
    );
  }
}

/** OpenRouteService foot-walking: the configurable free alternative. */
export class OrsWalkRouter implements WalkRouter {
  constructor(
    private apiKey: string,
    private f: F = fetch,
  ) {}
  async walk(from: LatLng, to: LatLng[]): Promise<WalkResult[]> {
    return Promise.all(
      to.map(async (t) => {
        const res = await this.f("https://api.openrouteservice.org/v2/directions/foot-walking", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: this.apiKey },
          body: JSON.stringify({ coordinates: [[from.lng, from.lat], [t.lng, t.lat]] }),
        });
        if (!res.ok) return estimateWalk(from, t);
        const s = ((await res.json()) as { routes?: Array<{ summary?: { duration: number; distance: number } }> }).routes?.[0]?.summary;
        if (!s) return estimateWalk(from, t);
        return { minutes: Math.max(1, Math.round(s.duration / 60)), metres: Math.round(s.distance), method: "routed" as const };
      }),
    );
  }
}

/** Used when no routing key is configured: always an estimate, and labelled as one. */
export class EstimateRouter implements WalkRouter {
  async walk(from: LatLng, to: LatLng[]): Promise<WalkResult[]> {
    return to.map((t) => estimateWalk(from, t));
  }
}
