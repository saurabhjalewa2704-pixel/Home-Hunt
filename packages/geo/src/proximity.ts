import { haversine, nearest } from "./geometry";
import {
  CATEGORIES,
  DEFAULT_GEO_CONFIG,
  type GeoConfig,
  type Geocoded,
  type Geocoder,
  type LatLng,
  type Place,
  type PlaceFinder,
  type ProximityCategory,
  type ProximityRow,
  type WalkRouter,
} from "./types";

/**
 * Restaurants count only at a cluster: the nearest point that has at least
 * `minCount` restaurants or cafes within `withinM` of each other, so a lone
 * takeaway does not count (FR-L4).
 */
export function restaurantClusters(places: Place[], cfg: GeoConfig["restaurantCluster"]): Place[] {
  return places.filter((p) => places.filter((q) => haversine(p, q) <= cfg.withinM).length >= cfg.minCount);
}

export interface ProximityDeps {
  geocoder: Geocoder;
  places: Array<{ categories: ProximityCategory[]; finder: PlaceFinder }>;
  router: WalkRouter;
  config?: GeoConfig;
}

export interface ProximityOutcome {
  origin: Geocoded;
  rows: ProximityRow[];
  /** Categories where a provider failed or nothing was in range, so the UI can ask for a manual entry. */
  unresolved: ProximityCategory[];
}

/**
 * Walking time to the nearest place in each category. The shortest routed
 * walk of the closest few candidates is kept, not the shortest straight line
 * (PRD 9.3).
 */
export async function calculateProximity(
  input: { lat?: number | null; lng?: number | null; postcode?: string | null },
  deps: ProximityDeps,
): Promise<ProximityOutcome | null> {
  const cfg = deps.config ?? DEFAULT_GEO_CONFIG;
  let origin: Geocoded | null = null;
  if (typeof input.lat === "number" && typeof input.lng === "number") origin = { lat: input.lat, lng: input.lng, precision: "exact" };
  else if (input.postcode) origin = await deps.geocoder.geocode(input.postcode);
  if (!origin) return null;

  const rows: ProximityRow[] = [];
  const unresolved: ProximityCategory[] = [];
  const from: LatLng = origin;

  await Promise.all(
    CATEGORIES.map(async (category) => {
      const finder = deps.places.find((p) => p.categories.includes(category))?.finder;
      if (!finder) return void unresolved.push(category);
      try {
        let candidates = await finder.find(category, from, cfg.radiusM);
        if (category === "restaurants") candidates = restaurantClusters(candidates, cfg.restaurantCluster);
        const top = nearest(from, candidates, cfg.candidatesPerCategory);
        if (!top.length) return void unresolved.push(category);
        const walks = await deps.router.walk(from, top);
        let best = 0;
        walks.forEach((w, i) => {
          if (w.minutes < walks[best].minutes) best = i;
        });
        rows.push({
          category,
          place_name: top[best].name,
          place_lat: top[best].lat,
          place_lng: top[best].lng,
          walk_min: walks[best].minutes,
          walk_m: walks[best].metres,
          method: walks[best].method,
        });
      } catch {
        unresolved.push(category);
      }
    }),
  );
  rows.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
  return { origin, rows, unresolved };
}
