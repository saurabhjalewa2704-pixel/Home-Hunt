import type { LatLng } from "./types";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Area of a small polygon in hectares (equirectangular projection; fine at park scale). */
export function polygonHectares(ring: LatLng[]): number {
  if (ring.length < 3) return 0;
  const lat0 = rad(ring.reduce((s, p) => s + p.lat, 0) / ring.length);
  const pts = ring.map((p) => ({ x: rad(p.lng) * R * Math.cos(lat0), y: rad(p.lat) * R }));
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a / 2) / 10_000;
}

export function nearest<T extends LatLng>(from: LatLng, items: T[], n: number): T[] {
  return [...items].sort((a, b) => haversine(from, a) - haversine(from, b)).slice(0, n);
}

/** Straight-line walk estimate: 1.3 detour factor at 80 m a minute. Used only when no routing key is set. */
export function estimateWalk(from: LatLng, to: LatLng) {
  const metres = Math.round(haversine(from, to) * 1.3);
  return { metres, minutes: Math.max(1, Math.round(metres / 80)), method: "estimated" as const };
}
