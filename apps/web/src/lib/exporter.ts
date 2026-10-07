import { activeConfig, deriveAll, TIER_LABELS } from "./derive";
import type { Data } from "./types";

const q = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** FR-D1: one row per property with scores (CSV), and everything (JSON). */
export function toCsv(data: Data, viewerId: string): string {
  const members = data.members;
  const head = [
    "address", "postcode", "status", "tier", "rank", "combined_score", "provisional",
    ...members.map((m) => `score_${m.display_name.toLowerCase()}`),
    "asking_price", "price_qualifier", "beds", "baths", "floor_area_sqft", "tenure", "lease_years",
    "station_min", "park_min", "supermarket_min", "gym_min", "restaurants_min", "listing_url",
  ];
  const rows = deriveAll(data, viewerId).map((d) => {
    const p = d.property;
    return [
      p.address, p.postcode, p.status, TIER_LABELS[d.tier], d.rank, d.result.combined.toFixed(1), d.provisional,
      ...members.map((m) => (d.result.memberScores[m.id] && !d.provisional ? d.result.memberScores[m.id].score.toFixed(1) : "")),
      p.asking_price, p.price_qualifier, p.beds, p.baths, p.floor_area_sqft, p.tenure, p.lease_years,
      d.minutes.station, d.minutes.park, d.minutes.supermarket, d.minutes.gym, d.minutes.restaurants, p.listing_url,
    ].map(q).join(",");
  });
  return [head.join(","), ...rows].join("\n") + "\n";
}

export function toJson(data: Data): string {
  return JSON.stringify({ exported_at: new Date().toISOString(), scoring: activeConfig(data), ...data }, null, 2);
}
