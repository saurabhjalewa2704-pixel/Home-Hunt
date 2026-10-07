"use client";
import { activeConfig } from "./derive";
import { store } from "./store";
import type { Property, ProximityCategory } from "./types";

export interface ProximityResponse {
  origin: { lat: number; lng: number; precision: "exact" | "approximate" };
  rows: Array<{ category: ProximityCategory; place_name: string; place_lat: number; place_lng: number; walk_min: number; walk_m: number; method: "routed" | "estimated" }>;
  unresolved: ProximityCategory[];
  approximate: boolean;
}

/**
 * Calculate walking times for a saved home and store them. Manual overrides
 * are kept unless `reset` is true (FR-L5, FR-L6). Returns what could not be
 * worked out so the page can ask for those by hand.
 */
export async function refreshProximity(p: Property, reset = false): Promise<{ ok: boolean; unresolved: ProximityCategory[]; message?: string }> {
  try {
    const res = await fetch("/api/proximity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat: p.lat, lng: p.lng, postcode: p.postcode, parkMinHectares: activeConfig(store.getState().data).config.parkMinHectares }),
    });
    const body = (await res.json()) as ProximityResponse & { error?: string };
    if (!res.ok) return { ok: false, unresolved: [], message: body.error ?? "Couldn't work out walking times." };
    await store.applyProximity(p.id, body.rows, reset);
    // Keep coordinates, and say plainly when only a partial postcode was available (FR-L7).
    await store.saveProperty({ ...p, lat: p.lat ?? body.origin.lat, lng: p.lng ?? body.origin.lng, address_precision: body.approximate ? "approximate" : p.address_precision });
    return { ok: true, unresolved: body.unresolved };
  } catch {
    return { ok: false, unresolved: [], message: "You seem to be offline. Walking times will need a connection." };
  }
}
