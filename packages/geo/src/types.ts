export type ProximityCategory = "station" | "park" | "supermarket" | "convenience" | "gym" | "restaurants";
export const CATEGORIES: ProximityCategory[] = ["station", "park", "supermarket", "convenience", "gym", "restaurants"];

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  name: string;
  /** Extra data used by filters, for example park area in hectares. */
  hectares?: number;
}

export interface Geocoded extends LatLng {
  /** "exact" for a full postcode, "approximate" for an outward code only. */
  precision: "exact" | "approximate";
}

export interface WalkResult {
  minutes: number;
  metres: number;
  method: "routed" | "estimated";
}

export interface ProximityRow {
  category: ProximityCategory;
  place_name: string;
  place_lat: number;
  place_lng: number;
  walk_min: number;
  walk_m: number;
  method: WalkResult["method"];
}

/** Providers sit behind these interfaces so costs or accuracy can be swapped (PRD 9.3). */
export interface Geocoder {
  geocode(postcode: string): Promise<Geocoded | null>;
}
export interface PlaceFinder {
  find(category: ProximityCategory, near: LatLng, radiusM: number): Promise<Place[]>;
}
export interface WalkRouter {
  walk(from: LatLng, to: LatLng[]): Promise<WalkResult[]>;
}

export interface GeoConfig {
  radiusM: number;
  parkMinHectares: number;
  candidatesPerCategory: number;
  supermarketBrands: string[];
  restaurantCluster: { minCount: number; withinM: number };
}

export const DEFAULT_GEO_CONFIG: GeoConfig = {
  radiusM: 2000,
  parkMinHectares: 1,
  candidatesPerCategory: 3,
  supermarketBrands: ["Tesco", "Sainsbury's", "Waitrose", "Asda", "Morrisons", "Aldi", "Lidl", "M&S Food", "Marks & Spencer", "Co-op", "Iceland"],
  restaurantCluster: { minCount: 5, withinM: 300 },
};
