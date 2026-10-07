import { describe, expect, it, vi } from "vitest";
import {
  EstimateRouter,
  GooglePlacesFinder,
  OverpassFinder,
  PostcodesIo,
  calculateProximity,
  estimateWalk,
  haversine,
  polygonHectares,
  restaurantClusters,
  type PlaceFinder,
} from "../src";

const home = { lat: 51.4651, lng: -0.1698 };
// ~111 m per 0.001 deg of latitude
const north = (m: number) => ({ lat: home.lat + m / 111_195, lng: home.lng });

describe("geometry", () => {
  it("haversine is close to known distances", () => {
    expect(haversine(home, north(1000))).toBeGreaterThan(995);
    expect(haversine(home, north(1000))).toBeLessThan(1005);
  });
  it("computes polygon area in hectares", () => {
    const side = 100; // metres => 1 ha
    const sq = [home, north(side), { lat: north(side).lat, lng: home.lng + side / (111_195 * Math.cos((home.lat * Math.PI) / 180)) }, { lat: home.lat, lng: home.lng + side / (111_195 * Math.cos((home.lat * Math.PI) / 180)) }];
    expect(polygonHectares(sq)).toBeGreaterThan(0.98);
    expect(polygonHectares(sq)).toBeLessThan(1.02);
  });
  it("estimates a walk at 80 m a minute with a detour factor", () => {
    const w = estimateWalk(home, north(800));
    expect(w.method).toBe("estimated");
    expect(w.minutes).toBe(13);
  });
});

describe("PostcodesIo", () => {
  it("geocodes a full postcode as exact and an outcode as approximate", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ result: { latitude: 51.5, longitude: -0.2 } })));
    const g = new PostcodesIo(f as never);
    expect(await g.geocode("sw11 6hg")).toEqual({ lat: 51.5, lng: -0.2, precision: "exact" });
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain("/postcodes/SW11%206HG");
    expect((await g.geocode("SW12"))?.precision).toBe("approximate");
    expect((f.mock.calls[1] as unknown as [string])[0]).toContain("/outcodes/SW12");
  });
  it("returns null when not found", async () => {
    const g = new PostcodesIo((async () => new Response("", { status: 404 })) as never);
    expect(await g.geocode("ZZ99 9ZZ")).toBeNull();
  });
});

describe("OverpassFinder parks", () => {
  const ring = (side: number) => {
    const lngStep = side / (111_195 * Math.cos((home.lat * Math.PI) / 180));
    const a = north(300);
    return [
      { lat: a.lat, lon: home.lng },
      { lat: north(300 + side).lat, lon: home.lng },
      { lat: north(300 + side).lat, lon: home.lng + lngStep },
      { lat: a.lat, lon: home.lng + lngStep },
    ];
  };
  it("keeps parks of 1 hectare or more and drops small squares", async () => {
    const f = vi.fn(async () =>
      new Response(
        JSON.stringify({
          elements: [
            { type: "way", tags: { name: "Wandsworth Common" }, geometry: ring(200) },
            { type: "way", tags: { name: "Tiny Square" }, geometry: ring(40) },
          ],
        }),
      ),
    );
    const places = await new OverpassFinder(f as never).find("park", home, 2000);
    expect(places.map((p) => p.name)).toEqual(["Wandsworth Common"]);
    expect(places[0].hectares).toBeGreaterThan(3.5);
  });
});

describe("GooglePlacesFinder", () => {
  const body = (names: string[]) =>
    JSON.stringify({ places: names.map((n, i) => ({ displayName: { text: n }, location: { latitude: home.lat + i * 0.001, longitude: home.lng } })) });

  it("keeps full-size brand supermarkets and records convenience formats separately", async () => {
    const f = vi.fn(async () => new Response(body(["Sainsbury's", "Tesco Express", "Costcutter", "Waitrose & Partners"])));
    const g = new GooglePlacesFinder("k", f as never);
    expect((await g.find("supermarket", home, 2000)).map((p) => p.name)).toEqual(["Sainsbury's", "Waitrose & Partners"]);
    expect((await g.find("convenience", home, 2000)).map((p) => p.name)).toEqual(["Tesco Express", "Costcutter"]);
    const init = (f.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1];
    expect(init.headers["x-goog-api-key"]).toBe("k");
  });
});

describe("restaurant clusters (FR-L4)", () => {
  it("ignores a lone takeaway", () => {
    const lone = [{ name: "Chippy", ...north(200) }];
    expect(restaurantClusters(lone, { minCount: 5, withinM: 300 })).toEqual([]);
  });
  it("keeps places that sit in a cluster of 5 within 300 m", () => {
    const cluster = Array.from({ length: 5 }, (_, i) => ({ name: `R${i}`, ...north(500 + i * 40) }));
    const far = { name: "Far", ...north(1800) };
    expect(restaurantClusters([...cluster, far], { minCount: 5, withinM: 300 }).map((p) => p.name)).toEqual(["R0", "R1", "R2", "R3", "R4"]);
  });
});

describe("calculateProximity", () => {
  const fixed = (places: Record<string, Array<{ name: string; m: number }>>): PlaceFinder => ({
    async find(category) {
      return (places[category] ?? []).map((p) => ({ name: p.name, ...north(p.m) }));
    },
  });

  it("keeps the shortest walk, not the shortest straight line", async () => {
    const router = {
      async walk(_f: unknown, to: Array<{ lat: number }>) {
        // The straight-line nearest candidate needs a long detour.
        return to.map((_t, i) => ({ minutes: i === 0 ? 20 : 8, metres: 600, method: "routed" as const }));
      },
    };
    const out = await calculateProximity(
      { lat: home.lat, lng: home.lng },
      {
        geocoder: { geocode: async () => null },
        places: [{ categories: ["station"], finder: fixed({ station: [{ name: "Near but cut off", m: 300 }, { name: "Clapham Junction", m: 700 }] }) }],
        router,
      },
    );
    const st = out!.rows.find((r) => r.category === "station")!;
    expect(st.place_name).toBe("Clapham Junction");
    expect(st.walk_min).toBe(8);
    expect(out!.unresolved).toContain("park");
  });

  it("geocodes the postcode when there are no coordinates and reports provider failures as unresolved", async () => {
    const geocoder = { geocode: vi.fn(async () => ({ ...home, precision: "approximate" as const })) };
    const broken: PlaceFinder = { find: async () => { throw new Error("boom"); } };
    const out = await calculateProximity(
      { postcode: "SW11" },
      { geocoder, places: [{ categories: ["station"], finder: fixed({ station: [{ name: "X", m: 400 }] }) }, { categories: ["gym"], finder: broken }], router: new EstimateRouter() },
    );
    expect(geocoder.geocode).toHaveBeenCalledWith("SW11");
    expect(out!.origin.precision).toBe("approximate");
    expect(out!.rows.map((r) => r.category)).toEqual(["station"]);
    expect(out!.unresolved).toContain("gym");
  });

  it("returns null when the location cannot be found", async () => {
    expect(await calculateProximity({ postcode: "ZZ9" }, { geocoder: { geocode: async () => null }, places: [], router: new EstimateRouter() })).toBeNull();
  });
});
