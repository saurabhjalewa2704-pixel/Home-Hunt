import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, rankHomes, score, type RankItem } from "../src";
import { assessA, assessB, prosConsA, worked, workedInput } from "./fixtures";

function item(id: string, over: Partial<RankItem> & { combined?: number; tier?: any; provisional?: boolean; price?: number } = {}): RankItem {
  const base = score(workedInput());
  return {
    id,
    stationMinutes: 9,
    lastViewingAt: 1,
    ...over,
    result: {
      ...base,
      combined: over.combined ?? 75,
      tier: over.tier ?? "strong",
      provisional: over.provisional ?? false,
      effectivePrice: over.price ?? 700_000,
    },
  };
}

describe("ranking", () => {
  it("orders by tier then score and numbers viewed homes across tiers", () => {
    const r = rankHomes(
      [item("b", { combined: 73 }), item("a", { combined: 84, tier: "top_pick" }), item("c", { combined: 60, tier: "maybe" })],
      DEFAULT_CONFIG,
    );
    expect(r.map((x) => [x.id, x.rank])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("breaks ties within 0.5 by station walk, then price, then recency", () => {
    const r = rankHomes(
      [
        item("slow", { combined: 75.2, stationMinutes: 12 }),
        item("near", { combined: 75.0, stationMinutes: 6 }),
        item("dear", { combined: 75.1, stationMinutes: 6, price: 720_000 }),
      ],
      DEFAULT_CONFIG,
    );
    expect(r.map((x) => x.id)).toEqual(["near", "dear", "slow"]);
  });

  it("does not tie-break scores more than 0.5 apart", () => {
    const r = rankHomes([item("far", { combined: 74, stationMinutes: 2 }), item("top", { combined: 75, stationMinutes: 20 })], DEFAULT_CONFIG);
    expect(r.map((x) => x.id)).toEqual(["top", "far"]);
  });

  it("puts pins first within their tier but never across tiers", () => {
    const r = rankHomes(
      [item("low", { combined: 71, pinned: true }), item("high", { combined: 79 }), item("tp", { combined: 82, tier: "top_pick" })],
      DEFAULT_CONFIG,
    );
    expect(r.map((x) => x.id)).toEqual(["tp", "low", "high"]);
  });

  it("lists provisional homes after viewed ones without ranks, and excludes ruled-out homes", () => {
    const r = rankHomes(
      [item("p1", { combined: 79, provisional: true }), item("v", { combined: 60, tier: "maybe" }), item("x", { tier: "ruled_out" })],
      DEFAULT_CONFIG,
    );
    expect(r).toEqual([
      { id: "v", tier: "maybe", rank: 1, provisional: false },
      { id: "p1", tier: "strong", rank: null, provisional: true },
    ]);
  });

  it("is deterministic for real scored inputs", () => {
    const a = score(workedInput());
    const b = score(workedInput({ assessments: [assessA, assessB], prosCons: prosConsA, property: { ...worked.property, askingPrice: 650_000 } }));
    const r = rankHomes(
      [
        { id: "a", result: a, stationMinutes: 9, lastViewingAt: 1 },
        { id: "b", result: b, stationMinutes: 9, lastViewingAt: 2 },
      ],
      DEFAULT_CONFIG,
    );
    expect(r[0].id).toBe("b");
  });
});
